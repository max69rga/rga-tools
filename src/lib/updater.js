// Mises à jour via les releases GitHub.
// - Version installée (NSIS) : télécharge le setup et le lance en silencieux, puis relance l'application.
// - Version portable : télécharge le nouvel exe et remplace l'ancien après fermeture.
const { app, net } = require('electron');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { TMP, log } = require('./util');

const pkg = require('../../package.json');
const REPO = process.env.RGA_UPDATE_REPO || pkg.updateRepo; // "owner/nom"

// Jeton GitHub en lecture seule, intégré au moment du build (scripts/embed-token.js, fichier non versionné).
function token() {
  if (process.env.RGA_UPDATE_TOKEN) return process.env.RGA_UPDATE_TOKEN;
  try {
    const { t } = require('./update-token.json');
    return t ? Buffer.from(t, 'base64').toString('utf8').split('').reverse().join('') : '';
  } catch { return ''; }
}
const UA = `RGA-Tools/${app.getVersion()}`;

let latest = null;      // dernière release trouvée
let downloaded = null;  // { file, version, kind }

function mode() {
  if (process.env.PORTABLE_EXECUTABLE_FILE) return 'portable';
  if (app.isPackaged) return 'installed';
  return 'dev';
}

// Compare deux versions "x.y.z" (préfixe v toléré). >0 si a > b.
function cmp(a, b) {
  const pa = String(a).replace(/^v/i, '').split(/[.-]/).map(n => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/i, '').split(/[.-]/).map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

function headers(extra = {}) {
  const h = { 'User-Agent': UA, 'Accept': 'application/vnd.github+json', ...extra };
  const t = token();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

function pickAsset(release) {
  const m = mode();
  const re = m === 'portable' ? /portable\.exe$/i : /setup\.exe$/i;
  return (release.assets || []).find(a => re.test(a.name)) || null;
}

async function check() {
  if (!REPO) return { error: 'Aucun dépôt de mises à jour configuré.' };
  const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: headers() });
  if (res.status === 404) return { current: app.getVersion(), available: false, error: token() ? 'Aucune version publiée, ou jeton sans accès au dépôt.' : 'Dépôt privé : jeton de mise à jour absent de ce build.' };
  if (res.status === 401) return { current: app.getVersion(), available: false, error: 'Jeton de mise à jour invalide ou révoqué.' };
  if (!res.ok) return { current: app.getVersion(), available: false, error: `GitHub a répondu ${res.status}` };
  const r = await res.json();
  const version = String(r.tag_name || '').replace(/^v/i, '');
  const asset = pickAsset(r);
  latest = { version, notes: r.body || '', url: r.html_url, publishedAt: r.published_at, asset: asset && { name: asset.name, size: asset.size, url: asset.browser_download_url, apiUrl: asset.url, digest: asset.digest || null } };
  const available = cmp(version, app.getVersion()) > 0;
  return { current: app.getVersion(), mode: mode(), available, ...latest, downloaded: downloaded?.version === version };
}

async function download(onPct) {
  if (!latest?.asset) throw new Error('Aucun fichier de mise à jour adapté à cette version (portable / installée).');
  const a = latest.asset;
  const dest = path.join(TMP, `update-${latest.version}-${a.name}`);
  // Les assets se téléchargent via l'API (fonctionne aussi avec un jeton sur dépôt privé).
  const res = await net.fetch(a.apiUrl, { headers: headers({ Accept: 'application/octet-stream' }) });
  if (!res.ok) throw new Error(`Téléchargement refusé (HTTP ${res.status})`);
  const total = Number(res.headers.get('content-length')) || a.size || 0;
  const out = fs.createWriteStream(dest);
  const hash = crypto.createHash('sha256');
  const reader = res.body.getReader();
  let got = 0, last = -1;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const buf = Buffer.from(value);
      hash.update(buf); got += buf.length;
      if (!out.write(buf)) await new Promise(r => out.once('drain', r));
      const pct = total ? Math.floor((got / total) * 100) : -1;
      if (onPct && pct !== last) { last = pct; onPct(pct); }
    }
  } finally { await new Promise(r => out.end(r)); }
  if (a.size && got !== a.size) { fs.rmSync(dest, { force: true }); throw new Error('Fichier incomplet, réessayez.'); }
  if (a.digest && a.digest.startsWith('sha256:') && a.digest.slice(7) !== hash.digest('hex')) {
    fs.rmSync(dest, { force: true }); throw new Error('Empreinte SHA-256 invalide : fichier corrompu.');
  }
  downloaded = { file: dest, version: latest.version, kind: mode() };
  log(`Mise à jour ${latest.version} téléchargée.`, 'success');
  return downloaded;
}

// Installe la mise à jour téléchargée puis quitte l'application.
function install() {
  if (!downloaded) throw new Error('Aucune mise à jour téléchargée.');
  const { file, kind } = downloaded;
  if (kind === 'installed') {
    // NSIS : /S = silencieux, --force-run = relancer l'application après installation.
    spawn(file, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
  } else if (kind === 'portable') {
    const target = process.env.PORTABLE_EXECUTABLE_FILE;
    const script = path.join(TMP, 'rga-update.cmd');
    fs.writeFileSync(script, [
      '@echo off',
      'setlocal',
      `set "NEW=${file}"`,
      `set "TARGET=${target}"`,
      // Attendre la fermeture de l'application (jusqu'à ~60 s) puis remplacer l'exe.
      'for /l %%i in (1,1,60) do (',
      '  move /y "%NEW%" "%TARGET%" >nul 2>&1 && goto ok',
      '  timeout /t 1 /nobreak >nul',
      ')',
      'exit /b 1',
      ':ok',
      'start "" "%TARGET%"',
      '(goto) 2>nul & del "%~f0"',
      '',
    ].join('\r\n'), 'latin1');
    spawn('cmd.exe', ['/d', '/c', script], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } else {
    throw new Error('Installation automatique indisponible en mode développement.');
  }
  setTimeout(() => app.quit(), 300);
}

module.exports = { check, download, install, mode, cmp, get repo() { return REPO; }, get hasToken() { return !!token(); } };

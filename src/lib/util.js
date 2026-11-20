// Primitives système partagées : commandes, PowerShell, téléchargements.
const { net } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = path.join(os.tmpdir(), 'RGATools');
fs.mkdirSync(TMP, { recursive: true });
const tmpFile = (name) => path.join(TMP, name);
const safeRm = (p) => { try { fs.rmSync(p, { force: true, recursive: true }); } catch {} };

let sink = { log() {}, progress() {}, status() {}, send() {} };
const setSink = (s) => { sink = s; };
const log = (msg, level) => sink.log(msg, level);
const progress = (scope, pct, label) => sink.progress(scope, pct, label);
const status = (scope, text, level) => sink.status(scope, text, level);
const emit = (ch, payload) => sink.send(ch, payload);

// Commande cmd en UTF-8 avec sortie ligne par ligne.
function run(command, { onLine, timeout = 0 } = {}) {
  return new Promise((resolve) => {
    const child = spawn('cmd.exe', ['/d', '/s', '/c', `chcp 65001 >nul & ${command}`], { windowsHide: true, windowsVerbatimArguments: true });
    let out = '', buf = '';
    const feed = (d) => {
      const s = d.toString('utf8'); out += s; buf += s;
      const lines = buf.split(/\r?\n/); buf = lines.pop();
      if (onLine) lines.forEach(l => l.trim() && onLine(l));
    };
    child.stdout.on('data', feed); child.stderr.on('data', feed);
    const timer = timeout ? setTimeout(() => { try { child.kill(); } catch {} }, timeout) : null;
    child.on('close', (code) => { if (timer) clearTimeout(timer); if (onLine && buf.trim()) onLine(buf); resolve({ code: code ?? -1, out }); });
    child.on('error', (e) => resolve({ code: -1, out: String(e) }));
  });
}

// Scripts PowerShell : écrits en clair dans %TEMP%\RGATools\ps (lisibles, nommés selon leur rôle)
// puis exécutés avec -File. Pas de commande encodée : plus transparent pour les antivirus.
const PSDIR = path.join(TMP, 'ps');
const PS_HEADER = [
  '# Script généré par RGA Tools (RGA Informatique) : https://github.com/max69rga/rga-tools',
  "$ProgressPreference = 'SilentlyContinue'",
  "$ErrorActionPreference = 'SilentlyContinue'",
  '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
  '',
].join('\r\n');
function psFile(script, name = 'rga') {
  fs.mkdirSync(PSDIR, { recursive: true });
  const body = PS_HEADER + script.replace(/\r?\n/g, '\r\n');
  const hash = require('crypto').createHash('sha1').update(body).digest('hex').slice(0, 10);
  const file = path.join(PSDIR, `${name.replace(/[^\w-]/g, '_')}-${hash}.ps1`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, '﻿' + body, 'utf8'); // BOM : accents lus par PowerShell 5.1
  return file;
}
const psArgs = (file) => ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', file];

// Exécute un script PowerShell -> texte UTF-8.
function ps(script, { timeout = 120000, name } = {}) {
  const file = psFile(script, name);
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', psArgs(file), { windowsHide: true });
    let out = '', err = '';
    child.stdout.on('data', d => (out += d.toString('utf8')));
    child.stderr.on('data', d => (err += d.toString('utf8')));
    const timer = setTimeout(() => { try { child.kill(); } catch {} }, timeout);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, out, err }); });
    child.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, out: '', err: String(e) }); });
  });
}

// Script PowerShell dont la dernière expression est convertie en JSON.
async function psJson(script, opts) {
  const r = await ps(`$__r = & {
${script}
}
$__r | ConvertTo-Json -Depth 6 -Compress`, opts);
  const txt = r.out.trim();
  if (!txt) return null;
  try { return JSON.parse(txt.replace(/^﻿/, '')); } catch { return null; }
}

function launch(file, args = '') {
  spawn('cmd.exe', ['/d', '/s', '/c', `start "" "${file}" ${args}`], { detached: true, windowsHide: true, windowsVerbatimArguments: true, stdio: 'ignore' }).unref();
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
async function download(url, dest, onPct) {
  const res = await net.fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/octet-stream,*/*', 'Accept-Language': 'fr-FR,fr;q=0.9' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const out = fs.createWriteStream(dest);
  const reader = res.body.getReader();
  let got = 0, last = -2;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      if (!out.write(Buffer.from(value))) await new Promise(r => out.once('drain', r));
      const pct = total ? Math.floor((got / total) * 100) : -1;
      if (onPct && pct !== last) { last = pct; onPct(pct, got, total); }
    }
  } finally { await new Promise(r => out.end(r)); }
  return dest;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = { TMP, tmpFile, psFile, psArgs, safeRm, setSink, log, progress, status, emit, run, ps, psJson, launch, download, sleep };

const { app, BrowserWindow, ipcMain, shell, dialog, nativeTheme, screen, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execSync } = require('child_process');
const C = require('./lib/catalog');
const U = require('./lib/util');
const { run, launch, download, tmpFile, safeRm, log, progress, status } = U;
const monitor = require('./lib/monitor');
const sysinfo = require('./lib/sysinfo');
const diag = require('./lib/diag');
const report = require('./lib/report');
const updater = require('./lib/updater');
const events = require('./lib/events');

app.setAppUserModelId('RGA.Tools');
if (!app.requestSingleInstanceLock()) app.quit();

let win;
const ASSETS = path.join(__dirname, 'renderer', 'assets');

// ───────────────────────── Paramètres ─────────────────────────
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const DEFAULTS = { theme: 'dark', tempLimit: 95, skipGpu: false, autoUpdate: true, overlay: true };
let settings = { ...DEFAULTS };
try { settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) }; } catch {}
const saveSettings = () => { try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 1)); } catch {} };

// ───────────────────────── Fenêtre ─────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 1020, minHeight: 660,
    frame: false, backgroundColor: settings.theme === 'light' ? '#f4f4f5' : '#0e0f11', show: false,
    icon: path.join(ASSETS, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => {
    win.show();
    // Vérification silencieuse des mises à jour au démarrage.
    if (settings.autoUpdate && updater.mode() !== 'dev') setTimeout(async () => {
      try { const r = await updater.check(); if (r.available) { send('update:available', r); log(`Mise à jour disponible : version ${r.version}.`, 'success'); } } catch {}
    }, 4000);
  });
  win.on('maximize', () => send('win:state', { maximized: true }));
  win.on('unmaximize', () => send('win:state', { maximized: false }));
  win.on('closed', () => { hideOverlay(); monitor.stop(); diag.cancelDiag(); });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  if (process.env.RGA_SNAP) snapshots(process.env.RGA_SNAP);
}

// Captures d'écran de chaque page (contrôle visuel en développement).
function snapshots(dir) {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  win.webContents.once('did-finish-load', async () => {
    await wait(2500);
    const pages = (process.env.RGA_SNAP_PAGES || 'home,diag,monitor,config,tools,soft,office,ext,clean,utils,optim,lic,settings').split(',');
    for (const id of pages) {
      await win.webContents.executeJavaScript(`${process.env.RGA_SNAP_THEME ? `applyTheme('${process.env.RGA_SNAP_THEME}');` : ''}go('${id}');${process.env.RGA_SNAP_JS || ''}`);
      await wait(+(process.env.RGA_SNAP_WAIT || 900));
      fs.writeFileSync(path.join(dir, `${id}.png`), (await win.webContents.capturePage()).toPNG());
      if (overlayWin && !overlayWin.isDestroyed()) fs.writeFileSync(path.join(dir, `${id}-overlay.png`), (await overlayWin.webContents.capturePage()).toPNG());
    }
    app.quit();
  });
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

function send(ch, payload) { if (win && !win.isDestroyed()) win.webContents.send(ch, payload); }
U.setSink({
  log: (msg, level = 'info') => send('log', { msg, level, t: Date.now() }),
  progress: (scope, pct, label) => send('progress', { scope, pct, label }),
  status: (scope, text, level = 'info') => send('status', { scope, text, level }),
  send: (ch, p) => { send(ch, p); if (ch === 'diag:tick') overlayTick(p); if (ch === 'diag:step' && p.label) overlayTick({ label: p.label, total: p.seconds || 0, elapsed: 0 }); },
});

function isAdmin() { try { execSync('net session', { stdio: 'ignore' }); return true; } catch { return false; } }

// ───────────────────────── IPC : fenêtre & système ─────────────────────────
ipcMain.handle('win:minimize', () => win.minimize());
ipcMain.handle('win:maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.handle('win:close', () => win.close());

ipcMain.handle('sys:info', () => ({
  admin: isAdmin(), is64: os.arch() === 'x64' || process.env.PROCESSOR_ARCHITEW6432 === 'AMD64',
  host: os.hostname(), release: os.release(), version: app.getVersion(),
  ramGB: Math.round(os.totalmem() / 1073741824), cpu: (os.cpus()[0] || {}).model?.trim() || '', threads: os.cpus().length,
}));
ipcMain.handle('catalog', () => C);
ipcMain.handle('settings:get', () => settings);
ipcMain.handle('settings:set', (_e, patch) => { settings = { ...settings, ...patch }; saveSettings(); return settings; });
ipcMain.handle('open:url', (_e, url) => shell.openExternal(url));
ipcMain.handle('open:path', (_e, p) => shell.openPath(p));
ipcMain.handle('open:settings', (_e, uri) => shell.openExternal(uri));
ipcMain.handle('relaunch:admin', () => {
  const exe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
  const args = app.isPackaged ? '' : ` -ArgumentList '${path.resolve(__dirname, '..').replace(/'/g, "''")}'`;
  spawn('powershell.exe', ['-NoProfile', '-Command', `Start-Process -FilePath '${exe.replace(/'/g, "''")}'${args} -Verb RunAs`], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  setTimeout(() => app.quit(), 400);
});

// ───────────────────────── Journaux Windows ─────────────────────────
ipcMain.handle('events:analyze', async (_e, opts) => {
  log(`Lecture des journaux Windows (${opts.days} jour(s))…`);
  const raw = await events.fetchEvents(opts);
  const res = events.analyze(raw, opts);
  log(`${res.total} événement(s) analysé(s) — ${res.summary}`, res.problems.some(p => p.sev === 'error') ? 'warn' : 'success');
  return res;
});
ipcMain.handle('events:tool', async (_e, tool) => {
  if (tool === 'drivers') return run('start "" devmgmt.msc');
  if (tool === 'eventvwr') return run('start "" eventvwr.msc');
  if (tool === 'wu') return shell.openExternal('ms-settings:troubleshoot');
  if (tool === 'minidump') {
    const dir = path.join(process.env.SystemRoot || 'C:\\Windows', 'Minidump');
    if (fs.existsSync(dir)) return shell.openPath(dir);
    log("Aucun dossier Minidump : Windows n'a pas conservé de fichier de vidage.", 'warn');
    return null;
  }
  if (tool === 'chkdsk') {
    log('> chkdsk C: /scan', 'cmd');
    progress('global', -1, 'Vérification du disque C:');
    const r = await run('chkdsk C: /scan', {
      timeout: 3600000,
      onLine: (l) => { const t = l.replace(/\0/g, '').trim(); if (t && !/^\d+\s*%|Progression|Progress/i.test(t)) log(`   ${t}`, 'dim'); },
    });
    progress('global', 100, 'Terminé');
    log(r.code === 0 ? 'Aucun problème trouvé sur C:.' : `chkdsk terminé (code ${r.code}) : des erreurs peuvent nécessiter « chkdsk C: /f » au redémarrage.`, r.code === 0 ? 'success' : 'warn');
    return r.code;
  }
  return null;
});
ipcMain.handle('events:export', async (_e, groups) => {
  const r = await dialog.showSaveDialog(win, {
    title: "Exporter l'analyse des journaux",
    defaultPath: path.join(app.getPath('desktop'), `Journaux_${os.hostname()}_${new Date().toISOString().slice(0, 10)}.csv`),
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (r.canceled || !r.filePath) return null;
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  const rows = [['Gravité', 'Catégorie', 'Problème', 'Source', 'ID', 'Nombre', 'Premier', 'Dernier', 'Cause', 'Action', 'Exemple']];
  for (const g of groups) rows.push([g.sev, g.cat, g.title, g.provider, g.id, g.count, g.first, g.last, g.cause, g.action, g.samples?.[0]?.m]);
  fs.writeFileSync(r.filePath, '\ufeff' + rows.map(x => x.map(q).join(';')).join('\r\n'), 'utf8');
  log(`Analyse exportée : ${r.filePath}`, 'success');
  return r.filePath;
});

// ───────────────────────── Mises à jour ─────────────────────────
ipcMain.handle('update:check', async () => {
  try { return await updater.check(); } catch (e) { return { current: app.getVersion(), error: e.message }; }
});
ipcMain.handle('update:download', async () => {
  try { await updater.download((pct) => send('update:progress', pct)); return { ok: true }; }
  catch (e) { log(`Mise à jour : ${e.message}`, 'error'); return { error: e.message }; }
});
ipcMain.handle('update:install', () => {
  try { diag.cancelDiag(); updater.install(); return { ok: true }; } catch (e) { return { error: e.message }; }
});
ipcMain.handle('update:info', () => ({ repo: updater.repo, mode: updater.mode(), version: app.getVersion() }));

// ───────────────────────── Overlay ─────────────────────────
let overlayWin = null, offOverlay = null, overlayManual = false;
function showOverlay() {
  if (!overlayWin || overlayWin.isDestroyed()) {
    const { workArea } = screen.getPrimaryDisplay();
    const W = 262, H = 222;
    overlayWin = new BrowserWindow({
      width: W, height: H, x: workArea.x + workArea.width - W - 12, y: workArea.y + 12,
      frame: false, transparent: true, resizable: false, movable: false, focusable: false, skipTaskbar: true, hasShadow: false,
      alwaysOnTop: true, show: false, backgroundColor: '#00000000',
      webPreferences: { preload: path.join(__dirname, 'overlay', 'preload.js'), contextIsolation: true, sandbox: true, backgroundThrottling: false },
    });
    overlayWin.setAlwaysOnTop(true, 'screen-saver');
    overlayWin.setIgnoreMouseEvents(true);
    overlayWin.loadFile(path.join(__dirname, 'overlay', 'overlay.html'));
    overlayWin.once('ready-to-show', () => overlayWin.showInactive());
    overlayWin.on('closed', () => { overlayWin = null; });
  } else overlayWin.showInactive();
  if (!offOverlay) offOverlay = monitor.on((s) => { if (overlayWin && !overlayWin.isDestroyed()) overlayWin.webContents.send('ov:sample', s); });
  send('overlay:state', true);
}
function hideOverlay() {
  if (offOverlay) { offOverlay(); offOverlay = null; }
  if (overlayWin && !overlayWin.isDestroyed()) overlayWin.destroy();
  overlayWin = null;
  if (!monitor.listeners.size) monitor.stop();
  send('overlay:state', false);
}
function overlayTick(t) { if (overlayWin && !overlayWin.isDestroyed()) overlayWin.webContents.send('ov:tick', t); }

ipcMain.handle('overlay:toggle', (_e, on) => { overlayManual = !!on; if (on) { showOverlay(); overlayTick({ label: 'Monitoring' }); } else hideOverlay(); return !!on; });

// Pilote de capteurs PawnIO (requis par LibreHardwareMonitor pour la température du processeur).
async function pawnioStatus() {
  const r = await run('sc query PawnIO');
  if (/RUNNING/i.test(r.out)) return 'running';
  if (/SERVICE_NAME|NOM_SERVICE/i.test(r.out)) return 'stopped';
  return 'missing';
}
ipcMain.handle('sensors:status', async () => ({ admin: isAdmin(), pawnio: await pawnioStatus(), last: monitor.last ? { cpuTemp: monitor.last.cpuTemp, cpuTempSrc: monitor.last.cpuTempSrc, gpuTemp: monitor.last.gpuTemp } : null }));
ipcMain.handle('sensors:installPawnIO', async () => {
  try {
    log('Recherche de la dernière version de PawnIO…');
    const res = await net.fetch('https://api.github.com/repos/namazso/PawnIO.Setup/releases/latest', { headers: { 'User-Agent': 'RGA-Tools', Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`GitHub a répondu ${res.status}`);
    const rel = await res.json();
    const asset = (rel.assets || []).find(a => /PawnIO_setup\.exe$/i.test(a.name));
    if (!asset) throw new Error('Installeur PawnIO introuvable dans la dernière version');
    const file = tmpFile('PawnIO_setup.exe');
    log(`Téléchargement de PawnIO ${rel.tag_name}…`);
    await download(asset.browser_download_url, file, (pct) => progress('global', pct, 'Téléchargement de PawnIO'));
    progress('global', 100, 'PawnIO téléchargé');
    log("Installeur PawnIO lancé : suivez l'assistant, puis redémarrez RGA Tools.", 'success');
    launch(file);
    return true;
  } catch (e) { log(`PawnIO : ${e.message}`, 'error'); return false; }
});



// ───────────────────────── Diagnostic / monitoring / config ─────────────────────────
let offLive = null;
ipcMain.handle('monitor:start', () => { if (!offLive) offLive = monitor.on((s) => send('monitor:sample', s)); return monitor.history.slice(-120); });
ipcMain.handle('monitor:stop', () => { if (offLive) { offLive(); offLive = null; } if (!monitor.listeners.size) monitor.stop(); });

ipcMain.handle('config:get', async () => {
  log('Lecture de la configuration du PC…');
  const [inventory, health] = await Promise.all([sysinfo.getInventory(), sysinfo.getHealth()]);
  log('Configuration lue.', 'success');
  return { inventory, health };
});

ipcMain.handle('diag:profiles', () => Object.fromEntries(Object.entries(diag.PROFILES).map(([k, p]) => [k, { ...p, seconds: diag.stepEstimate(p.steps) }])));
ipcMain.handle('diag:run', async (_e, { profile, note }) => {
  try {
    const stress = profile !== 'config';
    if (stress && settings.overlay) showOverlay();
    let R;
    try { R = await diag.runDiag(profile, { note, tempLimit: settings.tempLimit, skipGpu: settings.skipGpu, version: app.getVersion() }); }
    finally {
      if (stress && settings.overlay && !overlayManual) hideOverlay();
    }
    if (!R) return null;
    R.reportFile = report.save(R, path.join(ASSETS, 'logo-rga.png'));
    log(`Rapport enregistré : ${R.reportFile}`, 'success');
    return R;
  } catch (e) { log(`Erreur diagnostic : ${e.message}`, 'error'); return { error: e.message }; }
});
ipcMain.handle('diag:cancel', () => diag.cancelDiag());
ipcMain.handle('report:save', (_e, R) => report.save(R, path.join(ASSETS, 'logo-rga.png')));
ipcMain.handle('report:list', () => {
  const dir = path.join(app.getPath('desktop'), 'Diagnostics RGA');
  try {
    return fs.readdirSync(dir).filter(f => f.endsWith('.html')).map(f => {
      const p = path.join(dir, f); let meta = {};
      try { const j = JSON.parse(fs.readFileSync(p.replace(/\.html$/, '.json'), 'utf8')); meta = { score: j.score, profileName: j.profileName, host: j.inventory?.host, startedAt: j.startedAt }; } catch {}
      return { file: p, name: f, mtime: fs.statSync(p).mtimeMs, ...meta };
    }).sort((a, b) => b.mtime - a.mtime).slice(0, 20);
  } catch { return []; }
});

// ───────────────────────── Logiciels ─────────────────────────
async function ensureWindowsUpdate() {
  const r = await run('sc query wuauserv');
  if (/STOPPED|ARR[ÊE]T/i.test(r.out)) {
    log('Service Windows Update arrêté — démarrage…', 'warn');
    await run('net start wuauserv'); await run('net start bits');
    log('Service Windows Update redémarré.', 'success');
  }
}

async function installProgram(p, arch) {
  const url = arch === 'x86' ? p.x86 : p.x64;
  const file = tmpFile(`SilentInstall_${p.name.replace(/\s+/g, '_')}_${arch}${p.msi ? '.msi' : '.exe'}`);
  status(`soft:${p.id}`, 'Téléchargement…');
  log(`Téléchargement de ${p.name} (${arch})…`);
  try { await download(url, file, (pct) => progress(`soft:${p.id}`, pct)); }
  catch (e) { log(`Erreur téléchargement ${p.name} : ${e.message}`, 'error'); status(`soft:${p.id}`, 'Échec du téléchargement', 'error'); return false; }
  if (p.uninstallGuid) { log(`Désinstallation de l'ancienne version de ${p.name}…`); await run(`msiexec /x ${p.uninstallGuid} /qn /norestart`, { timeout: 600000 }); }
  status(`soft:${p.id}`, 'Installation…'); progress(`soft:${p.id}`, -1);
  log(`Installation silencieuse de ${p.name}…`);
  const r = await run(p.msi ? `msiexec /i "${file}" ${p.args}` : `"${file}" ${p.args}`, { timeout: 1800000 });
  safeRm(file); progress(`soft:${p.id}`, 100);
  if ([0, 3010, 1641].includes(r.code)) { log(`${p.name} installé avec succès.`, 'success'); status(`soft:${p.id}`, 'Installé', 'success'); return true; }
  log(`${p.name} — code retour : ${r.code}`, 'warn'); status(`soft:${p.id}`, `Code retour ${r.code}`, 'warn'); return false;
}

ipcMain.handle('soft:install', async (_e, items) => {
  await ensureWindowsUpdate();
  let ok = 0;
  for (let i = 0; i < items.length; i++) {
    const p = C.PROGRAMS.find(x => x.id === items[i].id); if (!p) continue;
    progress('global', Math.round((i / items.length) * 100), `${p.name} (${i + 1}/${items.length})`);
    if (await installProgram(p, items[i].arch)) ok++;
  }
  progress('global', 100, 'Terminé');
  log(`Installations terminées : ${ok}/${items.length} réussie(s).`, ok === items.length ? 'success' : 'warn');
  return ok;
});

// ───────────────────────── Office ─────────────────────────
const ODT_STEPS = [['Beginning Office installation', 5], ['Determining install SKU', 10], ['Beginning downloads', 15], ['Downloading file', 25], ['Download complete', 50], ['Beginning installation', 55], ['Applying package', 65], ['Installing Office', 70], ['Registering components', 80], ['Configuring Office', 88], ['Finalizing Office installation', 94], ['Office installation completed', 100]];
const KEY_RE = /^[A-Z0-9]{5}(-[A-Z0-9]{5}){4}$/i;

ipcMain.handle('office:install', async (_e, { id, arch, key, lang }) => {
  const o = C.OFFICE.find(x => x.id === id); if (!o) return false;
  const odtExe = tmpFile('ODT_Setup.exe'), odtDir = tmpFile('ODT');
  fs.mkdirSync(odtDir, { recursive: true });
  try {
    log('Téléchargement de l\'Office Deployment Tool…'); progress('global', 0, 'Téléchargement ODT');
    await download(C.ODT_URL, odtExe, (pct) => progress('global', Math.max(0, Math.round(pct * 0.05)), 'Téléchargement ODT'));
    await run(`"${odtExe}" /quiet /extract:"${odtDir}"`, { timeout: 120000 });
  } catch (e) { log(`Erreur ODT : ${e.message}`, 'error'); return false; }
  const setup = path.join(odtDir, 'setup.exe');
  if (!fs.existsSync(setup)) { log(`setup.exe introuvable dans ${odtDir}`, 'error'); return false; }
  log('Nettoyage des tâches planifiées Office…'); await run('schtasks /delete /tn "\\Microsoft\\Office" /f');
  const bits = arch === 'x86' ? '32' : '64';
  const pid = key && KEY_RE.test(key.trim()) ? ` PIDKEY="${key.trim().toUpperCase()}"` : '';
  const xml = `<Configuration>
  <Add OfficeClientEdition="${bits}" Channel="${o.channel}">
    <Product ID="${o.product}"${pid}>
      <Language ID="${lang || 'fr-fr'}" />
      <ExcludeApp ID="Groove" />
      <ExcludeApp ID="Lync" />
    </Product>
  </Add>
  <RemoveMSI />
  <Updates Enabled="FALSE" />
  <Display Level="None" AcceptEULA="TRUE" />
  <Logging Level="Standard" Path="${odtDir}" />
  <Property Name="AUTOACTIVATE" Value="${pid ? 1 : 0}" />
</Configuration>`;
  const cfg = path.join(odtDir, 'config.xml'); fs.writeFileSync(cfg, xml, 'utf8');
  log(`Installation de ${o.name} Professional Plus (${bits} bits) via ODT…`); log('Cela peut prendre 10 à 30 minutes selon la connexion.');
  const started = Date.now(); let lastPct = 5; const seen = new Set();
  const timer = setInterval(() => {
    try {
      for (const f of fs.readdirSync(odtDir).filter(f => f.endsWith('.log')).map(f => path.join(odtDir, f)).filter(f => fs.statSync(f).mtimeMs >= started - 5000)) {
        const txt = fs.readFileSync(f, 'utf8').toLowerCase();
        for (const [k, pct] of ODT_STEPS) if (!seen.has(k) && txt.includes(k.toLowerCase())) { seen.add(k); if (pct > lastPct) { lastPct = pct; progress('global', pct, k); log(`  ${k}…`); } }
      }
    } catch {}
  }, 1500);
  const r = await run(`"${setup}" /configure "${cfg}"`, { timeout: 3600000 });
  clearInterval(timer);
  if ([0, 3010].includes(r.code)) { progress('global', 100, 'Office installé'); log(`${o.name} Professional Plus installé avec succès.`, 'success'); safeRm(odtExe); return true; }
  log(`${o.name} — code retour : ${r.code}`, 'warn'); progress('global', lastPct, 'Échec'); return false;
});

ipcMain.handle('office:offscrub', async () => {
  const f = tmpFile('SetupProd_OffScrub.exe');
  try {
    log('Téléchargement de l\'outil de désinstallation Microsoft…');
    await download(C.OFFSCRUB_URL, f, (pct) => progress('office:offscrub', pct));
    launch(f); log('Outil lancé — suivez les étapes de l\'assistant.', 'success'); status('office:offscrub', 'Lancé', 'success');
  } catch (e) { log(`Erreur : ${e.message}`, 'error'); status('office:offscrub', 'Erreur', 'error'); }
});

// ───────────────────────── Navigateurs (extensions) ─────────────────────────
ipcMain.handle('browser:open', (_e, { exe, url }) => {
  const env = process.env;
  const roots = {
    'chrome.exe': [[env.LOCALAPPDATA, 'Google/Chrome/Application'], [env.ProgramFiles, 'Google/Chrome/Application'], [env['ProgramFiles(x86)'], 'Google/Chrome/Application']],
    'msedge.exe': [[env.ProgramFiles, 'Microsoft/Edge/Application'], [env['ProgramFiles(x86)'], 'Microsoft/Edge/Application']],
    'firefox.exe': [[env.ProgramFiles, 'Mozilla Firefox'], [env['ProgramFiles(x86)'], 'Mozilla Firefox']],
  }[exe] || [];
  for (const [base, sub] of roots) {
    if (!base) continue;
    const p = path.join(base, sub, exe);
    if (fs.existsSync(p)) { spawn(p, [url], { detached: true, stdio: 'ignore' }).unref(); return 'browser'; }
  }
  shell.openExternal(url); return 'default';
});

// ───────────────────────── Outils (nettoyage / diagnostic tiers) ─────────────────────────
function findFile(dir, name) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) { const f = findFile(p, name); if (f) return f; }
    else if (ent.name.toLowerCase() === name.toLowerCase()) return p;
  }
  return null;
}
ipcMain.handle('tool:run', async (_e, scope, tool) => {
  try {
    if (tool.kind === 'url') { shell.openExternal(tool.url); status(scope, 'Page ouverte dans le navigateur', 'success'); return; }
    if (tool.kind === 'memtest') { launch('mdsched.exe'); status(scope, 'Choisissez de redémarrer maintenant ou au prochain démarrage', 'success'); return; }
    if (tool.kind === 'defender') {
      status(scope, 'Planification…');
      const r = await run('powershell -NoProfile -Command "Start-MpWDOScan"');
      if (r.code === 0) { status(scope, 'Analyse planifiée — le PC va redémarrer', 'success'); log('Analyse Windows Defender Offline planifiée, redémarrage imminent.', 'success'); }
      else { status(scope, `Code retour ${r.code}`, 'warn'); log(r.out.trim(), 'warn'); }
      return;
    }
    const dest = tmpFile(tool.file);
    status(scope, 'Téléchargement…'); log(`Téléchargement de ${tool.name}…`);
    await download(tool.url, dest, (pct) => progress(scope, pct)); progress(scope, 100);
    if (tool.kind === 'zip') {
      const dir = tmpFile(tool.id); safeRm(dir); status(scope, 'Extraction…');
      await run(`powershell -NoProfile -Command "Expand-Archive -Force -LiteralPath '${dest}' -DestinationPath '${dir}'"`);
      const exe = findFile(dir, tool.launch);
      if (exe) { launch(exe); status(scope, 'Extrait et lancé', 'success'); } else { shell.openPath(dir); status(scope, 'Extrait — dossier ouvert', 'success'); }
    } else { launch(dest); status(scope, 'Lancé — suivez les instructions', 'success'); }
    log(`${tool.name} lancé.`, 'success');
  } catch (e) { status(scope, `Erreur : ${e.message}`, 'error'); log(`${tool.name} : ${e.message}`, 'error'); }
});

// ───────────────────────── Réseau ─────────────────────────
ipcMain.handle('net:fix', async (_e, ids) => {
  const fixes = C.NET_FIXES.filter(f => ids.includes(f.id));
  log(`Exécution de ${fixes.length} commande(s) réseau…`);
  for (let i = 0; i < fixes.length; i++) {
    const f = fixes[i];
    progress('global', Math.round((i / fixes.length) * 100), f.cmd);
    log(`> ${f.cmd}`, 'cmd');
    const r = await run(f.cmd, { onLine: (l) => log(`   ${l.trim()}`, 'dim'), timeout: 120000 });
    status(`net:${f.id}`, r.code === 0 ? 'OK' : `Code ${r.code}`, r.code === 0 ? 'success' : 'warn');
  }
  progress('global', 100, 'Terminé');
  if (fixes.some(f => f.reboot)) log('Redémarrage recommandé pour appliquer les changements.', 'warn');
  log('Toutes les corrections sont appliquées.', 'success');
});

ipcMain.handle('net:test', async () => {
  const res = {};
  const ping = async (host) => { const r = await run(`ping -n 4 ${host}`, { timeout: 20000 }); const m = r.out.match(/(?:Moyenne|Average)\s*=\s*(\d+)\s*ms/i); const loss = r.out.match(/\((\d+)\s*%/); return { ms: m ? +m[1] : null, loss: loss ? +loss[1] : 100 }; };
  log('Test de connectivité…');
  const gw = await U.psJson(`(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway } | Select-Object -First 1).IPv4DefaultGateway.NextHop`);
  res.gateway = gw ? { host: gw, ...(await ping(gw)) } : null;
  res.internet = { host: '1.1.1.1', ...(await ping('1.1.1.1')) };
  const d = await run('nslookup google.com', { timeout: 15000 });
  res.dns = /Addresses?:|Adresses?:/i.test(d.out.split(/\r?\n/).slice(2).join('\n'));
  log(`Passerelle ${res.gateway ? `${res.gateway.ms ?? '—'} ms (${res.gateway.loss} % perte)` : 'absente'} · Internet ${res.internet.ms ?? '—'} ms (${res.internet.loss} % perte) · DNS ${res.dns ? 'OK' : 'en échec'}`, res.internet.ms != null && res.dns ? 'success' : 'warn');
  return res;
});

// ───────────────────────── WiFi ─────────────────────────
ipcMain.handle('wifi:list', async () => {
  const r = await run('netsh wlan show profiles');
  const names = r.out.split(/\r?\n/).filter(l => /Profil Tous les utilisateurs|All User Profile/i.test(l)).map(l => l.split(':').slice(1).join(':').trim()).filter(Boolean);
  const out = [];
  for (const n of names) {
    const d = await run(`netsh wlan show profile name="${n.replace(/"/g, '')}" key=clear`);
    const line = d.out.split(/\r?\n/).find(l => /Contenu de la cl|Key Content/i.test(l));
    const auth = d.out.split(/\r?\n/).find(l => /Authentification|Authentication/i.test(l));
    out.push({ ssid: n, pass: line ? line.split(':').slice(1).join(':').trim() : '', auth: auth ? auth.split(':').slice(1).join(':').trim() : '' });
  }
  return out;
});
ipcMain.handle('wifi:export', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Dossier de destination des profils WiFi', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const dir = r.filePaths[0];
  log(`Export des profils WiFi vers ${dir}…`);
  const x = await run(`netsh wlan export profile folder="${dir}" key=clear`, { onLine: (l) => log(`   ${l.trim()}`, 'dim') });
  if (x.code === 0) { log(`Profils exportés en XML dans ${dir}`, 'success'); shell.openPath(dir); } else log(`Code retour : ${x.code}`, 'warn');
  return dir;
});
ipcMain.handle('wifi:import', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Profils WiFi à importer (.xml)', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Profils WiFi', extensions: ['xml'] }] });
  if (r.canceled) return 0;
  let ok = 0; log(`Import de ${r.filePaths.length} profil(s)…`);
  for (const f of r.filePaths) {
    const x = await run(`netsh wlan add profile filename="${f}" user=all`);
    if (x.code === 0) { ok++; log(`Importé : ${path.basename(f)}`, 'success'); } else log(`Échec : ${path.basename(f)} — ${x.out.trim()}`, 'warn');
  }
  log(`${ok}/${r.filePaths.length} profil(s) importé(s).`, ok === r.filePaths.length ? 'success' : 'warn');
  return ok;
});

// ───────────────────────── Outlook / identifiants ─────────────────────────
ipcMain.handle('creds:list', async () => {
  const r = await run('cmdkey /list');
  const entries = []; let cur = null;
  for (const raw of r.out.split(/\r?\n/)) {
    const l = raw.trim();
    const m = l.match(/^(Cible|Target|Entrée cible|Nom de la cible)\s*:\s*(.*)$/i);
    if (m) { cur = { target: m[2].trim(), type: '', user: '' }; entries.push(cur); continue; }
    if (!cur) continue;
    const t = l.match(/^Type\s*:\s*(.*)$/i); if (t) cur.type = t[1].trim();
    const u = l.match(/^(Utilisateur|User)\s*:\s*(.*)$/i); if (u) cur.user = u[2].trim();
  }
  const kw = ['outlook', 'office', 'exchange', 'msoffice', 'microsoftoffice', 'live.com', 'microsoftaccount', 'onedrive', 'smtp', 'imap', 'mail'];
  return entries.map(e => ({ ...e, outlook: kw.some(k => e.target.toLowerCase().includes(k)) }));
});
ipcMain.handle('creds:manager', () => run('control /name Microsoft.CredentialManager'));

// ───────────────────────── Optimisation ─────────────────────────
ipcMain.handle('winutil:run', () => {
  spawn('cmd.exe', ['/d', '/s', '/c', 'start "WinUtil" powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://christitus.com/win | iex"'], { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true }).unref();
  log('WinUtil lancé dans une nouvelle fenêtre PowerShell.', 'success');
});
ipcMain.handle('restore:create', async () => {
  log('Création d\'un point de restauration…');
  const r = await U.ps(`Enable-ComputerRestore -Drive "$env:SystemDrive\\"; Checkpoint-Computer -Description 'RGA Tools' -RestorePointType MODIFY_SETTINGS; if ($?) { 'OK' } else { 'KO' }`, { timeout: 300000 });
  const ok = /OK/.test(r.out);
  log(ok ? 'Point de restauration créé.' : `Échec : ${(r.err || r.out).trim().split('\n')[0] || 'un seul point par 24 h est autorisé par défaut'}`, ok ? 'success' : 'warn');
  return ok;
});
ipcMain.handle('clean:temp', async () => {
  log('Nettoyage des fichiers temporaires…');
  const r = await U.psJson(`
    $paths = @($env:TEMP, "$env:SystemRoot\\Temp", "$env:SystemRoot\\SoftwareDistribution\\Download", "$env:LOCALAPPDATA\\Microsoft\\Windows\\INetCache", "$env:LOCALAPPDATA\\CrashDumps")
    $freed = 0
    foreach ($p in $paths) { if (Test-Path $p) { Get-ChildItem $p -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer } | ForEach-Object { $s = $_.Length; try { Remove-Item $_.FullName -Force -ErrorAction Stop; $freed += $s } catch {} } } }
    Clear-RecycleBin -Force -ErrorAction SilentlyContinue
    [math]::Round($freed/1MB)`, { timeout: 600000 });
  log(`${r ?? 0} Mo libérés (fichiers temporaires, cache Windows Update, corbeille).`, 'success');
  return r;
});
ipcMain.handle('repair:run', async (_e, which) => {
  const cmds = { sfc: 'sfc /scannow', dism: 'DISM /Online /Cleanup-Image /RestoreHealth' };
  const cmd = cmds[which]; if (!cmd) return;
  log(`> ${cmd}`, 'cmd'); progress('global', -1, cmd);
  let lastPct = -1;
  const r = await run(cmd, { timeout: 7200000, onLine: (l) => {
    const clean = l.replace(/\0/g, '').trim();
    const m = clean.match(/(\d+(?:[.,]\d+)?)\s*%/);
    if (m) { const p = Math.round(parseFloat(m[1].replace(',', '.'))); if (p !== lastPct) { lastPct = p; progress('global', p, cmd); } return; }
    if (clean) log(`   ${clean}`, 'dim');
  } });
  progress('global', 100, 'Terminé');
  log(`${cmd} terminé (code ${r.code}).`, r.code === 0 ? 'success' : 'warn');
});

// ───────────────────────── Licences (Windows / Office) ─────────────────────────
const SLMGR = 'cscript //nologo "%windir%\\System32\\slmgr.vbs"';
function osppPath() {
  const env = process.env, c = [];
  for (const base of [env.ProgramFiles, env['ProgramFiles(x86)']]) { if (!base) continue; for (const v of ['Office16', 'Office15']) c.push(path.join(base, 'Microsoft Office', v, 'OSPP.VBS')); }
  return c.find(p => fs.existsSync(p));
}
ipcMain.handle('lic:status', async () => {
  log('Lecture du statut de licence Windows…');
  const a = await run(`${SLMGR} /dli`), b = await run(`${SLMGR} /xpr`);
  const res = { windows: (a.out + '\n' + b.out).trim(), office: null };
  const ospp = osppPath();
  if (ospp) { log('Lecture du statut de licence Office…'); res.office = (await run(`cscript //nologo "${ospp}" /dstatus`)).out.trim(); }
  return res;
});
ipcMain.handle('lic:windowsKey', async (_e, key) => {
  if (!KEY_RE.test((key || '').trim())) { log('Format de clé invalide (XXXXX-XXXXX-XXXXX-XXXXX-XXXXX).', 'error'); return false; }
  log('Installation de la clé produit Windows…');
  const i = await run(`${SLMGR} /ipk ${key.trim().toUpperCase()}`, { onLine: (l) => log(`   ${l}`, 'dim') });
  if (i.code !== 0) { log('Échec de l\'installation de la clé.', 'error'); return false; }
  log('Activation en ligne…');
  const a = await run(`${SLMGR} /ato`, { onLine: (l) => log(`   ${l}`, 'dim') });
  log(a.code === 0 ? 'Windows activé.' : 'Activation non confirmée — vérifiez le statut.', a.code === 0 ? 'success' : 'warn');
  return a.code === 0;
});
ipcMain.handle('lic:officeKey', async (_e, key) => {
  const ospp = osppPath();
  if (!ospp) { log('Office (OSPP.VBS) introuvable sur ce poste.', 'error'); return false; }
  if (!KEY_RE.test((key || '').trim())) { log('Format de clé invalide.', 'error'); return false; }
  log('Installation de la clé produit Office…');
  await run(`cscript //nologo "${ospp}" /inpkey:${key.trim().toUpperCase()}`, { onLine: (l) => log(`   ${l}`, 'dim') });
  const a = await run(`cscript //nologo "${ospp}" /act`, { onLine: (l) => log(`   ${l}`, 'dim') });
  const ok = /successful|réussi/i.test(a.out);
  log(ok ? 'Office activé.' : 'Activation Office non confirmée — vérifiez le statut.', ok ? 'success' : 'warn');
  return ok;
});

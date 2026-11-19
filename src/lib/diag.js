// Moteur de diagnostic : profils, tests de charge, mesures et analyse.
const { BrowserWindow, ipcMain } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');
const { run, psJson, log, emit, sleep } = require('./util');
const monitor = require('./monitor');
const sysinfo = require('./sysinfo');
const events = require('./events');

const PROFILES = {
  config:  { name: 'Export configuration', steps: ['inventory', 'health'] },
  quick:   { name: 'Diagnostic rapide', steps: ['inventory', 'health', 'idle:10', 'cpu1:20', 'cpuN:20', 'gpu:30', 'mix:40', 'disk'] },
  long:    { name: 'Diagnostic long', steps: ['inventory', 'health', 'idle:10', 'cpu1:30', 'cpuN:60', 'gpu:60', 'mix:900', 'disk'] },
  extreme: { name: 'Diagnostic extrême', steps: ['inventory', 'health', 'idle:10', 'power:900', 'disk'] },
};

const STEP_LABEL = {
  inventory: 'Lecture de la configuration matérielle et logicielle',
  health: 'Analyse des journaux et de la santé du système',
  idle: 'Observation du système au repos',
  cpu1: 'Test CPU — 1 cœur',
  cpuN: 'Test CPU — multi-cœurs',
  gpu: 'Test GPU 3D',
  mix: 'Test combiné CPU multi-cœurs + GPU',
  power: 'Test extrême CPU + GPU + RAM (alimentation)',
  disk: 'Test de débit des stockages',
};

let current = null; // { cancel: bool }

function stepEstimate(steps) {
  return steps.reduce((s, st) => { const [k, d] = st.split(':'); return s + (d ? +d : k === 'inventory' ? 25 : k === 'health' ? 20 : k === 'disk' ? 40 : 0); }, 0);
}

// ─── Charge CPU / mémoire ───
function startWorkers(n, mode = 'cpu', mb) {
  const file = path.join(__dirname, 'stress-worker.js').replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
  const ws = [];
  const stats = { ops: 0, ms: 0, memBytes: 0, memErrors: 0, crashed: 0, samples: [] };
  for (let i = 0; i < n; i++) {
    const w = new Worker(file, { workerData: { mode, mb } });
    w.on('message', (m) => {
      if (m.ops) { stats.ops += m.ops; stats.ms += m.dt; }
      if (m.bytes) { stats.memBytes += m.bytes; }
      if (m.errors) stats.memErrors = Math.max(stats.memErrors, m.errors);
      if (m.error) stats.allocFail = true;
    });
    w.on('error', () => { stats.crashed++; });
    ws.push(w);
  }
  return {
    stats,
    stop: async () => { for (const w of ws) w.postMessage('stop'); await sleep(300); await Promise.all(ws.map(w => w.terminate())); return stats; },
  };
}

// ─── Charge GPU ───
function startGpu() {
  const res = { fps: [], score: [], error: null, renderer: null };
  const win = new BrowserWindow({
    width: 960, height: 560, title: 'RGA Tools — Test GPU', autoHideMenuBar: true, backgroundColor: '#000',
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, '..', 'gpu', 'preload.js'), backgroundThrottling: false, contextIsolation: true, sandbox: true },
  });
  const h = (e, m) => { if (e.sender !== win.webContents) return; if (m.error) res.error = m.error; if (m.fps != null) res.fps.push(m.fps); if (m.score != null) res.score.push(m.score); if (m.renderer) res.renderer = m.renderer; };
  ipcMain.on('gpu:report', h);
  win.webContents.on('render-process-gone', () => { res.error = res.error || 'Le processus de rendu 3D s\'est arrêté (crash GPU / pilote)'; });
  win.loadFile(path.join(__dirname, '..', 'gpu', 'gpu.html'));
  return { res, stop: () => { ipcMain.removeListener('gpu:report', h); if (!win.isDestroyed()) win.destroy(); return res; } };
}

const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const max = (a) => (a.length ? Math.max(...a) : null);
const min = (a) => (a.length ? Math.min(...a) : null);
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
function sampleStats(samples) {
  const pick = (k) => samples.map(s => s[k]).filter(v => typeof v === 'number');
  return {
    cpuAvg: r1(avg(pick('cpu'))), mhzAvg: Math.round(avg(pick('mhz')) || 0) || null, mhzMin: min(pick('mhz')), mhzMax: max(pick('mhz')),
    gpuAvg: r1(avg(pick('gpu'))), tempAvg: r1(avg(pick('temp'))), tempMax: max(pick('temp')), ramAvg: r1(avg(pick('ram'))), n: samples.length,
    cpuTempAvg: r1(avg(pick('cpuTemp'))), cpuTempMax: max(pick('cpuTemp')), gpuTempAvg: r1(avg(pick('gpuTemp'))), gpuTempMax: max(pick('gpuTemp')),
    hotspotMax: max(pick('gpuHotspot')), vrmMax: max(pick('vrmTemp')), cpuPowerMax: max(pick('cpuPower')), gpuPowerMax: max(pick('gpuPower')),
    tempSource: samples.some(x => x.cpuTempSrc === 'lhm') ? 'lhm' : samples.some(x => x.cpuTempSrc === 'acpi') ? 'acpi' : samples.some(x => x.gpuTemp != null) ? 'gpu' : null,
  };
}

// Attente interruptible avec progression et garde-fou température.
async function hold(seconds, ctx, label, onTick) {
  const start = Date.now();
  while (Date.now() - start < seconds * 1000) {
    if (current?.cancel) throw new Error('cancel');
    const el = (Date.now() - start) / 1000;
    emit('diag:tick', { label, elapsed: Math.round(el), total: seconds, live: monitor.last });
    const t = monitor.last?.temp;
    if (ctx.tempLimit && t && t >= ctx.tempLimit) { log(`Sécurité : température ${t} °C ≥ ${ctx.tempLimit} °C, arrêt du test.`, 'error'); ctx.tempAbort = t; return false; }
    if (onTick) onTick(el);
    await sleep(500);
  }
  return true;
}

async function stressPhase(kind, seconds, ctx) {
  const rec = monitor.record();
  const threads = os.cpus().length;
  let cpu = null, gpu = null, mem = null;
  if (kind === 'cpu1') cpu = startWorkers(1);
  if (kind === 'cpuN') cpu = startWorkers(threads);
  // Un thread laissé libre pour que le rendu 3D reste alimenté pendant les tests combinés.
  if (kind === 'mix' || kind === 'power') cpu = startWorkers(Math.max(1, threads - 1));
  if (kind === 'gpu' || kind === 'mix' || kind === 'power') { if (ctx.gpuAvailable !== false) gpu = startGpu(); }
  if (kind === 'power') {
    const freeMB = Math.floor(os.freemem() / 1048576);
    const per = Math.max(64, Math.min(1024, Math.floor((freeMB * 0.6) / 2)));
    mem = startWorkers(2, 'mem', per);
    log(`   Test mémoire : 2 × ${per} Mo (motifs écrits puis vérifiés en boucle)`, 'dim');
  }
  let ok = true;
  try { ok = await hold(seconds, ctx, STEP_LABEL[kind]); }
  finally {
    var cs = cpu ? await cpu.stop() : null;
    var gs = gpu ? gpu.stop() : null;
    var ms = mem ? await mem.stop() : null;
  }
  const samples = rec.stop();
  const out = { kind, seconds, completed: ok, sensors: sampleStats(samples), series: samples.map(s => ({ cpu: s.cpu, mhz: s.mhz, gpu: s.gpu, temp: s.temp, cpuTemp: s.cpuTemp, gpuTemp: s.gpuTemp })) };
  // Score = milliers d'opérations par seconde, tous threads confondus.
  if (cs) { out.cpuScore = Math.round(cs.ops / (seconds * 1000)); out.cpuCrashed = cs.crashed; }
  if (gs) {
    // Les premières secondes servent à calibrer la charge.
    const skip = Math.min(8, Math.floor(gs.score.length / 3));
    const f = gs.fps.slice(skip), sc = gs.score.slice(skip);
    out.gpu = { renderer: gs.renderer, fpsAvg: Math.round(avg(f) || 0), fpsMin: min(f), score: Math.round(avg(sc) || 0), error: gs.error };
    if (sc.length >= 9) { const third = Math.floor(sc.length / 3); out.gpu.scoreFirst = Math.round(avg(sc.slice(0, third))); out.gpu.scoreLast = Math.round(avg(sc.slice(-third))); }
    if (gs.error) { ctx.gpuAvailable = false; log(`Test 3D : ${gs.error}. Le diagnostic continue sans test 3D.`, 'error'); }
  }
  if (ms) out.mem = { errors: ms.memErrors, gbChecked: Math.round(ms.memBytes / 1073741824), allocFail: !!ms.allocFail };
  return out;
}

// ─── Stockage ───
function isAdmin() { try { require('child_process').execSync('net session', { stdio: 'ignore' }); return true; } catch { return false; } }
async function diskPhase() {
  if (!isAdmin()) { log('   Mesure du débit ignorée : droits administrateur requis (winsat).', 'warn'); return [{ drive: 'C', needAdmin: true }]; }
  const vols = (await psJson(`Get-Volume | Where-Object { $_.DriveLetter -and $_.DriveType -eq 'Fixed' -and $_.SizeRemaining -gt 2GB } | ForEach-Object { [string]$_.DriveLetter }`)) || ['C'];
  const letters = Array.isArray(vols) ? vols : [vols];
  const res = [];
  for (const L of letters) {
    if (current?.cancel) throw new Error('cancel');
    const one = { drive: L };
    for (const [key, args, label] of [['seqRead', '-seq -read', 'lecture séquentielle'], ['seqWrite', '-seq -write', 'écriture séquentielle'], ['ranRead', '-ran -read', 'lecture aléatoire']]) {
      emit('diag:tick', { label: `Stockage ${L}: — ${label}`, elapsed: 0, total: 0, live: monitor.last });
      log(`   ${L}: ${label}…`, 'dim');
      const r = await run(`winsat disk ${args} -drive ${L}`, { timeout: 120000 });
      const m = r.out.match(/([\d.,]+)\s*MB\/s/i);
      one[key] = m ? Math.round(parseFloat(m[1].replace(',', '.'))) : null;
      if (!m && /admin|privil|élev/i.test(r.out)) one.needAdmin = true;
    }
    log(`   ${L}: lecture ${one.seqRead ?? '?'} Mo/s · écriture ${one.seqWrite ?? '?'} Mo/s · aléatoire ${one.ranRead ?? '?'} Mo/s`);
    res.push(one);
  }
  return res;
}

// ─── Analyse ───
function analyse(R) {
  const F = []; // { level: 'error'|'warn'|'info'|'ok', area, title, detail }
  const add = (level, area, title, detail = '') => F.push({ level, area, title, detail });
  const inv = R.inventory || {}, H = R.health || {};
  const tests = R.tests || {};

  // Stabilité
  // Problèmes identifiés dans les journaux Windows (plus précis que les simples compteurs).
  const covered = new Set();
  for (const g of R.events?.problems || []) {
    covered.add(g.rule);
    add(g.sev, `Journaux · ${g.cat}`, `${g.title} (${g.count}× en 30 j)`, [g.cause, g.action && `À faire : ${g.action}`].filter(Boolean).join(' '));
  }
  if (H.whea > 0 && !covered.has('whea')) add('error', 'Stabilité', `${H.whea} erreur(s) matérielle(s) WHEA sur 30 jours`, `Dernière : ${H.wheaLast}. Indique souvent une instabilité CPU/RAM (overclocking, XMP, tension) ou un composant défaillant.`);
  if (H.bsod > 0 && !covered.has('bsod')) add('error', 'Stabilité', `${H.bsod} écran(s) bleu(s) sur 30 jours`, `Dernier : ${H.bsodLast}.`);
  if (H.unexpectedShutdown > 0 && !covered.has('kp41')) add('warn', 'Stabilité', `${H.unexpectedShutdown} arrêt(s) inattendu(s) sur 30 jours`, 'Coupures de courant, appui long sur le bouton, ou problème d\'alimentation / surchauffe.');
  if (R.wheaDuring > 0) add('error', 'Stabilité', 'Erreur WHEA détectée pendant les tests', 'Le matériel est instable sous charge.');
  if (H.appCrashes > 20) add('info', 'Stabilité', `${H.appCrashes} plantages d'applications sur 30 jours`);
  if (Array.isArray(H.badDevices) && H.badDevices.length) add('warn', 'Pilotes', `${H.badDevices.length} périphérique(s) en erreur`, H.badDevices.map(d => `${d.name} (code ${d.code})`).join(' · '));

  // Processeur
  const cpuN = tests.cpuN || tests.mix || tests.power;
  const base = inv.cpu?.[0]?.maxMHz;
  if (cpuN?.sensors?.mhzAvg && base && cpuN.sensors.mhzAvg < base * 0.85) add('warn', 'Processeur', 'Fréquence sous charge inférieure à la fréquence de base', `Moyenne ${cpuN.sensors.mhzAvg} MHz pour ${base} MHz de base : bridage thermique ou d'alimentation probable (refroidissement, pâte thermique, mode économie).`);
  else if (cpuN?.sensors?.mhzAvg) add('ok', 'Processeur', 'Fréquence sous charge correcte', `Moyenne ${cpuN.sensors.mhzAvg} MHz (base ${base} MHz).`);
  if (tests.cpuN?.cpuCrashed || tests.cpu1?.cpuCrashed) add('error', 'Processeur', 'Un thread de calcul a planté pendant le test');
  const mx = (k) => Math.max(0, ...Object.values(tests).map(t => t?.sensors?.[k] || 0));
  const cT = mx('cpuTempMax'), gT = mx('gpuTempMax'), hT = mx('hotspotMax'), vT = mx('vrmMax');
  if (cT >= 95) add('error', 'Températures', `Processeur à ${cT} °C sous charge`, 'Surchauffe du processeur : vérifier le ventirad, la poussière et la pâte thermique.');
  else if (cT >= 85) add('warn', 'Températures', `Processeur à ${cT} °C sous charge`, 'Température élevée : un nettoyage du refroidissement est conseillé.');
  else if (cT > 0) add('ok', 'Températures', `Processeur : ${cT} °C maximum sous charge`);
  if (gT >= 90 || hT >= 105) add('error', 'Températures', `Carte graphique à ${gT} °C${hT ? ` (point chaud ${hT} °C)` : ''}`, 'Surchauffe GPU : nettoyer les ventilateurs, vérifier le flux d’air du boîtier, éventuellement repâter la carte.');
  else if (gT >= 83 || hT >= 95) add('warn', 'Températures', `Carte graphique à ${gT} °C${hT ? ` (point chaud ${hT} °C)` : ''}`, 'Température GPU élevée : améliorer le flux d’air.');
  else if (gT > 0) add('ok', 'Températures', `Carte graphique : ${gT} °C maximum sous charge`);
  if (vT >= 105) add('warn', 'Températures', `Étage d'alimentation (VRM) à ${vT} °C`, 'Les VRM de la carte mère chauffent : vérifier la ventilation autour du processeur.');
  if (!cT && Object.values(tests).some(t => t.kind !== 'idle')) add('info', 'Températures', 'Température du processeur non mesurée', 'Installez le pilote de capteurs PawnIO (Paramètres) et lancez RGA Tools en administrateur pour relever la température du processeur.');
  if (R.tempAbort) add('error', 'Températures', `Test interrompu à ${R.tempAbort} °C (limite de sécurité)`);

  // GPU
  const g = (tests.gpu || tests.mix || tests.power)?.gpu;
  if (g?.error) add('error', 'Carte graphique', 'Le test 3D a échoué', g.error);
  else if (g?.scoreFirst && g?.scoreLast && g.scoreLast < g.scoreFirst * 0.8) add('warn', 'Carte graphique', 'Chute des performances 3D au fil du test', `Score ${g.scoreFirst} → ${g.scoreLast} : bridage thermique probable de la carte graphique.`);
  else if (g?.score) add('ok', 'Carte graphique', 'Test 3D stable', `Score ${g.score} passes/s (${g.renderer || ''}).`);
  const gpus = (inv.gpu || []).filter(x => /^PCI/i.test(x.pnp || ''));
  for (const x of gpus) {
    if (x.driverDate) {
      const ageDays = (Date.now() - new Date(x.driverDate)) / 864e5;
      if (ageDays > 540) add('info', 'Carte graphique', `Pilote graphique ancien (${x.driverDate})`, `${x.name} — une mise à jour du pilote est conseillée.`);
    }
  }

  // Mémoire
  const ram = inv.ram || {};
  const mods = ram.modules || [];
  if (mods.length === 1 && (ram.slots || 0) >= 2) add('warn', 'Mémoire', 'Mémoire en simple canal (1 barrette)', 'Ajouter une 2e barrette identique double la bande passante.');
  for (const m of mods) {
    const rated = +(String(m.part).match(/(?:F4|F5|CMK|CMW|BL|KF|HX)\D{0,4}(\d{4})/i)?.[1] || 0);
    if (rated && m.configured && m.configured < rated * 0.9) { add('info', 'Mémoire', `RAM configurée à ${m.configured} MHz pour ${rated} MHz`, 'Le profil XMP / DOCP / EXPO ne semble pas activé dans le BIOS.'); break; }
  }
  if (tests.power?.mem?.errors > 0) add('error', 'Mémoire', `${tests.power.mem.errors} erreur(s) de vérification mémoire`, 'La RAM renvoie des données corrompues : lancer le diagnostic mémoire Windows ou MemTest86.');
  else if (tests.power?.mem?.gbChecked) add('ok', 'Mémoire', `Aucune erreur mémoire (${tests.power.mem.gbChecked} Go vérifiés)`);
  if (tests.idle?.sensors?.ramAvg > 85) add('warn', 'Mémoire', `RAM utilisée à ${tests.idle.sensors.ramAvg} % au repos`, 'Mémoire insuffisante ou application gourmande en arrière-plan.');
  if (ram.totalGB && ram.totalGB < 7.5) add('info', 'Mémoire', `${ram.totalGB} Go de RAM`, '8 Go minimum recommandés sous Windows 10/11.');

  // Stockage
  for (const d of inv.disks || []) {
    if (d.health && d.health !== 'Healthy') add('error', 'Stockage', `Disque « ${d.name} » : état ${d.health}`, 'Sauvegarder les données et remplacer le disque.');
    if (d.wear != null && d.wear >= 80) add('warn', 'Stockage', `SSD « ${d.name} » usé à ${d.wear} %`);
    if (d.readErr > 0 || d.writeErr > 0) add('warn', 'Stockage', `Erreurs non corrigées sur « ${d.name} »`, `Lecture ${d.readErr || 0} · écriture ${d.writeErr || 0}`);
    if (d.temp >= 70) add('warn', 'Stockage', `Disque « ${d.name} » à ${d.temp} °C`);
    if (/HDD/i.test(d.media) && /Windows/i.test(inv.os?.name || '') && (inv.disks || []).length === 1) add('info', 'Stockage', 'Windows installé sur un disque dur mécanique', 'Un SSD rendrait le PC nettement plus réactif.');
  }
  if (H.diskErrors > 0 && !covered.has('disk')) add('warn', 'Stockage', `${H.diskErrors >= 1000 ? '1000+' : H.diskErrors} événement(s) d'erreur disque sur 30 jours`, 'Vérifier les câbles / ports, ou un périphérique USB défectueux.');
  for (const v of inv.volumes || []) {
    const pct = v.sizeGB ? (v.freeGB / v.sizeGB) * 100 : 100;
    if (pct < 10) add('warn', 'Stockage', `Lecteur ${v.letter}: presque plein`, `${v.freeGB} Go libres sur ${v.sizeGB} Go.`);
  }
  for (const d of R.disk || []) {
    if (d.seqRead != null && d.seqRead < 60) add('warn', 'Stockage', `Lecteur ${d.drive}: lent (${d.seqRead} Mo/s en lecture)`);
  }

  // Système
  if (H.defender && (!H.defender.enabled || !H.defender.realtime) && !(inv.security?.antivirus || []).some(a => !/defender/i.test(a))) add('warn', 'Sécurité', 'Protection antivirus en temps réel désactivée');
  if (H.defender?.sigAgeDays > 7) add('warn', 'Sécurité', `Signatures antivirus vieilles de ${H.defender.sigAgeDays} jours`);
  if (H.activated === false) add('warn', 'Système', 'Windows n\'est pas activé');
  if (H.lastUpdate && (Date.now() - new Date(H.lastUpdate)) / 864e5 > 60) add('warn', 'Système', `Dernière mise à jour Windows le ${H.lastUpdate}`);
  if (H.rebootPending) add('info', 'Système', 'Redémarrage en attente pour terminer des mises à jour');
  if (inv.os?.uptimeH > 24 * 7) add('info', 'Système', `PC allumé depuis ${Math.round(inv.os.uptimeH / 24)} jours`, 'Un redémarrage complet est conseillé.');
  if (H.startupCount > 15) add('info', 'Système', `${H.startupCount} programmes au démarrage`, 'Désactiver les inutiles accélère le démarrage.');
  if (tests.idle?.sensors?.cpuAvg > 15) add('warn', 'Système', `Processeur occupé à ${tests.idle.sensors.cpuAvg} % au repos`, 'Une application tourne en arrière-plan (mises à jour, antivirus, logiciel indésirable).');
  if (inv.battery?.health && inv.battery.health < 60) add('warn', 'Batterie', `Batterie usée : ${inv.battery.health} % de la capacité d'origine`);
  else if (inv.battery?.health) add('ok', 'Batterie', `Batterie à ${inv.battery.health} % de sa capacité d'origine`);
  if (inv.system?.pcType === 1 && /économ|saver/i.test(inv.powerPlan || '')) add('info', 'Système', `Mode d'alimentation « ${inv.powerPlan} » sur un PC fixe`);

  const penalty = F.reduce((s, f) => s + (f.level === 'error' ? 18 : f.level === 'warn' ? 6 : f.level === 'info' ? 1 : 0), 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  return { findings: F, score };
}

async function countWhea(sinceIso) {
  const r = await psJson(`try { @(Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-WHEA-Logger'; StartTime=[datetime]'${sinceIso}'} -ErrorAction Stop).Count } catch { 0 }`);
  return +r || 0;
}

async function runDiag(profileId, opts = {}) {
  if (current) throw new Error('Un diagnostic est déjà en cours.');
  const P = PROFILES[profileId];
  current = { cancel: false };
  const ctx = { tempLimit: opts.tempLimit || 0, gpuAvailable: opts.skipGpu ? false : undefined };
  const R = { profile: profileId, profileName: P.name, note: opts.note || '', startedAt: new Date().toISOString(), tests: {}, version: opts.version };
  const steps = P.steps;
  const total = stepEstimate(steps);
  let done = 0;
  const startIso = new Date().toISOString().slice(0, 19);
  const needMonitor = steps.some(s => s.includes(':'));
  let offMon = null;
  if (needMonitor) { offMon = monitor.on(() => {}); const t0 = Date.now(); while (!monitor.last && Date.now() - t0 < 10000) await sleep(250); }
  try {
    log(`Démarrage : ${P.name}${opts.note ? ` — « ${opts.note} »` : ''}`, 'success');
    for (let i = 0; i < steps.length; i++) {
      const [k, d] = steps[i].split(':');
      const dur = d ? +d : k === 'inventory' ? 25 : k === 'health' ? 20 : 40;
      emit('diag:step', { index: i, count: steps.length, key: k, label: STEP_LABEL[k], seconds: d ? +d : null, pct: Math.round((done / total) * 100) });
      log(`${STEP_LABEL[k]}${d ? ` (${d >= 60 ? Math.round(d / 60) + ' min' : d + ' s'})` : ''}…`);
      if (current.cancel) throw new Error('cancel');
      if (k === 'inventory') R.inventory = await sysinfo.getInventory();
      else if (k === 'health') {
        R.health = await sysinfo.getHealth();
        // Journaux Windows : problèmes connus des 30 derniers jours.
        try {
          const ev = events.analyze(await events.fetchEvents({ days: 30, levels: [1, 2, 3], logs: ['System', 'Application', 'Defender'] }), { days: 30 });
          R.events = { total: ev.total, totals: ev.totals, summary: ev.summary, problems: ev.problems.map(({ samples, ...g }) => ({ ...g, sample: samples[0]?.m || '' })) };
          log(`   Journaux : ${ev.summary}`, ev.problems.some(p => p.sev === 'error') ? 'warn' : 'dim');
        } catch (e) { log(`   Journaux illisibles : ${e.message}`, 'warn'); }
      }
      else if (k === 'idle') { const rec = monitor.record(); await hold(+d, ctx, STEP_LABEL.idle); const s = rec.stop(); R.tests.idle = { kind: 'idle', seconds: +d, sensors: sampleStats(s), series: s.map(x => ({ cpu: x.cpu, mhz: x.mhz, gpu: x.gpu, temp: x.temp, cpuTemp: x.cpuTemp, gpuTemp: x.gpuTemp })) };
        if (R.tests.idle.sensors.cpuAvg > 15) log(`   Processeur utilisé à ${R.tests.idle.sensors.cpuAvg} % au repos : les résultats peuvent être faussés.`, 'warn'); }
      else if (k === 'disk') R.disk = await diskPhase();
      else {
        if ((k === 'gpu') && ctx.gpuAvailable === false) { log('   Test 3D ignoré.', 'warn'); continue; }
        const t = await stressPhase(k, +d, ctx);
        R.tests[k] = t;
        const s = t.sensors;
        log(`   CPU ${s.cpuAvg ?? '?'} % · ${s.mhzAvg ?? '?'} MHz${s.tempMax ? ` · ${s.tempMax} °C max` : ''}${t.cpuScore ? ` · score ${t.cpuScore}` : ''}${t.gpu?.score ? ` · GPU ${t.gpu.score} passes/s` : ''}`, 'dim');
        if (ctx.tempAbort) { R.tempAbort = ctx.tempAbort; break; }
      }
      done += dur;
    }
    if (needMonitor) { R.wheaDuring = await countWhea(startIso); if (R.wheaDuring) log('Erreur WHEA détectée pendant les tests !', 'error'); }
    R.finishedAt = new Date().toISOString();
    Object.assign(R, analyse(R));
    emit('diag:step', { index: steps.length, count: steps.length, key: 'done', label: 'Terminé', pct: 100 });
    log(`Diagnostic terminé — note ${R.score}/100.`, 'success');
    return R;
  } catch (e) {
    if (e.message === 'cancel') { log('Diagnostic annulé.', 'warn'); emit('diag:step', { key: 'cancel', label: 'Annulé', pct: 0 }); return null; }
    throw e;
  } finally {
    if (offMon) offMon();
    if (!monitor.listeners.size) monitor.stop();
    current = null;
  }
}

function cancelDiag() { if (current) current.cancel = true; }

module.exports = { PROFILES, runDiag, cancelDiag, analyse, stepEstimate };

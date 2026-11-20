/* RGA Tools — interface */
const api = window.rga;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDur = (s) => s >= 60 ? `~${Math.round(s / 60)} min` : `~${s} s`;
const fmtBytes = (b) => b >= 1048576 ? `${(b / 1048576).toFixed(1)} Mo/s` : b >= 1024 ? `${Math.round(b / 1024)} Ko/s` : `${Math.round(b || 0)} o/s`;

// ─── Icônes ───
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v12h14V9"/><path d="M10 21v-6h4v6"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  office: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  puzzle: '<path d="M10 3h4v3a2 2 0 1 0 4 0V3h3v7h-3a2 2 0 1 0 0 4h3v7h-7v-3a2 2 0 1 0-4 0v3H3v-7h3a2 2 0 1 0 0-4H3V3h7Z"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 8-8-1.3-1.3a4 4 0 0 1-5-5L14 2Z"/><path d="M7 14 3 18l3 3 4-4"/>',
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14 9l2 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r=".8" fill="currentColor"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  external: '<path d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
  play: '<path d="M6 4v16l14-8Z"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-4M4 4v4h4M4 13a8 8 0 0 0 14.9 4M20 20v-4h-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  alert: '<path d="M12 3 2 20h20Z"/><path d="M12 10v4M12 17v.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  broom: '<path d="M19 3 11 11M7 11l6 6-2 4-8-8 4-2ZM9 13l-3 3"/>',
  virus: '<circle cx="12" cy="12" r="5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5 19 19M5 19l3.5-3.5M15.5 8.5 19 5"/>',
  scan: '<path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3M7 12h10"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  memory: '<rect x="3" y="7" width="18" height="10" rx="1.5"/><path d="M7 7v10M11 7v10M15 7v10M5 17v3M19 17v3"/>',
  disk: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
  gpu: '<rect x="2" y="7" width="20" height="10" rx="1.5"/><circle cx="8" cy="12" r="2.5"/><circle cx="16" cy="12" r="2.5"/><path d="M5 17v3"/>',
  temp: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3Z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  stetho: '<path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v3a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>',
  monitor: '<path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 6-6"/>',
  pc: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  board: '<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="6" height="6"/><path d="M16 7h1M16 10h1M7 16h10"/>',
  battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2M6 10v4M9.5 10v4"/>',
  heart: '<path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-4 5 5 0 0 1 9 4c-2 4.6-9 9-9 9Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 8 0 5 3 8 7 8Z"/>',
  bolt2: '<path d="M4 12h3l2-6 4 12 2-6h5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z"/>',
  net: '<path d="M7 17V7M17 7v10M3 7h8M13 17h8"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="7" r="2"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8Z"/><path d="M12 11v6M9.5 14.5 12 17l2.5-2.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
};
const ic = (n, cls = '') => `<svg viewBox="0 0 24 24" class="ico ${cls}">${P[n] || ''}</svg>`;
const CHECK = `<span class="check"><svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg></span>`;

// ─── État ───
const S = {
  cat: null, sys: null, settings: null, page: 'home', utilsTab: 'net', busy: false,
  soft: new Set(), arch: {}, office: null, officeArch: 'x64', net: new Set(), wifi: null, creds: null, reveal: false,
  profiles: null, diagProfile: 'quick', diag: null, // { state:'running'|'done', steps, cur, result }
  config: null, reports: [], netTest: null,
  mon: { samples: [], on: false },
  ev: { days: 7, levels: { 1: true, 2: true, 3: true }, logs: { System: true, Application: true, Defender: true }, res: null, loading: false, open: new Set(), q: '', showAll: false },
  upd: { state: 'idle', data: null, pct: 0, error: null, info: null },
};

const BRAND = {
  winrar: ['#7c4dff', 'Rr'], vlc: ['#ff8800', 'VL'], onlyoffice: ['#ff6f3d', 'OO'], chrome: ['#4285f4', 'Ch'],
  anydesk: ['#ef443b', 'AD'], reader: ['#d4151c', 'Ar'], firefox: ['#ff7139', 'Fx'], thunderbird: ['#0a84ff', 'Tb'], openshell: ['#3aa0d8', 'OS'],
};

const NAV = [
  { id: 'home', label: 'Accueil', icon: 'home' },
  { sec: 'Diagnostic' },
  { id: 'diag', label: 'Diagnostic PC', icon: 'stetho' },
  { id: 'monitor', label: 'Monitoring', icon: 'monitor' },
  { id: 'config', label: 'Configuration PC', icon: 'pc' },
  { id: 'events', label: 'Journaux Windows', icon: 'list' },
  { id: 'tools', label: 'Outils de test', icon: 'pulse' },
  { sec: 'Installation' },
  { id: 'soft', label: 'Logiciels', icon: 'box' },
  { id: 'office', label: 'Microsoft Office', icon: 'office' },
  { id: 'ext', label: 'Extensions', icon: 'puzzle' },
  { sec: 'Maintenance' },
  { id: 'clean', label: 'Nettoyage', icon: 'shield' },
  { id: 'utils', label: 'Réseau & comptes', icon: 'wifi' },
  { id: 'optim', label: 'Optimisation', icon: 'zap' },
  { id: 'lic', label: 'Licences', icon: 'key' },
  { sec: 'RGA Tools' },
  { id: 'settings', label: 'Paramètres', icon: 'settings' },
];

// ─── Console / progression / toasts ───
let logCount = 0;
function addLog({ msg, level = 'info', t = Date.now() }) {
  const body = $('#console-body');
  const ts = new Date(t).toLocaleTimeString('fr-FR', { hour12: false });
  for (const line of String(msg).split('\n')) {
    const el = document.createElement('div');
    el.className = `ln ${level}`;
    el.innerHTML = `<span class="t">${ts}</span><span class="m">${esc(line) || '&nbsp;'}</span>`;
    body.appendChild(el);
  }
  while (body.children.length > 2000) body.firstChild.remove();
  body.scrollTop = body.scrollHeight;
  $('#console-count').textContent = ++logCount;
}
function setGlobal(pct, label) {
  if (label) $('#gprog-label').textContent = label;
  $('#gprog-fill').style.width = `${pct < 0 ? 100 : Math.max(0, Math.min(100, pct))}%`;
  $('#gprog-pct').textContent = pct >= 0 ? `${pct}%` : '';
}
function toast(text, level = 'info') {
  const t = document.createElement('div'); t.className = `toast ${level}`; t.textContent = text;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 4500);
}
function confirmBox(title, text, okLabel = 'Confirmer') {
  return new Promise((res) => {
    $('#modal-title').textContent = title; $('#modal-text').textContent = text; $('#modal-ok').textContent = okLabel;
    $('#modal').hidden = false;
    const done = (v) => { $('#modal').hidden = true; $('#modal-ok').onclick = $('#modal-cancel').onclick = null; res(v); };
    $('#modal-ok').onclick = () => done(true); $('#modal-cancel').onclick = () => done(false);
  });
}
function setBusy(b) { S.busy = b; $$('[data-busy]').forEach(x => (x.disabled = b)); }
const showConsole = () => $('#console').classList.remove('collapsed');

api.onLog(addLog);
api.onProgress(({ scope, pct, label }) => {
  if (scope === 'global') return setGlobal(pct, label);
  const bar = document.querySelector(`[data-bar="${CSS.escape(scope)}"]`);
  if (!bar) return;
  bar.classList.add('on'); bar.classList.toggle('indet', pct < 0);
  if (pct >= 0) bar.firstElementChild.style.width = `${pct}%`;
  if (pct >= 100) setTimeout(() => bar.classList.remove('on'), 1200);
});
api.onStatus(({ scope, text, level }) => {
  const el = document.querySelector(`[data-status="${CSS.escape(scope)}"]`);
  if (el) { el.textContent = text; el.className = `status ${level || ''}`; }
});

// ─── Thème ───
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  $('#btn-theme').innerHTML = ic(t === 'light' ? 'moon' : 'sun');
  $('#side-logo').src = 'assets/logo-rga.png';
}

// ─── Navigation ───
function renderNav() {
  $('#nav').innerHTML = NAV.map(n => n.sec
    ? `<div class="nav-section">${n.sec}</div>`
    : `<button class="nav-item ${S.page === n.id ? 'active' : ''}" data-nav="${n.id}">${ic(n.icon)}<span>${n.label}</span>${n.id === 'diag' && S.diag?.state === 'running' ? '<span class="pill">EN COURS</span>' : ''}</button>`).join('');
  $$('[data-nav]').forEach(b => b.onclick = () => go(b.dataset.nav));
}
function go(id) {
  if (S.page === 'monitor' && id !== 'monitor') stopMonitor();
  S.page = id; renderNav(); render();
}
function head(title, sub, actions = '') {
  return `<div class="page-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="actions">${actions}</div></div>`;
}
const PAGES = {}, BIND = {};
function render() {
  const pg = $('#page');
  pg.innerHTML = `<div class="fade-in">${PAGES[S.page]()}</div>`;
  pg.scrollTop = 0;
  (BIND[S.page] || (() => {}))();
  setBusy(S.busy);
}
const rerender = (id) => { if (S.page === id) { const st = $('#page').scrollTop; render(); $('#page').scrollTop = st; } };

// ════════════════════ ACCUEIL ════════════════════
PAGES.home = () => {
  const s = S.sys, last = S.reports[0];
  const tiles = [
    ['diag', 'stetho', 'Diagnostic PC', 'Tests de charge CPU / GPU / RAM / disques + rapport'],
    ['monitor', 'monitor', 'Monitoring', 'Charge, fréquences et débits en temps réel'],
    ['config', 'pc', 'Configuration PC', 'Inventaire matériel et santé du système'],
    ['events', 'list', 'Journaux Windows', 'Erreurs Windows expliquées, avec la marche à suivre'],
    ['soft', 'box', 'Logiciels', 'Installation silencieuse des essentiels'],
    ['office', 'office', 'Microsoft Office', 'Déploiement via Office Deployment Tool'],
    ['clean', 'shield', 'Nettoyage', 'Antimalwares et analyse hors-ligne'],
    ['utils', 'wifi', 'Réseau & comptes', 'Réparation réseau, WiFi, identifiants Outlook'],
    ['optim', 'zap', 'Optimisation', 'Nettoyage disque, réparation système, WinUtil'],
    ['lic', 'key', 'Licences', 'Statut et clés produit Windows / Office'],
  ];
  return `
  <div class="hero">
    <img src="assets/logo-rga-white.png" alt="RGA Informatique" />
    <div class="grow"><h1>Boîte à outils technicien</h1><p>Diagnostic, installation, nettoyage et réparation d'un PC Windows, depuis une seule application.</p></div>
    <button class="primary lg" data-go="diag">${ic('stetho')}Lancer un diagnostic</button>
  </div>
  <div class="stats">
    <div class="stat"><div class="k">Poste</div><div class="v">${esc(s.host)}</div><div class="s">${s.is64 ? 'Windows 64 bits' : 'Windows 32 bits'}</div></div>
    <div class="stat"><div class="k">Processeur</div><div class="v" title="${esc(s.cpu)}">${esc(s.cpu.replace(/\s+\d+-Core Processor|\(R\)|\(TM\)|CPU/gi, '').trim())}</div><div class="s">${s.threads} threads</div></div>
    <div class="stat"><div class="k">Mémoire</div><div class="v">${s.ramGB} Go</div><div class="s">RAM installée</div></div>
    <div class="stat"><div class="k">Dernier diagnostic</div><div class="v">${last?.score != null ? `${last.score}/100` : '—'}</div><div class="s">${last ? esc(new Date(last.mtime).toLocaleString('fr-FR')) : 'Aucun rapport'}</div></div>
  </div>
  <h2 class="section">Accès rapide</h2>
  <div class="grid">${tiles.map(([id, i, l, d]) => `
    <div class="card quick" data-go="${id}"><div class="tool-ic">${ic(i)}</div><div><h3>${l}</h3><div class="desc">${d}</div></div><span class="arrow">${ic('chevron')}</span></div>`).join('')}
  </div>`;
};
BIND.home = () => $$('[data-go]').forEach(c => c.onclick = () => go(c.dataset.go));

// ════════════════════ DIAGNOSTIC ════════════════════
const PROFILE_UI = {
  config: { icon: 'file', desc: 'Export complet de la configuration matérielle et logicielle, sans test de charge.', tip: 'Pour partager rapidement les caractéristiques du PC.' },
  quick: { icon: 'stetho', desc: 'Vérifie rapidement la santé et les performances : CPU, GPU, disques, journaux.', tip: 'En cas de doute, lancez celui-ci.', rec: 'Recommandé' },
  long: { icon: 'clock', desc: 'Comme le rapide, avec un test combiné CPU + GPU prolongé.', tip: 'Révèle les problèmes qui apparaissent sur la durée (chauffe, instabilité).' },
  extreme: { icon: 'flame', desc: 'Charge maximale CPU + GPU + RAM simultanée, vérification de la mémoire.', tip: 'Non représentatif d\'un usage réel : stabilité et alimentation uniquement.', rec: 'Avancé', adv: true },
};
const STEP_NAMES = { inventory: 'Configuration', health: 'Santé du système', idle: 'Repos', cpu1: 'CPU 1 cœur', cpuN: 'CPU multi-cœurs', gpu: 'GPU 3D', mix: 'CPU + GPU', power: 'CPU + GPU + RAM', disk: 'Stockages' };

PAGES.diag = () => {
  if (S.diag?.state === 'running') return diagRunning();
  if (S.diag?.state === 'done') return diagResult(S.diag.result);
  const P = S.profiles;
  return head('Diagnostic PC', 'Tests de charge et analyse complète du poste. Le rapport HTML est enregistré sur le Bureau, dans « Diagnostics RGA ». Aucune donnée n\'est envoyée sur Internet.') + `
  <div class="profiles">${Object.entries(P).map(([id, p]) => { const u = PROFILE_UI[id]; return `
    <div class="card selectable profile ${S.diagProfile === id ? 'selected' : ''}" data-profile="${id}">
      ${u.rec ? `<span class="rec ${u.adv ? 'adv' : ''}">${u.rec}</span>` : ''}
      <div class="p-ic">${ic(u.icon)}</div>
      <h3>${p.name}</h3>
      <div class="dur">${ic('clock')}${fmtDur(p.seconds)}</div>
      <div class="desc">${u.desc}</div>
      <div class="tip">${u.tip}</div>
    </div>`; }).join('')}
  </div>
  <div class="launch">
    <input class="input" id="diag-note" placeholder="Description du problème (facultatif) — ex. : écran noir en jeu, PC lent…" maxlength="300" />
    <button class="primary lg" id="diag-go">${ic('play')}Lancer le diagnostic</button>
  </div>
  <div class="note">${ic('info')}<div>Fermez les applications ouvertes avant de lancer un test, et branchez les portables sur secteur. Pendant les tests GPU, une fenêtre 3D s'ouvre : c'est normal. Un overlay affiche températures et charge pendant les tests. Les températures sont lues par LibreHardwareMonitor ; celle du processeur nécessite le pilote de capteurs PawnIO (voir Paramètres).</div></div>
  ${S.reports.length ? `<h2 class="section">Rapports récents <span class="count">${S.reports.length}</span></h2>
  <div class="list">${S.reports.slice(0, 8).map((r, i) => `
    <div class="row clickable" data-report="${i}">
      <div class="tool-ic">${ic('file')}</div>
      <div class="grow"><b>${esc(r.profileName || r.name)}</b><div class="sub">${esc(r.host || '')} · ${esc(new Date(r.mtime).toLocaleString('fr-FR'))}</div></div>
      ${r.score != null ? `<span class="tag ${r.score >= 85 ? 'ok' : r.score >= 60 ? 'warn' : 'err'}">${r.score}/100</span>` : ''}
      ${ic('external')}
    </div>`).join('')}</div>` : ''}`;
};

function diagRunning() {
  const D = S.diag, L = D.live || {};
  const gauge = (k, v, unit, pct) => `<div class="gauge"><div class="k">${k}</div><div class="v" data-g="${k}">${v ?? '—'}<small>${unit}</small></div>${pct != null ? `<div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>` : ''}</div>`;
  return head(`${S.profiles[D.profile].name} en cours`, D.note ? `« ${esc(D.note)} »` : 'Ne lancez pas d\'autres applications pendant les tests.',
    `<button class="danger" id="diag-cancel">${ic('stop')}Annuler</button>`) + `
  <div class="run">
    <div class="card"><ul class="steps">${D.steps.map((s, i) => { const [k, d] = s.split(':'); const st = i < D.cur ? 'done' : i === D.cur ? 'cur' : ''; return `
      <li class="${st}"><span class="st">${st === 'done' ? ic('check') : ''}</span>${STEP_NAMES[k]}<span class="d">${d ? fmtDur(+d).replace('~', '') : ''}</span></li>`; }).join('')}</ul></div>
    <div class="card">
      <div class="cur-step" id="d-label">${esc(D.label || 'Préparation…')}</div>
      <div class="desc" id="d-time">${D.total ? `${D.elapsed || 0} s / ${D.total} s` : 'Collecte des informations…'}</div>
      <div class="big-bar"><i id="d-bar" style="width:${D.pct || 0}%"></i></div>
      <div class="desc">Progression globale : <b id="d-pct">${D.pct || 0} %</b></div>
      <div class="gauges" id="d-gauges">
        ${gauge('CPU', L.cpu != null ? Math.round(L.cpu) : null, '%', L.cpu)}
        ${gauge('Fréquence', L.mhz, 'MHz')}
        ${gauge('GPU', L.gpu != null ? Math.round(L.gpu) : null, '%', L.gpu)}
        ${gauge('RAM', L.ram != null ? Math.round(L.ram) : null, '%', L.ram)}
        ${gauge('Temp. CPU', L.cpuTemp, '°C')}
        ${gauge('Temp. GPU', L.gpuTemp, '°C')}
      </div>
    </div>
  </div>`;
}

const LV_ICON = { error: 'x', warn: 'alert', info: 'info', ok: 'check' };
function findingsHtml(F) {
  const order = ['error', 'warn', 'info', 'ok'];
  return [...F].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level)).map(f => `
    <div class="finding"><span class="lv ${f.level}">${ic(LV_ICON[f.level])}</span>
      <div><div class="area">${esc(f.area)}</div><b>${esc(f.title)}</b>${f.detail ? `<p>${esc(f.detail)}</p>` : ''}${f.extra?.length ? `<ul class="ev-facts">${f.extra.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div></div>`).join('') || '<div class="empty">Aucune remarque.</div>';
}
function scoreColor(s) { return s >= 85 ? 'var(--ok)' : s >= 60 ? 'var(--warn)' : 'var(--err)'; }

function diagResult(R) {
  const c = { error: 0, warn: 0, info: 0 }; (R.findings || []).forEach(f => c[f.level] != null && c[f.level]++);
  const T = R.tests || {};
  const testRow = (k, t) => `<div class="row"><div class="grow"><b>${STEP_NAMES[k]}</b><div class="sub">${t.seconds} s${t.completed === false ? ' · interrompu' : ''}</div></div>
    <span class="tag">CPU ${t.sensors?.cpuAvg ?? '—'} %</span><span class="tag">${t.sensors?.mhzAvg ?? '—'} MHz</span>
    ${t.sensors?.cpuTempMax ? `<span class="tag">CPU ${t.sensors.cpuTempMax} °C</span>` : ''}${t.sensors?.gpuTempMax ? `<span class="tag">GPU ${t.sensors.gpuTempMax} °C</span>` : ''}${t.cpuScore ? `<span class="tag">Score ${t.cpuScore.toLocaleString('fr-FR')}</span>` : ''}
    ${t.gpu?.score ? `<span class="tag">GPU ${t.gpu.score} passes/s</span>` : ''}${t.gpu?.error ? '<span class="tag err">Échec 3D</span>' : ''}${t.mem ? `<span class="tag ${t.mem.errors ? 'err' : 'ok'}">RAM ${t.mem.errors} err.</span>` : ''}</div>`;
  return head(`${esc(R.profileName)} terminé`, `${esc(R.inventory?.host || '')} · ${new Date(R.startedAt).toLocaleString('fr-FR')}`,
    `<button class="ghost" id="r-folder">${ic('folder')}Dossier</button><button class="ghost" id="r-new">${ic('refresh')}Nouveau diagnostic</button><button class="primary" id="r-open">${ic('external')}Ouvrir le rapport</button>`) + `
  <div class="result-top">
    <div class="card" style="text-align:center">
      <div class="ring" style="background:conic-gradient(${scoreColor(R.score)} ${R.score}%, var(--surface-3) 0)"><div style="color:${scoreColor(R.score)}">${R.score}</div></div>
      <div class="desc">Note globale / 100</div>
      <div class="actions" style="justify-content:center;margin-top:12px"><span class="tag err">${c.error} problème(s)</span><span class="tag warn">${c.warn} attention</span><span class="tag">${c.info} conseil(s)</span></div>
    </div>
    <div class="card"><h3 style="margin-bottom:6px">Résumé</h3>${findingsHtml(R.findings || [])}</div>
  </div>
  ${Object.keys(T).length ? `<h2 class="section">Tests de charge</h2><div class="list">${Object.entries(T).map(([k, t]) => testRow(k, t)).join('')}</div>` : ''}
  ${(R.disk || []).length ? `<h2 class="section">Stockages</h2><div class="list">${R.disk.map(d => `<div class="row"><div class="tool-ic">${ic('disk')}</div><div class="grow"><b>Lecteur ${esc(d.drive)}:</b>${d.needAdmin ? '<div class="sub">Droits administrateur requis pour mesurer le débit.</div>' : ''}</div>
    <span class="tag">Lecture ${d.seqRead ?? '—'} Mo/s</span><span class="tag">Écriture ${d.seqWrite ?? '—'} Mo/s</span><span class="tag">Aléatoire ${d.ranRead ?? '—'} Mo/s</span></div>`).join('')}</div>` : ''}`;
}

BIND.diag = () => {
  if (S.diag?.state === 'running') { $('#diag-cancel').onclick = () => api.diag.cancel(); return; }
  if (S.diag?.state === 'done') {
    const R = S.diag.result;
    $('#r-open').onclick = () => api.openPath(R.reportFile);
    $('#r-folder').onclick = () => api.openPath(R.reportFile.replace(/[\\/][^\\/]+$/, ''));
    $('#r-new').onclick = () => { S.diag = null; render(); };
    return;
  }
  $$('[data-profile]').forEach(c => c.onclick = () => { S.diagProfile = c.dataset.profile; $$('[data-profile]').forEach(x => x.classList.toggle('selected', x === c)); });
  $$('[data-report]').forEach(r => r.onclick = () => api.openPath(S.reports[+r.dataset.report].file));
  $('#diag-go').onclick = startDiag;
};

async function startDiag() {
  const id = S.diagProfile;
  if (id === 'extreme' && !(await confirmBox('Diagnostic extrême', 'Ce test pousse le CPU, la carte graphique, la RAM et l\'alimentation au maximum pendant ~15 minutes.\n\nIl n\'est PAS représentatif d\'un usage réel et n\'est pas plus complet que les autres : il sert à vérifier la stabilité et l\'alimentation.\n\nDes températures élevées sont normales. Le test s\'arrête automatiquement si la limite de température est atteinte.', 'Lancer le test extrême'))) return;
  if (!S.sys.admin && id !== 'config' && !(await confirmBox('Droits administrateur', 'Sans droits administrateur, le débit des disques et certaines données SMART ne pourront pas être mesurés.\n\nContinuer quand même ?', 'Continuer'))) return;
  const note = $('#diag-note')?.value.trim() || '';
  S.diag = { state: 'running', profile: id, note, steps: S.profiles[id].steps, cur: 0, pct: 0 };
  renderNav(); render(); showConsole();
  const R = await api.diag.run({ profile: id, note });
  S.reports = await api.reports.list();
  if (!R) { S.diag = null; toast('Diagnostic annulé.', 'warn'); }
  else if (R.error) { S.diag = null; toast(`Erreur : ${R.error}`, 'error'); }
  else { S.diag = { state: 'done', result: R }; toast(`Diagnostic terminé — ${R.score}/100. Rapport enregistré sur le Bureau.`, 'success'); }
  setGlobal(0, 'Prêt'); renderNav();
  if (S.page === 'diag') render(); else if (R && !R.error) go('diag');
}

api.diag.onStep((s) => {
  if (!S.diag || S.diag.state !== 'running') return;
  if (s.index != null) S.diag.cur = s.index;
  Object.assign(S.diag, { label: s.label, pct: s.pct ?? S.diag.pct, total: s.seconds || 0, elapsed: 0 });
  setGlobal(S.diag.pct, s.label);
  rerender('diag');
});
api.diag.onTick((t) => {
  const D = S.diag; if (!D || D.state !== 'running') return;
  D.label = t.label; D.elapsed = t.elapsed; D.total = t.total; D.live = t.live || D.live;
  if (S.page !== 'diag') return;
  $('#d-label') && ($('#d-label').textContent = t.label);
  $('#d-time') && ($('#d-time').textContent = t.total ? `${t.elapsed} s / ${t.total} s` : 'Mesure en cours…');
  const L = D.live || {};
  const set = (k, v, unit, pct) => { const el = document.querySelector(`[data-g="${k}"]`); if (!el) return; el.innerHTML = `${v ?? '—'}<small>${unit}</small>`; const b = el.parentElement.querySelector('.bar-fill'); if (b && pct != null) b.style.width = `${pct}%`; };
  set('CPU', L.cpu != null ? Math.round(L.cpu) : null, '%', L.cpu); set('Fréquence', L.mhz, 'MHz'); set('GPU', L.gpu != null ? Math.round(L.gpu) : null, '%', L.gpu);
  set('RAM', L.ram != null ? Math.round(L.ram) : null, '%', L.ram); set('Temp. CPU', L.cpuTemp, '°C'); set('Temp. GPU', L.gpuTemp, '°C');
});

// ════════════════════ MONITORING ════════════════════
const MON = [
  { k: 'cpu', label: 'Processeur', icon: 'cpu', unit: '%', max: 100, sub: (s) => `${s.mhz ?? '—'} MHz` },
  { k: 'mhz', label: 'Fréquence CPU', icon: 'bolt2', unit: 'MHz', max: null, sub: (s) => `${s.perf ?? '—'} % de la fréquence de base` },
  { k: 'ram', label: 'Mémoire', icon: 'memory', unit: '%', max: 100, sub: (s) => `${s.ramUsedGB} / ${s.ramTotalGB} Go` },
  { k: 'gpu', label: 'Carte graphique', icon: 'gpu', unit: '%', max: 100, sub: () => 'Moteur le plus chargé' },
  { k: 'disk', label: 'Disques', icon: 'disk', unit: '', max: null, val: (s) => (s.diskR || 0) + (s.diskW || 0), fmt: fmtBytes, sub: (s) => `Lecture ${fmtBytes(s.diskR)} · Écriture ${fmtBytes(s.diskW)}` },
  { k: 'net', label: 'Réseau', icon: 'net', unit: '', max: null, val: (s) => (s.rx || 0) + (s.tx || 0), fmt: fmtBytes, sub: (s) => `↓ ${fmtBytes(s.rx)} · ↑ ${fmtBytes(s.tx)}` },
  { k: 'cpuTemp', label: 'Température CPU', icon: 'temp', unit: '°C', max: 110, sub: (s) => s.cpuTemp == null ? sensorHint() : `${({ lhm: 'Capteur du processeur', cores: 'Capteur des cœurs', mb: 'Estimée : sonde CPU de la carte mère', acpi: 'Estimée : zone thermique ACPI' })[s.cpuTempSrc] || ''}${s.cpuPower != null ? ` · ${Math.round(s.cpuPower)} W` : ''}${s.vrmTemp != null ? ` · VRM ${Math.round(s.vrmTemp)} °C` : ''}` },
  { k: 'gpuTemp', label: 'Température GPU', icon: 'temp', unit: '°C', max: 110, sub: (s) => s.gpuTemp == null ? 'Non disponible' : [s.gpuTempSrc === 'cpu' ? 'Estimée : GPU intégré (temp. du processeur)' : s.gpuTempSrc === 'hotspot' ? 'Estimée : point chaud du GPU' : '',s.gpuHotspot != null ? `Point chaud ${Math.round(s.gpuHotspot)} °C` : '', s.gpuPower != null ? `${Math.round(s.gpuPower)} W` : ''].filter(Boolean).join(' · ') || 'Pilote graphique' },
];
PAGES.monitor = () => head('Monitoring', 'Charge, fréquences et débits en temps réel (rafraîchi toutes les ~1,5 s, 2 dernières minutes affichées).',
  `${S.sens?.pawnio && S.sens.pawnio !== 'running' ? `<button class="ghost" id="mon-hw" data-busy>${ic('temp')}Installer le pilote de capteurs</button>` : ''}<button class="ghost" id="mon-ov">${ic('monitor')}${S.overlayOn ? 'Masquer l’overlay' : 'Afficher l’overlay'}</button><button class="${S.mon.on ? 'danger' : 'primary'}" id="mon-toggle">${ic(S.mon.on ? 'stop' : 'play')}${S.mon.on ? 'Arrêter' : 'Démarrer'}</button>`) + `
  <div class="mon">${MON.map(m => `
    <div class="card mon-card">
      <div class="h"><div class="k">${ic(m.icon)}${m.label}</div><div class="v" id="mv-${m.k}">—</div></div>
      <div class="sub" id="ms-${m.k}"></div>
      <canvas id="mc-${m.k}"></canvas>
    </div>`).join('')}
  </div>`;
BIND.monitor = () => {
  $('#mon-toggle').onclick = () => (S.mon.on ? stopMonitor() : startMonitor());
  $('#mon-hw') && ($('#mon-hw').onclick = installPawnIO);
  $('#mon-ov').onclick = async () => { S.overlayOn = await api.overlay.toggle(!S.overlayOn); rerender('monitor'); };
  if (!S.mon.on) startMonitor(); else drawMonitor();
};
let offSample = null;
async function startMonitor() {
  S.mon.on = true;
  const hist = await api.monitor.start();
  S.mon.samples = hist || [];
  if (!offSample) offSample = api.monitor.onSample((s) => { S.mon.samples.push(s); if (S.mon.samples.length > 120) S.mon.samples.shift(); if (S.page === 'monitor') drawMonitor(); });
  if (S.page === 'monitor') { const b = $('#mon-toggle'); if (b) { b.className = 'danger'; b.innerHTML = `${ic('stop')}Arrêter`; } drawMonitor(); }
}
function stopMonitor() {
  if (!S.mon.on) return;
  S.mon.on = false; api.monitor.stop();
  if (offSample) { offSample(); offSample = null; }
  const b = $('#mon-toggle'); if (b) { b.className = 'primary'; b.innerHTML = `${ic('play')}Démarrer`; }
}
function drawMonitor() {
  const sm = S.mon.samples, last = sm[sm.length - 1];
  const css = getComputedStyle(document.documentElement);
  const red = css.getPropertyValue('--red').trim(), grid = css.getPropertyValue('--chart-grid').trim();
  for (const m of MON) {
    const val = (s) => (m.val ? m.val(s) : s[m.k]);
    const vEl = $(`#mv-${m.k}`); if (!vEl) continue;
    if (last) {
      const v = val(last);
      vEl.innerHTML = v == null ? '—' : m.fmt ? m.fmt(v) : `${Math.round(v)}<small>${m.unit}</small>`;
      $(`#ms-${m.k}`).textContent = m.sub(last);
    }
    const cv = $(`#mc-${m.k}`); const w = cv.clientWidth, h = cv.clientHeight, dpr = devicePixelRatio || 1;
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    x.strokeStyle = grid; x.lineWidth = 1;
    for (let i = 1; i < 4; i++) { const y = Math.round((h / 4) * i) + .5; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
    const pts = sm.map(val).filter(v => v != null);
    if (pts.length < 2) continue;
    const max = m.max || Math.max(...pts, 1) * 1.15;
    const step = w / 119, off = w - (pts.length - 1) * step;
    const P = pts.map((v, i) => [off + i * step, h - (Math.min(v, max) / max) * (h - 6) - 3]);
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(208,32,43,.35)'); g.addColorStop(1, 'rgba(208,32,43,0)');
    x.beginPath(); x.moveTo(P[0][0], h); P.forEach(([a, b]) => x.lineTo(a, b)); x.lineTo(P[P.length - 1][0], h); x.closePath(); x.fillStyle = g; x.fill();
    x.beginPath(); P.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.strokeStyle = red; x.lineWidth = 1.8; x.lineJoin = 'round'; x.stroke();
  }
}

function sensorHint() {
  if (!S.sys?.admin) return 'Droits administrateur requis';
  if (S.sens?.pawnio && S.sens.pawnio !== 'running') return 'Pilote de capteurs PawnIO requis';
  return 'Capteur non disponible sur ce PC';
}
async function installPawnIO() {
  if (!(await confirmBox('Pilote de capteurs PawnIO', 'RGA Tools va télécharger l’installeur officiel de PawnIO (GitHub, pilote signé et open source) et le lancer.\n\nSuivez l’assistant, puis relancez RGA Tools pour afficher la température du processeur.', 'Télécharger et installer'))) return;
  setBusy(true); showConsole();
  try { await api.sensors.installPawnIO(); } finally { setBusy(false); setGlobal(0, 'Prêt'); }
}

// ════════════════════ CONFIGURATION ════════════════════
const kv = (pairs) => `<table class="kv">${pairs.filter(p => p[1] != null && p[1] !== '' && p[1] !== ' ').map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>`;
const cardSpec = (icon, title, body) => `<div class="card"><h3><span class="tool-ic">${ic(icon)}</span>${title}</h3>${body}</div>`;
PAGES.config = () => {
  const C = S.config;
  const actions = `<button class="ghost" id="cfg-refresh" data-busy>${ic('refresh')}Actualiser</button><button class="primary" id="cfg-export" data-busy>${ic('file')}Exporter le rapport</button>`;
  if (!C) return head('Configuration PC', 'Inventaire matériel et logiciel du poste, lu localement via WMI.', actions) + `<div class="card empty">${S.configLoading ? 'Lecture de la configuration… (20 à 60 secondes)' : 'Cliquez sur « Actualiser » pour lire la configuration.'}</div>`;
  const I = C.inventory || {}, H = C.health || {};
  const m = (s) => `<span class="m">${esc(s)}</span>`;
  const yes = (b) => b == null ? '—' : b ? 'Oui' : 'Non';
  return head('Configuration PC', `${esc(I.system?.maker)} ${esc(I.system?.model)} · ${esc(I.host)}`, actions) + `
  <div class="spec">
    ${cardSpec('pc', 'Système', kv([['Windows', `${esc(I.os?.name)} ${esc(I.os?.version)}`], ['Build', esc(I.os?.build)], ['Architecture', esc(I.os?.arch)], ['Installé le', esc(I.os?.installed)], ['Allumé depuis', `${esc(I.os?.uptimeH)} h ${m(`(${I.os?.boot})`)}`], ['Utilisateur', esc(I.user)], ['Mode d\'alimentation', esc(I.powerPlan)], ['Antivirus', esc((I.security?.antivirus || []).join(', '))]]))}
    ${cardSpec('board', 'Carte mère', kv([['Fabricant', esc(I.board?.maker)], ['Modèle', esc(I.board?.model)], ['BIOS', `${esc(I.board?.bios)} ${m(`(${I.board?.biosDate})`)}`], ['Firmware', esc(I.board?.uefi)], ['Secure Boot', yes(I.board?.secureBoot)], ['TPM', esc(I.board?.tpm) || '—'], ['N° de série PC', esc(I.system?.serial)]]))}
    ${(I.cpu || []).map(c => cardSpec('cpu', 'Processeur', kv([['Modèle', esc(c.name)], ['Cœurs / threads', `${c.cores} / ${c.threads}`], ['Fréquence de base', `${c.maxMHz} MHz`], ['Cache L2 / L3', `${Math.round(c.l2KB / 1024)} / ${Math.round(c.l3KB / 1024)} Mo`], ['Socket', esc(c.socket)], ['Virtualisation', yes(c.virt)]]))).join('')}
    ${cardSpec('memory', `Mémoire — ${I.ram?.totalGB} Go`, kv([['Emplacements', `${(I.ram?.modules || []).length} / ${I.ram?.slots ?? '?'} utilisés`], ...(I.ram?.modules || []).map(x => [esc(x.slot), `${x.sizeGB} Go · ${x.configured || x.speed} MHz<br>${m(`${x.maker} ${x.part}`)}`])]))}
    ${(I.gpu || []).map(g => cardSpec('gpu', 'Carte graphique', kv([['Modèle', esc(g.name)], ['Mémoire', g.vramMB ? `${g.vramMB} Mo` : '—'], ['Pilote', `${esc(g.driver)} ${m(`(${g.driverDate})`)}`], ['Affichage', esc(g.res) || '—']]))).join('')}
    ${(I.disks || []).map(d => cardSpec('disk', esc(d.name), kv([['Type', `${esc(d.media)} · ${esc(d.bus)}`], ['Capacité', `${d.sizeGB} Go`], ['État', d.health === 'Healthy' ? '<span class="tag ok">Sain</span>' : `<span class="tag err">${esc(d.health)}</span>`], ['Température', d.temp != null ? `${d.temp} °C` : null], ['Usure', d.wear != null ? `${d.wear} %` : null], ['Heures d\'utilisation', d.hours != null ? `${d.hours} h` : null]]))).join('')}
    ${cardSpec('folder', 'Volumes', kv((I.volumes || []).map(v => { const pct = v.sizeGB ? Math.round(100 - (v.freeGB / v.sizeGB) * 100) : 0; return [`${esc(v.letter)}: ${esc(v.label)}`, `${v.freeGB} Go libres / ${v.sizeGB} Go<div class="bar" style="margin-top:6px"><div class="bar-fill" style="width:${pct}%;${pct > 90 ? 'background:var(--err)' : ''}"></div></div>`]; })))}
    ${cardSpec('net', 'Réseau', kv([['Adresse IPv4', esc(I.network?.ipv4)], ['Passerelle', esc(I.network?.gateway)], ['DNS', esc((I.network?.dns || []).join(', '))], ...(I.network?.adapters || []).map(a => [esc(a.name), `${esc(a.desc)}<br>${m(`${a.status} · ${a.speed} · ${a.mac}`)}`])]))}
    ${I.battery ? cardSpec('battery', 'Batterie', kv([['Modèle', esc(I.battery.name)], ['Charge', `${I.battery.charge} %`], ['Capacité d\'origine', I.battery.design ? `${I.battery.design} mWh` : null], ['Capacité actuelle', I.battery.full ? `${I.battery.full} mWh` : null], ['Santé', I.battery.health ? `${I.battery.health} %` : null]])) : ''}
    ${cardSpec('heart', 'Santé (30 derniers jours)', kv([['Erreurs matérielles WHEA', H.whea ? `<span class="tag err">${H.whea}</span>` : '0'], ['Écrans bleus', H.bsod ? `<span class="tag err">${H.bsod}</span>` : '0'], ['Arrêts inattendus', H.unexpectedShutdown ? `<span class="tag warn">${H.unexpectedShutdown}</span>` : '0'], ['Erreurs disque', H.diskErrors ? `<span class="tag warn">${H.diskErrors >= 1000 ? '1000+' : H.diskErrors}</span>` : '0'], ['Plantages d\'applications', H.appCrashes], ['Périphériques en erreur', (H.badDevices || []).length ? (H.badDevices || []).map(d => `${esc(d.name)} ${m(`(code ${d.code})`)}`).join('<br>') : 'Aucun'], ['Windows activé', yes(H.activated)], ['Dernière mise à jour', esc(H.lastUpdate)], ['Programmes au démarrage', H.startupCount], ['Antivirus temps réel', H.defender ? yes(H.defender.realtime) : '—']]))}
  </div>`;
};
async function loadConfig() {
  S.configLoading = true; setBusy(true); rerender('config');
  try { S.config = await api.config(); } finally { S.configLoading = false; setBusy(false); rerender('config'); }
}
BIND.config = () => {
  $('#cfg-refresh').onclick = loadConfig;
  $('#cfg-export').onclick = () => { S.diagProfile = 'config'; go('diag'); startDiag(); };
  if (!S.config && !S.configLoading) loadConfig();
};

// ════════════════════ JOURNAUX WINDOWS ════════════════════
const EV_TOOLS = {
  chkdsk: ['Vérifier le disque C:', 'disk', async () => { setBusy(true); showConsole(); try { await api.events.tool('chkdsk'); } finally { setBusy(false); setGlobal(0, 'Prêt'); } }],
  drivers: ['Gestionnaire de périphériques', 'settings', () => api.events.tool('drivers')],
  wu: ['Résolution des problèmes', 'wrench', () => api.events.tool('wu')],
  minidump: ['Fichiers de vidage', 'folder', () => api.events.tool('minidump')],
  diag: ['Diagnostic PC', 'stetho', () => go('diag')],
  sfc: ['Lancer SFC', 'shield', async () => { setBusy(true); showConsole(); try { await api.repair('sfc'); } finally { setBusy(false); setGlobal(0, 'Prêt'); } }],
  dism: ['Lancer DISM', 'wrench', async () => { setBusy(true); showConsole(); try { await api.repair('dism'); } finally { setBusy(false); setGlobal(0, 'Prêt'); } }],
  net: ['Réparation réseau', 'globe', () => { S.utilsTab = 'net'; go('utils'); }],
  clean: ['Nettoyage', 'virus', () => go('clean')],
};
const SEV_UI = { error: ['err', 'Problème', 'x'], warn: ['warn', 'Attention', 'alert'], info: ['', 'Info', 'info'], unknown: ['', 'Non reconnu', 'info'], ignore: ['', 'Sans gravité', 'check'] };
const fmtDate = (iso) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function evChart(res) {
  const days = res.days || 7, out = [];
  const max = Math.max(1, ...Object.values(res.perDay).map(d => d.c + d.e + d.w));
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    const v = res.perDay[d] || { c: 0, e: 0, w: 0 };
    const h = (n) => `${(n / max) * 100}%`;
    out.push(`<div class="dbar" title="${new Date(d).toLocaleDateString('fr-FR')} : ${v.c} critique(s), ${v.e} erreur(s), ${v.w} avertissement(s)">
      <i class="w" style="height:${h(v.w)}"></i><i class="e" style="height:${h(v.e)}"></i><i class="c" style="height:${h(v.c)}"></i></div>`);
  }
  return `<div class="daychart">${out.join('')}</div>
    <div class="legend"><span><i class="c"></i>Critique</span><span><i class="e"></i>Erreur</span><span><i class="w"></i>Avertissement</span><span class="mut">${days} derniers jours</span></div>`;
}

function evGroupDetail(g) {
  const tool = g.tool && EV_TOOLS[g.tool];
  const search = `https://www.google.com/search?q=${encodeURIComponent(`"${g.provider}" event ID ${g.id}`)}`;
  return `<div class="ev-detail">
    ${g.cause ? `<p><b>Cause probable :</b> ${esc(g.cause)}</p>` : ''}
    ${g.details?.length ? `<ul class="ev-facts">${g.details.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
    ${g.before ? `<p><b>Juste avant l’arrêt :</b> ${g.before.length ? esc(g.before.join(' ; ')) : 'aucune erreur ni avertissement dans les 15 minutes précédentes.'}</p>` : ''}
    ${g.trend ? `<p class="mut" style="font-size:12.5px">${esc(g.trend)} · première fois le ${fmtDate(g.first)}</p>` : ''}
    ${g.action ? `<p><b>Que faire :</b> ${esc(g.action)}</p>` : ''}
    <div class="ev-samples">${g.samples.map(s => `<div><span class="t">${fmtDate(s.t)}</span><span>${esc(s.m)}</span></div>`).join('')}</div>
    <div class="actions" style="margin-top:10px">
      ${tool ? `<button class="primary sm" data-evtool="${g.tool}" data-busy>${ic(tool[1])}${tool[0]}</button>` : ''}
      <button class="ghost sm" data-evsearch="${esc(search)}">${ic('external')}Rechercher en ligne</button>
      <span class="mut" style="font-size:12px">${esc(g.provider)} · ID ${g.id} · ${esc(g.log)}</span>
    </div></div>`;
}

PAGES.events = () => {
  const E = S.ev, R = E.res;
  const chip = (group, k, label) => `<button class="chip ${E[group][k] ? 'on' : ''}" data-chip="${group}:${k}">${label}</button>`;
  let body = '';
  if (E.loading) body = `<div class="card empty">Lecture et analyse des journaux…</div>`;
  else if (!R) body = `<div class="card empty">Choisissez la période puis cliquez sur « Analyser ». Les erreurs connues (écrans bleus, disques, pilotes, mises à jour, réseau…) sont expliquées avec la marche à suivre.</div>`;
  else {
    const crit = R.problems.filter(p => p.sev === 'error').length;
    const q = (E.q || '').toLowerCase();
    const shown = R.groups.filter(g => (E.showAll || g.sev !== 'ignore') && (!q || `${g.title} ${g.provider} ${g.id} ${g.cat}`.toLowerCase().includes(q)));
    body = `
    <div class="stats">
      <div class="stat"><div class="k">Critiques</div><div class="v" style="color:${R.totals.critical ? 'var(--err)' : ''}">${R.totals.critical}</div></div>
      <div class="stat"><div class="k">Erreurs</div><div class="v" style="color:${R.totals.error ? 'var(--err)' : ''}">${R.totals.error}</div></div>
      <div class="stat"><div class="k">Avertissements</div><div class="v">${R.totals.warning}</div></div>
      <div class="stat"><div class="k">Problèmes identifiés</div><div class="v" style="color:${crit ? 'var(--err)' : R.problems.length ? 'var(--warn)' : 'var(--ok)'}">${R.problems.length}</div></div>
    </div>
    <div class="note ${crit ? 'warn' : ''}" style="margin-top:12px">${ic(crit ? 'alert' : 'info')}<div><b>${esc(R.summary)}</b> ${R.total} événement(s) analysé(s).</div></div>
    <div class="card">${evChart(R)}</div>
    <h2 class="section">Diagnostic <span class="count">${R.problems.length}</span></h2>
    ${R.problems.length ? `<div class="list">${R.problems.map(g => { const [cls, , icon] = SEV_UI[g.sev]; const open = E.open.has(g.key); return `
      <div class="ev-row ${open ? 'open' : ''}">
        <div class="row clickable" data-evopen="${esc(g.key)}">
          <span class="lv ${g.sev}">${ic(icon)}</span>
          <div class="grow"><div class="area">${esc(g.cat)}</div><b>${esc(g.title)}</b><div class="sub">${esc(g.cause)}</div></div>
          <span class="tag ${cls}">${g.count}×</span><span class="tag">Dernier : ${fmtDate(g.last)}</span>${ic('chevron', 'chev')}
        </div>${open ? evGroupDetail(g) : ''}</div>`; }).join('')}</div>`
      : `<div class="card empty">${ic('check')} Aucun problème connu n'a été détecté sur cette période.</div>`}
    <h2 class="section">Tous les événements <span class="count">${shown.length} groupe(s)</span></h2>
    <div class="actions" style="margin-bottom:10px">
      <input class="input" id="ev-q" placeholder="Filtrer (source, ID, texte…)" value="${esc(E.q || '')}" style="flex:1;min-width:240px;font-family:var(--font);letter-spacing:0" />
      <label class="mut" style="display:flex;gap:8px;align-items:center;font-size:12.5px"><span class="switch"><input type="checkbox" id="ev-all" ${E.showAll ? 'checked' : ''}><span></span></span>Afficher les événements sans gravité</label>
    </div>
    <div class="list">${shown.length ? shown.map(g => { const [cls, label] = SEV_UI[g.sev]; const open = E.open.has('all:' + g.key); return `
      <div class="ev-row ${open ? 'open' : ''}">
        <div class="row clickable" data-evopen="all:${esc(g.key)}">
          <span class="tag ${cls}" style="min-width:86px;text-align:center">${label}</span>
          <div class="grow"><b>${esc(g.title)}</b><div class="sub">${esc(g.provider)} · ID ${g.id} · ${esc(g.log)}</div></div>
          <span class="tag">${g.count}×</span><span class="tag">${fmtDate(g.last)}</span>${ic('chevron', 'chev')}
        </div>${open ? evGroupDetail(g) : ''}</div>`; }).join('') : '<div class="empty">Aucun événement.</div>'}</div>`;
  }
  return head('Journaux Windows', 'Lit les journaux d\'événements de Windows et explique les erreurs connues, avec la marche à suivre.',
    `<button class="ghost" id="ev-viewer">${ic('external')}Observateur d'événements</button>
     <button class="ghost" id="ev-export" ${R ? '' : 'disabled'}>${ic('download')}Exporter (.csv)</button>
     <button class="primary" id="ev-go" data-busy>${ic('scan')}Analyser</button>`) + `
  <div class="card" style="margin-bottom:16px">
    <div class="form-row" style="gap:22px">
      <div class="field" style="flex:0 0 auto;min-width:0"><label>Période</label>
        <div class="seg" id="ev-days">${[[1, '24 h'], [7, '7 jours'], [30, '30 jours'], [90, '90 jours']].map(([d, l]) => `<button data-v="${d}" class="${E.days === d ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="field" style="flex:0 0 auto;min-width:0"><label>Niveaux</label><div class="chips">${chip('levels', 1, 'Critique')}${chip('levels', 2, 'Erreur')}${chip('levels', 3, 'Avertissement')}</div></div>
      <div class="field" style="flex:0 0 auto;min-width:0"><label>Journaux</label><div class="chips">${chip('logs', 'System', 'Système')}${chip('logs', 'Application', 'Application')}${chip('logs', 'Defender', 'Defender')}</div></div>
    </div>
  </div>${body}`;
};

async function analyzeEvents() {
  const E = S.ev;
  const levels = Object.keys(E.levels).filter(k => E.levels[k]).map(Number);
  const logs = Object.keys(E.logs).filter(k => E.logs[k]);
  if (!levels.length || !logs.length) return toast('Sélectionnez au moins un niveau et un journal.', 'warn');
  E.loading = true; E.open = new Set(); setBusy(true); rerender('events');
  try { E.res = await api.events.analyze({ days: E.days, levels, logs }); }
  catch (e) { toast(`Erreur : ${e.message}`, 'error'); }
  finally { E.loading = false; setBusy(false); rerender('events'); }
}

BIND.events = () => {
  const E = S.ev;
  $('#ev-go').onclick = analyzeEvents;
  $('#ev-viewer').onclick = () => api.events.tool('eventvwr');
  $('#ev-export').onclick = () => E.res && api.events.export(E.res.groups);
  $('#ev-days').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; E.days = +b.dataset.v; $$('#ev-days button').forEach(x => x.classList.toggle('on', x === b)); };
  $$('[data-chip]').forEach(c => c.onclick = () => { const [g, k] = c.dataset.chip.split(':'); E[g][k] = !E[g][k]; c.classList.toggle('on', E[g][k]); });
  $$('[data-evopen]').forEach(r => r.onclick = () => { const k = r.dataset.evopen; E.open.has(k) ? E.open.delete(k) : E.open.add(k); rerender('events'); });
  $$('[data-evtool]').forEach(b => b.onclick = (ev) => { ev.stopPropagation(); EV_TOOLS[b.dataset.evtool][2](); });
  $$('[data-evsearch]').forEach(b => b.onclick = (ev) => { ev.stopPropagation(); api.openUrl(b.dataset.evsearch); });
  const q = $('#ev-q');
  if (q) q.oninput = () => { E.q = q.value; clearTimeout(E.t); E.t = setTimeout(() => { rerender('events'); const n = $('#ev-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
  const all = $('#ev-all'); if (all) all.onchange = () => { E.showAll = all.checked; rerender('events'); };
};

// ════════════════════ OUTILS DE TEST (tiers) ════════════════════
const TOOL_IC = { adw: 'broom', mbam: 'virus', eset: 'scan', defender: 'shield', occt: 'cpu', hwinfo: 'chart', cinebench: 'pulse', memtest: 'memory', crystaldisk: 'disk', furmark: 'gpu', coretemp: 'temp' };
function toolCard(t, prefix) {
  const label = { download: 'Télécharger et lancer', zip: 'Télécharger et lancer', url: 'Ouvrir le site', memtest: 'Planifier le test', defender: t.action }[t.kind];
  const icon = t.kind === 'url' ? 'external' : t.kind === 'defender' || t.kind === 'memtest' ? 'play' : 'download';
  return `<div class="card tool-card">
    <div class="card-top"><div class="tool-ic">${ic(TOOL_IC[t.id] || 'wrench')}</div><div><h3>${esc(t.name)}</h3><div class="desc">${esc(t.desc)}</div></div></div>
    <div class="card-foot"><div class="status" data-status="${prefix}:${t.id}"></div><button class="${t.kind === 'url' ? 'ghost' : 'primary'} sm" data-tool="${t.id}">${ic(icon)}${label}</button></div>
    <div class="mini-bar" data-bar="${prefix}:${t.id}"><i></i></div></div>`;
}
function bindTools(list, prefix) {
  $$('[data-tool]').forEach(b => b.onclick = async () => {
    const t = list.find(x => x.id === b.dataset.tool);
    if (t.kind === 'defender' && !(await confirmBox('Windows Defender Offline', 'L\'analyse hors-ligne redémarre immédiatement le PC.\nEnregistrez votre travail avant de continuer.', 'Redémarrer et analyser'))) return;
    b.disabled = true; try { await api.toolRun(`${prefix}:${t.id}`, t); } finally { b.disabled = false; }
  });
}
PAGES.tools = () => head('Outils de test', 'Logiciels de référence pour aller plus loin : stress-tests, sondes détaillées, santé des disques et de la mémoire.') +
  `<div class="grid wide">${S.cat.DIAG_TOOLS.map(t => toolCard(t, 'diag')).join('')}</div>`;
BIND.tools = () => bindTools(S.cat.DIAG_TOOLS, 'diag');

// ════════════════════ LOGICIELS ════════════════════
function softCard(p) {
  const [col, ini] = BRAND[p.id] || ['#555', p.name.slice(0, 2)];
  const arch = S.arch[p.id] || (S.sys.is64 ? 'x64' : 'x86');
  return `<div class="card selectable ${S.soft.has(p.id) ? 'selected' : ''}" data-soft="${p.id}">
    <div class="card-top"><div class="app-ic" style="background:${col}">${ini}</div><div><h3>${esc(p.name)}</h3><div class="desc">${esc(p.desc)}</div></div>${CHECK}</div>
    <div class="card-foot"><div class="status" data-status="soft:${p.id}">${p.msi ? 'Paquet MSI' : 'Installeur silencieux'}</div>
      ${p.x64 === p.x86 ? '' : `<div class="seg" data-arch="${p.id}"><button class="${arch === 'x64' ? 'on' : ''}" data-v="x64">x64</button><button class="${arch === 'x86' ? 'on' : ''}" data-v="x86">x86</button></div>`}</div>
    <div class="mini-bar" data-bar="soft:${p.id}"><i></i></div></div>`;
}
PAGES.soft = () => {
  const ess = S.cat.PROGRAMS.filter(p => p.group === 'essentiels'), opt = S.cat.PROGRAMS.filter(p => p.group === 'option');
  return head('Logiciels', 'Téléchargement depuis les sites officiels et installation silencieuse, sans aucune intervention.',
    `<button class="ghost" id="sel-ess">Essentiels</button><button class="ghost" id="sel-none">Tout désélectionner</button><button class="primary" id="soft-go" data-busy>${ic('download')}<span>Installer (${S.soft.size})</span></button>`) +
    `<h2 class="section">Essentiels <span class="count">${ess.length}</span></h2><div class="grid">${ess.map(softCard).join('')}</div>
     <h2 class="section">En option <span class="count">${opt.length}</span></h2><div class="grid">${opt.map(softCard).join('')}</div>`;
};
BIND.soft = () => {
  $$('[data-soft]').forEach(c => c.onclick = (e) => {
    if (e.target.closest('.seg')) return;
    const id = c.dataset.soft; S.soft.has(id) ? S.soft.delete(id) : S.soft.add(id);
    c.classList.toggle('selected'); $('#soft-go span').textContent = `Installer (${S.soft.size})`;
  });
  $$('[data-arch]').forEach(s => s.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; S.arch[s.dataset.arch] = b.dataset.v; $$('button', s).forEach(x => x.classList.toggle('on', x === b)); });
  $('#sel-ess').onclick = () => { S.cat.PROGRAMS.filter(p => p.group === 'essentiels').forEach(p => S.soft.add(p.id)); render(); };
  $('#sel-none').onclick = () => { S.soft.clear(); render(); };
  $('#soft-go').onclick = async () => {
    if (!S.soft.size) return toast('Sélectionnez au moins un logiciel.', 'warn');
    const items = S.cat.PROGRAMS.filter(p => S.soft.has(p.id)).map(p => ({ id: p.id, arch: S.arch[p.id] || (S.sys.is64 ? 'x64' : 'x86') }));
    setBusy(true); showConsole();
    try { const ok = await api.soft.install(items); toast(`${ok}/${items.length} logiciel(s) installé(s).`, ok === items.length ? 'success' : 'warn'); } finally { setBusy(false); }
  };
};

// ════════════════════ OFFICE ════════════════════
PAGES.office = () => head('Microsoft Office', 'Installation de Professional Plus via l\'Office Deployment Tool officiel de Microsoft.') + `
  <h2 class="section">Version</h2>
  <div class="grid">${S.cat.OFFICE.map(o => `
    <div class="card selectable ${S.office === o.id ? 'selected' : ''}" data-office="${o.id}">
      <div class="card-top"><div class="app-ic" style="background:#d83b01">${o.name.slice(-2)}</div><div><h3>${o.name}</h3><div class="desc">${o.note}</div></div>${CHECK}</div>
    </div>`).join('')}</div>
  <h2 class="section">Options</h2>
  <div class="card">
    <div class="form-row">
      <div class="field" style="flex:0 0 auto;min-width:0"><label>Architecture</label>
        <div class="seg" id="office-arch" style="height:38px;align-items:center"><button data-v="x64" class="${S.officeArch === 'x64' ? 'on' : ''}">64 bits</button><button data-v="x86" class="${S.officeArch === 'x86' ? 'on' : ''}">32 bits</button></div></div>
      <div class="field" style="flex:0 0 160px;min-width:0"><label>Langue</label>
        <select class="input" id="office-lang"><option value="fr-fr">Français</option><option value="en-us">English</option><option value="de-de">Deutsch</option><option value="es-es">Español</option><option value="it-it">Italiano</option></select></div>
      <div class="field"><label>Clé produit (facultatif — MAK / Retail)</label><input class="input" id="office-key" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" spellcheck="false" /></div>
      <button class="primary" id="office-go" data-busy>${ic('download')}Installer Office</button>
    </div>
    <div class="note">${ic('info')}<div>Office est téléchargé depuis les serveurs Microsoft (10 à 30 min selon la connexion). Sans clé, Office s'installe non activé : renseignez la clé de la licence ici ou plus tard dans <b>Licences</b>.</div></div>
  </div>
  <h2 class="section">Désinstallation</h2>
  <div class="card tool-card">
    <div class="card-top"><div class="tool-ic">${ic('trash')}</div><div><h3>Supprimer complètement Office</h3><div class="desc">Télécharge et lance l'assistant officiel Microsoft (SetupProd_OffScrub), qui remplace o15-ctrremove.</div></div></div>
    <div class="card-foot"><div class="status" data-status="office:offscrub"></div><button class="danger sm" id="offscrub">${ic('download')}Télécharger et lancer</button></div>
    <div class="mini-bar" data-bar="office:offscrub"><i></i></div>
  </div>`;
BIND.office = () => {
  $$('[data-office]').forEach(c => c.onclick = () => { S.office = c.dataset.office; $$('[data-office]').forEach(x => x.classList.toggle('selected', x === c)); });
  $('#office-arch').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; S.officeArch = b.dataset.v; $$('#office-arch button').forEach(x => x.classList.toggle('on', x === b)); };
  $('#office-go').onclick = async () => {
    if (!S.office) return toast('Sélectionnez une version d\'Office.', 'warn');
    setBusy(true); showConsole();
    try { const ok = await api.office.install({ id: S.office, arch: S.officeArch, key: $('#office-key').value, lang: $('#office-lang').value }); toast(ok ? 'Office installé.' : 'Installation Office non terminée — voir le journal.', ok ? 'success' : 'warn'); }
    finally { setBusy(false); }
  };
  $('#offscrub').onclick = () => { showConsole(); api.office.offscrub(); };
};

// ════════════════════ EXTENSIONS ════════════════════
PAGES.ext = () => head('Extensions', 'Ouvre directement la page d\'Adblock Plus dans le navigateur concerné.') + `
  <div class="list">${S.cat.EXTENSIONS.map(x => `
    <div class="row"><div class="tool-ic">${ic('globe')}</div><div class="grow"><b>Adblock Plus — ${x.name}</b><div class="sub">${esc(new URL(x.url).hostname)}</div></div>
      <button class="ghost sm" data-ext="${x.id}">${ic('external')}Ouvrir la page</button></div>`).join('')}</div>`;
BIND.ext = () => $$('[data-ext]').forEach(b => b.onclick = async () => {
  const x = S.cat.EXTENSIONS.find(e => e.id === b.dataset.ext);
  const r = await api.browserOpen({ exe: x.exe, url: x.url });
  toast(r === 'browser' ? `Page ouverte dans ${x.name}.` : `${x.name} introuvable — ouvert dans le navigateur par défaut.`, r === 'browser' ? 'success' : 'warn');
});

// ════════════════════ NETTOYAGE ════════════════════
PAGES.clean = () => head('Nettoyage', 'Suppression des virus, adwares et logiciels indésirables.') + `<div class="grid wide">${S.cat.CLEANERS.map(t => toolCard(t, 'clean')).join('')}</div>`;
BIND.clean = () => bindTools(S.cat.CLEANERS, 'clean');

// ════════════════════ RÉSEAU & COMPTES ════════════════════
PAGES.utils = () => {
  const tabs = [['net', 'Réseau', 'globe'], ['wifi', 'WiFi', 'wifi'], ['outlook', 'Outlook', 'mail']];
  return head('Réseau & comptes', 'Test et réparation de la connexion, profils WiFi et identifiants enregistrés.') +
    `<div class="tabs">${tabs.map(([id, l, i]) => `<button data-tab="${id}" class="${S.utilsTab === id ? 'on' : ''}">${ic(i)}${l}</button>`).join('')}</div><div>${UTILS[S.utilsTab]()}</div>`;
};
const pingTag = (p) => !p ? '<span class="tag err">Absente</span>' : p.ms == null ? '<span class="tag err">Injoignable</span>' : `<span class="tag ${p.loss ? 'warn' : 'ok'}">${p.ms} ms${p.loss ? ` · ${p.loss} % perte` : ''}</span>`;
const UTILS = {
  net: () => `
    <div class="card" style="margin-bottom:14px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div class="tool-ic">${ic('pulse')}</div>
      <div class="grow" style="flex:1"><h3>Test de connectivité</h3><div class="desc">Passerelle, accès Internet et résolution DNS.</div></div>
      ${S.netTest ? `<span class="tag">Passerelle</span>${pingTag(S.netTest.gateway)}<span class="tag">Internet</span>${pingTag(S.netTest.internet)}<span class="tag">DNS</span><span class="tag ${S.netTest.dns ? 'ok' : 'err'}">${S.netTest.dns ? 'OK' : 'Échec'}</span>` : ''}
      <button class="ghost" id="net-test" data-busy>${ic('play')}Tester</button>
    </div>
    <div class="actions" style="margin-bottom:12px"><button class="ghost sm" id="net-all">Tout sélectionner</button><button class="ghost sm" id="net-none">Tout désélectionner</button><span style="flex:1"></span><button class="primary" id="net-go" data-busy>${ic('play')}Exécuter la sélection</button></div>
    <div class="list">${S.cat.NET_FIXES.map(f => `
      <div class="row clickable" data-net="${f.id}"><span class="check ${S.net.has(f.id) ? 'on' : ''}"><svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg></span>
        <div class="grow"><code>${f.cmd}</code><div class="sub">${f.desc}</div></div>${f.reboot ? '<span class="tag warn">Redémarrage</span>' : ''}
        <div class="status" data-status="net:${f.id}" style="min-width:60px;justify-content:flex-end"></div></div>`).join('')}</div>
    <div class="note warn">${ic('alert')}<div>Un redémarrage peut être nécessaire après la réinitialisation de Winsock, IPv4 ou IPv6. <b>ipconfig /release</b> coupe la connexion jusqu'au renouvellement.</div></div>`,
  wifi: () => `
    <div class="actions" style="margin-bottom:12px"><button class="primary" id="wifi-list">${ic('refresh')}Afficher les réseaux</button><button class="ghost" id="wifi-reveal">${ic('eye')}${S.reveal ? 'Masquer' : 'Révéler'} les mots de passe</button><span style="flex:1"></span><button class="ghost" id="wifi-export">${ic('upload')}Exporter (.xml)</button><button class="ghost" id="wifi-import">${ic('download')}Importer</button></div>
    <div class="list" id="wifi-out">${wifiRows()}</div>
    <div class="note">${ic('info')}<div>L'export enregistre les profils avec leur clé en clair : conservez ces fichiers en lieu sûr. L'import les ajoute pour tous les utilisateurs du poste.</div></div>`,
  outlook: () => `
    <div class="actions" style="margin-bottom:12px"><button class="primary" id="creds-list">${ic('refresh')}Afficher les identifiants</button><button class="ghost" id="creds-manager">${ic('lock')}Gestionnaire d'identification Windows</button></div>
    <div class="list" id="creds-out">${credRows()}</div>
    <div class="note">${ic('info')}<div>Liste les comptes Outlook / Exchange / Microsoft 365 du Gestionnaire d'identification Windows. Les mots de passe sont chiffrés par Windows (DPAPI) et ne sont pas affichés.</div></div>`,
};
function wifiRows() {
  if (S.wifi === null) return `<div class="empty">Cliquez sur « Afficher les réseaux » pour lister les profils enregistrés.</div>`;
  if (S.wifi === 'loading') return `<div class="empty">Récupération des profils WiFi…</div>`;
  if (!S.wifi.length) return `<div class="empty">Aucun profil WiFi trouvé sur ce poste.</div>`;
  return S.wifi.map((w, i) => `<div class="row"><div class="tool-ic">${ic('wifi')}</div><div class="grow"><b>${esc(w.ssid)}</b><div class="sub">${esc(w.auth || '')}</div></div>
    ${w.pass ? `<span class="pass ${S.reveal ? '' : 'hidden'}">${esc(w.pass)}</span><button class="icon-btn" data-copy="${i}" title="Copier">${ic('copy')}</button>` : '<span class="tag">Aucune clé</span>'}</div>`).join('');
}
function credRows() {
  if (S.creds === null) return `<div class="empty">Cliquez sur « Afficher les identifiants ».</div>`;
  if (S.creds === 'loading') return `<div class="empty">Lecture du gestionnaire d'identification…</div>`;
  if (!S.creds.length) return `<div class="empty">Aucun identifiant enregistré. Ouvrez Outlook et connectez-vous pour qu'ils apparaissent.</div>`;
  return [...S.creds].sort((a, b) => b.outlook - a.outlook).map(c => `<div class="row"><div class="tool-ic">${ic(c.outlook ? 'mail' : 'lock')}</div>
    <div class="grow"><b style="word-break:break-all">${esc(c.target)}</b><div class="sub">${esc(c.user || '—')} · ${esc(c.type || '')}</div></div>${c.outlook ? '<span class="tag ok">Outlook / Office</span>' : ''}</div>`).join('');
}
BIND.utils = () => {
  $$('[data-tab]').forEach(b => b.onclick = () => { S.utilsTab = b.dataset.tab; render(); });
  if (S.utilsTab === 'net') {
    $('#net-test').onclick = async () => { setBusy(true); showConsole(); try { S.netTest = await api.net.test(); } finally { setBusy(false); rerender('utils'); } };
    $$('[data-net]').forEach(r => r.onclick = () => { const id = r.dataset.net; S.net.has(id) ? S.net.delete(id) : S.net.add(id); $('.check', r).classList.toggle('on'); });
    $('#net-all').onclick = () => { S.cat.NET_FIXES.forEach(f => S.net.add(f.id)); render(); };
    $('#net-none').onclick = () => { S.net.clear(); render(); };
    $('#net-go').onclick = async () => {
      if (!S.net.size) return toast('Sélectionnez au moins une commande.', 'warn');
      setBusy(true); showConsole();
      try { await api.net.fix(S.cat.NET_FIXES.filter(f => S.net.has(f.id)).map(f => f.id)); toast('Corrections réseau appliquées.', 'success'); } finally { setBusy(false); }
    };
  }
  if (S.utilsTab === 'wifi') {
    const bindCopy = () => $$('[data-copy]').forEach(b => b.onclick = () => { navigator.clipboard.writeText(S.wifi[+b.dataset.copy].pass); toast('Mot de passe copié.', 'success'); });
    bindCopy();
    $('#wifi-list').onclick = async () => { S.wifi = 'loading'; $('#wifi-out').innerHTML = wifiRows(); try { S.wifi = await api.wifi.list(); } catch { S.wifi = []; } $('#wifi-out').innerHTML = wifiRows(); bindCopy(); };
    $('#wifi-reveal').onclick = () => { S.reveal = !S.reveal; render(); };
    $('#wifi-export').onclick = () => { showConsole(); api.wifi.export(); };
    $('#wifi-import').onclick = () => { showConsole(); api.wifi.import(); };
  }
  if (S.utilsTab === 'outlook') {
    $('#creds-list').onclick = async () => { S.creds = 'loading'; $('#creds-out').innerHTML = credRows(); try { S.creds = await api.creds.list(); } catch { S.creds = []; } $('#creds-out').innerHTML = credRows(); };
    $('#creds-manager').onclick = () => api.creds.manager();
  }
};

// ════════════════════ OPTIMISATION ════════════════════
const optCard = (id, icon, title, desc, btn, cls = 'primary') => `<div class="card tool-card"><div class="card-top"><div class="tool-ic">${ic(icon)}</div><div><h3>${title}</h3><div class="desc">${desc}</div></div></div>
  <div class="card-foot"><span></span><button class="${cls} sm" id="${id}" data-busy>${btn}</button></div></div>`;
PAGES.optim = () => head('Optimisation & réparation', 'Nettoyage, réparation de Windows et réglages avancés.') + `
  <div class="grid wide">
    ${optCard('opt-restore', 'restore', 'Point de restauration', 'Crée un point de restauration système avant toute modification importante.', `${ic('restore')}Créer`, 'ghost')}
    ${optCard('opt-temp', 'broom', 'Fichiers temporaires', 'Vide les dossiers temporaires, le cache Windows Update, le cache Internet et la corbeille.', `${ic('trash')}Nettoyer`)}
    ${optCard('opt-sfc', 'shield', 'Vérifier les fichiers système (SFC)', 'Analyse et répare les fichiers système Windows corrompus. 5 à 15 minutes.', `${ic('play')}Lancer SFC`)}
    ${optCard('opt-dism', 'wrench', 'Réparer l\'image Windows (DISM)', 'Restaure le magasin de composants depuis Windows Update. À lancer si SFC échoue. 10 à 30 minutes.', `${ic('play')}Lancer DISM`)}
    ${optCard('opt-winutil', 'zap', 'Chris Titus Tech — WinUtil', 'Outil open source tout-en-un : télémétrie, bloatwares, réglages de performance. S\'ouvre dans PowerShell (connexion Internet requise).', `${ic('play')}Lancer WinUtil`)}
  </div>
  <div class="note warn">${ic('alert')}<div>Créez un point de restauration avant d'appliquer des réglages avec WinUtil. SFC et DISM nécessitent les droits administrateur.</div></div>`;
BIND.optim = () => {
  const job = (fn) => async () => { setBusy(true); showConsole(); try { await fn(); } finally { setBusy(false); setGlobal(0, 'Prêt'); } };
  $('#opt-restore').onclick = job(async () => toast((await api.restorePoint()) ? 'Point de restauration créé.' : 'Point de restauration non créé — voir le journal.', 'info'));
  $('#opt-temp').onclick = job(async () => { const mb = await api.cleanTemp(); toast(`${mb ?? 0} Mo libérés.`, 'success'); });
  $('#opt-sfc').onclick = job(() => api.repair('sfc'));
  $('#opt-dism').onclick = job(() => api.repair('dism'));
  $('#opt-winutil').onclick = () => { showConsole(); api.winutil(); };
};

// ════════════════════ LICENCES ════════════════════
PAGES.lic = () => head('Licences', 'Vérifiez l\'état d\'activation et installez les clés produit Windows et Office.',
  `<button class="ghost" id="lic-settings">${ic('settings')}Paramètres d'activation</button><button class="primary" id="lic-status" data-busy>${ic('refresh')}Vérifier le statut</button>`) + `
  <div class="grid two">
    <div class="card"><h3 style="margin-bottom:12px">Windows</h3>
      <div class="form-row"><div class="field"><label>Clé produit Windows</label><input class="input" id="win-key" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" spellcheck="false"/></div><button class="primary" id="win-act" data-busy>${ic('key')}Activer</button></div>
      <pre class="out" id="win-out" hidden></pre></div>
    <div class="card"><h3 style="margin-bottom:12px">Office</h3>
      <div class="form-row"><div class="field"><label>Clé produit Office (MAK / Retail)</label><input class="input" id="off-key" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" spellcheck="false"/></div><button class="primary" id="off-act" data-busy>${ic('key')}Activer</button></div>
      <pre class="out" id="off-out" hidden></pre></div>
  </div>
  <div class="note">${ic('info')}<div>Utilise les outils Microsoft intégrés (<b>slmgr</b> pour Windows, <b>OSPP</b> pour Office). Une clé valide issue de la licence est nécessaire.</div></div>`;
BIND.lic = () => {
  $('#lic-settings').onclick = () => api.openSettings('ms-settings:activation');
  $('#lic-status').onclick = async () => {
    setBusy(true); showConsole();
    try { const r = await api.lic.status(); $('#win-out').hidden = false; $('#win-out').textContent = r.windows || '—'; $('#off-out').hidden = false; $('#off-out').textContent = r.office || 'Office (OSPP.VBS) introuvable sur ce poste.'; }
    finally { setBusy(false); }
  };
  $('#win-act').onclick = async () => { setBusy(true); showConsole(); try { await api.lic.windowsKey($('#win-key').value); } finally { setBusy(false); } };
  $('#off-act').onclick = async () => { setBusy(true); showConsole(); try { await api.lic.officeKey($('#off-key').value); } finally { setBusy(false); } };
};

// ════════════════════ PARAMÈTRES ════════════════════
PAGES.settings = () => {
  const st = S.settings;
  return head('Paramètres', 'Préférences de RGA Tools.') + `
  <div class="list">
    <div class="row"><div class="tool-ic">${ic(st.theme === 'light' ? 'sun' : 'moon')}</div><div class="grow"><b>Thème</b><div class="sub">Apparence de l'application.</div></div>
      <div class="seg" id="set-theme"><button data-v="dark" class="${st.theme === 'dark' ? 'on' : ''}">Sombre</button><button data-v="light" class="${st.theme === 'light' ? 'on' : ''}">Clair</button></div></div>
    <div class="row"><div class="tool-ic">${ic('temp')}</div><div class="grow"><b>Limite de température</b><div class="sub">Interrompt les tests de charge si la température du processeur ou de la carte graphique dépasse cette valeur.</div></div>
      <select class="input" id="set-temp" style="width:120px">${[80, 85, 90, 95, 100].map(t => `<option value="${t}" ${st.tempLimit === t ? 'selected' : ''}>${t} °C</option>`).join('')}<option value="0" ${!st.tempLimit ? 'selected' : ''}>Désactivée</option></select></div>
    <div class="row"><div class="tool-ic">${ic('monitor')}</div><div class="grow"><b>Overlay pendant les tests</b><div class="sub">Affiche températures et charge en haut à droite de l'écran, au-dessus de toutes les fenêtres, pendant les tests de charge.</div></div>
      <label class="switch"><input type="checkbox" id="set-ov" ${st.overlay !== false ? 'checked' : ''}><span></span></label></div>
    <div class="row"><div class="tool-ic">${ic('temp')}</div><div class="grow"><b>Pilote de capteurs (PawnIO)</b><div class="sub">Pilote signé et open source utilisé par LibreHardwareMonitor pour lire la température et la consommation du processeur. À installer une fois par PC.</div></div>
      ${!S.sens ? '' : S.sens.pawnio === 'running' ? '<span class="tag ok">Installé</span>' : `<span class="tag warn">${S.sens.pawnio === 'stopped' ? 'Arrêté' : 'Absent'}</span><button class="primary sm" id="set-pawnio" data-busy>${ic('download')}Installer</button>`}</div>
    <div class="row"><div class="tool-ic">${ic('gpu')}</div><div class="grow"><b>Ignorer le test 3D</b><div class="sub">Utile sur les PC sans carte graphique compatible ou en bureau à distance.</div></div>
      <label class="switch"><input type="checkbox" id="set-gpu" ${st.skipGpu ? 'checked' : ''}><span></span></label></div>
    <div class="row"><div class="tool-ic">${ic('cloud')}</div><div class="grow"><b>Vérifier les mises à jour au démarrage</b><div class="sub">Propose automatiquement les nouvelles versions publiées sur GitHub.</div></div>
      <label class="switch"><input type="checkbox" id="set-upd" ${st.autoUpdate !== false ? 'checked' : ''}><span></span></label></div>
    <div class="row"><div class="tool-ic">${ic('folder')}</div><div class="grow"><b>Rapports de diagnostic</b><div class="sub">Bureau\\Diagnostics RGA</div></div>
      <button class="ghost sm" id="set-reports">${ic('folder')}Ouvrir le dossier</button></div>
  </div>
  <h2 class="section">Mises à jour</h2>
  <div class="card" id="upd-card">${updateCard()}</div>
  <h2 class="section">À propos</h2>
  <div class="card about">
    <img src="assets/logo-rga.png" alt="RGA Informatique" />
    <div><h3>RGA Tools v${esc(S.sys.version)}</h3><div class="desc" style="margin-top:6px">Boîte à outils technicien de RGA Informatique : diagnostic matériel, monitoring, installation de logiciels et d'Office, nettoyage, réparation réseau et système.<br>Toutes les analyses sont réalisées localement ; aucune donnée n'est transmise.</div></div>
  </div>`;
};
BIND.settings = () => {
  const save = async (patch) => { S.settings = await api.settings.set(patch); };
  $('#set-theme').onclick = async (e) => { const b = e.target.closest('button'); if (!b) return; await save({ theme: b.dataset.v }); applyTheme(b.dataset.v); render(); };
  $('#set-temp').onchange = (e) => save({ tempLimit: +e.target.value });
  $('#set-gpu').onchange = (e) => save({ skipGpu: e.target.checked });
  $('#set-ov').onchange = (e) => save({ overlay: e.target.checked });
  $('#set-pawnio') && ($('#set-pawnio').onclick = installPawnIO);
  $('#set-upd').onchange = (e) => save({ autoUpdate: e.target.checked });
  bindUpdate();
  $('#set-reports').onclick = async () => { const r = S.reports[0]; if (r) api.openPath(r.file.replace(/[\\/][^\\/]+$/, '')); else toast('Aucun rapport pour le moment.', 'info'); };
};

// ════════════════════ MISES À JOUR ════════════════════
function updateCard() {
  const U = S.upd, d = U.data, info = U.info || {};
  const modeTxt = { installed: 'version installée', portable: 'version portable', dev: 'mode développement' }[info.mode] || '';
  let status = '', action = `<button class="ghost" id="upd-check" ${U.state === 'checking' || U.state === 'downloading' ? 'disabled' : ''}>${ic('refresh')}Rechercher</button>`;
  if (U.state === 'checking') status = 'Recherche en cours…';
  else if (U.state === 'none') status = `<span class="tag ok">À jour</span> Aucune version plus récente que ${esc(d?.current || S.sys.version)}.`;
  else if (U.state === 'error') status = `<span class="tag err">Erreur</span> ${esc(U.error)}`;
  else if (U.state === 'available') { status = `<span class="tag warn">Version ${esc(d.version)} disponible</span>${d.publishedAt ? ` publiée le ${new Date(d.publishedAt).toLocaleDateString('fr-FR')}` : ''}`;
    action += info.mode === 'dev' ? '' : `<button class="primary" id="upd-dl">${ic('download')}Télécharger</button>`; }
  else if (U.state === 'downloading') status = `Téléchargement de la version ${esc(d.version)}… <b>${U.pct >= 0 ? U.pct + ' %' : ''}</b>`;
  else if (U.state === 'ready') { status = `<span class="tag ok">Version ${esc(d.version)} prête</span> RGA Tools va se fermer, se mettre à jour puis se relancer.`;
    action = `<button class="primary" id="upd-install">${ic('restore')}Installer et redémarrer</button>`; }
  return `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div class="tool-ic">${ic('cloud')}</div>
      <div style="flex:1;min-width:240px"><h3>RGA Tools v${esc(S.sys.version)} <span class="desc" style="font-weight:400">· ${modeTxt}</span></h3>
        <div class="desc" style="margin-top:4px">${status || 'Les nouvelles versions sont publiées sur GitHub.'}</div></div>
      <div class="actions">${action}</div></div>
    ${U.state === 'downloading' ? `<div class="big-bar"><i style="width:${Math.max(0, U.pct)}%"></i></div>` : ''}
    ${(U.state === 'available' || U.state === 'ready') && d?.notes ? `<pre class="out">${esc(d.notes.replace(/\r/g, ''))}</pre>` : ''}`;
}
function refreshUpdate() {
  const c = $('#upd-card'); if (c) { c.innerHTML = updateCard(); bindUpdate(); }
  const b = $('#tb-update');
  if (b) { const show = ['available', 'downloading', 'ready'].includes(S.upd.state); b.hidden = !show;
    b.innerHTML = `<span class="dot"></span>${S.upd.state === 'ready' ? 'Redémarrer pour mettre à jour' : `Mise à jour ${esc(S.upd.data?.version || '')}`}`; }
}
async function checkUpdate() {
  S.upd.state = 'checking'; refreshUpdate();
  const r = await api.update.check();
  S.upd.data = r;
  if (r.error) { S.upd.state = 'error'; S.upd.error = r.error; }
  else S.upd.state = r.available ? 'available' : 'none';
  refreshUpdate();
}
function bindUpdate() {
  $('#upd-check') && ($('#upd-check').onclick = checkUpdate);
  $('#upd-dl') && ($('#upd-dl').onclick = async () => {
    S.upd.state = 'downloading'; S.upd.pct = 0; refreshUpdate();
    const r = await api.update.download();
    if (r.error) { S.upd.state = 'error'; S.upd.error = r.error; } else S.upd.state = 'ready';
    refreshUpdate();
  });
  $('#upd-install') && ($('#upd-install').onclick = async () => {
    if (S.diag?.state === 'running' && !(await confirmBox('Diagnostic en cours', 'Le diagnostic en cours sera annulé.', 'Mettre à jour'))) return;
    const r = await api.update.install(); if (r.error) toast(r.error, 'error');
  });
}
api.overlay.onState((on) => { S.overlayOn = on; if (S.page === 'monitor') { const b = $('#mon-ov'); if (b) b.innerHTML = `${ic('monitor')}${on ? 'Masquer l’overlay' : 'Afficher l’overlay'}`; } });
api.update.onAvailable((r) => { S.upd.data = r; S.upd.state = 'available'; refreshUpdate(); toast(`Version ${r.version} de RGA Tools disponible.`, 'info'); });
api.update.onProgress((p) => { S.upd.pct = p; const bar = $('#upd-card .big-bar i'); if (bar) bar.style.width = `${Math.max(0, p)}%`; const b = $('#upd-card .desc b'); if (b) b.textContent = p >= 0 ? `${p} %` : ''; });

// ─── Démarrage ───
(async function init() {
  $('#btn-min').onclick = () => api.win.minimize();
  $('#btn-max').onclick = () => api.win.maximize();
  $('#btn-close').onclick = () => api.win.close();
  $('#console-toggle').onclick = () => $('#console').classList.toggle('collapsed');
  $('#console-clear').onclick = () => { $('#console-body').innerHTML = ''; logCount = 0; $('#console-count').textContent = 0; setGlobal(0, 'Prêt'); };

  [S.cat, S.sys, S.settings, S.profiles, S.reports, S.upd.info] = await Promise.all([api.catalog(), api.sysInfo(), api.settings.get(), api.diag.profiles(), api.reports.list(), api.update.info()]);
  api.sensors.status().then((st) => { S.sens = st; if (['monitor', 'settings'].includes(S.page)) rerender(S.page); });
  applyTheme(S.settings.theme);
  $('#btn-theme').onclick = async () => { const t = S.settings.theme === 'light' ? 'dark' : 'light'; S.settings = await api.settings.set({ theme: t }); applyTheme(t); if (S.page === 'monitor') drawMonitor(); if (S.page === 'settings') render(); };
  S.cat.PROGRAMS.filter(p => p.group === 'essentiels').forEach(p => S.soft.add(p.id));
  S.cat.NET_FIXES.forEach(f => S.net.add(f.id));

  $('#tb-ver').textContent = `v${S.sys.version}`;
  $('#side-foot').innerHTML = `<div>${esc(S.sys.host)}</div><div>${esc(S.sys.cpu)}</div>`;
  const c = $('#tb-center');
  if (S.sys.admin) c.innerHTML = `<span class="badge ok"><span class="dot"></span>Administrateur</span>`;
  else { c.innerHTML = `<button class="badge warn" title="Relancer en administrateur"><span class="dot"></span>Mode standard — relancer en administrateur</button>`; $('button', c).onclick = () => api.relaunchAdmin(); }
  c.insertAdjacentHTML('beforeend', `<button class="badge live" id="tb-update" hidden style="margin-left:8px"></button>`);
  $('#tb-update').onclick = () => go('settings');
  renderNav(); render();
  addLog({ msg: `RGA Tools v${S.sys.version} prêt — ${S.sys.host} (${S.sys.is64 ? 'x64' : 'x86'}, ${S.sys.admin ? 'administrateur' : 'standard'}).`, level: 'success' });
})();

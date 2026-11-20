// Rapport HTML autonome (un seul fichier, logo inclus) enregistré sur le Bureau.
// Le rapport met en avant ce qui sert au diagnostic : problèmes, mesures des tests effectués et
// résumé de la machine. La configuration complète reste disponible dans une section repliée.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const qr = require('./qr');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const v = (x, unit = '') => (x == null || x === '' ? '—' : `${esc(x)}${unit}`);
const has = (x) => x != null && x !== '' && x !== 0;

function spark(series, key, color, maxY) {
  const pts = series.map(s => s[key]).filter(x => typeof x === 'number');
  if (pts.length < 2) return '';
  const W = 300, H = 60, M = maxY || Math.max(...pts, 1);
  const d = pts.map((y, i) => `${((i / (pts.length - 1)) * W).toFixed(1)},${(H - (y / M) * (H - 4) - 2).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="spark"><polyline points="${d}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
}

const TEST_NAMES = { idle: 'Repos', cpu1: 'CPU 1 cœur', cpuN: 'CPU multi-cœurs', gpu: 'GPU 3D', mix: 'CPU + GPU', power: 'Extrême CPU + GPU + RAM' };
const LVL = { error: ['Problème', '#e5484d'], warn: ['Attention', '#f5a524'], info: ['Conseil', '#3b9eff'], ok: ['OK', '#30a46c'] };

// Mesures utiles selon le type de test (un test CPU n'affiche pas le score GPU, etc.).
const USES = {
  idle: { cpu: 1, temp: 1 },
  cpu1: { cpu: 1, mhz: 1, cpuTemp: 1, cpuPower: 1, cpuScore: 1 },
  cpuN: { cpu: 1, mhz: 1, cpuTemp: 1, cpuPower: 1, cpuScore: 1 },
  gpu: { gpu: 1, gpuTemp: 1, gpuPower: 1, gpuScore: 1 },
  mix: { cpu: 1, mhz: 1, gpu: 1, cpuTemp: 1, gpuTemp: 1, cpuPower: 1, gpuPower: 1, cpuScore: 1, gpuScore: 1 },
  power: { cpu: 1, mhz: 1, gpu: 1, cpuTemp: 1, gpuTemp: 1, cpuPower: 1, gpuPower: 1, cpuScore: 1, gpuScore: 1, mem: 1 },
};

function testCard(k, t) {
  const S = t.sensors || {}, u = USES[k] || USES.power;
  const kv = [];
  const item = (label, html) => kv.push(`<div><small>${label}</small>${html}</div>`);
  if (u.cpu && has(S.cpuAvg)) item('CPU moyen', `${S.cpuAvg} %`);
  if (u.mhz && has(S.mhzAvg)) item('Fréquence moyenne', `${S.mhzAvg} MHz${has(S.mhzMin) ? ` <span class="mut">(min ${S.mhzMin})</span>` : ''}`);
  if (u.gpu && has(S.gpuAvg)) item('GPU moyen', `${S.gpuAvg} %`);
  if ((u.cpuTemp || u.temp) && has(S.cpuTempMax)) item('Temp. CPU max', `${S.cpuTempMax} °C${S.cpuTempApprox ? ' <span class="mut">(estimée)</span>' : ''}`);
  if ((u.gpuTemp || u.temp) && has(S.gpuTempMax) && !S.gpuShared) item('Temp. GPU max', `${S.gpuTempMax} °C${has(S.hotspotMax) ? ` <span class="mut">(point chaud ${S.hotspotMax} °C)</span>` : ''}`);
  if (u.cpuPower && has(S.cpuPowerMax)) item('Puissance CPU max', `${S.cpuPowerMax} W`);
  if (u.gpuPower && has(S.gpuPowerMax)) item('Puissance GPU max', `${S.gpuPowerMax} W`);
  if (u.cpuScore && t.cpuScore) item('Score CPU', t.cpuScore.toLocaleString('fr-FR'));
  if (u.gpuScore && t.gpu?.score) item('Score GPU', `${t.gpu.score} passes/s <span class="mut">(${t.gpu.fpsAvg} FPS)</span>`);
  if (u.mem && t.mem) item('Erreurs RAM', `${t.mem.errors} <span class="mut">(${t.mem.gbChecked} Go vérifiés)</span>`);
  const sr = t.series || [], sp = [];
  if (u.cpu && sr.some(s => s.cpu > 0)) sp.push(`<div><small>CPU %</small>${spark(sr, 'cpu', '#d0202b', 100)}</div>`);
  if (u.mhz && sr.some(s => s.mhz > 0)) sp.push(`<div><small>Fréquence</small>${spark(sr, 'mhz', '#f5a524')}</div>`);
  if (u.gpu && sr.some(s => s.gpu > 0)) sp.push(`<div><small>GPU %</small>${spark(sr, 'gpu', '#3b9eff', 100)}</div>`);
  if ((u.cpuTemp || u.temp) && sr.some(s => s.cpuTemp)) sp.push(`<div><small>Temp. CPU °C</small>${spark(sr, 'cpuTemp', '#e5484d', 110)}</div>`);
  if ((u.gpuTemp || u.temp) && !S.gpuShared && sr.some(s => s.gpuTemp)) sp.push(`<div><small>Temp. GPU °C</small>${spark(sr, 'gpuTemp', '#8e4ec6', 110)}</div>`);
  const dur = t.seconds >= 60 ? `${Math.round(t.seconds / 60)} min` : `${t.seconds} s`;
  return `<div class="test">
    <div class="test-h"><b>${TEST_NAMES[k] || esc(k)}</b><span>${dur}${t.completed === false ? ' · <b style="color:#e5484d">interrompu</b>' : ''}</span></div>
    ${kv.length ? `<div class="kv">${kv.join('')}</div>` : '<p class="mut" style="margin:0">Aucune mesure disponible.</p>'}
    ${sp.length ? `<div class="sparks">${sp.join('')}</div>` : ''}
  </div>`;
}

function finding(f) {
  return `<div class="f"><span class="tag" style="background:${LVL[f.level][1]}">${LVL[f.level][0]}</span><div>
    <div class="area">${esc(f.area)}</div><b>${esc(f.title)}</b>${f.detail ? `<p>${esc(f.detail)}</p>` : ''}
    ${f.extra?.length ? `<ul>${f.extra.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div></div>`;
}

// Résumé de la machine : uniquement ce qui aide à interpréter le diagnostic.
function machine(I) {
  const rows = [];
  const row = (k, x) => { if (x) rows.push(`<tr><th>${k}</th><td>${x}</td></tr>`); };
  const generic = (x) => !x || /system (manufacturer|product name)|to be filled|default string|o\.e\.m|^none$/i.test(x);
  if (!generic(I.system?.model)) row('Ordinateur', esc([I.system?.maker, I.system?.model].filter(x => !generic(x)).join(' ')));
  else if (I.board?.model) row('Carte mère', esc([I.board.maker, I.board.model].filter(x => !generic(x)).join(' ')) + ' <span class="mut">(PC assemblé)</span>');
  row('Windows', `${esc(I.os?.name)} ${esc(I.os?.version)} <span class="mut">(build ${esc(I.os?.build)})</span>`);
  (I.cpu || []).forEach(c => row('Processeur', `${esc(c.name)} <span class="mut">${c.cores} cœurs / ${c.threads} threads</span>`));
  const mods = I.ram?.modules || [];
  if (I.ram?.totalGB) row('Mémoire', `${I.ram.totalGB} Go <span class="mut">${mods.length} barrette(s)${mods[0] ? ` · ${mods[0].configured || mods[0].speed} MHz` : ''}${I.ram.slots ? ` · ${mods.length}/${I.ram.slots} emplacements` : ''}</span>`);
  (I.gpu || []).filter(g => /^PCI/i.test(g.pnp || '') || !(I.gpu || []).some(x => /^PCI/i.test(x.pnp || ''))).forEach(g => row('Carte graphique', `${esc(g.name)} <span class="mut">pilote ${esc(g.driver)}${g.driverDate ? ` (${esc(g.driverDate)})` : ''}</span>`));
  (I.disks || []).forEach(d => {
    const bad = d.health && !/healthy|sain/i.test(d.health);
    const facts = [`${esc(d.media)} ${esc(d.bus)}`, `${d.sizeGB} Go`, d.health && `<span style="color:${bad ? '#e5484d' : 'inherit'}">${esc({ Healthy: 'sain', Warning: 'à surveiller', Unhealthy: 'défaillant' }[d.health] || d.health)}</span>`, has(d.wear) && `usure ${d.wear} %`, has(d.temp) && `${d.temp} °C`].filter(Boolean);
    row('Stockage', `${esc(d.name)} <span class="mut">${facts.join(' · ')}</span>`);
  });
  if (I.board?.bios) row('BIOS', `${esc(I.board.bios)} <span class="mut">${esc(I.board.biosDate)}</span>`);
  if (I.battery) row('Batterie', `santé ${v(I.battery.health, ' %')} <span class="mut">${v(I.battery.full)} / ${v(I.battery.design)} mWh</span>`);
  return `<div class="card"><h3>Machine</h3><table>${rows.join('')}</table></div>`;
}

function fullConfig(I, H) {
  const rows = (pairs) => pairs.filter(p => p[1] != null && p[1] !== '').map(([k, x]) => `<tr><th>${k}</th><td>${x}</td></tr>`).join('');
  return `<div class="grid">
  <div class="card"><h3>Système</h3><table>${rows([['Windows', `${esc(I.os?.name)} ${esc(I.os?.version)}`], ['Build', v(I.os?.build)], ['Installé le', v(I.os?.installed)], ['Démarré le', `${v(I.os?.boot)} <span class="mut">(${v(I.os?.uptimeH)} h)</span>`], ['Fabricant / modèle', `${esc(I.system?.maker)} ${esc(I.system?.model)}`], ['N° de série', v(I.system?.serial)], ['Mode d\'alimentation', v(I.powerPlan)], ['Antivirus', v((I.security?.antivirus || []).join(', '))]])}</table></div>
  <div class="card"><h3>Carte mère</h3><table>${rows([['Modèle', `${esc(I.board?.maker)} ${esc(I.board?.model)}`], ['BIOS', `${v(I.board?.bios)} <span class="mut">(${v(I.board?.biosDate)})</span>`], ['Firmware', v(I.board?.uefi)], ['Secure Boot', I.board?.secureBoot == null ? '—' : I.board.secureBoot ? 'Activé' : 'Désactivé'], ['TPM', v(I.board?.tpm)]])}</table></div>
  ${(I.cpu || []).map(c => `<div class="card"><h3>Processeur</h3><table>${rows([['Modèle', esc(c.name)], ['Cœurs / threads', `${c.cores} / ${c.threads}`], ['Fréquence de base', v(c.maxMHz, ' MHz')], ['Cache L2 / L3', `${Math.round(c.l2KB / 1024)} / ${Math.round(c.l3KB / 1024)} Mo`], ['Socket', v(c.socket)], ['Virtualisation', c.virt ? 'Activée' : 'Désactivée']])}</table></div>`).join('')}
  <div class="card"><h3>Mémoire — ${v(I.ram?.totalGB, ' Go')}</h3><table>${rows([['Emplacements', `${(I.ram?.modules || []).length} / ${v(I.ram?.slots)} utilisés`], ...(I.ram?.modules || []).map(m => [esc(m.slot), `${m.sizeGB} Go · ${m.configured || m.speed} MHz <span class="mut">${esc(m.maker)} ${esc(m.part)}</span>`])])}</table></div>
  ${(I.gpu || []).map(g => `<div class="card"><h3>Carte graphique</h3><table>${rows([['Modèle', esc(g.name)], ['Mémoire', g.vramMB ? `${g.vramMB} Mo` : '—'], ['Pilote', `${v(g.driver)} <span class="mut">(${v(g.driverDate)})</span>`], ['Affichage', v(g.res)]])}</table></div>`).join('')}
  ${(I.disks || []).map(d => `<div class="card"><h3>${esc(d.name)}</h3><table>${rows([['Type', `${esc(d.media)} · ${esc(d.bus)}`], ['Capacité', v(d.sizeGB, ' Go')], ['État', v(d.health)], ['Température', v(d.temp, ' °C')], ['Usure', v(d.wear, ' %')], ['Heures de fonctionnement', v(d.hours, ' h')]])}</table></div>`).join('')}
  <div class="card"><h3>Volumes</h3><table>${rows((I.volumes || []).map(x => [`${esc(x.letter)}: ${esc(x.label)}`, `${x.freeGB} Go libres / ${x.sizeGB} Go <span class="mut">${esc(x.fs)}</span>`]))}</table></div>
  <div class="card"><h3>Réseau</h3><table>${rows([['IPv4', v(I.network?.ipv4)], ['Passerelle', v(I.network?.gateway)], ['DNS', v((I.network?.dns || []).join(', '))], ...(I.network?.adapters || []).map(a => [esc(a.name), `${esc(a.desc)} <span class="mut">${esc(a.status)} ${esc(a.speed)}</span>`])])}</table></div>
  ${I.battery ? `<div class="card"><h3>Batterie</h3><table>${rows([['Modèle', v(I.battery.name)], ['Charge', v(I.battery.charge, ' %')], ['Capacité d\'origine', v(I.battery.design, ' mWh')], ['Capacité actuelle', v(I.battery.full, ' mWh')], ['Santé', v(I.battery.health, ' %')]])}</table></div>` : ''}
  <div class="card"><h3>Santé (30 derniers jours)</h3><table>${rows([['Erreurs WHEA', v(H.whea)], ['Écrans bleus', v(H.bsod)], ['Arrêts inattendus', v(H.unexpectedShutdown)], ['Erreurs disque', H.diskErrors >= 1000 ? '1000+' : v(H.diskErrors)], ['Plantages d\'applications', v(H.appCrashes)], ['Programmes au démarrage', v(H.startupCount)], ['Windows activé', H.activated == null ? '—' : H.activated ? 'Oui' : 'Non'], ['Dernière mise à jour', v(H.lastUpdate)]])}</table></div>
</div>`;
}

function render(R, logoDataUri, shareUrl) {
  const I = R.inventory || {}, H = R.health || {};
  const scoreCol = R.score == null ? '#888' : R.score >= 85 ? '#30a46c' : R.score >= 60 ? '#f5a524' : '#e5484d';
  const date = new Date(R.startedAt).toLocaleString('fr-FR');
  const order = ['error', 'warn', 'info', 'ok'];
  const sorted = [...(R.findings || [])].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
  const counts = { error: 0, warn: 0, info: 0, ok: 0 }; sorted.forEach(f => counts[f.level]++);
  const issues = sorted.filter(f => f.level !== 'ok'), oks = sorted.filter(f => f.level === 'ok');
  const testEntries = Object.entries(R.tests || {});
  const hasTests = testEntries.length > 0 || (R.disk || []).length > 0;
  const verdict = counts.error ? `${counts.error} problème(s) à traiter` : counts.warn ? `${counts.warn} point(s) à surveiller` : 'Aucun problème détecté';

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diagnostic ${esc(I.host)} — RGA Informatique</title>
<style>
:root{--red:#c31a24;--bg:#f6f6f7;--card:#fff;--b:#e6e6e9;--t:#17181a;--m:#6b6f76}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--t);font:14px/1.5 "Segoe UI",system-ui,sans-serif}
.wrap{max-width:1040px;margin:0 auto;padding:28px 20px 60px}
header{display:flex;align-items:center;gap:24px;justify-content:space-between;flex-wrap:wrap;margin-bottom:22px}
header img{height:64px}header .meta{text-align:right;color:var(--m)}header h1{margin:0;font-size:22px;color:var(--t)}
.top{display:grid;grid-template-columns:220px 1fr;gap:16px;margin-bottom:16px}
.card{background:var(--card);border:1px solid var(--b);border-radius:12px;padding:18px}
.score{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.ring{width:130px;height:130px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(${scoreCol} ${R.score || 0}%, #eceef0 0)}
.ring div{width:104px;height:104px;border-radius:50%;background:#fff;display:grid;place-items:center;font-size:34px;font-weight:700;color:${scoreCol}}
.verdict{margin-top:10px;font-weight:600;color:${scoreCol}}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.8px;color:var(--m);margin:26px 0 10px}
.f{display:flex;gap:12px;padding:10px 0;border-top:1px solid var(--b)}.f:first-child{border-top:0}
.tag{flex:none;font-size:11px;font-weight:700;padding:2px 8px;border-radius:5px;color:#fff;height:fit-content;margin-top:2px;min-width:72px;text-align:center}
.f .area{color:var(--m);font-size:12px}.f p{margin:2px 0 0;color:var(--m);font-size:13px}
.f ul{margin:6px 0 0;padding-left:18px;font-size:12.5px;color:var(--t)}.f li{margin:1px 0;word-break:break-word}
.oks{display:flex;flex-wrap:wrap;gap:6px}.oks span{background:#eef8f2;color:#1d7a4a;border-radius:6px;padding:3px 9px;font-size:12.5px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
table{width:100%;border-collapse:collapse}th{text-align:left;color:var(--m);font-weight:500;width:30%;padding:5px 8px 5px 0;vertical-align:top}td{padding:5px 0;font-weight:500;word-break:break-word}
.card h3{margin:0 0 8px;font-size:15px;display:flex;align-items:center;gap:8px}.card h3:before{content:"";width:4px;height:16px;border-radius:2px;background:var(--red)}
.test{background:var(--card);border:1px solid var(--b);border-radius:12px;padding:16px;margin-bottom:12px}
.test-h{display:flex;justify-content:space-between;margin-bottom:10px}.test-h span{color:var(--m)}
.kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;font-weight:600}.kv small,.sparks small{display:block;color:var(--m);font-weight:500;font-size:12px}
.sparks{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:12px}.spark{width:100%;height:60px;background:#fafafb;border:1px solid var(--b);border-radius:6px}
.mut{color:var(--m);font-weight:400}.note{background:#fff7f7;border:1px solid #f3d0d2;border-radius:10px;padding:10px 14px;margin-bottom:16px}
details{margin-top:26px}details summary{cursor:pointer;font-size:13px;text-transform:uppercase;letter-spacing:.8px;color:var(--m);margin-bottom:10px}
details .grid th{width:42%}

.qr{display:flex;align-items:center;gap:18px;margin-bottom:16px}.qr svg{flex:none;border-radius:6px}.qr b{font-size:15px}.qr p{margin:4px 0 0;color:var(--m);font-size:13px}.qr code{font-size:12px;color:var(--t);word-break:break-all}
footer{margin-top:40px;color:var(--m);font-size:12px;text-align:center}
@media(max-width:640px){.top{grid-template-columns:1fr}header .meta{text-align:left}}
@media print{body{background:#fff}.qr{display:none}.card,.test,.f{break-inside:avoid}details:not([open]){display:none}}
</style></head><body><div class="wrap">
<header><img src="${logoDataUri}" alt="RGA Informatique"><div class="meta"><h1>${esc(R.profileName)}</h1>${esc(I.host)} · ${esc(date)}</div></header>
${R.note ? `<div class="note"><b>Symptôme signalé :</b> ${esc(R.note)}</div>` : ''}
<div class="top">
  <div class="card score"><div class="ring"><div>${R.score ?? '—'}</div></div><div class="mut" style="margin-top:8px">Note globale / 100</div><div class="verdict">${verdict}</div></div>
  <div class="card"><h3>À traiter</h3>${issues.length ? issues.map(finding).join('') : '<p class="mut">Aucun problème ni point d’attention : la machine est saine sur les tests effectués.</p>'}</div>
</div>
${shareUrl ? `<!--qr--><div class="card qr">${qr.svg(shareUrl, 132)}<div><b>Ouvrir ce rapport sur un smartphone</b><p>Scannez le QR code avec l’appareil photo : le rapport s’ouvre sur le téléphone, qui peut l’imprimer ou l’enregistrer en PDF (menu Partager → Imprimer).</p><p>Le téléphone doit être connecté au même Wi-Fi que ce PC, et RGA Tools doit rester ouvert.<br><code>${esc(shareUrl)}</code></p></div></div><!--/qr-->` : ''}
${oks.length ? `<h2>Vérifié sans problème</h2><div class="card oks">${oks.map(f => `<span title="${esc(f.detail)}">✓ ${esc(f.title)}</span>`).join('')}</div>` : ''}
${testEntries.length ? `<h2>Mesures des tests</h2>${testEntries.map(([k, t]) => testCard(k, t)).join('')}` : ''}
${(R.disk || []).length ? `<h2>Débit des stockages</h2><div class="grid">${R.disk.map(d => `<div class="card"><h3>Lecteur ${esc(d.drive)}:</h3><table><tr><th>Lecture séquentielle</th><td>${v(d.seqRead, ' Mo/s')}</td></tr><tr><th>Écriture séquentielle</th><td>${v(d.seqWrite, ' Mo/s')}</td></tr><tr><th>Lecture aléatoire</th><td>${v(d.ranRead, ' Mo/s')}</td></tr></table></div>`).join('')}</div>` : ''}
<div style="margin-top:26px">${machine(I)}</div>
<details ${hasTests ? '' : 'open'}><summary>Configuration complète</summary>${fullConfig(I, H)}</details>
<footer>Rapport généré par RGA Tools v${esc(R.version || '')} — RGA Informatique · ${esc(date)}</footer>
</div></body></html>`;
}

function save(R, logoPath, urlFor) {
  const logo = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64');
  const dir = path.join(app.getPath('desktop'), 'Diagnostics RGA');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date(R.startedAt).toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const host = (R.inventory?.host || 'PC').replace(/[^\w-]/g, '');
  const file = path.join(dir, `${host}_${R.profile}_${stamp}.html`);
  let shareUrl = null;
  try { shareUrl = urlFor ? urlFor(file) : null; } catch {}
  fs.writeFileSync(file, render(R, logo, shareUrl), 'utf8');
  fs.writeFileSync(file.replace(/\.html$/, '.json'), JSON.stringify(R, null, 1), 'utf8');
  return file;
}

module.exports = { save, render };

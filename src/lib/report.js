// Rapport HTML autonome (un seul fichier, logo inclus) enregistré sur le Bureau.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const v = (x, unit = '') => (x == null || x === '' ? '—' : `${esc(x)}${unit}`);

function spark(series, key, color, maxY) {
  const pts = series.map(s => s[key]).filter(x => typeof x === 'number');
  if (pts.length < 2) return '';
  const W = 300, H = 60, M = maxY || Math.max(...pts, 1);
  const d = pts.map((y, i) => `${((i / (pts.length - 1)) * W).toFixed(1)},${(H - (y / M) * (H - 4) - 2).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="spark"><polyline points="${d}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
}

const TEST_NAMES = { idle: 'Repos', cpu1: 'CPU 1 cœur', cpuN: 'CPU multi-cœurs', gpu: 'GPU 3D', mix: 'CPU + GPU', power: 'Extrême CPU + GPU + RAM' };
const LVL = { error: ['Problème', '#e5484d'], warn: ['Attention', '#f5a524'], info: ['Conseil', '#3b9eff'], ok: ['OK', '#30a46c'] };

function render(R, logoDataUri) {
  const I = R.inventory || {}, H = R.health || {};
  const scoreCol = R.score == null ? '#888' : R.score >= 85 ? '#30a46c' : R.score >= 60 ? '#f5a524' : '#e5484d';
  const date = new Date(R.startedAt).toLocaleString('fr-FR');
  const rows = (pairs) => pairs.filter(p => p[1] != null && p[1] !== '').map(([k, x]) => `<tr><th>${k}</th><td>${x}</td></tr>`).join('');
  const sorted = [...(R.findings || [])].sort((a, b) => ['error', 'warn', 'info', 'ok'].indexOf(a.level) - ['error', 'warn', 'info', 'ok'].indexOf(b.level));
  const counts = { error: 0, warn: 0, info: 0, ok: 0 }; sorted.forEach(f => counts[f.level]++);

  const tests = Object.entries(R.tests || {}).map(([k, t]) => `
    <div class="test">
      <div class="test-h"><b>${TEST_NAMES[k] || k}</b><span>${t.seconds >= 60 ? Math.round(t.seconds / 60) + ' min' : t.seconds + ' s'}${t.completed === false ? ' · interrompu' : ''}</span></div>
      <div class="kv">
        <div><small>CPU moy.</small>${v(t.sensors?.cpuAvg, ' %')}</div>
        <div><small>Fréquence moy.</small>${v(t.sensors?.mhzAvg, ' MHz')}</div>
        <div><small>GPU moy.</small>${v(t.sensors?.gpuAvg, ' %')}</div>
        <div><small>Temp. max</small>${v(t.sensors?.tempMax, ' °C')}</div>
        ${t.cpuScore ? `<div><small>Score CPU</small>${t.cpuScore.toLocaleString('fr-FR')}</div>` : ''}
        ${t.gpu?.score ? `<div><small>Score GPU</small>${t.gpu.score} passes/s <span class="mut">(${t.gpu.fpsAvg} FPS)</span></div>` : ''}
        ${t.mem ? `<div><small>Erreurs RAM</small>${t.mem.errors} <span class="mut">(${t.mem.gbChecked} Go)</span></div>` : ''}
      </div>
      <div class="sparks">
        <div><small>CPU %</small>${spark(t.series || [], 'cpu', '#d0202b', 100)}</div>
        <div><small>Fréquence</small>${spark(t.series || [], 'mhz', '#f5a524')}</div>
        ${(t.series || []).some(s => s.gpu > 0) ? `<div><small>GPU %</small>${spark(t.series, 'gpu', '#3b9eff', 100)}</div>` : ''}
        ${(t.series || []).some(s => s.temp) ? `<div><small>Temp. °C</small>${spark(t.series, 'temp', '#e5484d')}</div>` : ''}
      </div>
    </div>`).join('');

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
.ring small{display:block;font-size:12px;color:var(--m);font-weight:500;margin-top:-30px}
.chips{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;justify-content:center}.chip{font-size:12px;padding:2px 9px;border-radius:99px;background:#f1f1f3}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.8px;color:var(--m);margin:26px 0 10px}
.f{display:flex;gap:12px;padding:10px 0;border-top:1px solid var(--b)}.f:first-child{border-top:0}
.tag{flex:none;font-size:11px;font-weight:700;padding:2px 8px;border-radius:5px;color:#fff;height:fit-content;margin-top:2px;min-width:72px;text-align:center}
.f .area{color:var(--m);font-size:12px}.f p{margin:2px 0 0;color:var(--m);font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
table{width:100%;border-collapse:collapse}th{text-align:left;color:var(--m);font-weight:500;width:42%;padding:5px 8px 5px 0;vertical-align:top}td{padding:5px 0;font-weight:500;word-break:break-word}
.card h3{margin:0 0 8px;font-size:15px;display:flex;align-items:center;gap:8px}.card h3:before{content:"";width:4px;height:16px;border-radius:2px;background:var(--red)}
.test{background:var(--card);border:1px solid var(--b);border-radius:12px;padding:16px;margin-bottom:12px}
.test-h{display:flex;justify-content:space-between;margin-bottom:10px}.test-h span{color:var(--m)}
.kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;font-weight:600}.kv small,.sparks small{display:block;color:var(--m);font-weight:500;font-size:12px}
.sparks{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:12px}.spark{width:100%;height:60px;background:#fafafb;border:1px solid var(--b);border-radius:6px}
.mut{color:var(--m);font-weight:400}.note{background:#fff7f7;border:1px solid #f3d0d2;border-radius:10px;padding:10px 14px;margin-bottom:16px}
footer{margin-top:40px;color:var(--m);font-size:12px;text-align:center}
@media(max-width:640px){.top{grid-template-columns:1fr}header .meta{text-align:left}}
@media print{body{background:#fff}.card,.test{break-inside:avoid}}
</style></head><body><div class="wrap">
<header><img src="${logoDataUri}" alt="RGA Informatique"><div class="meta"><h1>${esc(R.profileName)}</h1>${esc(I.host)} · ${esc(date)}</div></header>
${R.note ? `<div class="note"><b>Description :</b> ${esc(R.note)}</div>` : ''}
<div class="top">
  <div class="card score"><div class="ring"><div>${R.score ?? '—'}</div></div><div class="mut" style="margin-top:8px">Note globale / 100</div>
    <div class="chips"><span class="chip" style="color:#e5484d">${counts.error} problème(s)</span><span class="chip" style="color:#b7791f">${counts.warn} attention</span><span class="chip" style="color:#3b9eff">${counts.info} conseil(s)</span></div></div>
  <div class="card"><h3>Résumé</h3>${sorted.length ? sorted.map(f => `<div class="f"><span class="tag" style="background:${LVL[f.level][1]}">${LVL[f.level][0]}</span><div><div class="area">${esc(f.area)}</div><b>${esc(f.title)}</b>${f.detail ? `<p>${esc(f.detail)}</p>` : ''}</div></div>`).join('') : '<p class="mut">Aucune remarque.</p>'}</div>
</div>
${R.events ? `<h2>Journaux Windows (30 jours)</h2><div class="card"><p class="mut" style="margin:0 0 6px">${esc(R.events.summary)} ${R.events.total} événement(s) : ${R.events.totals.critical} critique(s), ${R.events.totals.error} erreur(s), ${R.events.totals.warning} avertissement(s).</p>${(R.events.problems || []).map(g => `<div class="f"><span class="tag" style="background:${LVL[g.sev]?.[1] || '#888'}">${g.count}×</span><div><div class="area">${esc(g.cat)} · ${esc(g.provider)} ${g.id}</div><b>${esc(g.title)}</b><p>${esc(g.cause)}</p>${g.action ? `<p><b>À faire :</b> ${esc(g.action)}</p>` : ''}</div></div>`).join('') || '<p class="mut">Aucun problème connu.</p>'}</div>` : ''}
${tests ? `<h2>Tests de charge</h2>${tests}` : ''}
${(R.disk || []).length ? `<h2>Débit des stockages</h2><div class="grid">${R.disk.map(d => `<div class="card"><h3>Lecteur ${esc(d.drive)}:</h3><table>${rows([['Lecture séquentielle', v(d.seqRead, ' Mo/s')], ['Écriture séquentielle', v(d.seqWrite, ' Mo/s')], ['Lecture aléatoire', v(d.ranRead, ' Mo/s')]])}</table></div>`).join('')}</div>` : ''}
<h2>Configuration</h2>
<div class="grid">
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
</div>
<footer>Rapport généré par RGA Tools v${esc(R.version || '')} — RGA Informatique · ${esc(date)}</footer>
</div></body></html>`;
}

function save(R, logoPath) {
  const logo = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64');
  const dir = path.join(app.getPath('desktop'), 'Diagnostics RGA');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date(R.startedAt).toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const host = (R.inventory?.host || 'PC').replace(/[^\w-]/g, '');
  const file = path.join(dir, `${host}_${R.profile}_${stamp}.html`);
  fs.writeFileSync(file, render(R, logo), 'utf8');
  fs.writeFileSync(file.replace(/\.html$/, '.json'), JSON.stringify(R, null, 1), 'utf8');
  return file;
}

module.exports = { save, render };

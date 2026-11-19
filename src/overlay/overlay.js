// Overlay : températures et charge en temps réel, au-dessus de toutes les fenêtres.
const $ = (id) => document.getElementById(id);
const cls = (t, warm, hot) => (t == null ? '' : t >= hot ? 'hot' : t >= warm ? 'warm' : 'ok');
const temp = (el, t, warm, hot) => { el.innerHTML = t == null ? '—' : `${Math.round(t)}<small>°C</small>`; el.className = `v ${cls(t, warm, hot)}`; };
const pct = (id, v) => { $(id).textContent = v == null ? '—' : `${Math.round(v)} %`; $(`${id}b`).style.width = `${Math.max(0, Math.min(100, v || 0))}%`; };
const w = (n) => (n == null ? '' : `${Math.round(n)} W`);

window.overlay.onSample((s) => {
  temp($('ct'), s.cpuTemp, 80, 92);
  temp($('gt'), s.gpuTemp, 80, 88);
  $('cs').textContent = [s.mhz ? `${s.mhz} MHz` : '', w(s.cpuPower)].filter(Boolean).join(' · ');
  $('gs').textContent = [s.gpuHotspot != null ? `Hotspot ${Math.round(s.gpuHotspot)}°` : '', w(s.gpuPower)].filter(Boolean).join(' · ');
  pct('cpu', s.cpu); pct('gpu', s.gpu); pct('ram', s.ram);
  const hint = $('hint');
  if (s.cpuTemp == null) { hint.hidden = false; hint.textContent = 'Temp. CPU : pilote PawnIO ou droits administrateur requis.'; }
  else if (s.cpuTempSrc === 'acpi') { hint.hidden = false; hint.textContent = 'Temp. CPU : zone thermique ACPI (approximative).'; }
  else hint.hidden = true;
});

window.overlay.onTick((t) => {
  $('lbl').textContent = t.label || 'Monitoring';
  const has = t.total > 0;
  $('barw').hidden = !has;
  $('tm').textContent = has ? `${fmt(t.elapsed)} / ${fmt(t.total)}` : '';
  if (has) $('bar').style.width = `${Math.min(100, (t.elapsed / t.total) * 100)}%`;
});
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

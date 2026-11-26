// Capteurs temps réel : un processus PowerShell persistant qui émet une ligne JSON par seconde.
// - Charge, fréquences, débits : classes Win32_PerfFormattedData (non localisées, Windows FR/EN).
// - Températures / puissances : LibreHardwareMonitorLib (vendor/lhm, MPL-2.0). La température du
//   processeur nécessite les droits administrateur et le pilote PawnIO. Repli : pilote NVIDIA
//   (nvidia-smi) pour le GPU, zones thermiques ACPI pour le CPU.
const { app } = require('electron');
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const { psFile, psArgs } = require('./util');

const LHM_DIR = app?.isPackaged ? path.join(process.resourcesPath, 'lhm') : path.join(__dirname, '..', '..', 'vendor', 'lhm');
const NVSMI = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'nvidia-smi.exe');
const q = (s) => s.replace(/'/g, "''");

const LOOP = `
$ProgressPreference='SilentlyContinue';$ErrorActionPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$inv = [Globalization.CultureInfo]::InvariantCulture
$lhm = $null
try {
  [void][Reflection.Assembly]::LoadFrom('${q(LHM_DIR)}\\LibreHardwareMonitorLib.dll')
  $lhm = New-Object LibreHardwareMonitor.Hardware.Computer
  $lhm.IsCpuEnabled = $true; $lhm.IsGpuEnabled = $true; $lhm.IsMotherboardEnabled = $true; $lhm.IsStorageEnabled = $true
  $lhm.Open()
  $hwt = (@($lhm.Hardware) | ForEach-Object { "$($_.HardwareType)" }) -join ','
} catch { $lhm = $null }
$base = (Get-CimInstance Win32_Processor | Select-Object -First 1).MaxClockSpeed
$nv = '${q(NVSMI)}'; $hasNv = Test-Path $nv
while ($true) {
  $p = Get-CimInstance Win32_PerfFormattedData_Counters_ProcessorInformation -Filter "Name='_Total'"
  $g = Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine
  $gAll = @{}
  foreach ($e in $g) { $t = ($e.Name -split 'engtype_')[1]; if ($t) { if (-not $gAll[$t]) { $gAll[$t] = 0 }; $gAll[$t] += $e.UtilizationPercentage } }
  $gpu = 0; foreach ($v in $gAll.Values) { if ($v -gt $gpu) { $gpu = $v } }
  $d = Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk -Filter "Name='_Total'"
  $n = Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface
  $rx = 0; $tx = 0; foreach ($i in $n) { $rx += $i.BytesReceivedPersec; $tx += $i.BytesSentPersec }
  $tz = Get-CimInstance Win32_PerfFormattedData_Counters_ThermalZoneInformation
  $acpi = $null; foreach ($z in $tz) { if ($z.HighPrecisionTemperature -gt 0) { $c = $z.HighPrecisionTemperature/10 - 273.15 } elseif ($z.Temperature -gt 0) { $c = $z.Temperature - 273.15 } else { $c = $null }; if ($c -and $c -gt 5 -and $c -lt 130 -and ($acpi -eq $null -or $c -gt $acpi)) { $acpi = $c } }
  $rows = $null
  if ($lhm) {
    $sb = New-Object Text.StringBuilder
    try {
      foreach ($h in $lhm.Hardware) {
        $h.Update(); foreach ($sh in $h.SubHardware) { $sh.Update() }
        foreach ($s in (@($h.Sensors) + @($h.SubHardware | ForEach-Object { $_.Sensors }))) {
          $st = "$($s.SensorType)"
          if (($st -eq 'Temperature' -or $st -eq 'Power') -and $s.Value -ne $null) {
            [void]$sb.Append($st).Append("\`t").Append("$($h.HardwareType)").Append("\`t").Append($s.Name).Append("\`t").Append(([double]$s.Value).ToString('0.##', $inv)).Append("\`n")
          }
        }
      }
    } catch {}
    $rows = $sb.ToString()
  }
  $nvo = $null; if ($hasNv) { $nvo = & $nv --query-gpu=temperature.gpu,power.draw --format=csv,noheader,nounits 2>$null | Select-Object -First 1 }
  $o = [pscustomobject]@{
    cpu = [math]::Min(100, [double]$p.PercentProcessorUtility)
    perf = [double]$p.PercentProcessorPerformance
    mhz = [math]::Round($base * [double]$p.PercentProcessorPerformance / 100)
    gpu = [math]::Min(100, [math]::Round($gpu, 1))
    diskR = [double]$d.DiskReadBytesPersec; diskW = [double]$d.DiskWriteBytesPersec; diskBusy = [math]::Min(100, [double]$d.PercentDiskTime)
    rx = $rx; tx = $tx
    acpi = if ($acpi) { [math]::Round($acpi, 1) } else { $null }
    lhm = if ($lhm) { $rows } else { 'OFF' }; hw = $hwt; nv = $nvo
  }
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds 250
}`;

// Choisit les relevés pertinents parmi ceux de LibreHardwareMonitor.
const num = (x) => { const n = parseFloat(x); return isFinite(n) ? n : null; };
function pick(rows, type, hw, patterns, agg = 'first') {
  for (const re of patterns) {
    const hits = rows.filter(r => r.type === type && hw.test(r.hw) && re.test(r.name) && r.v != null && r.v > 0.5 && r.v < 250); // 0 = capteur inaccessible (sans droits admin)
    if (hits.length) return agg === 'max' ? Math.max(...hits.map(h => h.v)) : hits[0].v;
  }
  return null;
}
function parseLhm(txt) {
  if (!txt || txt === 'OFF') return null;
  const rows = txt.split('\n').filter(Boolean).map(l => { const [type, hw, name, v] = l.split('\t'); return { type, hw: hw || '', name: name || '', v: num(v) }; });
  if (!rows.length) return {};
  const CPU = /^Cpu$/i, GPU = /^Gpu/i, MB = /Motherboard|SuperIO|EmbeddedController/i, DISK = /^Storage$/i;
  return {
    cpuTemp: pick(rows, 'Temperature', CPU, [/^Core \(Tctl\/Tdie\)$/i, /^CPU Package$/i, /^Core \(Tctl\)$/i, /^Core \(Tdie\)$/i, /^Package$/i, /^Core Max$/i, /^Core Average$/i, /^CCD\d? ?\(Tdie\)$/i, /^CPU Core$/i]),
    gpuTemp: pick(rows, 'Temperature', GPU, [/^GPU Core$/i, /^GPU Edge$/i, /^GPU Temperature$/i]),
    gpuHotspot: pick(rows, 'Temperature', GPU, [/^GPU Hot ?Spot$/i, /^GPU Junction$/i]),
    vrmTemp: pick(rows, 'Temperature', MB, [/VRM|MOS/i], 'max'),
    diskTemp: pick(rows, 'Temperature', DISK, [/^Composite Temperature$/i, /^Temperature$/i, /^Temperature #1$/i], 'max'),
    // Replis : autre capteur proche quand le capteur principal manque (noms variables selon Intel / AMD / portable).
    cpuTempAlt: pick(rows, 'Temperature', CPU, [/^(?!.*(distance|tj ?max|delta)).*$/i], 'max'),
    mbCpuTemp: pick(rows, 'Temperature', MB, [/^CPU( Socket| Package| Temp(erature)?)?$/i, /PECI|CPUTIN|CPU/i]),
    gpuTempAlt: pick(rows, 'Temperature', GPU, [/^(?!.*(hot ?spot|junction|memory|vram|mem)).*$/i], 'max'),
    cpuPower: pick(rows, 'Power', CPU, [/^Package$/i, /^CPU Package$/i, /^CPU Cores$/i]),
    gpuPower: pick(rows, 'Power', GPU, [/^GPU Package$/i, /^GPU Power$/i, /^GPU Total$/i, /^GPU Core$/i]),
  };
}

class Monitor {
  constructor() { this.child = null; this.listeners = new Set(); this.last = null; this.history = []; }
  start() {
    if (this.child) return;
    this.child = spawn('powershell.exe', psArgs(psFile(LOOP, 'capteurs')), { windowsHide: true });
    let buf = '';
    this.child.stdout.on('data', (d) => {
      buf += d.toString('utf8');
      const lines = buf.split(/\r?\n/); buf = lines.pop();
      for (const l of lines) {
        if (!l.trim().startsWith('{')) continue;
        try { this.ingest(JSON.parse(l)); } catch {}
      }
    });
    const c = this.child;
    c.on('close', () => { if (this.child === c) this.child = null; });
  }
  ingest(raw) {
    const total = os.totalmem(), free = os.freemem();
    const s = { cpu: raw.cpu, perf: raw.perf, mhz: raw.mhz, gpu: raw.gpu, diskR: raw.diskR, diskW: raw.diskW, diskBusy: raw.diskBusy, rx: raw.rx, tx: raw.tx };
    s.ram = Math.round(((total - free) / total) * 1000) / 10;
    s.ramUsedGB = Math.round(((total - free) / 1073741824) * 10) / 10;
    s.ramTotalGB = Math.round((total / 1073741824) * 10) / 10;
    const lhm = parseLhm(raw.lhm);
    s.sensors = lhm ? 'lhm' : 'off';
    const alt = {};
    if (lhm) for (const [k, v] of Object.entries(lhm)) if (v != null) { if (/Alt$|^mbCpu/.test(k)) alt[k] = v; else s[k] = v; }
    // Température CPU : capteur principal, puis autre capteur du processeur, carte mère, zone ACPI.
    if (s.cpuTemp != null) s.cpuTempSrc = 'lhm';
    else if (alt.cpuTempAlt != null) { s.cpuTemp = alt.cpuTempAlt; s.cpuTempSrc = 'cores'; }
    else if (alt.mbCpuTemp != null) { s.cpuTemp = alt.mbCpuTemp; s.cpuTempSrc = 'mb'; }
    else if (raw.acpi != null) { s.cpuTemp = raw.acpi; s.cpuTempSrc = 'acpi'; }
    // Température GPU : capteur principal, autre capteur du GPU, pilote NVIDIA, point chaud, puis
    // température du processeur si la machine n'a qu'un GPU intégré (même puce).
    if (s.gpuTemp != null) s.gpuTempSrc = 'lhm';
    else if (alt.gpuTempAlt != null) { s.gpuTemp = alt.gpuTempAlt; s.gpuTempSrc = 'lhm'; }
    if (raw.nv) {
      const [t, p] = String(raw.nv).split(',').map(x => num(x));
      if (t != null && s.gpuTemp == null) { s.gpuTemp = t; s.gpuTempSrc = 'nv'; }
      if (p != null && s.gpuPower == null) s.gpuPower = p;
    }
    if (s.gpuTemp == null && s.gpuHotspot != null) { s.gpuTemp = s.gpuHotspot; s.gpuTempSrc = 'hotspot'; }
    const dedicated = /Gpu(Nvidia|Amd)/i.test(raw.hw || '') || !!raw.nv;
    if (s.gpuTemp == null && s.cpuTemp != null && raw.hw && !dedicated) { s.gpuTemp = s.cpuTemp; s.gpuTempSrc = 'cpu'; }
    s.cpuTempApprox = ['mb', 'acpi'].includes(s.cpuTempSrc);
    s.gpuTempApprox = ['hotspot', 'cpu'].includes(s.gpuTempSrc);
    for (const k of ['cpuTemp', 'gpuTemp', 'gpuHotspot', 'vrmTemp', 'diskTemp', 'cpuPower', 'gpuPower']) if (s[k] != null) s[k] = Math.round(s[k] * 10) / 10;
    // Température la plus haute (garde-fou des tests de charge).
    const temps = [s.cpuTemp, s.gpuTemp, s.gpuHotspot].filter(x => x != null);
    s.temp = temps.length ? Math.max(...temps) : null;
    s.t = Date.now();
    this.last = s;
    this.history.push(s); if (this.history.length > 3600) this.history.shift();
    for (const fn of this.listeners) fn(s);
  }
  stop() { if (this.child) { try { this.child.kill(); } catch {} this.child = null; } }
  // Relance la lecture des capteurs (ex. après l'installation de PawnIO) si elle tourne.
  restart() { if (this.child) { this.stop(); this.start(); } }
  on(fn) { this.listeners.add(fn); this.start(); return () => { this.listeners.delete(fn); }; }
  // Enregistre les échantillons sur une fenêtre de temps.
  record() {
    const samples = [];
    const off = this.on((s) => samples.push(s));
    return { stop: () => { off(); return samples; }, samples };
  }
}

module.exports = new Monitor();
module.exports.parseLhm = parseLhm;
module.exports.LHM_DIR = LHM_DIR;

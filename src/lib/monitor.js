// Capteurs temps réel : un processus PowerShell persistant qui émet une ligne JSON par seconde.
// Les classes Win32_PerfFormattedData ne sont pas localisées (fonctionne sur Windows FR/EN).
const { spawn } = require('child_process');
const os = require('os');

const LOOP = `
$ProgressPreference='SilentlyContinue';$ErrorActionPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$base = (Get-CimInstance Win32_Processor | Select-Object -First 1).MaxClockSpeed
while ($true) {
  $p = Get-CimInstance Win32_PerfFormattedData_Counters_ProcessorInformation -Filter "Name='_Total'"
  $g = Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine
  $g3d = 0; $gAll = @{}
  foreach ($e in $g) { $t = ($e.Name -split 'engtype_')[1]; if ($t) { if (-not $gAll[$t]) { $gAll[$t] = 0 }; $gAll[$t] += $e.UtilizationPercentage } }
  $gpu = 0; foreach ($v in $gAll.Values) { if ($v -gt $gpu) { $gpu = $v } }
  $d = Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk -Filter "Name='_Total'"
  $n = Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface
  $rx = 0; $tx = 0; foreach ($i in $n) { $rx += $i.BytesReceivedPersec; $tx += $i.BytesSentPersec }
  $tz = Get-CimInstance Win32_PerfFormattedData_Counters_ThermalZoneInformation
  $temp = $null; foreach ($z in $tz) { if ($z.HighPrecisionTemperature -gt 0) { $c = $z.HighPrecisionTemperature/10 - 273.15 } elseif ($z.Temperature -gt 0) { $c = $z.Temperature - 273.15 } else { $c = $null }; if ($c -and $c -gt 5 -and $c -lt 130 -and ($temp -eq $null -or $c -gt $temp)) { $temp = $c } }
  $o = [pscustomobject]@{
    cpu = [math]::Min(100, [double]$p.PercentProcessorUtility)
    perf = [double]$p.PercentProcessorPerformance
    mhz = [math]::Round($base * [double]$p.PercentProcessorPerformance / 100)
    gpu = [math]::Min(100, [math]::Round($gpu, 1))
    diskR = [double]$d.DiskReadBytesPersec; diskW = [double]$d.DiskWriteBytesPersec; diskBusy = [math]::Min(100, [double]$d.PercentDiskTime)
    rx = $rx; tx = $tx
    temp = if ($temp) { [math]::Round($temp, 1) } else { $null }
  }
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds 250
}`;

class Monitor {
  constructor() { this.child = null; this.listeners = new Set(); this.last = null; this.history = []; }
  start() {
    if (this.child) return;
    const enc = Buffer.from(LOOP, 'utf16le').toString('base64');
    this.child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc], { windowsHide: true });
    let buf = '';
    this.child.stdout.on('data', (d) => {
      buf += d.toString('utf8');
      const lines = buf.split(/\r?\n/); buf = lines.pop();
      for (const l of lines) {
        if (!l.trim().startsWith('{')) continue;
        try {
          const s = JSON.parse(l);
          const total = os.totalmem(), free = os.freemem();
          s.ram = Math.round(((total - free) / total) * 1000) / 10;
          s.ramUsedGB = Math.round(((total - free) / 1073741824) * 10) / 10;
          s.ramTotalGB = Math.round((total / 1073741824) * 10) / 10;
          s.t = Date.now();
          this.last = s;
          this.history.push(s); if (this.history.length > 3600) this.history.shift();
          for (const fn of this.listeners) fn(s);
        } catch {}
      }
    });
    this.child.on('close', () => { this.child = null; });
  }
  stop() { if (this.child) { try { this.child.kill(); } catch {} this.child = null; } }
  on(fn) { this.listeners.add(fn); this.start(); return () => { this.listeners.delete(fn); }; }
  // Enregistre les échantillons sur une fenêtre de temps.
  record() {
    const samples = [];
    const off = this.on((s) => samples.push(s));
    return { stop: () => { off(); return samples; }, samples };
  }
}

module.exports = new Monitor();

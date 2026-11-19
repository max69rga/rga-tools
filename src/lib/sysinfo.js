// Inventaire matériel / logiciel et contrôles de santé (100 % local, via CIM/WMI).
const { psJson } = require('./util');

const INVENTORY = `
$os  = Get-CimInstance Win32_OperatingSystem
$cs  = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_Processor
$bb  = Get-CimInstance Win32_BaseBoard
$bios= Get-CimInstance Win32_BIOS
$enc = Get-CimInstance Win32_SystemEnclosure
$cv  = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion'
$gpus = Get-CimInstance Win32_VideoController | ForEach-Object {
  $vram = $_.AdapterRAM
  [pscustomobject]@{ name=$_.Name; driver=$_.DriverVersion; driverDate=if($_.DriverDate){$_.DriverDate.ToString('yyyy-MM-dd')}else{''}; vramMB=[math]::Round($vram/1MB); res= if($_.CurrentHorizontalResolution){"$($_.CurrentHorizontalResolution)x$($_.CurrentVerticalResolution) @ $($_.CurrentRefreshRate) Hz"}else{''}; pnp=$_.PNPDeviceID }
}
$vramReg = @(Get-ChildItem 'HKLM:\\SYSTEM\\ControlSet001\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}' -ErrorAction SilentlyContinue | ForEach-Object { $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue; if ($p.'HardwareInformation.qwMemorySize') { [pscustomobject]@{ desc=$p.DriverDesc; mb=[math]::Round([double]$p.'HardwareInformation.qwMemorySize'/1MB) } } })
foreach ($g in $gpus) { $m = $vramReg | Where-Object { $_.desc -eq $g.name } | Select-Object -First 1; if ($m) { $g.vramMB = $m.mb } }
$ram = Get-CimInstance Win32_PhysicalMemory | ForEach-Object { [pscustomobject]@{ slot=$_.DeviceLocator; sizeGB=[math]::Round($_.Capacity/1GB,1); speed=$_.Speed; configured=$_.ConfiguredClockSpeed; maker=($_.Manufacturer -as [string]).Trim(); part=($_.PartNumber -as [string]).Trim() } }
$slots = (Get-CimInstance Win32_PhysicalMemoryArray | Measure-Object -Property MemoryDevices -Sum).Sum
$disks = Get-PhysicalDisk | ForEach-Object {
  $rc = $_ | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue
  [pscustomobject]@{ name=$_.FriendlyName; media=[string]$_.MediaType; bus=[string]$_.BusType; sizeGB=[math]::Round($_.Size/1GB); health=[string]$_.HealthStatus; status=[string]$_.OperationalStatus;
    temp=$rc.Temperature; wear=$rc.Wear; hours=$rc.PowerOnHours; readErr=$rc.ReadErrorsUncorrected; writeErr=$rc.WriteErrorsUncorrected }
}
$vols = Get-Volume | Where-Object { $_.DriveLetter -and $_.DriveType -eq 'Fixed' } | ForEach-Object { [pscustomobject]@{ letter=[string]$_.DriveLetter; label=$_.FileSystemLabel; fs=$_.FileSystem; sizeGB=[math]::Round($_.Size/1GB,1); freeGB=[math]::Round($_.SizeRemaining/1GB,1) } }
$net = Get-NetAdapter -Physical -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ name=$_.Name; desc=$_.InterfaceDescription; status=[string]$_.Status; speed=[string]$_.LinkSpeed; mac=$_.MacAddress } }
$ip = Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPv4DefaultGateway } | Select-Object -First 1
$bat = Get-CimInstance Win32_Battery
$batInfo = $null
if ($bat) {
  $design = (Get-CimInstance -Namespace root\\wmi -ClassName BatteryStaticData -ErrorAction SilentlyContinue | Select-Object -First 1).DesignedCapacity
  $full = (Get-CimInstance -Namespace root\\wmi -ClassName BatteryFullChargedCapacity -ErrorAction SilentlyContinue | Select-Object -First 1).FullChargedCapacity
  $batInfo = [pscustomobject]@{ name=$bat.Name; charge=$bat.EstimatedChargeRemaining; status=$bat.BatteryStatus; design=$design; full=$full; health= if($design -and $full){[math]::Round(100*$full/$design)}else{$null} }
}
$tpm = Get-CimInstance -Namespace root\\cimv2\\security\\microsofttpm -ClassName Win32_Tpm -ErrorAction SilentlyContinue
$sb = try { Confirm-SecureBootUEFI } catch { $null }
$av = Get-CimInstance -Namespace root\\SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction SilentlyContinue | ForEach-Object { $_.displayName }
$plan = (powercfg /getactivescheme) -replace '.*\\((.*)\\).*','$1'
[pscustomobject]@{
  host=$env:COMPUTERNAME; user=$env:USERNAME
  os=[pscustomobject]@{ name=$os.Caption; version=$cv.DisplayVersion; build="$($os.BuildNumber).$($cv.UBR)"; arch=$os.OSArchitecture; installed=$os.InstallDate.ToString('yyyy-MM-dd'); boot=$os.LastBootUpTime.ToString('yyyy-MM-dd HH:mm'); uptimeH=[math]::Round(((Get-Date)-$os.LastBootUpTime).TotalHours,1); lang=$os.MUILanguages -join ', ' }
  system=[pscustomobject]@{ maker=$cs.Manufacturer; model=$cs.Model; family=$cs.SystemFamily; type=$enc.ChassisTypes -join ','; serial=$bios.SerialNumber; pcType=$cs.PCSystemType }
  board=[pscustomobject]@{ maker=$bb.Manufacturer; model=$bb.Product; bios="$($bios.SMBIOSBIOSVersion)"; biosDate=if($bios.ReleaseDate){$bios.ReleaseDate.ToString('yyyy-MM-dd')}else{''}; uefi=($env:firmware_type) ; secureBoot=$sb; tpm= if($tpm){"$($tpm.SpecVersion)".Split(',')[0]}else{$null} }
  cpu=@($cpu | ForEach-Object { [pscustomobject]@{ name=$_.Name.Trim(); cores=$_.NumberOfCores; threads=$_.NumberOfLogicalProcessors; maxMHz=$_.MaxClockSpeed; socket=$_.SocketDesignation; virt=$_.VirtualizationFirmwareEnabled; l2KB=$_.L2CacheSize; l3KB=$_.L3CacheSize } })
  ram=[pscustomobject]@{ totalGB=[math]::Round($cs.TotalPhysicalMemory/1GB,1); slots=$slots; modules=@($ram) }
  gpu=@($gpus)
  disks=@($disks); volumes=@($vols)
  network=[pscustomobject]@{ adapters=@($net); ipv4=($ip.IPv4Address.IPAddress | Select-Object -First 1); gateway=($ip.IPv4DefaultGateway.NextHop | Select-Object -First 1); dns=@($ip.DNSServer.ServerAddresses | Select-Object -First 3) }
  battery=$batInfo
  security=[pscustomobject]@{ antivirus=@($av); }
  powerPlan=$plan.Trim()
}`;

const HEALTH = `
$since = (Get-Date).AddDays(-30)
function cnt($f) { try { @(Get-WinEvent -FilterHashtable $f -MaxEvents 1000 -ErrorAction Stop).Count } catch { 0 } }
function last($f) { try { $e = Get-WinEvent -FilterHashtable $f -MaxEvents 1 -ErrorAction Stop; $e.TimeCreated.ToString('yyyy-MM-dd HH:mm') } catch { $null } }
$whea = @{LogName='System'; ProviderName='Microsoft-Windows-WHEA-Logger'; StartTime=$since}
$bsod = @{LogName='System'; ProviderName='Microsoft-Windows-WER-SystemErrorReporting'; Id=1001; StartTime=$since}
$kp41 = @{LogName='System'; ProviderName='Microsoft-Windows-Kernel-Power'; Id=41; StartTime=$since}
$disk = @{LogName='System'; ProviderName='disk'; Id=7,11,51,153; StartTime=$since}
$appc = @{LogName='Application'; ProviderName='Application Error'; Id=1000; StartTime=$since}
$drv = @(Get-CimInstance Win32_PnPEntity | Where-Object { $_.ConfigManagerErrorCode -ne 0 } | ForEach-Object { [pscustomobject]@{ name= if($_.Name){$_.Name}else{$_.PNPDeviceID}; code=$_.ConfigManagerErrorCode } })
$mp = Get-MpComputerStatus -ErrorAction SilentlyContinue
$pending = (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending') -or (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired')
$startup = @(Get-CimInstance Win32_StartupCommand).Count
$lic = Get-CimInstance SoftwareLicensingProduct -Filter "PartialProductKey IS NOT NULL AND Name LIKE 'Windows%'" | Select-Object -First 1
$hot = Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 1
[pscustomobject]@{
  whea=(cnt $whea); wheaLast=(last $whea)
  bsod=(cnt $bsod); bsodLast=(last $bsod)
  unexpectedShutdown=(cnt $kp41); kp41Last=(last $kp41)
  diskErrors=(cnt $disk)
  appCrashes=(cnt $appc)
  badDevices=@($drv)
  defender= if($mp){[pscustomobject]@{ enabled=$mp.AntivirusEnabled; realtime=$mp.RealTimeProtectionEnabled; sigAgeDays=$mp.AntivirusSignatureAge }}else{$null}
  rebootPending=$pending
  startupCount=$startup
  activated= if($lic){ $lic.LicenseStatus -eq 1 }else{ $null }
  lastUpdate= if($hot.InstalledOn){ $hot.InstalledOn.ToString('yyyy-MM-dd') }else{ $null }
}`;

const getInventory = () => psJson(INVENTORY, { timeout: 180000 });
const getHealth = () => psJson(HEALTH, { timeout: 180000 });

module.exports = { getInventory, getHealth };

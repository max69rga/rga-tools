// Lecture des journaux d'événements Windows et diagnostic des problèmes connus.
const { psJson } = require('./util');

const LOGS = {
  System: 'System',
  Application: 'Application',
  Defender: 'Microsoft-Windows-Windows Defender/Operational',
};

// ─── Lecture ───
async function fetchEvents({ days = 7, levels = [1, 2, 3], logs = ['System', 'Application'], max = 3000 } = {}) {
  const logNames = logs.map(l => LOGS[l] || l).map(l => `'${l.replace(/'/g, "''")}'`).join(',');
  const lv = levels.filter(n => [1, 2, 3, 4].includes(+n)).join(',') || '1,2,3';
  const script = `
$start = (Get-Date).AddDays(-${Math.max(1, Math.min(90, +days || 7))})
$disks = @{}; Get-PhysicalDisk | ForEach-Object { $disks["$($_.DeviceId)"] = $_.FriendlyName }
$pci = @{}; Get-CimInstance Win32_PnPEntity -Filter "PNPDeviceID LIKE 'PCI%'" | ForEach-Object { if ($_.PNPDeviceID -match 'VEN_([0-9A-F]{4})&DEV_([0-9A-F]{4})') { $k = "$($Matches[1]):$($Matches[2])"; if (-not $pci[$k]) { $pci[$k] = $_.Name } } }
$out = New-Object System.Collections.Generic.List[object]
foreach ($log in @(${logNames})) {
  try { $ev = Get-WinEvent -FilterHashtable @{ LogName = $log; Level = ${lv}; StartTime = $start } -MaxEvents ${max} -ErrorAction Stop } catch { $ev = @() }
  foreach ($e in $ev) {
    $m = $e.Message
    if (-not $m) { $m = (@($e.Properties | Select-Object -First 8 | ForEach-Object { "$($_.Value)" }) -join ' | ') }
    if ($m.Length -gt 900) { $m = $m.Substring(0, 900) + '…' }
    $out.Add([pscustomobject]@{
      t = $e.TimeCreated.ToString('o'); log = $log; lvl = [int]$e.Level; p = $e.ProviderName; id = $e.Id; m = $m
      d = @($e.Properties | Select-Object -First 10 | ForEach-Object { "$($_.Value)" })
    })
  }
}
$boots = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-Kernel-General'; Id = 12; StartTime = $start } -ErrorAction SilentlyContinue | ForEach-Object { $_.TimeCreated.ToString('o') })
[pscustomobject]@{ events = $out; disks = $disks; pci = $pci; boots = $boots }`;
  const r = await psJson(script, { timeout: 240000, name: 'journaux' });
  return { events: r?.events ? (Array.isArray(r.events) ? r.events : [r.events]) : [], disks: r?.disks || {}, pci: r?.pci || {}, boots: [].concat(r?.boots || []) };
}

// ─── Codes d'arrêt (écrans bleus) ───
const BUGCHECK = {
  0x0A: ['IRQL_NOT_LESS_OR_EQUAL', 'Pilote défectueux ou RAM instable.'],
  0x1A: ['MEMORY_MANAGEMENT', 'Erreur de gestion mémoire : RAM défectueuse ou instable (XMP), parfois un pilote.'],
  0x1E: ['KMODE_EXCEPTION_NOT_HANDLED', 'Exception dans un pilote noyau.'],
  0x3B: ['SYSTEM_SERVICE_EXCEPTION', 'Pilote ou composant système défaillant (souvent pilote graphique ou antivirus).'],
  0x50: ['PAGE_FAULT_IN_NONPAGED_AREA', 'Accès mémoire invalide : RAM, pilote ou fichier système corrompu.'],
  0x7A: ['KERNEL_DATA_INPAGE_ERROR', 'Lecture impossible depuis le disque (fichier d\'échange) : disque ou câble défaillant.'],
  0x7E: ['SYSTEM_THREAD_EXCEPTION_NOT_HANDLED', 'Pilote défectueux.'],
  0x7F: ['UNEXPECTED_KERNEL_MODE_TRAP', 'Problème matériel (RAM, CPU) ou overclocking.'],
  0x9F: ['DRIVER_POWER_STATE_FAILURE', 'Pilote bloqué lors d\'une mise en veille / sortie de veille.'],
  0xA0: ['INTERNAL_POWER_ERROR', 'Erreur de gestion d\'alimentation (veille prolongée).'],
  0xC2: ['BAD_POOL_CALLER', 'Pilote défectueux.'],
  0xD1: ['DRIVER_IRQL_NOT_LESS_OR_EQUAL', 'Pilote défectueux (souvent réseau, WiFi ou USB).'],
  0xEF: ['CRITICAL_PROCESS_DIED', 'Un processus système vital s\'est arrêté : fichiers système corrompus ou disque défaillant.'],
  0xF4: ['CRITICAL_OBJECT_TERMINATION', 'Processus critique arrêté : souvent disque ou câble SATA défaillant.'],
  0x101: ['CLOCK_WATCHDOG_TIMEOUT', 'Un cœur du processeur ne répond plus : CPU instable, overclocking ou BIOS.'],
  0x116: ['VIDEO_TDR_FAILURE', 'La carte graphique ne répond plus : pilote, surchauffe ou carte défaillante.'],
  0x117: ['VIDEO_TDR_TIMEOUT_DETECTED', 'La carte graphique ne répond plus : pilote, surchauffe ou carte défaillante.'],
  0x119: ['VIDEO_SCHEDULER_INTERNAL_ERROR', 'Erreur du pilote graphique.'],
  0x124: ['WHEA_UNCORRECTABLE_ERROR', 'Erreur matérielle non corrigible : CPU, RAM, carte mère ou alimentation (vérifier l\'overclocking et les températures).'],
  0x133: ['DPC_WATCHDOG_VIOLATION', 'Un pilote bloque le système trop longtemps (souvent stockage SSD/SATA ou firmware à mettre à jour).'],
  0x139: ['KERNEL_SECURITY_CHECK_FAILURE', 'Corruption détectée : pilote incompatible ou RAM défectueuse.'],
  0x13A: ['KERNEL_MODE_HEAP_CORRUPTION', 'Corruption mémoire par un pilote.'],
  0x154: ['UNEXPECTED_STORE_EXCEPTION', 'Erreur du stockage ou de la compression mémoire : SSD/disque à vérifier.'],
  0x1C7: ['STORE_DATA_STRUCTURE_CORRUPTION', 'Corruption mémoire : RAM ou disque.'],
  0x19: ['BAD_POOL_HEADER', 'Corruption mémoire par un pilote.'],
  0x24: ['NTFS_FILE_SYSTEM', 'Erreur du système de fichiers NTFS : lancer une vérification du disque.'],
  0xC000021A: ['WINLOGON_FATAL_ERROR', 'Processus de connexion arrêté : fichiers système corrompus.'],
};
function bugcheckInfo(code) {
  if (code == null || isNaN(code)) return null;
  const [name, cause] = BUGCHECK[code] || BUGCHECK[code >>> 0] || [];
  return { code: `0x${(code >>> 0).toString(16).toUpperCase().padStart(8, '0')}`, name: name || 'Code inconnu', cause: cause || 'Analyser le fichier de vidage mémoire (C:\\Windows\\Minidump) avec WinDbg ou BlueScreenView.' };
}
const hr = (v) => { const n = parseInt(v, 10); return isNaN(n) ? String(v || '') : `0x${(n >>> 0).toString(16).toUpperCase().padStart(8, '0')}`; };
const hexIn = (s) => { const m = String(s || '').match(/0x([0-9a-f]{1,8})\b/i); return m ? parseInt(m[1], 16) : null; };
const num = (v) => { const s = String(v ?? '').trim().replace(/^%%/, ''); const n = /^0x/i.test(s) ? parseInt(s, 16) : /^[0-9a-f]{8}$/i.test(s) && /[a-f]/i.test(s) ? parseInt(s, 16) : parseInt(s, 10); return isNaN(n) ? null : n >>> 0; };
const hex8 = (n) => `0x${(n >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
const line1 = (m) => String(m || '').split(/\r?\n/).map(s => s.trim()).find(Boolean) || '';
const clip = (s, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Codes d'exception (plantages d'applications, paramètres d'écran bleu).
const EXC = {
  0xC0000005: 'violation d’accès mémoire', 0xC0000409: 'dépassement de tampon détecté', 0xC0000374: 'corruption du tas mémoire',
  0xC00000FD: 'débordement de pile', 0x80000003: 'point d’arrêt (arrêt volontaire de l’application)', 0xE0434352: 'exception .NET non gérée',
  0xE06D7363: 'exception C++ non gérée', 0xC000001D: 'instruction illégale (processeur instable ou incompatible)', 0xC0000096: 'instruction privilégiée',
  0xC0000006: 'erreur de lecture de page (disque ou réseau)', 0xC0000135: 'DLL introuvable', 0xC0000142: 'échec d’initialisation d’une DLL',
  0xC0000417: 'paramètre invalide', 0xC0000602: 'arrêt immédiat demandé par l’application', 0xC000027B: 'erreur d’application Microsoft Store',
  0x40000015: 'arrêt forcé (abort)', 0xC0000420: 'échec d’assertion', 0xC000041D: 'exception dans une fonction de rappel',
};
const exc = (v) => { const n = num(v); return n == null ? '' : `${hex8(n)}${EXC[n] ? ` (${EXC[n]})` : ''}`; };

// Codes d'échec Windows Update.
const WUERR = {
  0x80073D02: 'l’application est ouverte pendant la mise à jour : la fermer puis relancer la mise à jour',
  0x80070002: 'fichiers de mise à jour manquants : vider le cache Windows Update', 0x80070003: 'chemin introuvable dans le cache Windows Update',
  0x80070005: 'accès refusé (antivirus ou droits)', 0x8007000D: 'données de mise à jour corrompues : vider le cache Windows Update',
  0x80070070: 'espace disque insuffisant', 0x80070643: 'échec de l’installateur (souvent .NET Framework ou Defender)',
  0x80073712: 'magasin de composants endommagé : lancer DISM', 0x800F081F: 'sources de réparation introuvables : lancer DISM',
  0x800F0922: 'partition réservée au système pleine, ou connexion / VPN coupé pendant l’installation',
  0x800F0831: 'mise à jour précédente manquante : lancer DISM', 0x800F0988: 'nettoyage des composants nécessaire (DISM /StartComponentCleanup)',
  0x8024200D: 'téléchargement incomplet', 0x8024402C: 'serveurs Windows Update injoignables (proxy ou DNS)', 0x80240034: 'téléchargement échoué',
  0x80240017: 'mise à jour non applicable à ce PC', 0x8024A105: 'agent Windows Update en erreur', 0x80246007: 'téléchargement non terminé',
  0x800705B4: 'délai dépassé', 0x80070020: 'fichier verrouillé par un autre programme (souvent l’antivirus)',
  0xC1900101: 'pilote incompatible pendant la mise à niveau de Windows', 0xC1900208: 'application incompatible qui bloque la mise à niveau',
};

// Codes d'erreur des services (Service Control Manager).
const SVCERR = {
  2: 'fichier du service introuvable (logiciel mal désinstallé)', 3: 'chemin introuvable', 5: 'accès refusé', 50: 'fonction non prise en charge sur ce PC',
  87: 'paramètre incorrect', 193: 'exécutable invalide ou corrompu', 577: 'signature numérique invalide (fichier modifié ou bloqué)',
  1053: 'le service n’a pas répondu à temps', 1058: 'service désactivé', 1067: 'le processus s’est arrêté de façon inattendue',
  1068: 'un service dont il dépend n’a pas démarré', 1069: 'échec d’ouverture de session du compte de service', 1075: 'dépendance inexistante',
  1079: 'compte de service incorrect', 1275: 'pilote bloqué par Windows', 1455: 'fichier d’échange trop petit',
};

// Fabricants PCI (erreurs PCI Express).
const PCIVEN = {
  '10DE': 'NVIDIA', '1002': 'AMD', '1022': 'AMD', '8086': 'Intel', '144D': 'Samsung', '15B7': 'Western Digital / SanDisk', '1987': 'Phison',
  '1C5C': 'SK hynix', '2646': 'Kingston', '1344': 'Micron / Crucial', '126F': 'Silicon Motion', '1E0F': 'KIOXIA', '1CC1': 'ADATA', '1D97': 'Lexar',
  '10EC': 'Realtek', '14E4': 'Broadcom', '168C': 'Qualcomm Atheros', '17CB': 'Qualcomm', '1B21': 'ASMedia', '1E49': 'YMTC', '1BB1': 'Seagate', '1E4B': 'MAXIO',
};
function pciDevice(m, ctx) {
  const x = String(m || '').match(/0x([0-9a-f]{4})\s*:\s*0x([0-9a-f]{4})/i);
  if (!x) return null;
  const k = `${x[1].toUpperCase()}:${x[2].toUpperCase()}`;
  return ctx.pci?.[k] || `${PCIVEN[k.slice(0, 4)] || 'fabricant'} ${k}`;
}
const wheaComponent = (m) => (String(m || '').match(/(?:Composant|Component)\s*:\s*([^\r\n]+)/i) || [])[1]?.trim() || '';

// Paramètres d'un écran bleu : « 0x0000003b (0x00000000c0000005, 0x…, …) ».
function bsodDetails(e) {
  const out = [];
  const src = String(e.d?.[0] || e.m || '');
  const code = hexIn(src);
  const params = ((src.match(/\(([^)]*)\)/) || [])[1] || '').split(',').map(s => s.trim()).filter(Boolean);
  if ([0x3B, 0x1E, 0x7E, 0x8E, 0x1000007E, 0x1000008E].includes(code) && params[0]) out.push(`Exception : ${exc('0x' + params[0].replace(/^0x0*/i, '').padStart(8, '0').slice(-8))}`);
  if (params.length) out.push(`Paramètres : ${params.join(', ')}`);
  const dump = (e.d || []).find(x => /\.dmp$/i.test(x)) || (String(e.m).match(/[A-Z]:\\[^\s]+\.dmp/i) || [])[0];
  if (dump) out.push(`Fichier de vidage : ${dump}`);
  return out;
}
// Kernel-Power 41 : BugcheckCode, P1..P4, SleepInProgress, PowerButtonTimestamp…
function kp41Kind(e) {
  if (parseInt(e.d?.[0], 10)) return 'bsod';
  if (e.d?.[6] && e.d[6] !== '0') return 'button';
  if (e.d?.[5] && e.d[5] !== '0') return 'sleep';
  return 'power';
}
const storeApp = (s) => (String(s || '').match(/^[0-9A-Z]{12}-(.+)$/) || [])[1] || null;

// ─── Base de connaissance ───
// match(e) -> bool ; key(e) -> sous-groupe ; title/cause/action -> texte (fonctions ou chaînes) ; sev : error|warn|info|ignore ; tool : action proposée
const RULES = [
  { id: 'bsod', match: e => (e.p === 'Microsoft-Windows-WER-SystemErrorReporting' && e.id === 1001) || (e.p === 'BugCheck' && e.id === 1001),
    key: e => String(hexIn(e.m) ?? hexIn(e.d?.[0]) ?? '?'), sev: 'error', cat: 'Stabilité', tool: 'minidump',
    title: e => { const b = bugcheckInfo(hexIn(e.m) ?? hexIn(e.d?.[0])); return `Écran bleu ${b ? `${b.name} (${b.code})` : ''}`; },
    cause: e => bugcheckInfo(hexIn(e.m) ?? hexIn(e.d?.[0]))?.cause || 'Arrêt critique du système.',
    detail: bsodDetails,
    action: 'Mettre à jour les pilotes (chipset, graphique, stockage) et le BIOS, désactiver l\'overclocking, puis lancer le diagnostic mémoire et un diagnostic PC complet.' },
  { id: 'kp41', match: e => e.p === 'Microsoft-Windows-Kernel-Power' && e.id === 41, cat: 'Stabilité', tool: 'diag',
    title: e => ({
      bsod: () => `Redémarrage brutal après écran bleu (${bugcheckInfo(parseInt(e.d[0], 10)).name})`,
      button: () => 'Arrêt forcé par un appui long sur le bouton d’alimentation',
      sleep: () => 'Arrêt brutal pendant la mise en veille ou la sortie de veille',
      power: () => 'Arrêt brutal sans écran bleu (coupure d’alimentation)',
    })[kp41Kind(e)](),
    key: kp41Kind,
    sev: e => (kp41Kind(e) === 'button' ? 'warn' : 'error'),
    cause: e => ({
      bsod: () => bugcheckInfo(parseInt(e.d[0], 10)).cause,
      button: () => 'Le PC a été éteint en maintenant le bouton d’alimentation : en général parce qu’il était figé ou ne répondait plus.',
      sleep: () => 'Le PC s’est arrêté pendant un changement d’état de veille : pilote (graphique, réseau, USB), BIOS ou démarrage rapide en cause.',
      power: () => 'Le PC s’est éteint d’un coup, sans écran bleu ni appui sur le bouton : coupure de courant, bloc d’alimentation défaillant ou surchauffe.',
    })[kp41Kind(e)](),
    detail: e => (kp41Kind(e) === 'bsod' ? [`Code ${hex8(parseInt(e.d[0], 10))}`, ...([0x3B, 0x1E, 0x7E].includes(parseInt(e.d[0], 10)) && e.d[1] ? [`Exception : ${exc(e.d[1])}`] : [])] : []),
    action: e => ({
      bsod: 'Mettre à jour les pilotes et le BIOS, désactiver l’overclocking, puis lancer le diagnostic mémoire et le diagnostic extrême.',
      button: 'Si le PC se fige : vérifier les températures, lancer le diagnostic extrême et contrôler l’état du disque.',
      sleep: 'Mettre à jour les pilotes (chipset, graphique, réseau) et le BIOS ; désactiver le démarrage rapide si le problème revient.',
      power: 'Vérifier l’alimentation (bloc, multiprise, onduleur) et les températures, puis lancer le diagnostic extrême.',
    })[kp41Kind(e)] },
  { id: 'bsoddrv', match: e => e.p === 'Microsoft-Windows-WER-SystemErrorReporting' && e.id === 1019, sev: 'info', cat: 'Stabilité', tool: 'drivers',
    key: e => String(e.d?.[0] || '').toLowerCase(), title: e => `Pilote associé à un écran bleu : ${e.d?.[0] || '?'}`,
    cause: e => driverInfo(e.d?.[0]) || 'Windows désigne ce pilote comme cause probable de l’écran bleu.',
    action: 'Mettre à jour ou réinstaller le pilote (ou le logiciel) auquel il appartient.' },
  { id: 'unexp', match: e => e.p === 'EventLog' && e.id === 6008, sev: 'warn', cat: 'Stabilité',
    title: 'Arrêt précédent inattendu', cause: 'Windows ne s\'est pas arrêté proprement.', action: 'Voir les événements Kernel-Power 41 associés.' },
  { id: 'whea', match: e => e.p === 'Microsoft-Windows-WHEA-Logger', sev: e => (e.id === 17 || e.id === 47 ? 'warn' : 'error'), cat: 'Matériel', tool: 'diag',
    key: (e, ctx) => `${e.id}:${pciDevice(e.m, ctx) || wheaComponent(e.m)}`,
    detail: (e, ctx) => [wheaComponent(e.m) && `Composant : ${wheaComponent(e.m)}`, pciDevice(e.m, ctx) && `Périphérique : ${pciDevice(e.m, ctx)}`].filter(Boolean),
    title: (e, ctx) => (e.id === 17 && pciDevice(e.m, ctx)) ? `Erreur PCI Express corrigée sur « ${pciDevice(e.m, ctx)} »` : ({ 17: 'Erreur PCI Express corrigée (WHEA 17)', 47: 'Erreur mémoire corrigée (WHEA 47)', 18: 'Erreur matérielle fatale du processeur (WHEA 18)', 19: 'Erreur matérielle corrigée du processeur (WHEA 19)', 1: 'Erreur matérielle (WHEA 1)' }[e.id] || `Erreur matérielle WHEA ${e.id}`),
    cause: e => e.id === 17 ? 'Un périphérique PCIe (carte graphique, SSD NVMe, carte réseau) génère des erreurs de bus, souvent liées à la gestion d\'énergie ASPM.' : e.id === 47 ? 'La RAM a produit des erreurs corrigées : barrette instable ou défaillante.' : 'Le processeur, la RAM ou la carte mère signale des erreurs : instabilité (overclocking, XMP, tension) ou composant défaillant.',
    action: e => e.id === 17 ? 'Mettre à jour BIOS et pilotes chipset ; si l\'erreur persiste, désactiver ASPM / PCIe Link State Power Management.' : 'Désactiver l\'overclocking et le profil XMP pour tester, mettre à jour le BIOS, lancer le diagnostic mémoire et le diagnostic extrême.' },
  { id: 'disk', match: e => /^(disk|Disk)$/.test(e.p) && [7, 11, 15, 51, 52, 153, 154, 157].includes(e.id), sev: e => ([7, 11, 52].includes(e.id) ? 'error' : 'warn'), cat: 'Stockage', tool: 'chkdsk',
    key: e => `${e.id}:${(String(e.m).match(/Harddisk(\d+)/i) || [])[1] ?? ''}`,
    title: (e, ctx) => {
      const n = (String(e.m).match(/Harddisk(\d+)/i) || [])[1]; const name = n != null ? (ctx.disks[n] ? `« ${ctx.disks[n]} »` : `n° ${n} (amovible ou déconnecté)`) : '';
      return ({ 7: `Secteurs défectueux sur le disque ${name}`, 11: `Erreur du contrôleur du disque ${name}`, 15: `Disque ${name} non prêt`, 51: `Erreur de pagination sur le disque ${name}`, 52: `Défaillance SMART imminente du disque ${name}`, 153: `Opérations disque réessayées sur ${name}`, 154: `Erreur matérielle d'E/S sur ${name}`, 157: `Disque ${name} retiré à chaud` }[e.id]) || `Erreur disque ${e.id}`;
    },
    cause: e => ({ 7: 'Le disque contient des secteurs illisibles : il est en train de se dégrader.', 11: 'Problème de communication avec le disque : câble SATA, port, alimentation ou contrôleur.', 51: 'Échec d\'écriture/lecture lors de la pagination : souvent un périphérique USB débranché, un câble défectueux ou un disque en fin de vie.', 52: 'Le disque prévient lui-même d\'une panne prochaine.', 153: 'Le disque a mis trop de temps à répondre : disque lent/défaillant, câble ou pilote de stockage.', 157: 'Un disque (souvent USB) a été déconnecté sans être éjecté.' }[e.id] || 'Erreur de stockage.'),
    action: e => [7, 52].includes(e.id) ? 'Sauvegarder immédiatement les données et prévoir le remplacement du disque. Vérifier l\'état SMART avec CrystalDiskInfo.' : 'Vérifier les câbles / ports (essayer un autre port USB ou câble SATA), contrôler l\'état SMART avec CrystalDiskInfo et lancer une vérification du disque.' },
  { id: 'ntfs', match: e => e.p === 'Ntfs' && [55, 98, 137, 140].includes(e.id), sev: 'error', cat: 'Stockage', tool: 'chkdsk',
    title: 'Corruption du système de fichiers NTFS', cause: 'La structure du système de fichiers est endommagée (arrêt brutal ou disque défaillant).', action: 'Lancer une vérification du disque (chkdsk) puis contrôler l\'état SMART.' },
  { id: 'storreset', match: e => /^(storahci|stornvme|iaStorA|iaStorAC|iaStorAVC|nvme|amd_sata|amdsata)$/i.test(e.p) && [129, 11, 153].includes(e.id), sev: 'warn', cat: 'Stockage', tool: 'drivers',
    title: e => `Réinitialisation du contrôleur de stockage (${e.p})`, cause: 'Le SSD/disque ne répondait plus et a été réinitialisé : firmware, pilote de stockage, gestion d\'énergie ou câble.',
    action: 'Mettre à jour le firmware du SSD, le pilote de stockage / chipset et le BIOS ; vérifier le câble SATA.' },
  { id: 'gpu', match: e => (e.p === 'Display' && e.id === 4101) || (/^(nvlddmkm|amdkmdag|amdwddmg|igfx|igfxn)$/i.test(e.p) && [13, 14, 153, 4101].includes(e.id)), sev: 'warn', cat: 'Carte graphique', tool: 'drivers',
    title: 'Le pilote graphique a cessé de répondre et a été redémarré', cause: 'Plantage du pilote graphique (TDR) : pilote corrompu ou instable, surchauffe, overclocking GPU ou alimentation insuffisante.',
    action: 'Réinstaller proprement le pilote graphique (DDU), vérifier les températures GPU et lancer le test GPU du diagnostic.' },
  { id: 'cputhrottle', match: e => e.p === 'Microsoft-Windows-Kernel-Processor-Power' && e.id === 37, sev: 'warn', cat: 'Températures', tool: 'diag',
    title: 'Processeur bridé par le firmware', cause: 'La fréquence du processeur a été réduite par le système (surchauffe ou limite d\'alimentation).', action: 'Nettoyer le refroidissement, vérifier la pâte thermique et le mode d\'alimentation.' },
  { id: 'lowmem', match: e => e.p === 'Microsoft-Windows-Resource-Exhaustion-Detector' && e.id === 2004, sev: 'warn', cat: 'Mémoire',
    title: 'Mémoire virtuelle épuisée', cause: 'Windows a manqué de mémoire : RAM insuffisante ou application qui consomme trop (fuite mémoire).', action: 'Identifier l\'application en cause (le message la cite), ajouter de la RAM ou augmenter le fichier d\'échange.' },
  { id: 'svc', match: e => e.p === 'Service Control Manager' && [7000, 7001, 7009, 7011, 7022, 7023, 7024, 7026, 7031, 7032, 7034, 7038, 7043].includes(e.id), sev: e => ([7031, 7034].includes(e.id) ? 'warn' : 'info'), cat: 'Services',
    key: e => `${e.id}:${e.d?.[0] || ''}`, title: e => `Service « ${e.d?.[0] || '?'} » ${[7031, 7034].includes(e.id) ? 's\'est arrêté de façon inattendue' : [7009, 7011, 7022].includes(e.id) ? 'ne répond pas au démarrage' : 'n\'a pas pu démarrer'}`,
    detail: e => { const c = [7000, 7009, 7011, 7023, 7024, 7038, 7043].includes(e.id) ? num(e.d?.[1]) : null; return [c != null && `Erreur ${c}${SVCERR[c] ? ` : ${SVCERR[c]}` : ''}`, clip(String(e.m || '').replace(/\s+/g, ' ').trim(), 240)].filter(Boolean); },
    cause: e => { const c = [7000, 7009, 7011, 7023, 7024, 7038, 7043].includes(e.id) ? num(e.d?.[1]) : null; return SVCERR[c] ? `Cause indiquée par Windows : ${SVCERR[c]}.` : 'Service Windows ou logiciel tiers défaillant, mal désinstallé ou bloqué.'; }, action: 'Si le service appartient à un logiciel inutilisé, le désinstaller ; sinon réinstaller / mettre à jour ce logiciel. Les services Windows peuvent être réparés avec SFC.', tool: 'sfc' },
  { id: 'kpnp', match: e => e.p === 'Microsoft-Windows-Kernel-PnP' && [219, 411].includes(e.id), sev: 'info', cat: 'Pilotes', tool: 'drivers',
    title: 'Pilote de périphérique non chargé au démarrage', cause: 'Un pilote n\'a pas pu être chargé (périphérique absent ou pilote incompatible).', action: 'Vérifier le Gestionnaire de périphériques et mettre à jour le pilote concerné.' },
  { id: 'apperr', match: e => (e.p === 'Application Error' && e.id === 1000) || (e.p === 'Application Hang' && e.id === 1002), sev: 'info', cat: 'Applications',
    key: e => `${e.id}:${(e.d?.[0] || '').toLowerCase()}`,
    title: e => `${e.id === 1002 ? 'Blocage' : 'Plantage'} de l'application « ${e.d?.[0] || '?'} »`,
    detail: e => (e.id === 1000
      ? [e.d?.[1] && `Version de l’application : ${e.d[1]}`, e.d?.[3] && `Module en cause : ${e.d[3]}`, e.d?.[6] && `Exception : ${exc(e.d[6])}`, (String(e.m).match(/[A-Z]:\\[^\r\n]+\.exe/i) || [])[0]]
      : [e.d?.[1] && `Version de l’application : ${e.d[1]}`, e.d?.[5] && `Emplacement : ${e.d[5]}`]).filter(Boolean),
    cause: e => e.id === 1000 && e.d?.[3] ? `Module en cause : ${e.d[3]}${e.d?.[6] ? ` (exception ${exc(e.d[6])})` : ''}. ${/ntdll|kernelbase|ucrtbase|msvcp|vcruntime/i.test(e.d[3]) ? 'Module système générique : souvent un bug de l\'application elle-même ou des bibliothèques Visual C++ à réparer.' : /nvwgf|atiumd|amdxx|igd|d3d|dxgi/i.test(e.d[3]) ? 'Module graphique : mettre à jour / réinstaller le pilote graphique.' : 'Le module indique souvent le composant fautif (plugin, pilote, antivirus).'}` : 'L\'application ne répondait plus.',
    action: 'Mettre à jour ou réinstaller l\'application ; si plusieurs applications plantent, réparer Windows (SFC/DISM) et tester la RAM.' },
  { id: 'dotnet', match: e => e.p === '.NET Runtime' && [1026, 1023, 1025].includes(e.id), sev: 'info', cat: 'Applications', key: e => `${e.id}:${(String(e.m).match(/Application\s*:\s*([^\s\r\n]+)/i) || [])[1] || ''}`,
    title: e => `Erreur .NET${(String(e.m).match(/Application\s*:\s*([^\s\r\n]+)/i) || [])[1] ? ` dans « ${(String(e.m).match(/Application\s*:\s*([^\s\r\n]+)/i))[1]} »` : ''}`, cause: 'Exception non gérée dans une application .NET.', action: 'Mettre à jour l\'application ; réparer .NET Framework / .NET Runtime si plusieurs applications sont touchées.' },
  { id: 'wu', match: e => e.p === 'Microsoft-Windows-WindowsUpdateClient' && [20, 25, 31].includes(e.id), cat: 'Mises à jour', tool: 'wu',
    sev: e => (storeApp(e.d?.[1]) ? 'info' : 'warn'),
    key: e => `${e.d?.[0] || ''}:${e.d?.[1] || ''}`,
    title: e => storeApp(e.d?.[1]) ? `Échec de mise à jour de l’application Store « ${storeApp(e.d[1])} »${e.d?.[0] ? ` (${hr(e.d[0])})` : ''}` : `Échec d'installation d'une mise à jour Windows${e.d?.[0] ? ` (${hr(e.d[0])})` : ''}`,
    detail: e => [e.d?.[1] && `Mise à jour : ${e.d[1]}`, WUERR[num(e.d?.[0])] && `Code ${hr(e.d[0])} : ${WUERR[num(e.d[0])]}`].filter(Boolean),
    cause: e => WUERR[num(e.d?.[0])] ? `Cause indiquée par le code d’erreur : ${WUERR[num(e.d[0])]}.` : 'Composants Windows Update corrompus, espace disque insuffisant ou fichiers système endommagés.',
    action: e => storeApp(e.d?.[1]) ? 'Fermer l’application puis relancer la mise à jour depuis le Microsoft Store (Bibliothèque → Obtenir les mises à jour).' : 'Lancer l\'utilitaire de résolution des problèmes Windows Update, puis DISM et SFC ; vérifier l\'espace libre sur C:.' },
  { id: 'wuservicing', match: e => e.p === 'Microsoft-Windows-Servicing' || (e.p === 'Microsoft-Windows-CBS' && e.lvl <= 2), sev: 'warn', cat: 'Mises à jour', tool: 'dism',
    title: 'Erreur de maintenance des composants Windows', cause: 'Le magasin de composants Windows est endommagé.', action: 'Lancer DISM puis SFC.' },
  { id: 'ipconflict', match: e => e.p === 'Tcpip' && e.id === 4199, sev: 'warn', cat: 'Réseau', tool: 'net',
    title: 'Conflit d\'adresse IP', cause: 'Un autre appareil du réseau utilise la même adresse IP.', action: 'Passer en DHCP automatique ou changer l\'IP fixe ; redémarrer la box si besoin.' },
  { id: 'dhcp', match: e => /Dhcp-Client/i.test(e.p) && [1001, 1002, 1003, 50103].includes(e.id), sev: 'warn', cat: 'Réseau', tool: 'net',
    title: 'Impossible d\'obtenir une adresse IP (DHCP)', cause: 'La box / le serveur DHCP ne répond pas : câble, WiFi, box ou pilote réseau.', action: 'Lancer la réparation réseau (release / renew, reset Winsock), vérifier le câble ou redémarrer la box.' },
  { id: 'dns', match: e => /DNS-Client/i.test(e.p) && [1014].includes(e.id), sev: 'info', cat: 'Réseau', tool: 'net',
    title: 'Délais de résolution DNS', cause: 'Les serveurs DNS ont mis trop de temps à répondre (connexion instable ou DNS lents).', action: 'Vider le cache DNS ; utiliser des DNS fiables (box, 1.1.1.1, 8.8.8.8).' },
  { id: 'netadapter', match: e => /^(Netwtw\d*|e1[cdi]express|e1d|e2f|rt640x64|rtwlane|rtux64w10|Netwbw\d*|athw\w*|BCMWL\w*|mrvlpcie\w*)$/i.test(e.p) && e.lvl <= 3, sev: 'warn', cat: 'Réseau', tool: 'drivers',
    key: e => e.p, title: e => `Erreurs de la carte réseau (${e.p})`, cause: 'Le pilote de la carte réseau signale des réinitialisations ou erreurs : pilote, gestion d\'énergie ou interférences WiFi.',
    action: 'Mettre à jour le pilote réseau depuis le site du fabricant et désactiver « Autoriser l\'ordinateur à éteindre ce périphérique » dans ses propriétés.' },
  { id: 'defender', match: e => /Windows Defender/i.test(e.p) && [1006, 1007, 1015, 1116, 1117, 1118, 1119].includes(e.id), sev: e => ([1117].includes(e.id) ? 'warn' : 'error'), cat: 'Sécurité', tool: 'clean',
    key: e => `${e.id}:${(String(e.m).match(/(?:Nom|Name)\s*:\s*([^\r\n]+)/i) || [])[1] || ''}`,
    title: e => `${e.id === 1117 ? 'Menace traitée' : e.id === 1118 || e.id === 1119 ? 'Échec du traitement d\'une menace' : 'Menace détectée'} : ${(String(e.m).match(/(?:Nom|Name)\s*:\s*([^\r\n]+)/i) || [])[1] || 'logiciel malveillant'}`,
    cause: 'Microsoft Defender a détecté un logiciel malveillant ou indésirable.', action: 'Lancer une analyse complète (Malwarebytes, AdwCleaner) et vérifier les programmes installés.' },
  { id: 'vss', match: e => (e.p === 'VSS' && [8193, 12, 13, 8194].includes(e.id)) || (e.p === 'volsnap' && [25, 36].includes(e.id)), sev: 'info', cat: 'Sauvegarde',
    title: 'Erreurs du service de clichés instantanés (VSS)', cause: 'Les points de restauration / sauvegardes peuvent échouer (service VSS ou espace réservé insuffisant).', action: 'Vérifier l\'espace disque ; redémarrer ; si besoin réenregistrer VSS ou désinstaller le logiciel de sauvegarde en conflit.' },
  { id: 'bitlocker', match: e => /BitLocker/i.test(e.p) && e.lvl <= 2, sev: 'info', cat: 'Sécurité',
    title: 'Avertissement BitLocker', cause: 'BitLocker signale un problème de configuration (TPM, clé de récupération ou chiffrement de périphérique).', action: 'Vérifier l\'état BitLocker et la sauvegarde de la clé de récupération (compte Microsoft).' },
  { id: 'time', match: e => e.p === 'Microsoft-Windows-Time-Service' && e.lvl <= 3, sev: 'info', cat: 'Système',
    title: 'Synchronisation de l\'heure impossible', cause: 'Le serveur de temps n\'est pas joignable.', action: 'Vérifier la connexion Internet ; resynchroniser l\'heure dans Paramètres → Heure.' },
  { id: 'userprofile', match: e => /User Profiles? (General|Service)/i.test(e.p), sev: 'info', cat: 'Système',
    title: 'Avertissements du service de profils utilisateur', cause: 'Fichiers de profil verrouillés à la fermeture de session (souvent sans conséquence).', action: 'Aucune action si aucun symptôme ; sinon redémarrer et vérifier l\'antivirus / la synchronisation OneDrive.' },
  { id: 'search', match: e => e.p === 'Microsoft-Windows-Search', sev: 'info', cat: 'Système',
    title: 'Avertissements de l\'indexation Windows Search', cause: 'L\'index de recherche rencontre des fichiers inaccessibles.', action: 'Si la recherche Windows est lente ou incomplète : reconstruire l\'index (Options d\'indexation).' },
  // Bruit connu, sans conséquence
  { id: 'noise', match: e => (e.p === 'Microsoft-Windows-DistributedCOM' && [10016, 10010, 10005].includes(e.id)) || (e.p === 'Microsoft-Windows-Perflib') || (e.p === 'VBScriptDeprecationAlert') || (e.p === 'Microsoft-Windows-WMI' && e.id === 63) || (e.p === 'Microsoft-Windows-RestartManager') || (e.p === 'Microsoft-Windows-Security-SPP' && [8198, 16385].includes(e.id)) || (e.p === 'Microsoft-Windows-Winlogon' && e.id === 6004) || (e.p === 'ESENT' && e.lvl === 3) || (e.p === '.NET Runtime' && e.id === 1022) || (e.p === 'volmgr' && [161, 162].includes(e.id)),
    sev: 'ignore', cat: 'Sans gravité', title: e => `${e.p} ${e.id}`, cause: 'Événement fréquent et sans conséquence, ignoré par le diagnostic.', action: '' },
];

const SEV_RANK = { error: 0, warn: 1, info: 2, ignore: 3, unknown: 2 };
const val = (x, e, ctx) => (typeof x === 'function' ? x(e, ctx) : x);

// Pilotes souvent cités dans les écrans bleus.
const DRIVERS = [
  [/^nvlddmkm/i, 'pilote graphique NVIDIA'], [/^(amdkmdag|atikmdag|amdkmpfd)/i, 'pilote graphique AMD'], [/^igd/i, 'pilote graphique Intel'],
  [/^(dxgkrnl|dxgmms\d|watchdog)/i, 'noyau graphique DirectX de Windows (souvent déclenché par le pilote graphique)'],
  [/^win32k/i, 'composant graphique / fenêtres de Windows (souvent pilote graphique, RAM ou logiciel d’incrustation)'],
  [/^(ntoskrnl|hal)/i, 'noyau de Windows (cause réelle souvent matérielle : RAM, CPU, ou un autre pilote)'],
  [/^(storport|stornvme|storahci|iastor|nvme|disk|classpnp|volmgr|ntfs|fltmgr)/i, 'stockage / système de fichiers (SSD, contrôleur ou filtre antivirus)'],
  [/^(tcpip|ndis|netio|afd|netwtw|netwbw|rt\d|e1[dcr]|rtwlan|athw|bcmwl)/i, 'réseau (pilote de carte réseau ou WiFi)'],
  [/^(usbxhci|usbport|usbhub|ucx01000|hidusb|hidclass)/i, 'USB (contrôleur ou périphérique USB)'],
  [/^(wdfilter|wdnisdrv|mpkslh)/i, 'Microsoft Defender'], [/^(klif|kl\w+)/i, 'antivirus Kaspersky'], [/^(asw|aswsp|aswsnx)/i, 'antivirus Avast / AVG'],
  [/^(bd\w+|gzflt|trufos)/i, 'antivirus Bitdefender'], [/^(eset|ehdrv|epfw)/i, 'antivirus ESET'], [/^(symefa|srtsp|bhdrvx|eeCtrl)/i, 'antivirus Norton'],
  [/^(portcls|ks|hdaudbus|rtkvhd|realtek)/i, 'audio'], [/^(cng|ksecdd)/i, 'sécurité / chiffrement de Windows'],
];
const driverInfo = (n) => { const x = DRIVERS.find(([re]) => re.test(String(n || ''))); return x ? `Pilote en cause : ${x[1]}.` : ''; };

function analyze({ events, disks, pci, boots }, { days } = {}) {
  const ctx = { disks: disks || {}, pci: pci || {} };
  const now = Date.now();
  const groups = new Map();
  const perDay = {};
  const totals = { critical: 0, error: 0, warning: 0 };
  for (const e of events) {
    const day = e.t.slice(0, 10);
    perDay[day] = perDay[day] || { c: 0, e: 0, w: 0 };
    if (e.lvl === 1) { perDay[day].c++; totals.critical++; } else if (e.lvl === 2) { perDay[day].e++; totals.error++; } else { perDay[day].w++; totals.warning++; }
    const rule = RULES.find(r => { try { return r.match(e); } catch { return false; } });
    const sub = rule?.key ? val(rule.key, e, ctx) : '';
    const k = rule ? `${rule.id}|${sub}` : `?|${e.p}|${e.id}`;
    let g = groups.get(k);
    if (!g) {
      g = rule
        ? { key: k, rule: rule.id, known: rule.id !== 'noise', sev: val(rule.sev, e, ctx), cat: rule.cat, title: val(rule.title, e, ctx), cause: val(rule.cause, e, ctx), action: val(rule.action, e, ctx), tool: rule.tool || null }
        : { key: k, rule: null, known: false, sev: e.lvl <= 2 ? 'unknown' : 'ignore', cat: 'Autres', title: line1(e.m) && !/^[\d\s|.-]*$/.test(line1(e.m)) ? `${e.p} : ${clip(line1(e.m), 110)}` : `${e.p} — événement ${e.id}`, cause: '', action: '', tool: null };
      Object.assign(g, { provider: e.p, id: e.id, log: e.log, count: 0, first: e.t, last: e.t, lvl: e.lvl, samples: [], details: [], recent: 0, dayset: new Set() });
      groups.set(k, g);
    }
    e.g = g;
    g.count++;
    g.dayset.add(e.t.slice(0, 10));
    if (now - Date.parse(e.t) < 7 * 864e5) g.recent++;
    if (rule?.detail && g.details.length < 6) {
      for (const x of [].concat(val(rule.detail, e, ctx) || [])) if (x && !g.details.includes(x) && g.details.length < 6) g.details.push(x);
    }
    if (e.t < g.first) g.first = e.t;
    if (e.t > g.last) g.last = e.t;
    g.lvl = Math.min(g.lvl, e.lvl);
    if (g.samples.length < 5) g.samples.push({ t: e.t, m: e.m, lvl: e.lvl });
  }
  // Contexte : ce qui s'est produit dans les 15 minutes avant un écran bleu ou un arrêt brutal.
  const sorted = events.filter(e => e.g).sort((a, b) => (a.t < b.t ? -1 : 1));
  const CRASH = new Set(['bsod', 'kp41', 'unexp']);
  for (const g of groups.values()) {
    g.days = g.dayset.size; delete g.dayset;
    g.trend = g.count === 1 ? 'Une seule fois' : `${g.count} fois sur ${g.days} jour(s)${g.recent ? `, dont ${g.recent} ces 7 derniers jours` : ', aucune ces 7 derniers jours'}`;
    if (!CRASH.has(g.rule)) continue;
    // L'événement est écrit au redémarrage : on regarde avant ce démarrage.
    const tl = Date.parse(g.last);
    const boot = (boots || []).map(Date.parse).filter(b => b <= tl + 1000 && tl - b < 3600000).sort((a, b) => b - a)[0];
    const t1 = boot || tl, t0 = t1 - 15 * 60000;
    if (g.rule === 'bsod' || (g.rule === 'kp41' && g.key.endsWith('|bsod'))) {
      const drv = sorted.find(e => e.g.rule === 'bsoddrv' && Math.abs(Date.parse(e.t) - tl) < 30 * 60000);
      if (drv && drv.d?.[0]) { g.details.unshift(`Pilote désigné par Windows : ${drv.d[0]}${driverInfo(drv.d[0]) ? ` (${driverInfo(drv.d[0]).replace(/^Pilote en cause : |\.$/g, '')})` : ''}`); g.driver = drv.d[0]; }
    }
    const before = [];
    for (const e of sorted) {
      const t = Date.parse(e.t);
      if (t < t0) continue;
      if (t >= t1) break;
      if (CRASH.has(e.g.rule) || e.g.sev === 'ignore' || before.includes(e.g.title)) continue;
      before.push(e.g.title);
    }
    g.before = before.slice(-5);
  }
  for (const e of events) delete e.g;
  const list = [...groups.values()].sort((a, b) => (SEV_RANK[a.sev] - SEV_RANK[b.sev]) || (b.count - a.count));
  // Un même plantage produit plusieurs événements (écran bleu 1001, Kernel-Power 41, EventLog 6008) : on n'en garde qu'un.
  const hasBsod = list.some(g => g.rule === 'bsod'), hasKp = list.some(g => g.rule === 'kp41');
  const dup = (g) => (g.rule === 'kp41' && g.key.endsWith('|bsod') && hasBsod) || (g.rule === 'unexp' && (hasKp || hasBsod));
  const problems = list.filter(g => g.known && ['error', 'warn'].includes(g.sev) && !dup(g));
  const summary = !events.length ? 'Aucun événement d\'erreur ou d\'avertissement sur la période.'
    : problems.some(p => p.sev === 'error') ? `${problems.filter(p => p.sev === 'error').length} problème(s) important(s) identifié(s).`
      : problems.length ? `${problems.length} point(s) à surveiller, aucun problème grave identifié.` : 'Aucun problème connu identifié : les événements relevés sont sans gravité ou non reconnus.';
  return { days, total: events.length, totals, perDay, groups: list, problems, summary };
}

module.exports = { fetchEvents, analyze, LOGS };

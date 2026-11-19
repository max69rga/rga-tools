// Catalogue des logiciels et outils — repris du logiciel RGA Tools d'origine.

const PROGRAMS = [
  { id: 'winrar', name: 'WinRAR', group: 'essentiels', desc: 'Archiveur RAR / ZIP / 7z',
    x64: 'https://www.rarlab.com/rar/winrar-x64-701.exe', x86: 'https://www.rarlab.com/rar/wrar701.exe', args: '/S' },
  { id: 'vlc', name: 'VLC', group: 'essentiels', desc: 'Lecteur multimédia universel',
    x64: 'https://download.videolan.org/pub/videolan/vlc/last/win64/vlc-3.0.23-win64.exe',
    x86: 'https://download.videolan.org/pub/videolan/vlc/last/win32/vlc-3.0.23-win32.exe', args: '/S' },
  { id: 'onlyoffice', name: 'OnlyOffice', group: 'essentiels', desc: 'Suite bureautique gratuite',
    x64: 'https://github.com/ONLYOFFICE/DesktopEditors/releases/download/v9.3.1/DesktopEditors_x64.exe',
    x86: 'https://github.com/ONLYOFFICE/DesktopEditors/releases/download/v9.3.1/DesktopEditors_x86.exe', args: '/SILENT /NORESTART' },
  { id: 'chrome', name: 'Google Chrome', group: 'essentiels', desc: 'Navigateur (MSI entreprise)',
    x64: 'https://dl.google.com/dl/chrome/install/googlechromestandaloneenterprise64.msi',
    x86: 'https://dl.google.com/dl/chrome/install/googlechromestandaloneenterprise.msi', args: '/qn /norestart ALLUSERS=1', msi: true },
  { id: 'anydesk', name: 'AnyDesk', group: 'essentiels', desc: 'Prise en main à distance',
    x64: 'https://download.anydesk.com/AnyDesk.exe', x86: 'https://download.anydesk.com/AnyDesk.exe',
    args: '--install "C:\\Program Files (x86)\\AnyDesk" --start-with-win --create-shortcuts --create-desktop-icon --silent' },
  { id: 'reader', name: 'Adobe Reader DC', group: 'essentiels', desc: 'Lecteur PDF (FR)',
    x64: 'https://ardownload3.adobe.com/pub/adobe/acrobat/win/AcrobatDC/2500121288/AcroRdrDCx642500121288_fr_FR.exe',
    x86: 'https://ardownload3.adobe.com/pub/adobe/acrobat/win/AcrobatDC/2500121288/AcroRdrDC2500121288_fr_FR.exe',
    args: '/sAll /rs /msi EULA_ACCEPT=YES', uninstallGuid: '{AC76BA86-7AD7-1033-7B44-AC0F074E4100}' },
  { id: 'firefox', name: 'Mozilla Firefox', group: 'option', desc: 'Navigateur open source (FR)',
    x64: 'https://download.mozilla.org/?product=firefox-latest-ssl&os=win64&lang=fr',
    x86: 'https://download.mozilla.org/?product=firefox-latest-ssl&os=win&lang=fr', args: '-ms' },
  { id: 'thunderbird', name: 'Thunderbird', group: 'option', desc: 'Client de messagerie (FR)',
    x64: 'https://download.mozilla.org/?product=thunderbird-latest-ssl&os=win64&lang=fr',
    x86: 'https://download.mozilla.org/?product=thunderbird-latest-ssl&os=win&lang=fr', args: '-ms' },
  { id: 'openshell', name: 'Open Shell', group: 'option', desc: 'Menu Démarrer classique',
    x64: 'https://github.com/Open-Shell/Open-Shell-Menu/releases/download/v4.4.191/OpenShellSetup_4_4_191.exe',
    x86: 'https://github.com/Open-Shell/Open-Shell-Menu/releases/download/v4.4.191/OpenShellSetup_4_4_191.exe', args: '/quiet /norestart' },
];

const OFFICE = [
  { id: 'o2024', name: 'Office 2024', product: 'ProPlus2024Volume', channel: 'PerpetualVL2024', note: 'Professional Plus LTSC — Volume' },
  { id: 'o2021', name: 'Office 2021', product: 'ProPlus2021Volume', channel: 'PerpetualVL2021', note: 'Professional Plus LTSC — Volume' },
  { id: 'o2019', name: 'Office 2019', product: 'ProPlus2019Volume', channel: 'PerpetualVL2019', note: 'Professional Plus — Volume' },
  { id: 'o2016', name: 'Office 2016', product: 'ProPlusRetail', channel: 'Current', note: 'ProPlusRetail via ODT' },
  { id: 'o2013', name: 'Office 2013', product: 'ProPlusRetail', channel: 'Current', note: 'ProPlusRetail via ODT' },
];

const ODT_URL = 'https://download.microsoft.com/download/2/7/A/27AF1BE6-DD20-4CB4-B154-EBAB8A7D4A7E/officedeploymenttool_18227-20162.exe';
const OFFSCRUB_URL = 'https://aka.ms/SaraSetup';

const EXTENSIONS = [
  { id: 'chrome', name: 'Google Chrome', exe: 'chrome.exe', url: 'https://chromewebstore.google.com/detail/adblock-plus-free-ad-bloc/cfhdojbkjhnklbpkdaibdccddilifddb' },
  { id: 'edge', name: 'Microsoft Edge', exe: 'msedge.exe', url: 'https://microsoftedge.microsoft.com/addons/detail/adblock-plus-free-ad-bl/gmgoamodcdcjnbaobigkjelfplakmdhh' },
  { id: 'firefox', name: 'Mozilla Firefox', exe: 'firefox.exe', url: 'https://addons.mozilla.org/fr/firefox/addon/adblock-plus/' },
];

const CLEANERS = [
  { id: 'adw', name: 'AdwCleaner', desc: 'Supprime adwares, barres d\'outils, PUP et hijackers. Portable, sans installation.',
    kind: 'download', url: 'https://downloads.malwarebytes.com/file/adwcleaner', file: 'AdwCleaner.exe' },
  { id: 'mbam', name: 'Malwarebytes', desc: 'Détecte et supprime malwares, ransomwares et spywares. Version gratuite.',
    kind: 'download', url: 'https://downloads.malwarebytes.com/file/mb5_installer', file: 'MBSetup.exe' },
  { id: 'eset', name: 'ESET Online Scanner', desc: 'Analyse approfondie sans installation permanente. Connexion Internet requise.',
    kind: 'download', url: 'https://download.eset.com/com/eset/tools/online_scanner/latest/esetonlinescanner.exe', file: 'esetonlinescanner.exe' },
  { id: 'defender', name: 'Windows Defender Offline', desc: 'Analyse hors-ligne au redémarrage. Détecte rootkits et menaces profondes.',
    kind: 'defender', action: 'Planifier et redémarrer' },
];

const DIAG_TOOLS = [
  { id: 'occt', name: 'OCCT', desc: 'Test de stabilité CPU, GPU, RAM et alimentation sous charge.',
    kind: 'download', url: 'https://www.ocbase.com/download/edition:Personal', file: 'OCCT-Personal.exe' },
  { id: 'hwinfo', name: 'HWiNFO', desc: 'Monitoring temps réel — températures, tensions, fréquences.',
    kind: 'url', url: 'https://www.hwinfo.com/download/' },
  { id: 'cinebench', name: 'Cinebench R23', desc: 'Benchmark CPU mono et multi-cœurs par Maxon.',
    kind: 'zip', url: 'https://installer.maxon.net/cinebench/CinebenchR23.zip', file: 'CinebenchR23.zip', launch: 'Cinebench.exe' },
  { id: 'memtest', name: 'Diagnostic mémoire Windows', desc: 'Outil intégré : teste la RAM au prochain redémarrage.',
    kind: 'memtest' },
  { id: 'crystaldisk', name: 'CrystalDiskInfo', desc: 'Santé des disques HDD/SSD via S.M.A.R.T.',
    kind: 'url', url: 'https://crystalmark.info/en/software/crystaldiskinfo/' },
  { id: 'furmark', name: 'FurMark 2', desc: 'Stress-test GPU : détecte instabilité, surchauffe et artefacts.',
    kind: 'url', url: 'https://geeks3d.com/furmark/' },
  { id: 'coretemp', name: 'Core Temp', desc: 'Température de chaque cœur du processeur en temps réel.',
    kind: 'url', url: 'https://www.alcpu.com/CoreTemp/' },
];

const NET_FIXES = [
  { id: 'flush_dns', cmd: 'ipconfig /flushdns', desc: 'Vide le cache DNS' },
  { id: 'reset_proxy', cmd: 'netsh winhttp reset proxy', desc: 'Réinitialise le proxy WinHTTP' },
  { id: 'reset_tracing', cmd: 'netsh winhttp reset tracing', desc: 'Réinitialise le traçage WinHTTP' },
  { id: 'reset_winsock', cmd: 'netsh winsock reset catalog', desc: 'Réinitialise le catalogue Winsock', reboot: true },
  { id: 'reset_ipv4', cmd: 'netsh int ipv4 reset catalog', desc: 'Réinitialise la pile IPv4', reboot: true },
  { id: 'reset_ipv6', cmd: 'netsh int ipv6 reset catalog', desc: 'Réinitialise la pile IPv6', reboot: true },
  { id: 'release', cmd: 'ipconfig /release', desc: 'Libère l\'adresse IP' },
  { id: 'renew', cmd: 'ipconfig /renew', desc: 'Renouvelle l\'adresse IP' },
];

module.exports = { PROGRAMS, OFFICE, ODT_URL, OFFSCRUB_URL, EXTENSIONS, CLEANERS, DIAG_TOOLS, NET_FIXES };

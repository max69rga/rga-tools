<p align="center">
  <img src="src/renderer/assets/logo-rga.png" alt="RGA Informatique" width="320" />
</p>

<h1 align="center">RGA Tools</h1>

<p align="center">
  Boîte à outils technicien Windows de <b>RGA Informatique</b> : diagnostic matériel, monitoring, installation de logiciels et d'Office, nettoyage, réparation réseau et système.
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-3.3.0-c31a24" />
  <img alt="Plateforme" src="https://img.shields.io/badge/plateforme-Windows%2010%20%2F%2011-555" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-33-47848f" />
  <a href="https://github.com/max69rga/rga-tools/actions/workflows/release.yml"><img alt="Build" src="https://github.com/max69rga/rga-tools/actions/workflows/release.yml/badge.svg" /></a>
</p>

---

## Fonctionnalités

| Domaine | Contenu |
|---|---|
| **Diagnostic PC** | 4 profils (export config, rapide, long, extrême) : stress CPU / GPU / RAM, débit disques, analyse des journaux, note sur 100, rapport HTML local |
| **Monitoring** | CPU, fréquence, RAM, GPU, disques, réseau, température en temps réel |
| **Configuration PC** | Inventaire matériel et logiciel + santé du système sur 30 jours |
| **Journaux Windows** | Lecture des journaux Système / Application / Defender, problèmes connus expliqués (écrans bleus décodés, disques, pilotes, mises à jour, réseau…) avec la marche à suivre, export CSV |
| **Outils de test** | OCCT, HWiNFO, Cinebench, diagnostic mémoire Windows, CrystalDiskInfo, FurMark, Core Temp |
| **Logiciels** | Installation silencieuse depuis les sites officiels (x64 / x86) |
| **Microsoft Office** | 2013 → 2024 Professional Plus via Office Deployment Tool, désinstallation propre |
| **Extensions** | Adblock Plus pour Chrome, Edge, Firefox |
| **Nettoyage** | AdwCleaner, Malwarebytes, ESET Online Scanner, Defender Offline |
| **Réseau & comptes** | Test de connectivité, réparation (DNS, Winsock, IP…), profils WiFi, identifiants Outlook |
| **Optimisation** | Point de restauration, fichiers temporaires, SFC, DISM, WinUtil |
| **Licences** | Statut et activation par clé produit (`slmgr`, `OSPP`) |

Toutes les analyses sont réalisées **localement** : aucune donnée n'est transmise.

## Installation

Télécharger la dernière version sur la page **[Releases](https://github.com/max69rga/rga-tools/releases/latest)** :

- `RGA-Tools-x.y.z-portable.exe` — exécutable unique, sans installation (idéal sur clé USB) ;
- `RGA-Tools-x.y.z-setup.exe` — installeur (raccourcis menu Démarrer / Bureau, désinstalleur).

Les deux demandent les droits administrateur au lancement (nécessaires pour les installations, les tests disque, SFC/DISM, etc.).

> Les exécutables ne sont pas signés : Windows SmartScreen peut afficher un avertissement au premier lancement (« Informations complémentaires » → « Exécuter quand même »).

## Rapports de diagnostic

Chaque diagnostic produit, dans `Bureau\Diagnostics RGA` :

- `<PC>_<profil>_<date>.html` — rapport autonome à ouvrir dans un navigateur, imprimable ;
- `<PC>_<profil>_<date>.json` — données brutes.

## Développement

Prérequis : [Node.js](https://nodejs.org/) 20+ et Windows.

```bash
npm install          # dépendances
npm start            # lancer l'application en mode développement
npm run icons        # régénérer l'icône et les variantes du logo depuis src/renderer/assets/logo-rga.png
npm run dist         # construire les .exe (portable + installeur) dans dist/
```

### Structure

```
src/
├─ main.js              Processus principal : fenêtre, IPC, actions système
├─ preload.js           Pont sécurisé renderer ↔ main (contextIsolation)
├─ lib/
│  ├─ catalog.js        Logiciels, versions Office, outils, commandes réseau
│  ├─ util.js           Commandes cmd / PowerShell, téléchargements
│  ├─ sysinfo.js        Inventaire matériel et contrôles de santé (CIM / WMI)
│  ├─ monitor.js        Capteurs temps réel (compteurs de performance)
│  ├─ events.js         Journaux d'événements Windows + base de diagnostic
│  ├─ updater.js        Mises à jour via les releases GitHub
│  ├─ diag.js           Moteur de diagnostic : profils, tests, analyse, note
│  ├─ stress-worker.js  Thread de charge CPU / test mémoire
│  └─ report.js         Rapport HTML
├─ gpu/                 Fenêtre du test 3D (WebGL2)
└─ renderer/            Interface (HTML / CSS / JS) et logos
```

### Mises à jour automatiques

Au démarrage, RGA Tools interroge la dernière release du dépôt public indiqué par `updateRepo` dans `package.json`. Si une version plus récente existe, elle est proposée (barre de titre et **Paramètres → Mises à jour**) :

- **version installée** : téléchargement de `RGA-Tools-x.y.z-setup.exe`, installation silencieuse, relance automatique ;
- **version portable** : téléchargement de `RGA-Tools-x.y.z-portable.exe`, remplacement de l'exe après fermeture, relance.

Le téléchargement est contrôlé (taille et empreinte SHA-256 fournies par GitHub).

### Publier une version

Les exe sont compilés par **GitHub Actions** ([`.github/workflows/release.yml`](.github/workflows/release.yml)) : aucun outil n'est nécessaire en local à part Git.

1. Mettre à jour `version` dans `package.json` et ajouter une entrée `## [x.y.z]` dans `CHANGELOG.md`.
2. Commit, puis `npm run release` (ou `git tag vX.Y.Z && git push origin vX.Y.Z`).
3. GitHub Actions compile le portable et l'installeur, puis publie la release avec les notes du CHANGELOG. Les postes la reçoivent au démarrage suivant.

Pour tester un build sans rien publier : onglet **Actions → Build & Release → Run workflow** ; les exe sont téléchargeables dans les artefacts de l'exécution.

## Notes

- Les températures ne sont disponibles que si le PC expose ses sondes à Windows (zones thermiques ACPI, fréquent sur portables). Sinon, utiliser HWiNFO depuis **Outils de test**.
- Le score GPU provient d'un test WebGL maison : il sert à comparer un même PC dans le temps (détection de bridage thermique), pas à se comparer à d'autres benchmarks.

---

© RGA Informatique.

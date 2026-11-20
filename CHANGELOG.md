# Historique des versions

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions selon [SemVer](https://semver.org/lang/fr/).

## [3.4.1] — 2026-11-20

### Modifié
- Plus aucune commande PowerShell encodée (`-EncodedCommand`) : les scripts sont écrits en clair dans `%TEMP%\RGATools\ps` (nommés selon leur rôle : `capteurs`, `inventaire`, `sante`, `journaux`…) puis exécutés avec `-File` et la stratégie `RemoteSigned` au lieu de `Bypass`. Réduit les faux positifs des antivirus (quarantaine Norton signalée).
- Informations d'éditeur complétées dans les exe (RGA Informatique).

## [3.4.0] — 2026-11-20

### Ajouté
- **Températures intégrées** grâce à [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor) (v0.9.6, MPL-2.0), embarqué dans l'application : processeur (Tctl/Tdie, package), carte graphique (cœur, point chaud), SSD, consommation CPU / GPU, VRM quand la carte mère les nomme. Aucun logiciel tiers à installer ou à lancer.
  - Température GPU NVIDIA aussi lue via le pilote (`nvidia-smi`) en secours.
  - Température processeur : droits administrateur + pilote **PawnIO** (signé, open source). Statut et installation en un clic dans **Paramètres**.
- **Overlay** toujours au premier plan (en haut à droite) pendant les tests de charge : températures CPU / GPU, point chaud, consommation, charge CPU / GPU / RAM, progression du test. Activable aussi depuis **Monitoring** ; désactivable dans **Paramètres**.
- Monitoring : cartes Température CPU et Température GPU.

### Modifié
- Diagnostic PC et rapport : températures CPU et GPU séparées (max, point chaud, puissances, courbes), seuils propres à chaque composant, garde-fou de température sur le plus chaud des deux.

## [3.3.0] — 2026-11-19

### Ajouté
- **Journaux Windows** : nouvelle page qui lit les journaux Système, Application et Microsoft Defender (24 h à 90 jours, filtres par niveau) et explique les problèmes reconnus avec la cause probable et la marche à suivre.
  - Écrans bleus avec décodage des codes d'arrêt (0x124, 0x133, 0x116, 0x1A…), arrêts inattendus, erreurs matérielles WHEA.
  - Disques (secteurs défectueux, pagination, contrôleur, NTFS, réinitialisations SSD) avec le nom du disque concerné.
  - Pilote graphique (TDR), bridage du processeur, mémoire épuisée, services en échec, plantages d'applications (module fautif), .NET.
  - Windows Update (code d'erreur), réseau (conflit IP, DHCP, DNS, carte réseau), menaces Defender, VSS, BitLocker…
  - Événements bénins connus (DCOM 10016, Perflib…) masqués ; recherche en ligne pour les événements non reconnus.
  - Graphique par jour, filtre texte, boutons d'action (vérification du disque, SFC, DISM, Gestionnaire de périphériques, fichiers de vidage…), export CSV.
- Le **Diagnostic PC** et son rapport intègrent l'analyse des journaux des 30 derniers jours.

## [3.2.0] — 2026-11-19

### Modifié
- Le dépôt est désormais **public** : [max69rga/rga-tools](https://github.com/max69rga/rga-tools). Les mises à jour ne nécessitent plus de jeton.
- Les releases sont compilées et publiées automatiquement par **GitHub Actions** à chaque tag `vX.Y.Z` (plus besoin de compiler en local).
- `npm run release` vérifie la version et le CHANGELOG puis pousse le tag.

### Supprimé
- Jeton GitHub intégré au build (`.update-token`, `scripts/embed-token.js`).

## [3.1.0] — 2026-11-19

### Ajouté
- **Mises à jour automatiques via GitHub** : vérification au démarrage (désactivable dans Paramètres), badge dans la barre de titre, notes de version, téléchargement avec contrôle de taille et d'empreinte SHA-256.
  - Version installée : le nouvel installeur s'exécute en silencieux puis relance RGA Tools.
  - Version portable : l'exe est remplacé automatiquement après fermeture, puis relancé.
- Jeton GitHub en lecture seule intégré au build (`.update-token`, jamais versionné) pour lire les releases du dépôt privé.
- Script `npm run release` : tag, push et publication de la release avec les deux exe et les notes du CHANGELOG.

## [3.0.0] — 2026-11-19

Fusion de RGA Tools avec un module de diagnostic matériel inspiré de UserDiag, et nouvelle identité visuelle RGA Informatique.

### Ajouté
- **Diagnostic PC** : 4 profils (export configuration, rapide ~3 min, long ~19 min, extrême ~17 min).
  - Tests de charge CPU 1 cœur / multi-cœurs (threads de calcul), GPU 3D (WebGL2 à charge adaptative), combiné CPU + GPU, extrême CPU + GPU + RAM avec vérification d'intégrité mémoire.
  - Débit des stockages (winsat, droits administrateur requis).
  - Analyse des journaux (WHEA, écrans bleus, arrêts inattendus, erreurs disque), pilotes en erreur, SMART, batterie, antivirus, mises à jour, profil XMP, simple canal…
  - Note globale sur 100, arrêt de sécurité sur limite de température.
  - Rapport HTML autonome + JSON enregistrés dans `Bureau\Diagnostics RGA`. Aucune donnée envoyée sur Internet.
- **Monitoring** temps réel : CPU, fréquence, RAM, GPU, disques, réseau, température (si exposée par l'ACPI).
- **Configuration PC** : inventaire complet (système, carte mère, CPU, RAM, GPU, disques, volumes, réseau, batterie, santé).
- **Réseau** : test de connectivité (passerelle, Internet, DNS).
- **Optimisation** : point de restauration, nettoyage des fichiers temporaires, SFC, DISM.
- **Paramètres** : thème clair / sombre, limite de température, désactivation du test 3D.

### Modifié
- Nouveau design aux couleurs RGA Informatique, logo officiel, icône d'application.
- Navigation réorganisée (Diagnostic / Installation / Maintenance).
- Les exécutables portable et installeur exigent les droits administrateur dès le lancement.
- Code découpé en modules (`src/lib`).

## [2.0.0] — 2026-11-16

Réécriture complète sous Electron du logiciel Python/Tkinter d'origine.

### Ajouté
- Installation silencieuse des logiciels (WinRAR, VLC, OnlyOffice, Chrome, AnyDesk, Adobe Reader, Firefox, Thunderbird, Open Shell).
- Déploiement Office 2013 → 2024 via Office Deployment Tool (architecture, langue, clé produit facultative) et outil de désinstallation Microsoft.
- Extensions Adblock Plus, outils de nettoyage (AdwCleaner, Malwarebytes, ESET, Defender Offline).
- Réparation réseau, profils WiFi (affichage, export, import), identifiants Outlook.
- Outils de diagnostic tiers, WinUtil.
- Page **Licences** basée sur `slmgr` / `OSPP` (remplace l'activation MAS de l'ancienne version, retirée).
- Journal, barres de progression, version portable et installeur NSIS.

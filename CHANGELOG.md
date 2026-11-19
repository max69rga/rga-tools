# Historique des versions

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions selon [SemVer](https://semver.org/lang/fr/).

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

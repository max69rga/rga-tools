// Affiche les notes de release de la version courante (extraites de CHANGELOG.md).
// Utilisé par GitHub Actions : node scripts/release-notes.js > notes.md
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const v = require('../package.json').version;
const log = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').replace(/\r/g, '');
const m = log.match(new RegExp(`## \\[${v.replace(/\./g, '\\.')}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[|$)`));
if (!m) { console.error(`Pas d'entrée ${v} dans CHANGELOG.md`); process.exit(1); }

process.stdout.write(`${m[1].trim()}

---
**Téléchargements**
- \`RGA-Tools-${v}-portable.exe\` : exécutable unique, sans installation
- \`RGA-Tools-${v}-setup.exe\` : installeur

Les versions déjà installées proposent automatiquement cette mise à jour au démarrage.
`);

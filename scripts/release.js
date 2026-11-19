// Publie la version courante : tag Git + release GitHub avec les deux exe.
// Prérequis : `npm run dist` déjà fait, version et CHANGELOG à jour, travail commité.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = require('../package.json');
const v = pkg.version, tag = `v${v}`;
const GH = fs.existsSync('C:\\Program Files\\GitHub CLI\\gh.exe') ? 'C:\\Program Files\\GitHub CLI\\gh.exe' : 'gh';
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...opts }).trim();

const files = [`RGA-Tools-${v}-portable.exe`, `RGA-Tools-${v}-setup.exe`].map(f => path.join(root, 'dist', f));
for (const f of files) if (!fs.existsSync(f)) { console.error(`Manquant : ${f} — lancez d'abord npm run dist`); process.exit(1); }

if (sh('git', ['status', '--porcelain'])) { console.error('Des modifications ne sont pas commitées.'); process.exit(1); }

const log = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
const m = log.match(new RegExp(`## \\[${v.replace(/\./g, '\\.')}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[|$)`));
if (!m) { console.error(`Pas d'entrée ${v} dans CHANGELOG.md`); process.exit(1); }
const notes = `${m[1].trim()}\n\n---\n**Téléchargements**\n- \`RGA-Tools-${v}-portable.exe\` : exécutable unique, sans installation\n- \`RGA-Tools-${v}-setup.exe\` : installeur\n\nLes versions déjà installées proposent automatiquement cette mise à jour.\n`;
const notesFile = path.join(require('os').tmpdir(), `rga-notes-${v}.md`);
fs.writeFileSync(notesFile, notes, 'utf8');

const tags = sh('git', ['tag', '--list', tag]);
if (!tags) { sh('git', ['tag', '-a', tag, '-m', `RGA Tools ${v}`]); console.log(`Tag ${tag} créé.`); }
sh('git', ['push', 'origin', 'HEAD', tag]);
console.log('Code et tag poussés.');
sh(GH, ['release', 'create', tag, ...files, '--repo', pkg.updateRepo, '--title', `RGA Tools ${v}`, '--notes-file', notesFile, '--latest'], { stdio: 'inherit' });
fs.rmSync(notesFile, { force: true });
console.log(`Release ${tag} publiée sur ${pkg.updateRepo}.`);

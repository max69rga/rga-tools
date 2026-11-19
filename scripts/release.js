// Lance la publication de la version courante : vérifications, tag vX.Y.Z, push.
// La compilation et la release GitHub sont ensuite faites par GitHub Actions (.github/workflows/release.yml).
const { execFileSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = require('../package.json');
const tag = `v${pkg.version}`;
const sh = (cmd, args) => (execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }) || '').trim();

// Notes présentes dans le CHANGELOG ?
execFileSync(process.execPath, [path.join(__dirname, 'release-notes.js')], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });

if (sh('git', ['status', '--porcelain'])) { console.error('Des modifications ne sont pas commitées.'); process.exit(1); }
if (sh('git', ['tag', '--list', tag])) { console.error(`Le tag ${tag} existe déjà : augmentez la version dans package.json.`); process.exit(1); }

sh('git', ['tag', '-a', tag, '-m', `RGA Tools ${pkg.version}`]);
sh('git', ['push', 'origin', 'HEAD', tag]);
console.log(`Tag ${tag} poussé. GitHub Actions compile et publie la release :`);
console.log(`https://github.com/${pkg.updateRepo}/actions`);

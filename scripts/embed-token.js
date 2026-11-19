// Intègre le jeton de mise à jour dans le build (src/lib/update-token.json, ignoré par Git).
// Source : variable RGA_UPDATE_TOKEN, sinon le fichier .update-token à la racine du projet.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let t = process.env.RGA_UPDATE_TOKEN || '';
const f = path.join(root, '.update-token');
if (!t && fs.existsSync(f)) t = fs.readFileSync(f, 'utf8').trim();
const out = path.join(root, 'src', 'lib', 'update-token.json');
const enc = t ? Buffer.from(t.split('').reverse().join(''), 'utf8').toString('base64') : '';
fs.writeFileSync(out, JSON.stringify({ t: enc }));
console.log(t ? 'Jeton de mise à jour intégré.' : 'ATTENTION : aucun jeton (.update-token) — les mises à jour ne fonctionneront pas avec un dépôt privé.');

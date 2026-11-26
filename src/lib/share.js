// Partage des rapports sur le réseau local : un petit serveur HTTP sert chaque rapport
// à une adresse non devinable (jeton dérivé d'un secret propre au PC), pour l'ouvrir
// sur un smartphone en scannant le QR code du rapport.
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dgram = require('dgram');
const { execFile } = require('child_process');
const { app } = require('electron');

const PORT = 47610;
const MARK = /<!--qr-->[\s\S]*?<!--\/qr-->/g;
let server = null, port = null, secret = null, routeIp = null;
const FW_RULE = 'RGA Tools - rapports sur smartphone';

const reportsDir = () => path.join(app.getPath('desktop'), 'Diagnostics RGA');

function getSecret() {
  if (secret) return secret;
  const f = path.join(app.getPath('userData'), 'share.key');
  try { secret = fs.readFileSync(f, 'utf8').trim(); } catch {}
  if (!/^[0-9a-f]{64}$/.test(secret || '')) { secret = crypto.randomBytes(32).toString('hex'); try { fs.writeFileSync(f, secret); } catch {} }
  return secret;
}
const token = (name) => crypto.createHmac('sha256', getSecret()).update(name).digest('hex').slice(0, 24);

const PRIV = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;

// IP locale utilisée par la route par défaut (celle que voit la box) : un « connect » UDP
// ne fait que choisir la route, aucun paquet n'est envoyé.
function defaultRouteIp() {
  return new Promise((resolve) => {
    const s = dgram.createSocket('udp4');
    const done = (ip) => { try { s.close(); } catch {} resolve(ip); };
    s.on('error', () => done(null));
    try { s.connect(53, '1.1.1.1', () => { let ip = null; try { ip = s.address().address; } catch {} done(PRIV.test(ip || '') ? ip : null); }); } catch { done(null); }
    setTimeout(() => done(null), 1500);
  });
}

// Autorise les connexions entrantes sur le port des rapports, depuis le réseau local seulement
// (réseaux privés et d'entreprise). Sans cette règle, le pare-feu Windows bloque le téléphone.
function ensureFirewall() {
  return new Promise((resolve) => {
    execFile('netsh', ['advfirewall', 'firewall', 'show', 'rule', `name=${FW_RULE}`], { windowsHide: true }, (err) => {
      if (!err) return resolve('present');
      execFile('netsh', ['advfirewall', 'firewall', 'add', 'rule', `name=${FW_RULE}`, 'dir=in', 'action=allow', 'protocol=TCP', `localport=${PORT}`, 'remoteip=localsubnet', 'profile=private,domain'], { windowsHide: true },
        (e) => resolve(e ? 'failed' : 'added'));
    });
  });
}

// Adresse IPv4 privée de la carte réseau réelle (Wi-Fi / Ethernet), hors adaptateurs virtuels.
function lanIp() {
  if (routeIp) return routeIp;
  const virt = /vethernet|virtualbox|vmware|hyper-v|wsl|docker|loopback|bluetooth|tailscale|zerotier|vpn|tap|tun/i;
  const c = [];
  for (const [name, list] of Object.entries(os.networkInterfaces()))
    for (const a of list || [])
      if (a.family === 'IPv4' && !a.internal && PRIV.test(a.address))
        c.push({ ip: a.address, score: (virt.test(name) ? 0 : 2) + (/wi-?fi|wlan|sans fil|ethernet/i.test(name) ? 1 : 0) + (a.address.startsWith('192.168.') ? 1 : 0) });
  c.sort((a, b) => b.score - a.score);
  return c[0]?.ip || null;
}

function handle(req, res) {
  const m = /^\/r\/([0-9a-f]{24})$/.exec(req.url || '');
  let file = null;
  if (req.method === 'GET' && m) {
    try { file = fs.readdirSync(reportsDir()).find(f => f.endsWith('.html') && token(f) === m[1]); } catch {}
  }
  if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Rapport introuvable.'); }
  const html = fs.readFileSync(path.join(reportsDir(), file), 'utf8').replace(MARK, '');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'" });
  res.end(html);
}

let fwDone = null;
async function start() {
  routeIp = await defaultRouteIp();
  if (!fwDone) fwDone = ensureFirewall();
  await fwDone;
  if (server) return port;
  return new Promise((resolve) => {
    const s = http.createServer(handle);
    const listen = (p) => s.listen(p, '0.0.0.0');
    s.on('listening', () => { server = s; port = s.address().port; resolve(port); });
    s.on('error', (e) => { if (e.code === 'EADDRINUSE' && !s.listening && s._retried !== true) { s._retried = true; listen(0); } else resolve(null); });
    listen(PORT);
  });
}
function stop() { if (server) { server.close(); server = null; port = null; } }

// Adresse à mettre dans le QR code du rapport, ou null si le partage est impossible.
function urlFor(file) {
  const ip = lanIp();
  return server && ip ? `http://${ip}:${port}/r/${token(path.basename(file))}` : null;
}

const firewall = () => fwDone;
module.exports = { start, stop, urlFor, firewall, MARK, PORT };

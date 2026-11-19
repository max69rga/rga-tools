// Génère les variantes du logo RGA Informatique + l'icône de l'application. Lancer : npm run icons
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs'), path = require('path');
app.disableHardwareAcceleration();
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'renderer', 'assets', 'logo-rga.png');
const OUT_A = path.join(ROOT, 'src', 'renderer', 'assets');
const OUT_B = path.join(ROOT, 'build');

const job = (src) => `
(async () => {
  const img = new Image(); img.src = ${JSON.stringify(src)}; await img.decode();
  const W = img.width, H = img.height;
  const out = {};
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  { const c = cv(W, H), x = c.getContext('2d'); x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); out.white = c.toDataURL(); }
  const mH = 452;
  { const c = cv(W, mH), x = c.getContext('2d'); x.drawImage(img, 0, 0, W, mH, 0, 0, W, mH); out.mark = c.toDataURL();
    x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, W, mH); out.markWhite = c.toDataURL(); }
  const S = 512, c = cv(S, S), x = c.getContext('2d');
  const r = S * 0.22, m = S * 0.03;
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#e2343e'); g.addColorStop(1, '#a3121b');
  x.fillStyle = g; x.beginPath(); x.roundRect(m, m, S - 2 * m, S - 2 * m, r); x.fill();
  const sh = x.createLinearGradient(0, 0, 0, S); sh.addColorStop(0, 'rgba(255,255,255,.18)'); sh.addColorStop(.5, 'rgba(255,255,255,0)');
  x.fillStyle = sh; x.fill();
  const mw = new Image(); mw.src = out.markWhite; await mw.decode();
  const w = S * 0.78, h = w * mH / W; x.drawImage(mw, (S - w) / 2, (S - h) / 2 + S * 0.01, w, h);
  out.icon = c.toDataURL();
  return out;
})()`;

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await w.loadURL('data:text/html,<html><body></body></html>');
  const src = 'data:image/png;base64,' + fs.readFileSync(SRC).toString('base64');
  const r = await w.webContents.executeJavaScript(job(src));
  const save = (p, du) => fs.writeFileSync(p, Buffer.from(du.split(',')[1], 'base64'));
  save(path.join(OUT_A, 'logo-rga-white.png'), r.white);
  save(path.join(OUT_A, 'mark-rga.png'), r.mark);
  save(path.join(OUT_A, 'mark-rga-white.png'), r.markWhite);
  save(path.join(OUT_A, 'icon.png'), r.icon);
  const big = nativeImage.createFromDataURL(r.icon);
  const files = [];
  for (const s of [16, 24, 32, 48, 64, 128, 256]) {
    const f = path.join(OUT_B, `icon-${s}.png`);
    fs.writeFileSync(f, big.resize({ width: s, height: s, quality: 'best' }).toPNG()); files.push(f);
  }
  fs.copyFileSync(path.join(OUT_B, 'icon-256.png'), path.join(OUT_B, 'icon.png'));
  const pngToIco = (await import('png-to-ico')).default;
  fs.writeFileSync(path.join(OUT_B, 'icon.ico'), await pngToIco(files));
  console.log('assets ok');
  app.quit();
}).catch(e => { console.error(e); app.exit(1); });

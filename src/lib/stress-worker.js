// Thread de charge : calcul CPU (score) ou test d'intégrité mémoire (motifs écrits puis vérifiés).
const { parentPort, workerData } = require('worker_threads');

const { mode, mb = 256 } = workerData;
let stop = false;
parentPort.on('message', (m) => { if (m === 'stop') stop = true; });

function cpuLoop() {
  // Charge mixte flottant + entier, découpée en lots pour rester réactive.
  let ops = 0, acc = 0.5, h = 0x811c9dc5, last = Date.now();
  const tick = () => {
    for (let n = 0; n < 200000; n++) {
      acc = Math.sqrt(acc * 1.000001 + n) * Math.sin(acc) + Math.cos(n * 0.001);
      h = Math.imul(h ^ n, 16777619) >>> 0;
    }
    ops += 200000;
    const now = Date.now();
    if (now - last >= 500) { parentPort.postMessage({ ops, dt: now - last, chk: (acc + h) % 1 }); ops = 0; last = now; }
    if (!stop) setImmediate(tick); else parentPort.postMessage({ done: true });
  };
  tick();
}

function memLoop() {
  let buf;
  try { buf = new Uint32Array((mb * 1024 * 1024) / 4); } catch (e) { parentPort.postMessage({ error: 'alloc', mb }); return; }
  const patterns = [0x00000000, 0xFFFFFFFF, 0xAAAAAAAA, 0x55555555, 0x12345678];
  let pass = 0, errors = 0, bytes = 0, last = Date.now();
  const tick = () => {
    const p = patterns[pass % patterns.length] ^ (pass * 2654435761 >>> 0);
    for (let i = 0; i < buf.length; i++) buf[i] = (p ^ i) >>> 0;
    for (let i = 0; i < buf.length; i++) if (buf[i] !== ((p ^ i) >>> 0)) errors++;
    bytes += buf.length * 8; pass++;
    const now = Date.now();
    if (now - last >= 500) { parentPort.postMessage({ bytes, dt: now - last, errors, pass }); bytes = 0; last = now; }
    if (!stop) setImmediate(tick); else { buf = null; parentPort.postMessage({ done: true, errors }); }
  };
  tick();
}

mode === 'mem' ? memLoop() : cpuLoop();

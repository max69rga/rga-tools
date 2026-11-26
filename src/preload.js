const { contextBridge, ipcRenderer } = require('electron');

const invoke = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);
const on = (ch) => (cb) => { const h = (_e, d) => cb(d); ipcRenderer.on(ch, h); return () => ipcRenderer.removeListener(ch, h); };

contextBridge.exposeInMainWorld('rga', {
  win: { minimize: invoke('win:minimize'), maximize: invoke('win:maximize'), close: invoke('win:close'), onState: on('win:state') },
  sysInfo: invoke('sys:info'),
  catalog: invoke('catalog'),
  settings: { get: invoke('settings:get'), set: invoke('settings:set') },
  openUrl: invoke('open:url'),
  openPath: invoke('open:path'),
  openSettings: invoke('open:settings'),
  relaunchAdmin: invoke('relaunch:admin'),
  monitor: { start: invoke('monitor:start'), stop: invoke('monitor:stop'), onSample: on('monitor:sample') },
  config: invoke('config:get'),
  diag: { profiles: invoke('diag:profiles'), run: invoke('diag:run'), cancel: invoke('diag:cancel'), onStep: on('diag:step'), onTick: on('diag:tick') },
  reports: { list: invoke('report:list') },
  overlay: { toggle: invoke('overlay:toggle'), onState: on('overlay:state') },
  sensors: { status: invoke('sensors:status'), installPawnIO: invoke('sensors:installPawnIO'), dump: invoke('sensors:dump'), waitPawnIO: invoke('sensors:waitPawnIO') },
  events: { analyze: invoke('events:analyze'), tool: invoke('events:tool'), export: invoke('events:export') },
  update: { check: invoke('update:check'), download: invoke('update:download'), install: invoke('update:install'), info: invoke('update:info'), onAvailable: on('update:available'), onProgress: on('update:progress') },
  soft: { install: invoke('soft:install') },
  office: { install: invoke('office:install'), offscrub: invoke('office:offscrub') },
  browserOpen: invoke('browser:open'),
  toolRun: invoke('tool:run'),
  net: { fix: invoke('net:fix'), test: invoke('net:test') },
  wifi: { list: invoke('wifi:list'), export: invoke('wifi:export'), import: invoke('wifi:import') },
  creds: { list: invoke('creds:list'), manager: invoke('creds:manager') },
  winutil: invoke('winutil:run'),
  restorePoint: invoke('restore:create'),
  cleanTemp: invoke('clean:temp'),
  repair: invoke('repair:run'),
  lic: { status: invoke('lic:status'), windowsKey: invoke('lic:windowsKey'), officeKey: invoke('lic:officeKey') },
  onLog: on('log'), onProgress: on('progress'), onStatus: on('status'),
});

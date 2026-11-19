// Charge GPU : raymarching volumétrique lourd en WebGL2, mesure des FPS.
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
const report = (m) => window.gpuApi && window.gpuApi.report(m);

if (!gl) {
  report({ error: 'WebGL2 indisponible (pilote graphique manquant ou GPU non pris en charge)' });
} else {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  document.getElementById('info').textContent = renderer;

  const vs = `#version 300 es
  in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const fs = `#version 300 es
  precision highp float; uniform vec2 r; uniform float t; uniform int steps; out vec4 o;
  mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
  float map(vec3 p){
    p.xz *= rot(t*.3); p.xy *= rot(t*.2);
    float d = 1e9; vec3 q = p;
    for(int i=0;i<8;i++){ q = abs(q)-vec3(.6,.4,.5); q.xy *= rot(.7+t*.05); q.yz *= rot(.4); d = min(d, length(q)-.18); }
    return min(d, length(p)-.9 + .08*sin(10.*p.x+t)*sin(10.*p.y)*sin(10.*p.z));
  }
  void main(){
    vec2 uv = (gl_FragCoord.xy - .5*r)/r.y;
    vec3 ro = vec3(0,0,-3.2), rd = normalize(vec3(uv,1.3));
    float d=0., g=0.; vec3 col=vec3(0);
    for(int i=0;i<512;i++){ if(i>=steps) break; vec3 p=ro+rd*d; float h=map(p); g += .012/(.02+abs(h)); if(h<.001||d>12.) break; d += h*.6; }
    vec3 p = ro+rd*d; vec2 e=vec2(.001,0);
    vec3 n = normalize(vec3(map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx)));
    float l = max(dot(n, normalize(vec3(.6,.8,-.5))), 0.);
    col = d<12. ? mix(vec3(.75,.08,.12), vec3(1.,.85,.8), l) : vec3(0);
    col += g*.02*vec3(.9,.2,.25);
    o = vec4(pow(col, vec3(.8)), 1.);
  }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't'), uS = gl.getUniformLocation(prog, 'steps');

  // Charge adaptative : le nombre de passes par image augmente tant que le GPU suit
  // la synchro verticale. Score = passes plein écran rendues par seconde.
  let frames = 0, draws = 0, passes = 1, last = performance.now(), lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; report({ error: 'Contexte WebGL perdu (crash ou réinitialisation du pilote graphique)' }); });
  const t0 = performance.now();
  let refresh = 0;
  function frame(now) {
    if (lost) return;
    const w = 960, h = 540;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uR, w, h); gl.uniform1f(uT, (now - t0) / 1000); gl.uniform1i(uS, 96);
    for (let i = 0; i < passes; i++) gl.drawArrays(gl.TRIANGLES, 0, 3);
    frames++; draws += passes;
    if (now - last >= 1000) {
      const dt = now - last;
      const fps = Math.round((frames * 1000) / dt);
      const score = Math.round((draws * 1000) / dt);
      if (!refresh) refresh = fps;
      if (fps >= refresh * 0.9 && passes < 64) passes = Math.min(64, Math.ceil(passes * 1.5));
      else if (fps < refresh * 0.5 && passes > 1) passes--;
      document.getElementById('fps').textContent = fps;
      document.getElementById('info').textContent = `${renderer} · ${score} passes/s`;
      report({ fps, score, passes, renderer }); frames = 0; draws = 0; last = now;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

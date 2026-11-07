/**
 * Le disque d'or de l'accueil, en vraie 3D (WebGL 1 : présent sur presque tous les ordinateurs, même anciens ; aucun
 * Internet, aucune bibliothèque). Un vrai objet : deux faces (recto, verso), une tranche, une épaisseur ; du métal
 * qui renvoie la lumière (les reflets glissent quand il tourne et bascule), et un léger flou de rotation quand il tourne vite. Une seule image par trame, quelques milliers de triangles :
 * c'est la carte graphique qui travaille, la page reste fluide.
 *
 * Si WebGL manque, ou si les images ne se chargent pas, `creer` renvoie null : l'accueil garde son ancien dessin.
 */
import { fichier } from './res.ts';

export interface Pose3D {
  cx: number; cy: number;     // centre du disque à l'écran (px CSS)
  diam: number;               // diamètre à l'écran, vu de face (px CSS)
  spin: number;               // rotation propre (degrés ; + = sens antihoraire vu de face)
  flip: number;               // retournement autour de l'axe horizontal (degrés ; 90 = sur la tranche, 180 = verso)
  tilt: number;               // petit balancement autour de l'axe vertical (degrés)
  vit: number;                // (inutilisé : plus de flou)
  reflet?: number;            // 0 → 1 : le reflet fixe du grand disque apparaît (fin de l'accueil)
  D: number;                  // diamètre du grand disque de l'interface (px) : le disque est un objet de cette taille,
                              // vu par la même caméra que le grand disque (perspective 1150 px, origine 50 % 30 %)
}

const VS = `attribute vec3 aP; attribute vec3 aN; attribute vec2 aUV; attribute float aF;
uniform mat4 uM; uniform mat3 uR; uniform mat4 uProj; uniform float uSpin;
varying vec3 vN; varying vec3 vPos; varying vec2 vUV; varying float vF; varying vec2 vLoc;
void main() {
  vec4 w = uM * vec4(aP, 1.0);
  vPos = w.xyz; vN = uR * aN; vUV = aUV; vF = aF; float c = cos(uSpin), s = sin(uSpin); vLoc = vec2(c * aP.x - s * aP.y, s * aP.x + c * aP.y);   // (sans la rotation propre : le reflet fixe du grand disque)
  gl_Position = uProj * w;
}`;

// (ASCII seulement : WebGL refuse les accents, même dans les commentaires)
const FS = `precision mediump float;
uniform sampler2D uRecto; uniform sampler2D uVerso; uniform float uReflet;
varying vec3 vN; varying vec3 vPos; varying vec2 vUV; varying float vF; varying vec2 vLoc;
void main() {
  vec3 N = normalize(vN);
  if (dot(N, normalize(-vPos)) < 0.0) N = -N;
  float l = max(dot(N, normalize(vec3(-0.3, 0.5, 0.8))), 0.0);
  vec3 col;
  if (vF < 1.5) {                                         // une face : la photo du disque, simplement eclairee (ni reflet ni flou)
    col = (vF < 0.5 ? texture2D(uRecto, vUV).rgb : texture2D(uVerso, vUV).rgb) * (0.86 + 0.14 * l);
    if (uReflet > 0.0) {                                  // a la fin : le meme reflet fixe que le grand disque (app.css, .disc-sheen), pour un relais invisible
      float a = mod(degrees(atan(vLoc.x, -vLoc.y)) - 210.0 + 720.0, 360.0), cl = 0.0, nr = 0.0;
      if (a < 22.0) cl = 0.16 * a / 22.0; else if (a < 55.0) cl = 0.16 * (55.0 - a) / 33.0;
      else if (a < 120.0) nr = 0.12 * (a - 55.0) / 65.0; else if (a < 170.0) nr = 0.12 * (170.0 - a) / 50.0;
      else if (a < 205.0) cl = 0.12 * (a - 170.0) / 35.0; else if (a < 240.0) cl = 0.12 * (240.0 - a) / 35.0;
      else if (a < 300.0) nr = 0.12 * (a - 240.0) / 60.0; else nr = 0.12 * (360.0 - a) / 60.0;
      vec3 r = mix(col, vec3(0.0), nr);   // (plus de reflet clair : seulement les zones plus sombres)
      r *= 1.0 - 0.28 * clamp((length(vLoc) - 0.6) / 0.4, 0.0, 1.0);
      col = mix(col, r, uReflet);
    }
  } else {                                                // la tranche : metal sombre
    col = vec3(0.16, 0.13, 0.09) * (0.55 + 0.6 * l);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

function charge(gl: WebGLRenderingContext, b: ImageBitmap | HTMLImageElement) {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, b);
  const pot = (n: number) => (n & (n - 1)) === 0;
  if (pot(b.width) && pot(b.height)) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
  else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const ext = gl.getExtension('EXT_texture_filter_anisotropic');
  if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));   // net même très incliné
  return t;
}
async function image(p: string) {
  const blob = await fichier(p);
  if ('createImageBitmap' in window) return createImageBitmap(blob);
  const img = new Image(); img.src = URL.createObjectURL(blob); await img.decode(); return img;
}

/** Le maillage : face avant, face arrière, tranche (rayon 1, épaisseur EP). */
function maillage() {
  const EP = 0.0087, S = 160, P: number[] = [], idx: number[] = [];
  const v = (x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, w: number, f: number) => { P.push(x, y, z, nx, ny, nz, u, w, f); return P.length / 9 - 1; };
  for (const [z, nz, f] of [[EP / 2, 1, 0], [-EP / 2, -1, 1]] as const) {
    const c = v(0, 0, z, 0, 0, nz, 0.5, 0.5, f);
    const ring: number[] = [];
    for (let i = 0; i <= S; i++) {
      const a = (i / S) * Math.PI * 2, x = Math.cos(a), y = Math.sin(a);
      ring.push(v(x, y, z, 0, 0, nz, (x + 1) / 2, f === 0 ? (1 - y) / 2 : (1 + y) / 2, f));   // verso : retourné comme il se lit, vu de derrière
    }
    for (let i = 0; i < S; i++) idx.push(c, ring[i], ring[i + 1]);
  }
  const base = P.length / 9;
  for (let i = 0; i <= S; i++) {
    const a = (i / S) * Math.PI * 2, x = Math.cos(a), y = Math.sin(a);
    v(x, y, EP / 2, x, y, 0, i / S, 0, 2); v(x, y, -EP / 2, x, y, 0, i / S, 1, 2);
  }
  for (let i = 0; i < S; i++) { const a = base + 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  return { P: new Float32Array(P), I: new Uint16Array(idx) };
}

export interface Disque3D { dessiner(p: Pose3D, dt: number): void; detruire(): void; canvas: HTMLCanvasElement }

export async function creer(parent: HTMLElement): Promise<Disque3D | null> {
  const canvas = document.createElement('canvas');
  canvas.className = 'w-gl'; canvas.setAttribute('aria-hidden', 'true');
  const gl = (canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, powerPreference: 'high-performance' })
    || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  if (!gl) return null;
  const sh = (t: number, src: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, src); gl.compileShader(o); return o; };
  const prog = gl.createProgram()!; gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  let recto: ImageBitmap | HTMLImageElement, verso: ImageBitmap | HTMLImageElement;
  try { [recto, verso] = await Promise.all([image('disque/recto-doux.webp'), image('disque/verso-disque.jpg')]); } catch { return null; }
  gl.useProgram(prog);
  const { P, I } = maillage();
  const vb = gl.createBuffer(), ib = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, P, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I, gl.STATIC_DRAW);
  const at = (n: string, sz: number, off: number) => { const l = gl.getAttribLocation(prog, n); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, sz, gl.FLOAT, false, 36, off * 4); };
  at('aP', 3, 0); at('aN', 3, 3); at('aUV', 2, 6); at('aF', 1, 8);
  gl.activeTexture(gl.TEXTURE0); charge(gl, recto); gl.activeTexture(gl.TEXTURE1); charge(gl, verso);
  const U = (n: string) => gl.getUniformLocation(prog, n);
  gl.uniform1i(U('uRecto'), 0); gl.uniform1i(U('uVerso'), 1);
  const uM = U('uM'), uR = U('uR'), uProj = U('uProj'), uSpin = U('uSpin'), uReflet = U('uReflet');
  gl.enable(gl.DEPTH_TEST);
  parent.append(canvas);

  let W = 0, H = 0, dpr = 1, lent = 0;
  const taille = () => {
    dpr = Math.min(devicePixelRatio || 1, lent > 20 ? 1 : 1.5);   // ordinateur lent : moins de pixels, toujours fluide
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  taille(); addEventListener('resize', taille);
  const F = 1150;                                               // la caméra du grand disque (app.css, .stage)

  return {
    canvas,
    dessiner(p: Pose3D, dt: number) {
      if (dt > 0.03) { if (++lent === 21) taille(); } else lent = Math.max(0, lent - 1);
      // le disque est un objet de diamètre D (comme le grand disque) ; pour qu'il paraisse de diamètre p.diam au point (cx, cy),
      // on le place plus loin (k < 1) sur la ligne de visée : à la fin (k = 1) il est exactement dans le plan du grand disque
      const ox = W / 2, oy = H * 0.3, k = Math.max(1e-3, p.diam / p.D);
      const x = (p.cx - ox) / k, y = -(p.cy - oy) / k, z = F * (1 - 1 / k) - F;   // coordonnées vues de l'œil (y vers le haut)
      const r = Math.PI / 180, sz = Math.sin(p.spin * r), cz = Math.cos(p.spin * r), sx = Math.sin(p.flip * r), cx = Math.cos(p.flip * r), sy = Math.sin(p.tilt * r), cy = Math.cos(p.tilt * r);
      // rotation = balancement (Y) · retournement (X) · rotation propre (Z)
      const Rz = [cz, sz, 0, -sz, cz, 0, 0, 0, 1], Rx = [1, 0, 0, 0, cx, sx, 0, -sx, cx], Ry = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];
      const mul = (a: number[], b: number[]) => { const o = new Array(9).fill(0); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) o[j * 3 + i] += a[k * 3 + i] * b[j * 3 + k]; return o; };
      const R = mul(Ry, mul(Rx, Rz));
      gl.uniformMatrix3fv(uR, false, R);
      const e = p.D / 2; gl.uniformMatrix4fv(uM, false, [R[0] * e, R[1] * e, R[2] * e, 0, R[3] * e, R[4] * e, R[5] * e, 0, R[6] * e, R[7] * e, R[8] * e, 0, x, y, z, 1]);
      const n = 20, fa = 2e5, bY = -(H / 2 - oy) / (H / 2);           // origine de la perspective à 30 % de la hauteur, comme le grand disque
      gl.uniformMatrix4fv(uProj, false, [F / (W / 2), 0, 0, 0, 0, F / (H / 2), 0, 0, 0, bY, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0]);
      gl.uniform1f(uSpin, p.spin * r); gl.uniform1f(uReflet, p.reflet ?? 0);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, I.length, gl.UNSIGNED_SHORT, 0);
    },
    detruire() { removeEventListener('resize', taille); canvas.remove(); /* (ni loseContext() ni redimensionnement : ils bloquaient le fil principal ≈ 0,5 s ; le navigateur libère le contexte seul) */ },
  };
}

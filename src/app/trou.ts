/**
 * La fin de l'accueil : le disque est avalé par un trou noir — une déformation purement optique, comme le fisheye :
 * la lumière du disque est courbée autour d'un point (lentille gravitationnelle). Son centre s'ouvre en une ombre noire,
 * sa matière s'étire en anneau autour d'elle (l'anneau d'Einstein), légèrement entraînée en rotation, puis l'anneau
 * s'éteint et le grand disque apparaît. Aucun flou, aucun rétrécissement : la matière du disque reste nette, seulement
 * déviée. Les étoiles autour sont déviées de la même façon (space.ts).
 *
 * Référence : l'équation de la lentille ponctuelle, β = θ − θE²/θ (θ : position vue, β : position réelle, θE : rayon
 * d'Einstein) — c'est elle qui donne l'anneau et l'ombre des images de trous noirs (Interstellar, EHT).
 *
 * WebGL 1, aucune bibliothèque, hors ligne. Sans WebGL : `creerTrou` renvoie null et l'accueil garde sa fin habituelle.
 */
import { fichier } from './res.ts';

export interface PoseTrou {
  cx: number; cy: number; R: number;   // centre et rayon du disque à l'écran (px CSS)
  flip: number;                        // retournement (degrés) : 0 = recto de face, 180 = verso de face
  spin: number;                        // rotation propre (degrés), comme --spin
  tE: number;                          // rayon d'Einstein (en rayons du disque)
  ombre: number;                       // rayon de l'ombre noire (en rayons du disque)
  a: number;                           // opacité d'ensemble (extinction finale)
}
export interface Trou { dessiner(p: PoseTrou): void; detruire(): void }

const VS = `attribute vec2 aXY; void main() { gl_Position = vec4(aXY, 0.0, 1.0); }`;
// (ASCII seulement dans les shaders)
const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uRecto; uniform sampler2D uVerso;
uniform vec2 uView; uniform vec2 uC; uniform float uR; uniform float uCos; uniform float uSpin; uniform float uDpr;
uniform float uTE; uniform float uOmbre; uniform float uA;
vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
void main() {
  vec2 px = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y) / uDpr;
  vec2 p = (px - uC) / uR;                                  // position vue (rayons du disque)
  float r2 = max(dot(p, p), 1e-6), r = sqrt(r2);
  // lentille : la position reelle de ce qu'on voit ici, plus un leger entrainement en rotation pres de l'ombre
  vec2 b = p * (1.0 + uTE * uTE / r2);   // aspiration : on voit ici ce qui est plus loin -> tout le disque est tire vers le centre
  b = rot(b, 0.35 * uTE * uTE / max(r2, 0.04));
  // le disque (vu de biais selon son retournement) a cette position reelle
  vec2 d = vec2(b.x, b.y / max(abs(uCos), 0.02));
  float rd = length(d);
  vec3 col = vec3(0.0); float a = 0.0;
  if (rd < 1.0) {
    vec2 e = uCos >= 0.0 ? rot(d, -uSpin) : rot(d, uSpin);
    col = (uCos >= 0.0 ? texture2D(uRecto, e * 0.5 + 0.5).rgb : texture2D(uVerso, e * 0.5 + 0.5).rgb) * 0.85;
    a = 1.0 - smoothstep(0.985, 1.0, rd);
  }
  // l'ombre : noire et opaque (elle cache aussi les etoiles derriere), au bord net mais lisse
  float o = 1.0 - smoothstep(uOmbre * 0.97, uOmbre * 1.03, r);
  float ad = a * (1.0 - o);                                 // (premultiplie : le disque visible hors de l'ombre, l'ombre noire)
  gl_FragColor = vec4(col * ad, ad + o) * uA;
}`;

async function bitmap(p: string) {
  const b = await fichier(p);
  if ('createImageBitmap' in window) return createImageBitmap(b);
  const img = new Image(); img.src = URL.createObjectURL(b); await img.decode(); return img;
}

export async function creerTrou(parent: HTMLElement): Promise<Trou | null> {
  const c = document.createElement('canvas');
  c.className = 'w-trou'; c.setAttribute('aria-hidden', 'true');
  const gl = c.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false }) as WebGLRenderingContext | null;
  if (!gl) return null;
  const sh = (t: number, src: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, src); gl.compileShader(o); return o; };
  const prog = gl.createProgram()!; gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  let recto: ImageBitmap | HTMLImageElement, verso: ImageBitmap | HTMLImageElement;
  try { [recto, verso] = await Promise.all([bitmap('disque/recto-doux.webp'), bitmap('disque/verso-disque.jpg')]); } catch { return null; }
  gl.useProgram(prog);
  const tex = (unit: number, img: ImageBitmap | HTMLImageElement) => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    const pot = (n: number) => (n & (n - 1)) === 0;   // (mipmaps : la matiere comprimee vers le centre reste douce, sans scintillement)
    if (pot(img.width) && pot(img.height)) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  tex(0, recto); tex(1, verso);
  const U = (k: string) => gl.getUniformLocation(prog, k);
  gl.uniform1i(U('uRecto'), 0); gl.uniform1i(U('uVerso'), 1);
  const uView = U('uView'), uC = U('uC'), uR = U('uR'), uCos = U('uCos'), uSpin = U('uSpin'), uDpr = U('uDpr'), uTE = U('uTE'), uOmbre = U('uOmbre'), uA = U('uA');
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const l = gl.getAttribLocation(prog, 'aXY'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  parent.append(c);
  let dpr = 1;
  const taille = () => { dpr = Math.min(devicePixelRatio || 1, 1.5); c.width = Math.round(innerWidth * dpr); c.height = Math.round(innerHeight * dpr); gl.viewport(0, 0, c.width, c.height); };
  taille(); addEventListener('resize', taille);
  const r = Math.PI / 180;
  return {
    dessiner(p: PoseTrou) {
      gl.uniform2f(uView, c.width, c.height); gl.uniform1f(uDpr, dpr);
      gl.uniform2f(uC, p.cx, p.cy); gl.uniform1f(uR, p.R);
      gl.uniform1f(uCos, Math.cos(p.flip * r)); gl.uniform1f(uSpin, p.spin * r); gl.uniform1f(uTE, p.tE); gl.uniform1f(uOmbre, p.ombre); gl.uniform1f(uA, p.a);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    detruire() { removeEventListener('resize', taille); c.remove(); /* (ni loseContext() ni redimensionnement : ils bloquaient le fil principal ≈ 0,5 s ; le navigateur libère le contexte seul) */ },
  };
}

/**
 * L'apparition du grand disque de l'interface : l'inverse de l'aspiration (le disque naît de son centre et se déploie
 * jusqu'à son bord, en se détordant). Sa face (le canevas déjà peint par carousel.ts) est redessinée ici, déformée dans
 * son propre plan ; posée à la place de la face en CSS, elle garde la perspective, l'inclinaison et la rotation.
 */
export interface TrouFace { canvas: HTMLCanvasElement; dessiner(t: number): void; detruire(): void }
const FS2 = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex; uniform vec2 uTaille; uniform float uT;
vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
void main() {
  // la meme lentille que la disparition du petit disque, jouee a l'envers : rayon d'Einstein tE de 0,5 (avale) a 0 (entier)
  vec2 q = (gl_FragCoord.xy / uTaille) * 2.0 - 1.0; q.y = -q.y;          // le plan du disque (rayon 1, y vers le bas)
  float e = clamp(uT, 0.0, 1.0);
  q /= mix(0.45, 1.0, e);                                                 // il grossit en apparaissant (de 45 % a sa taille)
  float r2 = max(dot(q, q), 1e-6), r = sqrt(r2);
  if (r > 1.0) discard;
  float tE = 0.5 * pow(1.0 - e, 0.75);   // (intense : la lentille reste forte longtemps)
  vec2 b = q * (1.0 + tE * tE / r2);
  b = rot(b, 2.4 * tE * tE / max(r2, 0.03) + 1.2 * tE);   // torsion bien plus forte : il se detord en tournoyant
  float rb = length(b);
  vec3 col = vec3(0.0); float a = 0.0;
  if (rb < 1.0) { vec4 t = texture2D(uTex, b * 0.5 + 0.5); col = t.rgb; a = t.a * (1.0 - smoothstep(0.985, 1.0, rb)); }
  float th1 = (1.0 - sqrt(max(1.0 - 4.0 * tE * tE, 0.0))) * 0.5;
  float o = tE > 0.0005 ? 1.0 - smoothstep(th1 * 0.97, th1 * 1.03, r) : 0.0;
  float ad = a * (1.0 - o), k = smoothstep(0.0, 0.12, e);              // (au tout debut : l'ombre apparait en fondu)
  gl_FragColor = vec4(col * ad, ad + o) * k;
}`;
export function creerTrouFace(src: HTMLCanvasElement): TrouFace | null {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const gl = c.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false }) as WebGLRenderingContext | null;
  if (!gl) return null;
  const sh = (t: number, s: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const prog = gl.createProgram()!; gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS2)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t);
  try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch { return null; }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);
  const uTaille = gl.getUniformLocation(prog, 'uTaille'), uT = gl.getUniformLocation(prog, 'uT');
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const l = gl.getAttribLocation(prog, 'aXY'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
  gl.viewport(0, 0, c.width, c.height);
  return {
    canvas: c,
    dessiner(tt: number) { gl.uniform2f(uTaille, c.width, c.height); gl.uniform1f(uT, tt); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3); },
    detruire() { c.remove(); /* (ni loseContext() ni redimensionnement : ils bloquaient le fil principal ≈ 0,5 s ; le navigateur libère le contexte seul) */ },
  };
}

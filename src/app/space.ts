/**
 * Le fond spatial.
 * - Fond : noir, avec des poussières et de fins défauts, comme sur les photos du disque — et
 *   comme un ciel. Peint une seule fois dans une image (aucun coût pendant l'animation).
 */

let urlFond = '';
/**
 * Écran « simple » (écran externe, gamme sRGB ou faible densité) : les gris presque noirs du fond y sont souvent écrasés
 * et les poussières disparaissent. On le repère (sans rien changer sur un écran Retina P3, comme celui du Mac) et la page
 * éclaircit alors un peu le fond (classe html.ecran-simple, voir app.css). Mis à jour si la fenêtre change d'écran.
 */
function reperEcran() {
  const p3 = matchMedia('(color-gamut: p3)'), maj = () => document.documentElement.classList.toggle('ecran-simple', !p3.matches || (devicePixelRatio || 1) < 1.5);
  maj(); p3.addEventListener('change', maj);
  const suivre = () => matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`).addEventListener('change', () => { maj(); suivre(); }, { once: true });
  suivre();
}
let repere = false;
/** Le fond (poussières, fibres) pour la carte graphique : une tuile de la taille de l'écran, prise au centre du fond peint,
 *  dessinée avec les étoiles et bougeant exactement comme elles (dérive, voyage, recul, rotation). */
export const tuileFond: { c: HTMLCanvasElement | null; v: number } = { c: null, v: 0 };
export function paintSpace() {
  if (!repere) { repere = true; reperEcran(); }
  const dpr = Math.min(devicePixelRatio || 1, 2);
  // écran à faible densité (écran externe, vidéoprojecteur…) : les poussières, plus fines qu'un pixel, y deviennent presque
  // invisibles (la dalle écrase ces gris très sombres). On les dessine alors sur un pixel entier, un peu plus lumineuses,
  // pour retrouver l'aspect de l'écran Retina ; sur un écran Retina (Mac), rien ne change.
  const basse = dpr < 1.5;
  // peint deux fois plus grand que l'écran (même densité, même taille de poussières) : le fond dépasse de chaque côté,
  // ce qui lui permet de suivre la caméra plus longtemps pendant le voyage sans montrer son bord
  const W = Math.min(5200, Math.round(screen.width * dpr * 2)), H = Math.min(3600, Math.round(screen.height * dpr * 2));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  let s = 20261001; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  // poussières : très fines et nombreuses, de tailles et d'éclats variés (aucune grosse tache)
  const n = Math.round((W * H) / 1400);
  let x0 = 0, y0 = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.pow(r(), 3.2) * 0.55 + 0.02, x = r() * W, y = r() * H;
    const t = r();
    g.fillStyle = t > 0.8 ? `rgba(255,236,200,${a})` : t > 0.65 ? `rgba(205,220,255,${a * 0.8})` : `rgba(235,232,225,${a})`;
    let sz = (r() > 0.97 ? 0.9 + r() * 0.5 : 0.35 + r() * 0.5) * dpr;
    if (basse && sz < 1) { g.globalAlpha = Math.min(1, 0.25 + 0.6 * sz); sz = 1; x0 = Math.round(x); y0 = Math.round(y); } else { g.globalAlpha = 1; x0 = x; y0 = y; }
    g.fillRect(x0, y0, sz, sz);
    g.globalAlpha = 1;
    if (r() > 0.992) { g.fillRect(x - sz * 1.5, y + sz * 0.3, sz * 4, sz * 0.25); g.fillRect(x + sz * 0.3, y - sz * 1.5, sz * 0.25, sz * 4); }   // rares éclats en croix, très fins
  }
  // (plus de fibres ni de rayures : elles faisaient des « cheveux » sur l'écran)
  {
    const tw = Math.min(W, Math.round(screen.width * dpr)), th = Math.min(H, Math.round(screen.height * dpr));
    const t = document.createElement('canvas'); t.width = tw; t.height = th;
    t.getContext('2d')!.drawImage(c, (W - tw) / 2, (H - th) / 2, tw, th, 0, 0, tw, th);
    tuileFond.c = t; tuileFond.v++;
  }
  c.toBlob((b) => {
    if (!b) return;
    const ancien = urlFond; urlFond = URL.createObjectURL(b);
    document.documentElement.style.setProperty('--space', `url(${urlFond})`);
    if (ancien) setTimeout(() => URL.revokeObjectURL(ancien), 2000);
    document.body.classList.add('space');
    if (!document.querySelector('.fond')) { const f = document.createElement('div'); f.className = 'fond'; f.setAttribute('aria-hidden', 'true'); document.body.prepend(f); }
  }, 'image/jpeg', 0.9);
  // la fenêtre passe sur un autre écran (Retina ↔ écran externe) : le fond est repeint pour cet écran
  matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`).addEventListener('change', () => paintSpace(), { once: true });
}

/**
 * Le ciel vit, à peine : quelques points de lumière scintillent très lentement par-dessus le fond fixe
 * (qui garde sa texture fine). Dessinés par la carte graphique (WebGL) en une seule passe : aucun
 * calcul ni transfert d'image par le processeur, léger sur tous les navigateurs. 30 images/s suffisent ;
 * arrêté quand l'onglet est caché, dans la galerie (le ciel y est couvert) ou si les animations sont réduites.
 */
/**
 * La caméra dérive dans l'espace : les étoiles glissent lentement vers la gauche (et un peu vers le bas),
 * les plus proches un peu plus vite (parallaxe). Tout est fait par la carte graphique, dans le dessin déjà existant.
 *
 * Le voyage (au contact, voir prelude.ts) : `camera.voyage(t)` donne, pour l'instant t, où est la caméra
 * (x, y en pixels d'écran), son recul (zoom ≤ 1) et son roulis (radians). Les étoiles, le fond, les éléments de
 * l'accueil et le disque sont tous placés par cette même fonction, au même instant : ils restent parfaitement raccord.
 */
export interface Pose { x: number; y: number; zoom: number; roll: number; vx: number; vy: number; w?: number; fish?: number }   // vx, vy : vitesse (px/s) ; w : vitesse de rotation de la caméra (rad/s)
export const camera: { voyage: ((now: number) => Pose) | null; repos: Pose } = { voyage: null, repos: { x: 0, y: 0, zoom: 1, roll: 0, vx: 0, vy: 0 } };
/** Où est la caméra maintenant (pendant le voyage, ou là où elle s'est arrêtée). */
/** L'approche de l'accueil : la caméra avance vers le disque (z : grossissement du ciel, x, y : point visé, px CSS).
 *  Les étoiles proches s'écartent plus vite que les lointaines. */
export const approche = { z: 1, x: 0, y: 0 };
/** Le trou noir de la fin de l'accueil (trou.ts) : centre (px CSS) et rayon d'Einstein (px) ; les étoiles et le fond sont déviés autour. */
export const lentille = { x: 0, y: 0, r: 0 };
export const pose = (now: number): Pose => camera.voyage ? camera.voyage(now) : camera.repos;
const DERIVE = { x: -5.5, y: 1.6 };   // pixels par seconde à la vitesse 1 : vers la gauche, un peu vers le bas

export function twinkle() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'); c.className = 'scintille'; c.setAttribute('aria-hidden', 'true');
  const fond = document.querySelector('.fond');
  if (fond) fond.after(c); else document.body.prepend(c);
  const gl = c.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) { c.remove(); return; }
  // Deux passes, très légères :
  // - les points : les étoiles habituelles, exactement comme avant (au repos, rien ne change) ;
  // - en voyage seulement, des traits fins (1 px) dans le sens du mouvement, d'autant plus longs et nombreux que la
  //   caméra va vite (des étoiles lointaines en plus, invisibles au repos). Des lignes, pas de grands carrés : aucun coût.
  // (shaders en ASCII seulement : WebGL refuse les accents, même dans les commentaires)
  const VS = `attribute vec2 aPos; attribute vec4 aCol; attribute vec4 aAnim; attribute float aBout; attribute float aCote;
uniform vec2 uView; uniform vec2 uDom; uniform vec2 uOff; uniform vec2 uVoy; uniform vec2 uVel; uniform float uZoom; uniform float uRoll; uniform float uVis; uniform mediump float uLigne; uniform float uT; uniform mediump float uDpr; uniform float uFish; uniform vec3 uAp; uniform float uOmega; uniform float uArcT; uniform vec3 uLens;
varying vec4 vCol; varying float vK, vBig, vSize, vA, vBout; varying vec3 vQ;
void main() {
  vec2 p = mod(aPos * uDom + uOff * aAnim.x - uVoy * (0.8 + 0.2 * aAnim.x), uDom) - (uDom - uView) * 0.5;   // un carré qui couvre tout le cercle de l'écran : en tournant, aucun coin vide
  vec2 q = p - uView * 0.5; float cr = cos(uRoll), sr = sin(uRoll);
  p = uView * 0.5 + vec2(cr * q.x - sr * q.y, sr * q.x + cr * q.y) * uZoom;
  float za = 1.0 + (uAp.x - 1.0) * (0.45 + 0.35 * aAnim.x); p = uAp.yz + (p - uAp.yz) * za;   // l'approche (accueil)
  if (uLens.z > 0.5) { vec2 ql = p - uLens.xy; float bl = max(length(ql), 0.001); p = uLens.xy + ql / bl * 0.5 * (bl + sqrt(max(bl * bl - 4.0 * uLens.z * uLens.z, 0.0))); }   // le trou noir aspire : les etoiles sont tirees vers lui (et avalees tout pres)
  vec2 v = -vec2(cr * uVel.x - sr * uVel.y, sr * uVel.x + cr * uVel.y) * (0.8 + 0.2 * aAnim.x) * uZoom;
  float len = min(260.0 * uDpr, length(v) / 60.0);
  float arcA = 0.0;
  if (uLigne > 1.5) {
    // traînées lumineuses (hypervitesse et rotation) : un ruban fondu qui s'affine vers la queue, avec une tête en halo qui
    // englobe le point de l'étoile. En rotation il suit l'arc de cercle autour du centre ; en hypervitesse il est droit.
    // Largeurs variées d'une étoile à l'autre : des traînées fines et d'autres plus pleines.
    vec2 c = uView * 0.5, qq = p - c; float rq = max(length(qq), 1.0);
    float La = rq * abs(uOmega) * uArcT;                                      // longueur de l'arc (rotation)
    vec2 dirL = len > 0.0 ? normalize(v) : vec2(1.0, 0.0);
    bool arc = La >= len;
    float L = max(La, len);
    float fin = 0.38 + 0.62 * fract(aAnim.z * 1.7 + aAnim.y * 3.1);           // finesse propre a chaque etoile
    float hw = (0.55 + 0.9 * aAnim.x) * uDpr * fin * (1.0 + 0.3 * clamp(L / (90.0 * uDpr), 0.0, 1.0));
    float t = max(aBout, 0.0), dd;
    vec2 pos;
    vec2 mv = arc ? sign(uOmega) * vec2(-qq.y, qq.x) / rq : -dirL;            // sens de la tete
    if (aBout < 0.0) {                                                        // un peu en avant : le halo de tete entoure l'etoile
      dd = aBout / 0.2 * 2.4 * hw; pos = c + qq - mv * dd;
      pos += (arc ? qq / rq : vec2(-dirL.y, dirL.x)) * aCote * hw * 2.5;
    } else if (arc) {
      float ph = -uOmega * uArcT * t, cs = cos(ph), sn = sin(ph);
      vec2 qa = vec2(cs * qq.x - sn * qq.y, sn * qq.x + cs * qq.y);
      dd = t * L; pos = c + qa + (qa / max(length(qa), 1.0)) * aCote * hw * 2.5 * (1.0 - 0.55 * t);
    } else {
      dd = t * L; pos = p + dirL * len * t + vec2(-dirL.y, dirL.x) * aCote * hw * 2.5 * (1.0 - 0.55 * t);
    }
    p = pos; vQ = vec3(dd, max(L, 0.001), hw);
    arcA = clamp((L - 2.0 * uDpr) / (14.0 * uDpr), 0.0, 1.0);
  } else {
    p += (len > 0.0 ? normalize(v) : vec2(0.0)) * len * aBout;
  }
  vec2 qf = p - uView * 0.5; float rf = dot(qf, qf) / dot(uView * 0.5, uView * 0.5); p = uView * 0.5 + qf * (1.0 + uFish * pow(rf, 0.8));   // (exposant < 1 : l'effet s'étend un peu plus vers le centre)
  gl_Position = vec4(p / uView * 2.0 - 1.0, 0.0, 1.0); gl_Position.y = -gl_Position.y;
  float k = 0.5 + 0.5 * sin(uT * aAnim.y * 6.2831853 + aAnim.z);
  vK = k; vBig = (aAnim.w > 0.5 && aAnim.w < 1.5) ? 1.0 : 0.0; vCol = aCol; vBout = uLigne > 1.5 ? aCote : aBout;
  float trait = clamp((len - 2.0) / 18.0, 0.0, 1.0);
  vA = uLigne > 1.5 ? arcA * (aAnim.w > 1.5 ? uVis : 1.0) : uLigne > 0.5 ? trait * (aAnim.w > 1.5 ? uVis : 1.0) : (aAnim.w > 1.5 ? 0.0 : 1.0);
  float core = max(1.0, floor(aAnim.x * uDpr + 0.5));
  vSize = core;
  gl_PointSize = vBig > 0.5 ? core + 4.0 * uDpr : core + 2.0;   // (+2 px : place pour un bord anticrénelé — l'étoile glisse au sous-pixel, sans sauter d'un pixel à l'autre)
}`;
  const FS = `precision mediump float;
varying vec4 vCol; varying float vK, vBig, vSize, vA, vBout; varying vec3 vQ; uniform float uDpr; uniform float uLigne;
void main() {
  float a = vCol.a * (0.25 + 0.75 * vK * vK) * vA;
  if (uLigne > 1.5) {
    float u = clamp(vQ.x / vQ.y, 0.0, 1.0);
    float trav = exp(-pow(vBout * 2.5, 2.0) * 1.4);                           // bord fondu, aucun trait dur
    float queue = vQ.x >= 0.0 ? pow(1.0 - u, 1.6) : 0.0;
    float tete = exp(-(vQ.x * vQ.x) / (vQ.z * vQ.z * 3.0));                   // halo autour de l'etoile : la tete et la traine ne font qu'un
    a = a * trav * max(0.75 * queue, 0.95 * tete);
    if (a < 0.002) discard;
    vec3 col = mix(vCol.rgb, vec3(0.36, 0.55, 1.0), 0.46 * (1.0 - 0.7 * tete));   // un reflet bleu tres leger dans la lueur (le bleu de la Terre)
    gl_FragColor = vec4(col * a, a); return;
  }
  if (uLigne > 0.5) { a = a * (1.0 - 0.8 * vBout); gl_FragColor = vec4(mix(vCol.rgb, vec3(0.42, 0.6, 1.0), 0.2 * vBout) * a, a); return; }
  if (a < 0.003) discard;
  if (vBig < 0.5) {                                        // point ordinaire : carré de « core » px, couverture exacte de chaque pixel (mouvement fluide)
    vec2 d = abs((gl_PointCoord - 0.5) * (vSize + 2.0));
    vec2 cov = clamp(vSize * 0.5 + 0.5 - d, 0.0, 1.0);
    a *= cov.x * cov.y;
    if (a < 0.002) discard;
  }
  if (vBig > 0.5) {
    float S = vSize + 4.0 * uDpr;
    vec2 d = abs((gl_PointCoord - 0.5) * S);
    bool core = d.x <= vSize * 0.5 && d.y <= vSize * 0.5;
    if (!core) {
      bool cross = (d.x < 0.5 && d.y <= 2.5 * uDpr) || (d.y < 0.5 && d.x <= 2.5 * uDpr);
      if (!cross || vK <= 0.85) discard;
      a = a * 0.35 * (vK - 0.85) / 0.15;
    }
  }
  gl_FragColor = vec4(vCol.rgb * a, a);
}`;
  const sh = (t: number, src: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, src); gl.compileShader(o); return o; };
  const prog = gl.createProgram()!; gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { c.remove(); return; }
  gl.useProgram(prog);
  const bufP = gl.createBuffer(), bufL = gl.createBuffer(), bufA = gl.createBuffer(); let n = 0, nl = 0, na = 0;
  const U = (k: string) => gl.getUniformLocation(prog, k);
  const uLens = U('uLens'), uDom = U('uDom'), uArcT = U('uArcT'), uOmega = U('uOmega'), uAp = U('uAp'), uFish = U('uFish'), uView = U('uView'), uOff = U('uOff'), uVoy = U('uVoy'), uVel = U('uVel'), uVis = U('uVis'), uZoom = U('uZoom'), uRoll = U('uRoll'), uLigne = U('uLigne'), uT = U('uT'), uDpr = U('uDpr');
  const F = 4, ST = 12 * F;
  const lier = (b: WebGLBuffer | null) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    const at = (name: string, size: number, off: number) => { const l = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, ST, off * F); };
    at('aPos', 2, 0); at('aCol', 4, 2); at('aAnim', 4, 6); at('aBout', 1, 10); at('aCote', 1, 11);
  };
  const build = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);   // (1,5 : presque aussi net, deux fois moins de pixels à dessiner à chaque image)
    c.width = Math.round(innerWidth * dpr); c.height = Math.round(innerHeight * dpr);
    let s = 19770905; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const Sd = Math.ceil(Math.hypot(c.width, c.height) / 0.85);   // (couvre aussi le recul du décrochage)   // côté du carré (px de l'écran)
    const base = Math.round(innerWidth * innerHeight / 9000 * (Sd * Sd) / (c.width * c.height));   // même densité qu'avant, sur une surface plus grande
    n = base * 4;   // les étoiles habituelles (les mêmes qu'avant), puis trois fois plus d'étoiles lointaines, visibles en voyage seulement
    const etoiles: number[][] = [];
    for (let i = 0; i < n; i++) {
      const voyage = i >= base;
      const x = r(), y = r(), z = voyage ? 0.45 + r() * 0.45 : r() < 0.9 ? 0.55 + r() * 0.5 : 1.1 + r() * 0.5, a = voyage ? 0.12 + Math.pow(r(), 2) * 0.45 : 0.22 + Math.pow(r(), 2) * 0.6, f = 0.08 + r() * 0.22, p = r() * Math.PI * 2, t = r();
      const col = t > 0.82 ? [255, 238, 206] : t > 0.66 ? [212, 224, 255] : [242, 240, 234];
      etoiles.push([x, y, col[0] / 255, col[1] / 255, col[2] / 255, a, z, f, p, voyage ? 2 : z > 1.1 ? 1 : 0]);
    }
    const dp = new Float32Array(base * 12), dl = new Float32Array(n * 24);
    etoiles.forEach((e, i) => { if (i < base) dp.set([...e, 0, 0], i * 12); dl.set([...e, 0, 0], i * 24); dl.set([...e, 1, 0], i * 24 + 12); });
    nl = n * 2;
    // les traînées courbes (rotation) : un ruban de 8 segments par étoile, du halo de tête jusqu'à la queue
    const K = [-0.2, 0, 0.1, 0.22, 0.36, 0.52, 0.7, 0.85, 1], da: number[] = [];
    etoiles.forEach((e) => { for (let j = 0; j < K.length - 1; j++) for (const [b, c] of [[K[j], -1], [K[j], 1], [K[j + 1], -1], [K[j + 1], -1], [K[j], 1], [K[j + 1], 1]]) da.push(...e, b, c); });
    na = da.length / 12;
    gl.bindBuffer(gl.ARRAY_BUFFER, bufA); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(da), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufP); gl.bufferData(gl.ARRAY_BUFFER, dp, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufL); gl.bufferData(gl.ARRAY_BUFFER, dl, gl.STATIC_DRAW);
    n = base;
    gl.viewport(0, 0, c.width, c.height);
    gl.uniform2f(uView, c.width, c.height); gl.uniform2f(uDom, Sd, Sd); gl.uniform1f(uDpr, dpr);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  };
  build();
  let rz = 0; addEventListener('resize', () => { clearTimeout(rz); rz = window.setTimeout(build, 200); });
  // ── le fond (poussières et fibres) : dessiné ici, avec les étoiles, par la même caméra (dérive, voyage, recul, rotation),
  // répété à l'infini : il bouge avec elles et n'a jamais de bord ──
  const BVS = `attribute vec2 aXY; void main() { gl_Position = vec4(aXY, 0.0, 1.0); }`;
  const BFS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex; uniform vec2 uTS; uniform vec2 uV; uniform vec2 uO; uniform vec2 uY; uniform float uZ; uniform float uR; uniform float uF; uniform float uL; uniform vec3 uLs;
void main() {
  vec2 s = vec2(gl_FragCoord.x, uV.y - gl_FragCoord.y), c = uV * 0.5, q = s - c, g = q; float R2 = dot(c, c);
  if (uF > 0.0005) { for (int i = 0; i < 3; i++) { float rf = dot(g, g) / R2; g = q / (1.0 + uF * pow(rf, 0.8)); } }   // (au repos : rien à calculer)
  if (uLs.z > 0.5) { vec2 ql = c + g - uLs.xy; g = uLs.xy + ql * (1.0 + uLs.z * uLs.z / max(dot(ql, ql), 1.0)) - c; }   // lentille du trou noir
  g /= uZ; float cr = cos(uR), sr = sin(uR); vec2 w = vec2(cr * g.x + sr * g.y, -sr * g.x + cr * g.y);
  vec2 uv = fract((w - uO * 0.7 + uY * 0.94 + uTS * 0.5) / uTS);
  gl_FragColor = vec4(texture2D(uTex, uv).rgb * uL, 1.0);
}`;
  const bprog = gl.createProgram()!; gl.attachShader(bprog, sh(gl.VERTEX_SHADER, BVS)); gl.attachShader(bprog, sh(gl.FRAGMENT_SHADER, BFS)); gl.linkProgram(bprog);
  const bOk = gl.getProgramParameter(bprog, gl.LINK_STATUS);
  const bBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const BU = (k: string) => gl.getUniformLocation(bprog, k);
  const bTS = BU('uTS'), bV = BU('uV'), bO = BU('uO'), bY = BU('uY'), bZ = BU('uZ'), bR = BU('uR'), bF = BU('uF'), bL = BU('uL'), bLs = BU('uLs'), bXY = gl.getAttribLocation(bprog, 'aXY');
  const tex = gl.createTexture(); let texV = 0, texW = 0, texH = 0;
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const fondGl = (ps: Pose, fish: number, dpr: number) => {
    const t = tuileFond.c;
    if (!bOk || !t || t.width > maxTex || t.height > maxTex) return false;
    gl.useProgram(bprog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    if (texV !== tuileFond.v) {
      texV = tuileFond.v; texW = t.width; texH = t.height;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      document.documentElement.classList.add('fond-gl');   // l'ancien fond (calque fixe) n'est plus affiché
    }
    const sc = Math.max(c.width / texW, c.height / texH);   // même échelle qu'avant (le fond « couvrait » l'écran)
    gl.uniform2f(bTS, texW * sc, texH * sc); gl.uniform2f(bV, c.width, c.height); gl.uniform2f(bO, ox, oy); gl.uniform2f(bY, ps.x * dpr, ps.y * dpr);
    gl.uniform1f(bZ, ps.zoom); gl.uniform1f(bR, ps.roll); gl.uniform1f(bF, fish); gl.uniform1f(bL, document.documentElement.classList.contains('ecran-simple') ? 1.25 : 1); gl.uniform3f(bLs, lentille.x * dpr, lentille.y * dpr, lentille.r * dpr);
    gl.bindBuffer(gl.ARRAY_BUFFER, bBuf); gl.enableVertexAttribArray(bXY); gl.vertexAttribPointer(bXY, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.enable(gl.BLEND);
    gl.useProgram(prog);
    return true;
  };
  let last = 0, ox = 0, oy = 0;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    if (document.hidden) return;   // chaque image de l'écran : la dérive des étoiles reste fluide, même sur un grand écran   // 30 images/s en dérive, chaque image pendant le voyage
    const cl = document.body.classList;
    if (!cl.contains('vue-disque') && !cl.contains('welcome')) return;   // galerie : le ciel est couvert
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    const dpr = c.width / innerWidth;
    ox = (ox + DERIVE.x * dt * dpr) % 1e6; oy = (oy + DERIVE.y * dt * dpr) % 1e6;
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const ps0 = pose(now), vit0 = Math.max(Math.hypot(ps0.vx, ps0.vy), Math.abs(ps0.w ?? 0) * 0.075 * Math.hypot(innerWidth, innerHeight)), kf0 = Math.min(1, Math.max(0, (vit0 - 420) / 2400));
    fondGl(ps0, Math.max(ps0.fish ?? 0, 0.65 * Math.pow(kf0 * kf0 * (3 - 2 * kf0), 1.6)), dpr);
    const ps = pose(now), vit = Math.max(Math.hypot(ps.vx, ps.vy), Math.abs(ps.w ?? 0) * 0.075 * Math.hypot(innerWidth, innerHeight));   // (rotation : la vitesse d'une étoile à mi-distance du bord)
    gl.uniform1f(uOmega, ps.w ?? 0);
    gl.uniform2f(uOff, ox, oy); gl.uniform2f(uVoy, ps.x * dpr, ps.y * dpr); gl.uniform1f(uZoom, ps.zoom); gl.uniform1f(uRoll, ps.roll);
    gl.uniform2f(uVel, ps.vx * dpr, ps.vy * dpr); gl.uniform1f(uVis, Math.min(1, Math.max(0, (vit - 300) / 1500)));   // plus on va vite, plus on voit d'étoiles
    const kf = Math.min(1, Math.max(0, (vit - 420) / 2400)); gl.uniform1f(uFish, Math.max(ps.fish ?? 0, 0.65 * Math.pow(kf * kf * (3 - 2 * kf), 1.6)));   // (il arrive un peu plus tard et plus doucement au départ)   // hypervitesse : fisheye inversé (les bords de l'image s'étirent vers l'extérieur), d'autant plus fort qu'on va vite
    gl.uniform3f(uAp, approche.z, approche.x * dpr, approche.y * dpr);
    gl.uniform3f(uLens, lentille.x * dpr, lentille.y * dpr, lentille.r * dpr);
    gl.uniform1f(uT, now / 1000);
    gl.uniform1f(uArcT, 0.055);
    if (Math.abs(ps.w ?? 0) > 0.02 || Math.hypot(ps.vx, ps.vy) > 120) { gl.uniform1f(uLigne, 2); lier(bufA); gl.drawArrays(gl.TRIANGLES, 0, na); }   // traînées lumineuses (rotation : courbes ; hypervitesse : droites), sous les points
    gl.uniform1f(uLigne, 0); lier(bufP); gl.drawArrays(gl.POINTS, 0, n);                 // les étoiles, comme toujours
  };
  requestAnimationFrame(frame);
}

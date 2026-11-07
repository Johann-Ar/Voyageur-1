/**
 * Le disque et ses images.
 * Le Golden Record est posé en bas de l'écran, vu en plongée, à moitié hors champ. Ses images
 * flottent au-dessus de lui, debout, reliées à lui par un fil. Tourner le disque (molette, glisser,
 * flèches) les fait défiler ; au repos il tourne lentement (vitesse de lecture).
 * Tout est en CSS 3D (perspective + preserve-3d) : pas de WebGL, léger, net.
 */
import { urlLisible } from './res.ts';
import { t } from './i18n.ts';
import { platine } from './audio.ts';
import { creerTrouFace, type TrouFace } from './trou.ts';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Aléa stable par image (disposition organique). */
const rnd = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

export interface CarouselItem { id: string; thumb: string; aspect: number; mine: boolean; label: string; title: string }

/** Photos du disque (public/disque/, voir CREDITS.md). */
/** Face visible : le disque lui-même (« verso » fourni, déjà découpé). */
const FACE = 'disque/verso-disque.jpg';
const IDLE_SPEED = 0.17;   // rotation de base un peu plus vive   // images par seconde, au repos
const TILT = 70;
/** Angle du grand disque à la reprise, depuis l'angle du disque de l'accueil (degrés). */
const SPIN_A = -1, SPIN_B = 0;
/** Durée de l'apparition du grand disque (s). */
const APPARITION = 1.8, APPARITION_DELAI = 0.35;           // inclinaison du disque (degrés) : un peu plus à plat
/** Diamètre du disque pour que son bord passe exactement par les deux coins bas de l'écran
 *  (plan incliné de TILT°, perspective 1150 px, origine 50 % 30 %). */
/** Safari et Firefox calculent les filtres SVG sur le processeur, à chaque image : quand le disque file, ça saccadait.
 *  Chez eux, le flou de vitesse (toujours dans le sens du mouvement) est calculé une seule fois par image, au chargement,
 *  dans un second canevas posé par-dessus : pendant le défilement, seule son opacité change (rien n'est recalculé). */
const flouPrecalc = !/Chrome|Chromium|Edg\//.test(navigator.userAgent);
function flouHorizontal(img: HTMLImageElement) {
  const w = Math.max(1, Math.round(img.naturalWidth / 2)), h = Math.max(1, Math.round(img.naturalHeight / 2));   // demi-résolution : le flou n'a pas besoin de détails
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.className = 'flou-v';
  const g = cv.getContext('2d')!, N = 12, etendue = w * 0.06;   // traînée ≈ ±6 % de la largeur de l'image
  g.drawImage(img, 0, 0, w, h);                                   // le fond : les bords restent pleins
  for (let k = 0; k < N; k++) { const x = (k / (N - 1) - 0.5) * 2 * etendue; g.globalAlpha = 1 / (k + 1); g.drawImage(img, x, 0, w, h); }   // moyenne cumulée de copies décalées : un flou de bougé, pas gaussien
  return cv;
}
/** Épaisseur des fils (en px) : un trait de 1 px affiné par la transformation (une largeur CSS sous 1 px disparaissait dans Firefox). */
const FIL = 0.45;
function fitDisc(vw: number, vh: number, top: number) {
  const P = 1150, oy = vh * 0.3, a = TILT * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const reach = (D: number) => {                 // demi-largeur du disque à hauteur du bas de l'écran
    let best = 0;
    for (let k = 0; k <= 720; k++) {
      const t = (k / 720) * Math.PI, r = D / 2, x = r * Math.cos(t), y = r * Math.sin(t);   // moitié avant
      const z = y * sa, f = P / (P - z);
      if (z >= P - 1) continue;
      const Y = oy + (top + y * ca - oy) * f;
      if (Y >= vh) best = Math.max(best, Math.abs(x * f));
    }
    return best;
  };
  let lo = vw * 0.3, hi = vw * 3;
  for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (reach(m) < vw / 2) lo = m; else hi = m; }
  return hi;
}
const CURVE = 1.6;        // courbe des images un peu plus ouverte que le disque : plus d'images à la fois
const PAD = 0, CAP = 0;   // plus de cadre ni de titre : l'image seule

export class DiscCarousel {
  private root: HTMLElement;
  private body: HTMLElement;
  private faces: HTMLCanvasElement[];
  private cards: HTMLElement[] = [];
  private threads: HTMLElement[] = [];
  private dots: HTMLElement[] = [];
  private items: CarouselItem[] = [];
  private pos = 0;
  private vel = 0;
  private target: number | null = null;
  private running = false;
  private last = performance.now();
  private geo = { vw: 0, vh: 0, D: 0, R: 0, H: 0, step: 0.2 };
  onOpen: (i: number) => void = () => {};

  constructor(root: HTMLElement, waiting = false) {
    this.root = root;
    if (waiting) { this.tiltNow = 90; this.setRise(0); this.waiting = true; document.body.classList.add('montee', 'sans-images'); }   /* en attente : de profil, déjà dessiné sous le cadre (--rise posé dans layout) */
    root.innerHTML = `
      <div class="plane">
        <div class="disc-edge"></div>
        <div class="disc-body">
          <canvas class="face recto"></canvas>
          <canvas class="face verso"></canvas>
        </div>
        <div class="disc-sheen"></div>
      </div>
      <div class="calque shadows"></div>
      <div class="calque cartes"><div class="ring"></div></div>`;
    // fils et images : des calques à plat (2D) ; chaque élément reçoit sa transformation 3D complète (perspective comprise).
    // Aucun calque 3D imbriqué : Safari les aplatissait (les images restaient couchées sur le disque).
    this.body = root.querySelector('.disc-body') as HTMLElement;
    // Safari et Firefox calculent les filtres SVG sur le processeur, à chaque image : quand le disque file, ça saccadait.
    // Chez eux, le flou de vitesse passe par le flou CSS (calculé par la carte graphique) ; Chrome garde le flou directionnel.
    if (!/Chrome|Chromium|Edg\//.test(navigator.userAgent)) document.documentElement.classList.add('flou-css');
    if (!document.getElementById('flou1')) document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${[2, 4.5, 8].map((d, i) => `<filter id="flou${i + 1}" x="-15%" y="0" width="130%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feGaussianBlur stdDeviation="${d} 0"/></filter>`).join('')}</svg>`);
    this.faces = [...root.querySelectorAll('.face')] as HTMLCanvasElement[];
    void urlLisible(FACE).then((u) => this.loadFace(0, u, true));   // ses pixels sont lus (repérage du disque) : adresse lisible partout
    let rz = 0; window.addEventListener('resize', () => { if (!rz) rz = requestAnimationFrame(() => { rz = 0; this.layout(); }); });   // au plus une mise en page par image pendant le redimensionnement

    window.addEventListener('wheel', (e) => {
      if (this.root.hidden || document.body.classList.contains('viewing') || document.body.classList.contains('welcome') || (e.target as HTMLElement).closest('.settings')) return;
      e.preventDefault();
      this.touche();
      const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? -e.deltaX : e.deltaY) * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);   // glisser vers la droite : le disque tourne vers la droite
      this.target = null; this.vel += d * this.gain() * (d < 0 ? 0.55 : 1); // à rebours : le disque résiste
      // un gros coup de molette (pas un petit) : on change de station
      const now = performance.now();
      const fade = Math.exp(-(now - this.burstAt) / 350); this.burstAt = now;
      this.burst = this.burst * fade + Math.max(0, d); this.burstRev = this.burstRev * fade + Math.max(0, -d);
      if (this.burst > 520 && now - this.tunedAt > 1200) { this.tunedAt = now; this.burst = 0; platine.tune(); }              // dans le sens du disque : on change de morceau (un élan moyen suffit)
      if (this.burstRev > 800 && now - this.tunedAt > 1200) { this.tunedAt = now; this.burstRev = 0; platine.scratch(); }   // à rebours : un scratch, le morceau continue
    }, { passive: false });

    let drag: { x: number; y: number; p: number; t: number; moved: boolean; tactile: boolean; lx: number; ly: number; acc: number } | null = null;
    root.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, p: this.pos, t: performance.now(), moved: false, tactile: e.pointerType !== 'mouse', lx: e.clientX, ly: e.clientY, acc: 0 }; this.target = null; this.vel = 0; });
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (e.pointerType === 'mouse' && !e.buttons) { drag = null; return; }   // bouton relâché hors de la fenêtre : on lâche le disque
      const dx = e.clientX - drag.x;
      // au doigt : glisser vers la droite fait tourner le disque dans le sens des aiguilles d'une montre, et glisser vers le
      // haut ou vers le bas le fait tourner aussi (toujours dans son sens), comme une molette
      if (drag.tactile) { drag.acc += (e.clientX - drag.lx) + Math.abs(e.clientY - drag.ly); drag.lx = e.clientX; drag.ly = e.clientY; }
      if (!drag.moved && (Math.abs(dx) > 6 || (drag.tactile && Math.abs(e.clientY - drag.y) > 6))) { drag.moved = true; this.touche(); }
      if (!drag.moved) return;
      const np = drag.tactile ? drag.p + drag.acc / (this.geo.H * 1.7) : drag.p - dx / (this.geo.H * 1.7);
      const now = performance.now();
      this.vel = (np - this.pos) / Math.max(1, (now - drag.t) / 16.7) * 0.6; drag.t = now;
      this.pos = np;
    });
    window.addEventListener('pointercancel', () => { drag = null; });
    window.addEventListener('pointerup', () => {
      const moved = drag?.moved; drag = null;
      if (moved) { root.classList.add('dragged'); setTimeout(() => root.classList.remove('dragged'), 0); }
    });
    root.addEventListener('click', (e) => { if (root.classList.contains('dragged')) { e.stopPropagation(); e.preventDefault(); } }, true);
    this.layout();
  }

  setItems(items: CarouselItem[]) {
    this.items = items;
    const ring = this.root.querySelector('.ring') as HTMLElement, sh = this.root.querySelector('.shadows') as HTMLElement;
    ring.innerHTML = ''; sh.innerHTML = '';
    const dl = items.map(() => (Math.random() * 1.1).toFixed(2) + 's');   // (plus étalé)   // l'arrivée des images : chacune avec un petit décalage au hasard
    this.threads = items.map((_, i) => { const s = document.createElement('div'); s.className = 'thread'; s.style.setProperty('--dl', dl[i]); sh.append(s); return s; });
    this.dots = items.map((_, i) => { const s = document.createElement('div'); s.className = 'anchor'; s.style.setProperty('--dl', dl[i]); sh.append(s); return s; });
    this.cards = items.map((it, i) => {
      const b = document.createElement('button');
      b.className = 'card' + (it.mine ? ' mine' : ''); b.style.setProperty('--dl', dl[i]);
      b.style.setProperty('--a', String(it.aspect));
      b.setAttribute('aria-label', it.label);
      b.dataset.src = it.thumb;
      b.innerHTML = '<span class="pic"></span>';
      b.style.setProperty('--r1', rnd(i, 1).toFixed(3)); 
      b.addEventListener('click', () => this.onOpen(i));
      b.addEventListener('pointerenter', () => { this.hoverTo[i] = 1; });
      b.addEventListener('pointerleave', () => { this.hoverTo[i] = 0; });
      b.addEventListener('focus', () => { if (b.matches(':focus-visible') && Math.abs(this.offset(i)) > 0.5) this.goTo(i); });   // seulement au clavier (Tab) : un clic n'amène pas l'image au centre, le disque ne tourne pas
      ring.append(b);
      return b;
    });
    this.hover = items.map(() => 0); this.hoverTo = items.map(() => 0);
    this.layout();
    this.start();
  }

  goTo(i: number, instant = false) {
    if (!this.items.length) return;
    const t = this.pos + this.offset(i);
    if (instant || reduceMotion) { this.pos = t; this.target = null; } else this.target = t;
    this.vel = 0;
  }
  /** Sensibilité de la molette : plus douce qu'avant, et bien plus encore juste après la sortie d'une image (elle remonte en ~1,4 s). */
  private calmUntil = 0;
  calm(ms = 1400) { this.calmUntil = performance.now() + ms; }
  private gain() {
    const left = Math.max(0, this.calmUntil - performance.now()) / 1400;
    return 0.0009 * (1 - 0.8 * left * left);
  }
  get index() { const n = this.items.length; return n ? ((Math.round(-this.pos) % n) + n) % n : 0; }
  flash(i: number) { const c = this.cards[i]; if (!c) return; c.classList.remove('new'); void c.offsetWidth; c.classList.add('new'); }
  step(d: number) { const n = this.items.length; this.goTo(((Math.round(-this.pos) + d) % n + n) % n); }

  /** Écart (en « pas » moyens de la bande) entre l'image i et le centre. La bande avance d'un mouvement uniforme. */
  private offset(i: number) {
    const n = this.items.length; if (!n || !this.xs.length) return 0;
    const avg = this.xsLen / n;
    let d = (-this.xs[i] / avg - this.pos) % n; if (d > n / 2) d -= n; if (d < -n / 2) d += n;
    return d;
  }

  private layout() {
    const vw = innerWidth, vh = innerHeight;
    const portrait = vh > vw * 1.2;
    const top = portrait ? vh * 1.04 : vh * 1.1;   // téléphone en hauteur : le disque un peu plus bas à l'écran…
    const D = fitDisc(vw, vh, top) * (portrait ? 1.3 : 1);   // …et plus grand (il déborde des coins bas) ; ailleurs, il touche pile les deux coins bas de l'écran
    const H = Math.round(Math.max(110, Math.min(vh * 0.31, vw * (portrait ? 0.46 : 0.265))));   // un peu plus petites : tout tient sous le titre
    const R = D / 2 * 0.8;
    const step = (H * 1.4 + H * 0.22) / R;   // rotation du disque par image ≈ écart moyen entre deux images
    this.geo = { vw, vh, D, R, H, step };
    if (this.items.length) this.computeBand();
    const s = this.root.style;
    s.setProperty('--D', D + 'px'); s.setProperty('--H', H + 'px'); s.setProperty('--pad', PAD + 'px'); s.setProperty('--cap', CAP + 'px');
    s.setProperty('--tilt', this.tiltNow + 'deg');
    if (this.waiting) this.setRise(D * 0.55);   // exactement là où la montée commencera : rien à recalculer au moment crucial
    for (const pl of this.root.querySelectorAll<HTMLElement>('.plane, .calque')) { pl.style.left = vw / 2 + 'px'; pl.style.top = top + 'px'; }
    this.planeTop = top;
    const br = document.querySelector('.brand')?.getBoundingClientRect();
    this.ceil = br && br.height ? br.bottom + 8 : 84;      // les images ne montent pas plus haut que le bas du titre
    for (let i = 0; i < this.faces.length; i++) this.drawFace(i);
  }

  /** Arrivée depuis l'accueil : le disque, de profil, bascule vers nous jusqu'à sa position,
   *  en tournant vite sur lui-même, puis ralentit tranquillement jusqu'à sa vitesse habituelle. */
  private tiltNow = TILT;
  private lastRate = -1; private burst = 0; private burstRev = 0; private burstAt = 0; private tunedAt = 0; private lastPos = 0;
  private tiltFrom = 0;
  private waiting = false;
  private riseNow = 0;
  private setRise(px: number) { this.riseNow = px; this.root.style.setProperty('--rise', px.toFixed(1) + 'px'); }
  private boost = 0;
  private plat = false;
  private sortie: TrouFace | null = null; private sortieDe = 0;   // l'apparition : il naît de son centre (l'inverse de l'aspiration)
  private vLisse = 0; private niveauFlou = 0;
  arrive(spinDeg = 110, plat: { ang: number } | null = null) {
    if (reduceMotion) { this.waiting = false; this.tiltNow = TILT; this.setRise(0); this.layout(); document.body.classList.remove('montee', 'sans-images'); this.root.style.setProperty('--tilt', TILT + 'deg'); return; }
    this.waiting = false; this.tiltFrom = performance.now(); this.arriveA = performance.now();
    // (plus de son à l'apparition du grand disque, ni d'effet de trou noir)
    // le disque de l'accueil (en 3D) s'est posé exactement ici : le grand disque prend sa place, déjà incliné, au même angle
    this.plat = !!plat;
    if (plat && this.sortie) { this.tiltNow = TILT; this.root.style.setProperty('--tilt', TILT + 'deg'); this.setRise(0); }
    if (plat && !this.sortie) {
      this.tiltNow = TILT; this.root.style.setProperty('--tilt', TILT + 'deg'); this.setRise(0);
      const n = this.items.length || 1, a = (SPIN_A * plat.ang + SPIN_B) * Math.PI / 180 / Math.max(1e-3, this.geo.step);
      this.pos = a - Math.round(a / n) * n; this.lastPos = this.pos; this.target = null; this.place(performance.now() / 1000);
    }
    // même vitesse de rotation propre que le petit disque à l'instant où il a disparu (comme si la caméra s'était juste déplacée)
    this.boost = Math.max(0, spinDeg * Math.PI / 180 / Math.max(1e-3, this.geo.step) - IDLE_SPEED);
  }
  /**
   * L'invitation à tourner le disque : tant que personne n'y a touché, une petite indication apparaît sur le disque
   * (un arc fléché, « Faites défiler ou glissez pour tourner le disque »), et de temps en temps le disque reçoit une
   * légère poussée, comme une main qui le lance pour montrer le geste. Au premier défilement ou glissement, tout s'arrête.
   */
  private arriveA = 0; private touchePas = true; private indice: HTMLElement | null = null; private prochainElan = 0;
  private touche() {
    if (!this.touchePas) return;
    this.touchePas = false;
    const el = this.indice; this.indice = null;
    if (el) { el.classList.remove('on'); setTimeout(() => el.remove(), 900); }
  }
  private inviter(now: number) {
    if (!this.touchePas || reduceMotion) return;
    const visible = !this.root.hidden && !document.body.classList.contains('viewing') && !document.body.classList.contains('welcome');
    if (!this.indice) {
      const tactile = matchMedia('(hover: none)').matches;
      const el = document.createElement('div'); el.className = 'tourner-indice'; el.setAttribute('aria-hidden', 'true');
      // un arc fin qui suit le bord du disque (bombé vers le haut) et une pointe dans le sens où il tourne (vers la droite)
      el.innerHTML = `<svg viewBox="0 0 140 30"><path class="arc" d="M10 26 Q70 -2 130 26"/><path class="pointe" d="M124.8 18.6 L130 26 L121 26.8"/><circle class="bille" r="1.8" opacity="0"><animateMotion dur="1.6s" begin="indefinite" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".25 .1 .25 1" path="M10 26 Q70 -2 130 26"/><animate attributeName="opacity" dur="1.6s" begin="indefinite" fill="freeze" values="0;1;1;0" keyTimes="0;.12;.85;1"/></circle></svg>
        <span>${tactile ? t({ en: 'Drag to turn the record', fr: 'Glissez pour tourner le disque' }) : t({ en: 'Scroll or drag to turn the record', fr: 'Faites défiler ou glissez pour tourner le disque' })}</span>`;
      document.body.append(el); this.indice = el;
      this.prochainElan = now + 1200;
    }
    this.indice.classList.toggle('on', visible);
    if (visible && now >= this.prochainElan) {   // la poussée, en même temps que la bille parcourt l'arc
      this.prochainElan = now + 6500;
      // (plus de poussée : elle faisait une saccade ; le disque tourne déjà seul, le point sur l'arc suffit)
      for (const an of this.indice.querySelectorAll<SVGAnimationElement>('.bille > *')) { try { an.beginElement(); } catch { /* SVG animé indisponible */ } }
    }
  }
  start() { if (this.running) return; this.running = true; this.last = performance.now(); requestAnimationFrame(this.frame); }

  private frame = (now: number) => {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const cl = document.body.classList;
    const cache = cl.contains('welcome') && !cl.contains('prechauffe');   // pendant l'accueil le disque est invisible : rien à calculer (il se prépare juste avant la fin)
    if (!this.root.hidden && !cache) {
      if (this.target !== null) {
        const d = this.target - this.pos;
        this.pos += d * (1 - Math.pow(0.0005, dt));
        if (Math.abs(d) < 0.002) { this.pos = this.target; this.target = null; }
      } else {
        // inertie : lancé dans son sens, il file longtemps ; freiné ou tourné à l'envers, le moteur le ramène
        // plus fermement vers son allure (comme un plateau qu'on retient à la main), sans à-coup
        if (this.vel < 0) this.vel = Math.max(this.vel, -0.06);
        this.pos += this.vel * dt * 60; this.vel *= Math.pow(this.vel < 0 ? 0.008 : 0.04, dt);   // (même élan quel que soit le nombre d'images par seconde : 60, 120 Hz ou un navigateur plus lent)
        this.pos += this.boost * dt; this.boost *= Math.pow(0.45, dt);   // élan de l'accueil, qui s'éteint doucement
        if (!reduceMotion) this.pos += IDLE_SPEED * dt;   // rotation minimale constante (= lecture ×1), toujours
      }
      if (this.sortie) {
        const u = Math.min(1, Math.max(0, (now - this.sortieDe) / 1000 / APPARITION)), e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);   // départ doux, élan, arrivée douce
        this.sortie.dessiner(e);
        const ed = String(Math.min(1, Math.max(0, (e - 0.65) / 0.35)));
        for (const el of this.root.querySelectorAll<HTMLElement>('.disc-edge, .disc-sheen')) el.style.opacity = ed;
        if (u >= 1) { this.sortie.detruire(); this.sortie = null; this.faces[0].style.visibility = ''; for (const el of this.root.querySelectorAll<HTMLElement>('.disc-edge, .disc-sheen')) el.style.opacity = ''; }
      }
      if (this.tiltFrom) {
        // arrivée : il est sur sa tranche, comme le petit disque à l'instant où il a disparu, et continue
        // le même basculement (même vitesse au départ) jusqu'à sa position, en ralentissant doucement
        // et il arrive par le bas, au même instant, dans le même élan
        const s = (now - this.tiltFrom) / 1000, tau = 0.6, k = Math.exp(-s / tau);
        { const g = Math.exp(-s / 0.45); this.root.style.setProperty('--sc', (1 - 0.42 * g).toFixed(4)); }   // il arrive plus petit et grossit jusqu'à sa taille
        if (!this.plat) {
          this.tiltNow = 90 + (TILT - 90) * (1 - k);
          this.root.style.setProperty('--tilt', this.tiltNow.toFixed(2) + 'deg');
          this.setRise(this.geo.D * 0.55 * k);
        }
        if (s > 0.9 && document.body.classList.contains('montee')) document.body.classList.remove('montee');   // puis images, fils, titre et boutons apparaissent
        if (s > 1.8 && document.body.classList.contains('sans-images')) { document.body.classList.add('images-decalees'); document.body.classList.remove('sans-images');
          // chaque image visible apparaît avec son petit souffle, au même décalage que son fondu, placé à sa position gauche/droite
          const vis = this.cards.filter((c) => c.style.display === 'block');
          // (plus de son à l'apparition des images ici)
          setTimeout(() => document.body.classList.remove('images-decalees'), 2800); }   // le disque est en place : les images apparaissent ensuite, en fondu
        if (s > 5) { this.root.style.setProperty('--sc', '1'); this.tiltFrom = 0; this.tiltNow = TILT; this.root.style.setProperty('--tilt', TILT + 'deg'); this.setRise(0); }
      }
      // la musique suit la rotation : vitesse habituelle = lecture normale
      // la musique : ×1 dans une large marge (on peut faire défiler doucement sans rien changer) ;
      // vraiment lancé, elle accélère et monte ; retenu à rebours, elle ralentit et descend, comme sous la main
      const v = (this.pos - this.lastPos) / Math.max(dt, 1e-3); this.lastPos = this.pos;   // images/s, + = sens du disque
      // flou de vitesse : quand le disque est lancé très vite, les images filent (3 niveaux fixes, rien de recalculé à chaque image)
      this.vLisse += (Math.abs(v) - this.vLisse) * Math.min(1, dt * 8);
      const nf = this.vLisse < 2.2 ? 0 : this.vLisse < 4 ? 1 : this.vLisse < 7 ? 2 : 3;
      if (nf !== this.niveauFlou) { this.root.classList.remove('flou-' + this.niveauFlou); if (nf) this.root.classList.add('flou-' + nf); this.niveauFlou = nf; }
      const r = v >= 0 ? 1 + 0.2 * Math.log2(1 + Math.max(0, v - 4) / 14) : 1 - 0.24 * (1 - Math.exp(-Math.max(0, -v - 0.8) / 2.4));   // (moins sensible : il faut vraiment lancer le disque pour déformer le son)   // progressif : pas de seuil, le son se transforme peu à peu
      const rr = Math.max(0.4, Math.min(2.4, r));
      if (!document.body.classList.contains('welcome') && Math.abs(rr - this.lastRate) > 0.002) { this.lastRate = rr; platine.setSpeed(rr); }   // seulement quand la vitesse change vraiment
      this.place(now / 1000);
      if (this.touchePas && !this.tiltFrom && !cl.contains('montee') && !cl.contains('sans-images') && (this.arriveA && now - this.arriveA > 4200)) this.inviter(now);
    }
    requestAnimationFrame(this.frame);
  };

  /** Rangée de l'image (0 : basse, 1 : haute), stable. */
  private row(i: number) { return (i + (rnd(i, 6) < 0.22 ? 1 : 0)) % 2; }
  private xs: number[] = [];
  private planeTop = 0;
  private ceil = 84;
  private hover: number[] = [];
  private hoverTo: number[] = [];
  private hs: number[] = [];
  private ws: number[] = [];
  private xsLen = 1;
  /** Positions le long de la bande : deux rangées qui se chevauchent en largeur, jamais dans une même rangée. */
  private computeBand() {
    const n = this.items.length, H = this.geo.H, gap = H * 0.12;   // plus d'images à la fois
    // tailles harmonisées : même surface pour toutes les images, quel que soit leur format
    this.hs = this.items.map((it) => H * Math.sqrt(1.2 / (it.aspect || 1.5)));
    this.hs.forEach((h, i) => this.cards[i]?.style.setProperty('--ch', h.toFixed(1) + 'px'));
    const w = (i: number) => this.hs[i] * (this.items[i].aspect || 1.5);
    this.ws = this.items.map((_, i) => w(i));
    const end = [-Infinity, -Infinity];
    this.xs = new Array(n);
    let x = 0;
    for (let i = 0; i < n; i++) {
      const r = this.row(i), half = w(i) / 2;
      x = i === 0 ? 0 : Math.max(x + (w(i - 1) / 2 + half) * 0.46, end[r] + gap + half);   // jamais deux images serrées
      this.xs[i] = x; end[r] = x + half;
    }
    this.xsLen = Math.max(end[0], end[1]) + gap + w(0) / 2;
    this.geo.step = this.xsLen / n / this.geo.R;          // le disque tourne d'autant que la bande avance
  }

  /** Décalage d'une image depuis la courbe : le long de la normale à la courbure du disque (vers le haut
   *  et vers l'extérieur), si bien que sur les côtés les images partent vers les coins en suivant le disque.
   *  La rangée haute s'écarte juste assez pour ne jamais toucher les images basses voisines. */
  private offsetOf(i: number, xi: number, ct: number, Rb: number, L: number): [number, number] {
    const H = this.geo.H, gap = H * 0.14;
    const Rc = Rb * CURVE, curve = (x: number): [number, number] => [x, (-Rb + (x * x) / (2 * Rc)) * ct];
    const normal = (x: number): [number, number] => { const sl = (x * ct) / Rc, k = Math.hypot(sl, 1); return [sl / k, -1 / k]; };
    const low = (j: number) => H * (0.3 + 0.18 * rnd(j, 1));   // rangée basse : plus haut, moins sur le disque
    const ni = normal(xi);
    let d = this.row(i) ? H * (0.6 + 0.18 * rnd(i, 1)) : low(i);
    if (this.row(i)) {
      const n = this.items.length, shift = xi - this.xs[i], ti: [number, number] = [-ni[1], ni[0]];
      const pi = curve(xi), ci: [number, number] = [pi[0], pi[1] - this.hs[i] / 2];
      for (let k = -4; k <= 4; k++) {
        const j = (i + k + n) % n;
        if (j === i || this.row(j)) continue;
        let xj = this.xs[j] + shift; xj -= Math.round((xj - xi) / L) * L;
        const pj = curve(xj), nj = normal(xj), lj = low(j);
        const cj: [number, number] = [pj[0] + nj[0] * lj, pj[1] + nj[1] * lj - this.hs[j] / 2];
        const dx = ci[0] - cj[0], dy = ci[1] - cj[1];
        const ext = (w: number, h: number, v: [number, number]) => w * Math.abs(v[0]) + h * Math.abs(v[1]);
        const need = (ext(this.ws[i], this.hs[i], ni) + ext(this.ws[j], this.hs[j], ni)) / 2 + gap - (dx * ni[0] + dy * ni[1]);
        const sepT = Math.abs(dx * ti[0] + dy * ti[1]) - (ext(this.ws[i], this.hs[i], ti) + ext(this.ws[j], this.hs[j], ti)) / 2;
        const s = 1 - Math.min(1, Math.max(0, (sepT - gap) / (H * 0.8)));   // s'écarte en douceur à l'approche
        d = Math.max(d, need * s * s * (3 - 2 * s));
      }
    }
    return [ni[0] * d, -ni[1] * d];
  }

  /** Taille à l'écran : la perspective grossit les images qui arrivent sur les côtés (plus près de nous) ;
   *  on compense, et on les rend même un peu plus petites vers les bords de l'écran. */
  private sideScale(x: number, y: number, st: number) {
    const P = 1150;                                          // perspective de .stage
    const near = P / Math.max(200, P - y * st);              // grossissement dû à la perspective
    const u = Math.min(1, Math.abs(x) / (this.geo.vw / 2));
    const near0 = P / Math.max(200, P + this.geo.R * 0.74 * st);   // au centre : taille inchangée
    return (1 - 0.28 * u * u) * near0 / near;
  }

  private place(_t: number) {
    const { R, H, step, D } = this.geo, deg = 180 / Math.PI, n = this.items.length;
    if (!n) return;
    const spin = this.pos * step;                        // rotation du disque (radians), liée aux images et à leurs fils ; sens horaire
    this.body.style.setProperty('--spin', `${(spin * deg).toFixed(3)}deg`);
    const tilt = TILT * Math.PI / 180, ct = Math.cos(tilt), st = Math.sin(tilt);
    // tailles fixes par image (rien ne grossit ni ne flotte : stable)
    const X = this.xs, L = this.xsLen;
    // la bande avance d'un mouvement uniforme (aucun « aimant » au passage du centre), au rythme du disque
    const xpos = -this.pos * (L / n);
    // la même transformation que le plan du disque (montée + inclinaison), sous la même perspective que la scène
    const Px = this.geo.vw / 2 - this.geo.vw / 2, Py = this.geo.vh * 0.3 - this.planeTop;
    const tn = this.tiltNow;
    // projection faite ici, en 2D : chaque image reste face à nous, donc son image à l'écran n'est qu'un
    // déplacement + une échelle. Aucun calcul 3D laissé au navigateur pour les images et les fils : même rendu
    // partout, pas de tuiles manquantes ni de clignotement (Safari comme Chrome).
    const th0 = tn * Math.PI / 180, cT = Math.cos(th0), sT = Math.sin(th0), PERS = 1150, rise = this.riseNow;
    const proj = (px: number, py: number, pz: number): [number, number, number] => {
      const Y = py * cT - pz * sT + rise, Z = py * sT + pz * cT, k = PERS / Math.max(PERS / 3, PERS - Z);   // (au-delà, le point serait derrière nous : jamais à l'écran)
      return [Px + px * k, Py + (Y - Py) * k, k];
    };
    const lim = this.geo.vw / 2 + H * 2.4;     // au-delà : hors de l'écran
    for (let i = 0; i < n; i++) {
      const c = this.cards[i], th = this.threads[i], dot = this.dots[i];
      let xi = X[i] - xpos; xi -= Math.round(xi / L) * L;
      if (c.dataset.src && Math.abs(xi) < lim * 1.8) {   // l'image est chargée et décodée AVANT d'entrer à l'écran : elle n'apparaît jamais à moitié
        // dessinée une fois pour toutes dans un canevas : son contenu reste en mémoire (une <img> cachée puis réaffichée
        // pouvait être redécodée par le navigateur : image absente un instant = clignotement, fil sans image)
        const img = new Image(), pic = c.querySelector('.pic')!; img.src = c.dataset.src; delete c.dataset.src;
        img.decode().then(() => {
          const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
          cv.getContext('2d')!.drawImage(img, 0, 0); pic.append(cv); if (flouPrecalc) pic.append(flouHorizontal(img)); c.dataset.pret = '1';
        }).catch(() => { c.dataset.pret = '1'; });
      }
      if (Math.abs(xi) > lim || !c.dataset.pret) {   // hors champ, ou image pas encore prête : ni l'image, ni son fil
        if (c.style.display !== 'none') { c.style.display = 'none'; th.style.display = 'none'; dot.style.display = 'none'; }
        continue;
      }
      if (c.style.display !== 'block') {
        c.style.display = 'block'; th.style.display = 'block'; dot.style.display = 'block';
      }
      this.hover[i] += (this.hoverTo[i] - this.hover[i]) * 0.18;   // léger grossissement au survol
      const s = this.sideScale(xi, -R * 0.74 + (xi * xi) / (2 * R * 0.74 * CURVE), st) * (1 + 0.07 * this.hover[i]), e = Math.abs(xi) < (L / n) * 0.5 ? 1 : 0;
      // trajectoire douce (arc de parabole), sans à-coup aux bords de l'écran
      const Rb = R * 0.74, y = -Rb + (xi * xi) / (2 * Rb * CURVE);   // plus près du centre du disque ; suit sa courbure jusqu'hors de l'écran
      const [ox, oy] = this.offsetOf(i, xi, ct, Rb, L);   // deux rangées qui ne se touchent jamais, le long de la courbure
      // la perspective écarte les images sur les côtés (plus près de nous) : on resserre d'autant
      const Pp = 1150, comp = (Pp / Math.max(200, Pp + Rb * st)) / (Pp / Math.max(200, Pp - y * st));
      const x = (xi + ox) * comp;
      // plafond : le haut de l'image ne dépasse pas le bas du titre
      const P = 1150, f = P / Math.max(200, P - y * st), py0 = this.geo.vh * 0.3;
      const room = (this.planeTop + y * ct - py0) - (this.ceil - py0) / f;          // hauteur libre sous le titre
      let sc = s;
      if (oy + this.hs[i] * sc > room) sc = Math.max(s * 0.6, (room - oy) / this.hs[i]);   // trop haut : l'image rapetisse au lieu de descendre sur sa voisine
      const lift = Math.max(0, Math.min(oy, room - this.hs[i] * sc));
      const fwd = 0;
      // le bas de l'image (point d'attache), relevé de « lift » face à nous
      const [bx, bY, bk] = proj(x, y - lift * cT + fwd * sT, lift * sT + fwd * cT);
      c.style.transform = `translate(${bx.toFixed(2)}px, ${bY.toFixed(2)}px) scale(${(sc * bk).toFixed(4)})`;
      const zi = String(1000 + Math.round(y)); if (c.style.zIndex !== zi) c.style.zIndex = zi;   // la plus proche (plus bas à l'écran) passe devant
      c.classList.toggle('au-centre', e > 0.5);   // (ne jamais l'appeler « top » : c'est la classe de la barre du haut, ses styles s'appliquaient à l'image → sauts et clignotements)
      // le fil : du bas de l'image vers un point fixé SUR le disque (il tourne exactement avec lui)
      const rq = (0.62 + 0.34 * rnd(i, 4)) * D / 2, aq = xi / R + (rnd(i, 5) - 0.5) * step * 0.8;   // tourne exactement avec le disque
      const qx = rq * Math.sin(aq), qy = -rq * Math.cos(aq);
      const [ax, aY, ak] = proj(qx, qy, 0.5);              // l'attache sur le disque
      const vx = bx - ax, vy = bY - aY, vl = Math.hypot(vx, vy) || 1;
      th.style.transform = `matrix(${(FIL * vy / vl).toFixed(4)}, ${(-FIL * vx / vl).toFixed(4)}, ${(vx / 1000).toFixed(5)}, ${(vy / 1000).toFixed(5)}, ${ax.toFixed(2)}, ${aY.toFixed(2)})`;   // un trait de 1 px (fil de 1000 px de haut, mis à la longueur) de l'attache au bas de l'image
      dot.style.transform = `translate(${ax.toFixed(2)}px, ${aY.toFixed(2)}px) scale(${ak.toFixed(3)})`;
    }
  }

  // ─── les faces du disque ─────────────────────────────────────────────────────
  private photos: (HTMLImageElement | null)[] = [null, null];
  private crops: ([number, number, number, number] | null)[] = [null, null];

  private loadFace(k: number, src: string, verso = false) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      this.photos[k] = img;
      let cr = findDisc(img);
      if (verso) {
        // la photo est légèrement excentrée : on tourne autour du centre des sillons (mesuré sur l'étiquette
        // et l'anneau qui l'entoure), pas autour du centre de l'image — le disque ne « bat » plus en tournant
        // (la photo a depuis été recentrée sur le trou : son centre est celui de l'image, comme pour le disque de l'accueil)
        // on tourne autour du centre des sillons (mesuré : 8 et 16 px de 2048 à côté du trou), sinon le disque tourne « de travers »
        const k = img.naturalWidth / 2048, cx = img.naturalWidth / 2 + 8 * k, cy = img.naturalHeight / 2 + 16 * k;
        // le bord de la photo n'est pas tout à fait concentrique au trou (il recule d'environ 1,6 % en haut à gauche) : on cadre
        // un peu à l'intérieur, pour que le contour du disque soit un cercle parfait centré sur le trou
        const sd = Math.min(cr[2], cr[3], 2 * (img.naturalWidth / 2 - 16 * k)) * 0.984;
        cr = [cx - sd / 2, cy - sd / 2, sd, sd];
      }
      this.crops[k] = cr; this.drawFace(k);
    };
    img.onerror = () => this.drawFace(k);
    img.src = src;
  }

  private drawFace(k: number) {
    const c = this.faces[k], D = this.geo.D;
    const px = k === 1 ? 64 : Math.min(2048, Math.round(D * Math.min(devicePixelRatio || 1, 1.5)));   // la face arrière n'est jamais visible : inutile de la peindre en grand
    if (c.width !== px) c.width = c.height = px;
    const g = c.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, px, px);
    g.save(); g.beginPath(); g.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2); g.clip();
    const p = this.photos[k], cr = this.crops[k];
    if (p && cr) { g.imageSmoothingQuality = 'high'; g.drawImage(p, cr[0], cr[1], cr[2], cr[3], 0, 0, px, px); }
    else paintDisc(g, px, k === 1);
    g.restore();
  }
}

/** Repère le disque dans la photo : la plus grande zone qui se détache du fond (mesuré sur les bords). */
function findDisc(img: HTMLImageElement): [number, number, number, number] {
  const s = 256, k = s / Math.max(img.naturalWidth, img.naturalHeight);
  const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  let br = 0, bg = 0, bb = 0, ne = 0;
  const addEdge = (x: number, y: number) => { const i = (y * w + x) * 4; br += d[i]; bg += d[i + 1]; bb += d[i + 2]; ne++; };
  for (let x = 0; x < w; x++) { addEdge(x, 0); addEdge(x, h - 1); }
  for (let y = 0; y < h; y++) { addEdge(0, y); addEdge(w - 1, y); }
  br /= ne; bg /= ne; bb /= ne;
  const rows = new Array(h).fill(0), cols = new Array(w).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg) + Math.abs(d[i + 2] - bb) > 75) { rows[y]++; cols[x]++; }
  }
  const span = (a: number[], n: number) => { const m = Math.max(...a) * 0.08; let lo = 0, hi = n - 1; while (lo < n && a[lo] <= m) lo++; while (hi > 0 && a[hi] <= m) hi--; return [lo, hi]; };
  const [x0, x1] = span(cols, w), [y0, y1] = span(rows, h);
  const size = Math.max(x1 - x0, y1 - y0) + 1, cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2;
  if (size < s * 0.3 || size > s * 1.05) { const m = Math.min(img.naturalWidth, img.naturalHeight); return [(img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m]; }
  return [(cx - size / 2) / k, (cy - size / 2) / k, size / k, size / k];
}

/** En attendant les photos : un disque d'or peint (sillons, étiquette, trou). */
function paintDisc(g: CanvasRenderingContext2D, px: number, back: boolean) {
  const r = px / 2;
  g.translate(r, r);
  const base = g.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.05, 0, 0, r);
  base.addColorStop(0, back ? '#d9c27f' : '#f3dc9c'); base.addColorStop(0.45, '#c9a256'); base.addColorStop(0.85, '#8d6a2c'); base.addColorStop(1, '#5d4419');
  g.fillStyle = base; g.fillRect(-r, -r, px, px);
  let seed = back ? 11 : 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (!back) for (let rr = r * 0.36; rr < r * 0.975; rr += Math.max(1, px / 900)) {
    g.strokeStyle = `rgba(${rnd() > 0.5 ? '40,28,8' : '255,240,200'},${(0.04 + rnd() * 0.07).toFixed(3)})`;
    g.lineWidth = Math.max(0.6, px / 1800);
    g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.stroke();
  }
  g.fillStyle = '#a07d39'; g.beginPath(); g.arc(0, 0, r * (back ? 0.9 : 0.33), 0, Math.PI * 2); g.fill();
  g.fillStyle = '#050505'; g.beginPath(); g.arc(0, 0, r * 0.04, 0, Math.PI * 2); g.fill();
}

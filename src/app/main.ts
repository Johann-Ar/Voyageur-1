/**
 * VOYAGEUR 1 — la page.
 * Deux vues des mêmes images : le disque (par défaut, après l'accueil) et la galerie (ordre au hasard,
 * tiré à chaque ouverture). Un clic ouvre l'image en volume.
 */
import { chemin, donnee } from './res.ts';
import { loadArchives, loadBitmap, bitmapToRGBA, type Archive } from './data.ts';
import { bitmapToBlob } from './exports.ts';
import { Viewer, levelById } from './viewer.ts';
import { DiscCarousel } from './carousel.ts';
import { paintSpace, twinkle } from './space.ts';
import { prelude } from './prelude.ts';
import { welcome, spinNear, lastSpin, posePlat } from './welcome.ts';
import { outilRognage } from './rognage.ts';
import { platine } from './audio.ts';
import { refletIcones } from './reflet.ts';
import { loadSettings, buildSettingsPanel, type Settings } from './settings.ts';
import { lossFromTraces, detectAxis, type LossMap } from './loss.ts';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const stage = $('#stage'), grid = $('#grid'), viewerEl = $('#viewer'), status = $('#status');

type Item = { kind: 'archive'; id: string; a: Archive; aspect: number };

let items: Item[] = [];
let current = -1;
let currentBitmap: ImageBitmap | null = null;
const busy = false;
const settings: Settings = loadSettings();
const viewer = new Viewer($<HTMLCanvasElement>('#scene'), settings);
viewer.autoMotion = settings.motion;
const lossCache = new Map<string, LossMap>();

// ─── grille ───────────────────────────────────────────────────────────────────
function thumbSrc(it: Item): string {
  return chemin(`thumbs/${it.id}.jpg`);
}

// deux affichages : la grille (par défaut) ou le disque (option)
type Vue = 'grille' | 'disque';
let vue: Vue = (() => { try { return localStorage.getItem('voyageur-vue') === 'disque' ? 'disque' : 'grille'; } catch { return 'grille'; } })();
let carousel: DiscCarousel | null = null;
const vueBtn = $<HTMLButtonElement>('#vue-btn');
function setVue(v: Vue, garde = false) {
  vue = v;
  try { localStorage.setItem('voyageur-vue', v); } catch { /* stockage indisponible */ }
  document.body.classList.toggle('vue-disque', v === 'disque');
  if (v === 'grille') { grid.hidden = false; if (!garde) stage.hidden = true; } else { stage.hidden = false; if (!garde) grid.hidden = true; }   // garde : l'autre vue reste le temps du fondu
  vueBtn.setAttribute('aria-pressed', String(v === 'disque'));
  vueBtn.setAttribute('aria-label', v === 'disque' ? 'Afficher la grille' : 'Afficher le disque');
  if (v === 'disque' && !carousel) { carousel = new DiscCarousel(stage, carouselArrive && document.body.classList.contains('welcome')); carousel.onOpen = (i) => open(i); }
  renderGrid();
}
let switching = false;
vueBtn.addEventListener('click', async () => {
  if (switching) return; switching = true;
  try {
  const frame2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  if (vue === 'disque') {
    // la galerie se pose par-dessus le disque : son fond noir apparaît et le cache, le disque ne disparaît pas
    melanger(); grid.classList.add('cache', 'bascule');
    setVue('grille', true);
    // les premières vignettes sont décodées AVANT le fondu : il ne saccade pas
    const imgs = [...grid.querySelectorAll('img')].slice(0, 30) as HTMLImageElement[];
    await Promise.race([Promise.allSettled(imgs.map((im) => im.decode())), wait(700)]);
    for (const c of grid.children) c.classList.add('in');
    await frame2(); grid.classList.remove('cache');
    await wait(950); grid.classList.remove('bascule'); if ((vue as Vue) === 'grille') stage.hidden = true;
  } else {
    // la galerie s'efface et découvre le disque, resté à sa place
    const y = scrollY;
    grid.classList.add('bascule');
    setVue('disque', true);
    grid.style.transform = `translateY(${scrollY - y}px)`;   // si le défilement est remis à zéro, la galerie reste quand même où elle était pendant qu'elle s'efface
    await frame2(); grid.classList.add('cache');
    await wait(950); if ((vue as Vue) === 'disque') grid.hidden = true; grid.classList.remove('cache', 'bascule'); grid.style.transform = '';
  }
  } finally { switching = false; }   // une erreur ne bloque jamais le bouton
});

// la galerie s'affiche dans un ordre au hasard, tiré de nouveau à chaque ouverture de la vue
let ordre = new Map<string, number>();
function melanger() { ordre = new Map(items.map((it) => [it.id, Math.floor(Math.random() * 1e6)])); }
function rang(id: string) { let r = ordre.get(id); if (r === undefined) { r = Math.floor(Math.random() * 1e6); ordre.set(id, r); } return r; }

function renderGrid() {
  if (vue === 'disque') { renderDisc(); return; }
  grid.innerHTML = '';
  items.forEach((it, i) => {
    const b = document.createElement('button');
    b.className = 'cell';
    b.style.setProperty('--a', String(it.aspect));
    b.style.setProperty('--i', String(Math.min(i, 40)));
    b.style.order = String(rang(it.id));   // affichage dans un ordre au hasard
    b.setAttribute('aria-label', `Image ${it.a.position} du disque`);
    const img = document.createElement('img');
    img.src = thumbSrc(it); img.alt = ''; img.loading = i < 24 ? 'eager' : 'lazy'; img.decoding = 'async';
    img.onload = () => b.classList.add('in');
    b.append(img);
    b.addEventListener('click', () => open(i));
    grid.append(b);
  });
  const filler = document.createElement('span'); filler.className = 'filler'; grid.append(filler);
}

function titleOf(it: Item) {
  return `${String(it.a.position).padStart(3, '0')} — ${it.a.titre_fr || it.a.titre_en}`;
}

function renderDisc() {
  carousel?.setItems(items.map((it) => ({
    id: it.id, thumb: thumbSrc(it), aspect: it.aspect, mine: false,
    label: `Image ${it.a.position} du disque`,
    title: titleOf(it),
  })));
}

// ─── visionneuse ──────────────────────────────────────────────────────────────
async function bitmapOf(it: Item): Promise<ImageBitmap> {
  return loadBitmap(it.a.fichier_decode);
}

// ─── image agrandie : l'image cliquée grossit au centre, sans quitter l'accueil ──────
let carouselArrive = false;   // le disque attend la fin de l'accueil (de profil, invisible)
let focused = -1;          // image agrandie (−1 : aucune)
let moving = 0;            // transitions en cours

function showViewer() {
  document.body.classList.add('viewing');
  if (viewerEl.hidden) { viewerEl.hidden = false; viewer.start(); }
}

/** Ouvre l'image i (si une autre est ouverte, elle retourne à sa place pendant que i grossit). */
async function open(i: number, rotate = false) {
  if (busy || moving > 0 || !items.length) return;
  i = (i + items.length) % items.length;
  if (i === focused) return;
  const prev = focused;
  if (rotate) carousel?.goTo(i);           // le disque continue de tourner : l'image suivante passe au centre
  if (prev >= 0 && !viewerEl.hidden) {     // changement d'image (flèches) : la précédente rentre dans sa plaque, à l'envers de son apparition
    platine.effet('disparition', 0, 0, 1, 0.9);   // la précédente rentre dans sa plaque : même durée que son animation
    moving++; try { await viewer.vanish(); } finally { moving--; }
  }
  await enter(i, 0);
}

const FADE = 450;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** L'image i apparaît en volume, au premier plan, sans bouger l'interface du disque. */
async function enter(i: number, delay: number) {
  moving++;
  focused = current = i;
  const it = items[i];
  try {
    const bmp = await bitmapOf(it);
    if (delay) await wait(delay);
    if (focused !== i) return;
    const old = currentBitmap; currentBitmap = bmp;
    viewer.resetView();                   // chaque image repart de face
    viewer.resetFly();
    // tout le calcul (niveaux, splats, plaque) se fait AVANT d'afficher : l'apparition ne saccade plus
    await showImage(bmp, true, it);        // apparition : les splats se condensent (pas de fondu)
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    showViewer();
    viewerEl.classList.add('on');
    platine.effet('apparition', 0, 0, 1, 1.0);   // pile quand le volume se condense (≈ 1 s), pas au clic
    if (old && old !== bmp) old.close();   // libère l'image précédente (mémoire)
  } catch (e) { say('Cette image ne peut pas s’afficher.'); console.error(e); if (focused === i) focused = current = -1; }   // on pourra la rouvrir
  finally { moving--; }
}

/** L'image disparaît en fondu. `swap` : une autre va apparaître à sa place. */
async function leave(_i: number, swap = false) {
  moving++;
  if (!swap) { focused = -1; document.body.classList.remove('viewing'); }
  await viewer.vanish();                 // l'apparition à l'envers
  viewerEl.classList.remove('on');
  await wait(FADE);
  viewer.clear();
  if (!swap && focused < 0) { current = -1; viewerEl.hidden = true; viewer.stop(); }
  moving--;
}

function closeViewer(byScroll = false) {
  if (busy || moving > 0 || focused < 0) return;   // pas pendant qu'une image arrive ou part
  const i = focused;
  platine.effet('disparition', 0, 0, 1, 0.9);   // à la fermeture : même durée que l'image qui rentre dans sa plaque
  leave(i).then(() => {
    if (byScroll) return;                  // sortie à la molette : le disque garde son élan, rien ne le ramène en arrière
    if (vue !== 'disque') (grid.children[i] as HTMLElement | undefined)?.focus({ preventScroll: true });   // disque : il garde sa rotation ×1, rien ne le ramène
  });
}

/** Sens des dégradations de l'image (mesuré une fois par image) : splats, sillons et matière d'or le suivent. */
const axisCache = new Map<string, 'v' | 'h'>();
async function axisOf(it: Item, bmp: ImageBitmap): Promise<'v' | 'h'> {
  let a = axisCache.get(it.id);
  if (!a) { a = detectAxis(await bitmapToRGBA(bmp, 512)); axisCache.set(it.id, a); }
  return a;
}

/** Carte de perte d'une image, estimée depuis ses traces (stries, trames, pertes du décodage). */
async function lossOf(it: Item, bmp: ImageBitmap): Promise<LossMap> {
  let m = lossCache.get(it.id);
  if (m) return m;
  m = lossFromTraces(await bitmapToRGBA(bmp), await axisOf(it, bmp));
  lossCache.set(it.id, m);
  return m;
}

async function showImage(bmp: ImageBitmap, appear: boolean, it: Item) {
  if (!viewer.ok) { const f = $<HTMLImageElement>('#fallback'); f.hidden = false; f.src = ''; bitmapToBlobUrl(bmp).then((u) => { f.src = u; }); return; }
  let loss: LossMap | null = null;
  try { loss = await lossOf(it, bmp); } catch (e) { console.warn('carte de perte indisponible', e); }
  if (items[current]?.id !== it.id) return;
  const axis = await axisOf(it, bmp);
  if (items[current]?.id !== it.id) return;
  viewer.setImage(bmp, appear, axis, loss, it.id);
}
async function bitmapToBlobUrl(bmp: ImageBitmap) { return URL.createObjectURL(await bitmapToBlob(bmp, 2000, 'image/png')); }

let sayTimer = 0;
function say(msg: string) { status.textContent = msg; clearTimeout(sayTimer); sayTimer = window.setTimeout(() => { status.textContent = ''; }, 4000); }

// ─── réglages (temporaires) ───────────────────────────────────────────────────
const setBtn = $('#settings-btn'), setPanel = $('#settings');
// le bouton des réglages n'apparaît qu'avec la touche R, et seulement en mode test (adresse avec ?debug)
const modeTest = new URLSearchParams(location.search).has('debug');
if (modeTest) outilRognage();   // touche C : rogner les images de la galerie (rognage.ts)
window.addEventListener('keydown', (e) => {
  if (!modeTest || e.repeat || e.key.toLowerCase() !== 'r' || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('input, textarea, select')) return;
  const on = document.body.classList.toggle('reglages');
  if (!on) { setPanel.hidden = true; setBtn.setAttribute('aria-expanded', 'false'); }
});
setBtn.addEventListener('click', () => { setPanel.hidden = !setPanel.hidden; setBtn.setAttribute('aria-expanded', String(!setPanel.hidden)); });
buildSettingsPanel(setPanel, settings, (k) => {
  viewer.look = settings; viewer.autoMotion = settings.motion;
  if ((k === 'step' || k === 'density' || k === 'trichrome' || k === 'matter') && currentBitmap && !viewerEl.hidden) viewer.rebuild(currentBitmap);
});

// ─── évènements ───────────────────────────────────────────────────────────────
// la molette, image ouverte : un mouvement franc la referme (et l'élan passe au disque)
viewerEl.addEventListener('wheel', (e) => {
  if (e.ctrlKey || (e.target as HTMLElement).closest('.settings')) return;
  // défiler fait toujours sortir de la vue de l'image ; le disque reprend sa rotation sans à-coup
  if (focused >= 0 && !busy) {
    e.preventDefault();
    closeViewer(true); carousel?.calm();   // l'évènement continue jusqu'au disque, qui repart doucement
  }
}, { passive: false });
// un clic (sans glisser) loin de l'image ramène à l'accueil
let tap: [number, number] | null = null;
viewerEl.addEventListener('pointerdown', (e) => { tap = [e.clientX, e.clientY]; });
viewerEl.addEventListener('pointerup', (e) => {
  if (!tap || (e.target as HTMLElement).closest('button, .settings')) { tap = null; return; }
  const moved = Math.hypot(e.clientX - tap[0], e.clientY - tap[1]); tap = null;
  const b = Viewer.rectFor(items[focused]?.aspect ?? 1.5), m = 24;
  const outside = e.clientX < b.left - m || e.clientX > b.left + b.width + m || e.clientY < b.top - m || e.clientY > b.top + b.height + m;
  if (moved < 5 && outside) closeViewer();
});
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input,select')) return;
  if (document.body.classList.contains('welcome')) return;   // l'accueil a ses propres touches
  if (viewerEl.hidden) {
    if (vue !== 'disque' || !carousel) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); carousel.step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); carousel.step(-1); }
    else if (e.key === 'Enter' && !(e.target as HTMLElement).closest('button,a')) open(carousel.index);
    return;
  }
  if (e.key === 'Escape') closeViewer();
  else if (e.key === 'ArrowRight' && focused >= 0) open(focused + 1, true);
  else if (e.key === 'ArrowLeft' && focused >= 0) open(focused - 1, true);
});
// ─── démarrage ────────────────────────────────────────────────────────────────
paintSpace(); twinkle();
spinNear($('.brand .disc'));
refletIcones('.vue-btn, .settings-btn');   // même reflet doré que le titre, sur les icônes
if (!new URLSearchParams(location.search).has('image') && !new URLSearchParams(location.search).has('entrer')) { vue = 'disque'; carouselArrive = true; prelude().then(() => welcome()).then(() => { for (const el of document.querySelectorAll<HTMLElement>('body > header, body > main')) el.inert = false; carousel?.arrive(lastSpin, posePlat); }); }   // pré-accueil → accueil → disque   // l'accueil mène à l'interface du disque
else { document.body.classList.remove('welcome'); platine.play('musiques'); }   // (la page démarre masquée : rien ne s'affiche avant l'accueil)
(async () => {
  try {
    const [archives, aspects] = await Promise.all([loadArchives(),
      donnee<Record<string, number>>('thumbs/aspects.json', {})]);   // format réel (images recadrées)
    items = [
      ...archives.sort((a, b) => a.position - b.position).map((a) => ({ kind: 'archive' as const, id: a.id, a, aspect: aspects[a.id] ?? (a.orientation ? 364 / 540 : 540 / 364) })),
    ];
    for (let k = items.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [items[k], items[j]] = [items[j], items[k]]; }   // ordre au hasard
    setVue(vue);
    const q = new URLSearchParams(location.search).get('image');
    if (q) { const i = items.findIndex((x) => x.id === q); if (i >= 0) open(i); }
  } catch (e) { console.error(e); say('La collection n’a pas pu se charger.'); }
})();

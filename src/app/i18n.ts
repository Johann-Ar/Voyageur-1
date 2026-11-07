/**
 * Langue du site : celle choisie avec le sélecteur du début (gardée dans le navigateur), sinon celle du
 * navigateur (français s'il est en français, anglais pour toute autre langue). `?lang=fr|en` l'impose.
 */
export type Langue = 'en' | 'fr';
const CLE = 'voyageur-langue';

export const langue: Langue = (() => {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'fr' || q === 'en') return q;
  try { const c = localStorage.getItem(CLE); if (c === 'fr' || c === 'en') return c; } catch { /* stockage indisponible */ }
  const pref = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase();
  return pref.startsWith('fr') ? 'fr' : 'en';
})();
document.documentElement.lang = langue;

/** Le texte dans la langue du site. */
export function t<T>(m: { en: T; fr: T }): T { return m[langue]; }

/** Change de langue : le choix est gardé, et la page repart au début (tous les textes sont posés au démarrage). */
function changerLangue(l: Langue) {
  if (l === langue) return;
  let garde = false;
  try { localStorage.setItem(CLE, l); garde = true; } catch { /* stockage indisponible : l'adresse s'en charge */ }
  const u = new URL(location.href);
  if (garde) u.searchParams.delete('lang'); else u.searchParams.set('lang', l);
  location.href = u.toString();
}

/** Le sélecteur « EN · FR » (seulement sur l'écran d'ouverture du récit). */
export function boutonLangue(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'langue';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', t({ en: 'Language', fr: 'Langue' }));
  ['en', 'fr'].forEach((l, k) => {
    if (k) { const sep = document.createElement('span'); sep.textContent = '·'; sep.setAttribute('aria-hidden', 'true'); el.append(sep); }
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = l.toUpperCase(); b.lang = l;
    b.setAttribute('aria-pressed', String(l === langue));
    b.setAttribute('aria-label', l === 'en' ? 'English' : 'Français');
    b.addEventListener('click', () => changerLangue(l as Langue));
    el.append(b);
  });
  return el;
}

/** Textes de la page (index.html) : en-tête, vues, pied de page, libellés d'accessibilité. */
export function traduirePage() {
  const $ = (s: string) => document.querySelector<HTMLElement>(s);
  document.title = t({ en: 'Voyager 1 and the Golden Record', fr: 'Voyageur 1 et le disque d’or' });
  document.querySelector('meta[name="description"]')?.setAttribute('content', t({
    en: 'Discover the Golden Record of Voyager 1 (1977): its 116 images decoded from the signal, its sounds and its music, to explore in volume.',
    fr: 'Découvrir le disque d’or de Voyager 1 (1977) : ses 116 images décodées du signal, ses sons et ses musiques, à explorer en volume.',
  }));
  const w = $('.brand .word'); if (w) w.textContent = t({ en: 'VOYAGER 1', fr: 'VOYAGEUR 1' });
  const st = $('.brand .sous-titre'); if (st) st.textContent = t({ en: 'and the Golden Record', fr: 'et le disque d’or' });
  $('.brand')?.setAttribute('aria-label', t({ en: 'VOYAGER 1, home', fr: 'VOYAGEUR 1, accueil' }));
  const ld = $('.vue-lbl .l-disc'); if (ld) ld.textContent = t({ en: 'Record', fr: 'Disque' });
  const lg = $('.vue-lbl .l-grid'); if (lg) lg.textContent = t({ en: 'Gallery', fr: 'Galerie' });
  $('#grid')?.setAttribute('aria-label', t({ en: 'Image collection', fr: 'Collection d’images' }));
  $('#stage')?.setAttribute('aria-label', t({ en: 'The record and its images', fr: 'Le disque et ses images' }));
  $('#viewer')?.setAttribute('aria-label', t({ en: 'Image in volume', fr: 'Image en volume' }));
  $('#settings-btn')?.setAttribute('aria-label', t({ en: 'Rendering settings', fr: 'Réglages de rendu' }));
  const foot = $('.foot');
  if (foot) foot.innerHTML = t({
    en: 'Images: NASA / JPL, Voyager Golden Record, 1977 · decoding: Ron Barry, 2017 · <a href="CREDITS.md" target="_blank">credits</a>',
    fr: 'Images : NASA / JPL, Voyager Golden Record, 1977 · décodage : Ron Barry, 2017 · <a href="CREDITS.md" target="_blank">crédits</a>',
  });
}

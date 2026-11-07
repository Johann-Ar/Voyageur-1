/**
 * Panneau de réglage des images du pré-accueil (touche R) : exposition, contraste, saturation, température,
 * teinte, hautes lumières, ombres — comme dans un logiciel photo. On choisit l'image à régler (1, 2 ou 3).
 *
 * Tout passe par des filtres SVG (aucune lecture des pixels) : ça marche aussi hors ligne, depuis la clé,
 * où les navigateurs interdisent de lire le contenu des images.
 * Les réglages du site sont fixés dans DEFAUTS (ci-dessous) : identiques pour tous, sur tous les ordinateurs. Le panneau ne
 * sert qu'à essayer (rien n'est gardé au rechargement) ; « Copier les réglages » donne les valeurs à fixer.
 */
const CURSEURS = [
  ['exposition', 'Exposition'], ['contraste', 'Contraste'], ['saturation', 'Saturation'], ['temperature', 'Température'],
  ['teinte', 'Teinte'], ['hautes', 'Hautes lumières'], ['ombres', 'Ombres'], ['blancs', 'Blancs'],
] as const;
type Nom = typeof CURSEURS[number][0];
type Reglage = Record<Nom, number>;   // de −100 à 100
const zero = (): Reglage => ({ exposition: 0, contraste: 0, saturation: 0, temperature: 0, teinte: 0, hautes: 0, ombres: 0, blancs: 0 });
/** Les réglages du site (choisis avec ce panneau) : ce que voient les visiteurs. */
const DEFAUTS: Record<string, Partial<Reglage>> = {
  1: { contraste: 23, hautes: 100, ombres: -100 },
  2: { contraste: 26, saturation: -100, hautes: 100, ombres: -12 },
  3: { exposition: -8, contraste: 100, saturation: -100, hautes: 100, ombres: -5 },
};

const neutre = (r: Reglage) => CURSEURS.every(([n]) => !r[n]);

const lisse = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** La courbe des tons (contraste, hautes lumières, ombres), échantillonnée pour feComponentTransfer. */
function courbe(r: Reglage) {
  const c = r.contraste / 100, h = r.hautes / 100, o = r.ombres / 100, pts: string[] = [];
  for (let i = 0; i <= 64; i++) {
    let y = i / 64;
    // contraste : une courbe en S douce autour du gris moyen (pas de coupure nette)
    if (c) { const s = y * y * (3 - 2 * y); y = c > 0 ? y + (s - y) * c * 1.6 : y + (0.5 - y) * -c * 0.6; }
    // hautes lumières : seulement la partie claire, vers le blanc (ou le gris), sans jamais dépasser
    if (h) { const w = lisse(0.45, 1, y) * 0.55 * h; y += w * (h > 0 ? 1 - y : y); }
    // ombres : seulement la partie sombre, vers le noir (ou le gris)
    if (o) { const w = (1 - lisse(0, 0.55, y)) * 0.55 * o; y += w * (o > 0 ? 1 - y : y); }
    // blancs : uniquement les tons clairs (au-dessus du gris moyen). On déplace le point blanc : les gris clairs deviennent
    // blancs, sans toucher aux noirs, aux tons sombres ni aux tons moyens ; pente douce (pas de cassure ni d'aplat brutal)
    const b = r.blancs / 100;
    if (b) {
      const t0 = 0.5, w = lisse(0.4, 0.6, y);
      let v = t0 + (y - t0) / (b > 0 ? 1 - 0.35 * b : 1 / (1 + 0.35 * b));   // au maximum, tout ce qui dépasse ≈ 82 % devient blanc
      if (b > 0) { const k = 0.9; if (v > k) v = k + (1 - k) * Math.tanh((v - k) / (1 - k)); }   // le blanc arrive en douceur
      y += w * (v - y);
    }
    pts.push(Math.min(1, Math.max(0, y)).toFixed(4));
  }
  return pts.join(' ');
}
/** Exposition, saturation, température et teinte : une seule matrice de couleur. */
function matrice(r: Reglage) {
  const e = Math.pow(2, r.exposition / 100 * 1.5), s = 1 + r.saturation / 100, t = r.temperature / 100 * 0.12, g = r.teinte / 100 * 0.1;
  const L = [0.2126, 0.7152, 0.0722], k = [e * (1 + t), e * (1 - g), e * (1 - t)];
  const m: number[] = [];
  for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) m.push(k[i] * ((1 - s) * L[j] + (i === j ? s : 0))); m.push(0, 0); }
  m.push(0, 0, 0, 1, 0);
  return m.map((v) => v.toFixed(4)).join(' ');
}

/** Applique les réglages du site aux images ; avec `panneau` (mode test, adresse avec ?debug), la touche R ouvre le panneau. */
export function reglages(root: HTMLElement, panneauPermis = false) {
  const imgs = [...root.querySelectorAll<HTMLImageElement>('.p-tirage img')];
  const tous: Record<string, Reglage> = {};
  for (const k of ['1', '2', '3']) tous[k] = { ...zero(), ...DEFAUTS[k] };   // toujours les réglages du site, quel que soit l'ordinateur
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  root.append(svg);
  const appliquer = (i: number) => {
    const r = { ...zero(), ...tous[i + 1] }, img = imgs[i];
    if (!img) return;
    let f = svg.querySelector<SVGFilterElement>(`#reglage-${i + 1}`);
    if (neutre(r)) { img.style.removeProperty('--reglage'); return; }
    if (!f) { f = document.createElementNS('http://www.w3.org/2000/svg', 'filter'); f.id = `reglage-${i + 1}`; f.setAttribute('color-interpolation-filters', 'sRGB'); svg.append(f); }
    const t = courbe(r);
    f.innerHTML = `<feColorMatrix type="matrix" values="${matrice(r)}"/><feComponentTransfer><feFuncR type="table" tableValues="${t}"/><feFuncG type="table" tableValues="${t}"/><feFuncB type="table" tableValues="${t}"/></feComponentTransfer>`;
    img.style.setProperty('--reglage', `url(#reglage-${i + 1})`);
  };
  imgs.forEach((_, i) => appliquer(i));

  let panneau: HTMLElement | null = null, choix = 0;
  const ouvrir = () => {
    panneau = document.createElement('aside');
    panneau.className = 'rg-panneau';   // (pas « reglages » : c'est la classe que le mode test de l'interface pose sur la page)
    panneau.setAttribute('aria-label', 'Réglage des images');
    panneau.innerHTML = `<div class="rg-tete"><span>Réglages</span><button type="button" class="rg-fermer" aria-label="Fermer">×</button></div>
      <div class="rg-choix">${imgs.map((_, i) => `<button type="button" data-i="${i}">Image ${i + 1}</button>`).join('')}</div>
      ${CURSEURS.map(([n, l]) => `<label class="rg-ligne"><span>${l}</span><input type="range" min="-100" max="100" step="1" data-n="${n}" /><output></output></label>`).join('')}
      <div class="rg-bas"><button type="button" class="rg-zero">Valeurs du site</button><button type="button" class="rg-copier">Copier les réglages</button></div>
      <p class="rg-aide">Double-clic sur un curseur : remis à 0 · R : fermer</p>`;
    root.append(panneau);
    const maj = () => {
      const r = { ...zero(), ...tous[choix + 1] };
      panneau!.querySelectorAll<HTMLButtonElement>('.rg-choix button').forEach((b) => b.classList.toggle('actif', +b.dataset.i! === choix));
      panneau!.querySelectorAll<HTMLInputElement>('input').forEach((c) => { const v = r[c.dataset.n as Nom]; c.value = String(v); (c.nextElementSibling as HTMLOutputElement).value = (v > 0 ? '+' : '') + v; });
      imgs.forEach((im, i) => im.closest('.p-tirage')?.classList.toggle('rg-cible', i === choix));
    };
    const changer = (c: HTMLInputElement, v: number) => {
      const r = { ...zero(), ...tous[choix + 1], [c.dataset.n as Nom]: v };
      tous[choix + 1] = r; appliquer(choix); maj();
    };
    panneau.addEventListener('input', (e) => { const c = e.target as HTMLInputElement; if (c.dataset.n) changer(c, +c.value); });
    panneau.addEventListener('dblclick', (e) => { const c = e.target as HTMLInputElement; if (c.dataset?.n) changer(c, 0); });
    panneau.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button'); if (!b) return;
      if (b.dataset.i) { choix = +b.dataset.i; maj(); }
      else if (b.classList.contains('rg-zero')) { tous[choix + 1] = { ...zero(), ...DEFAUTS[choix + 1] }; appliquer(choix); maj(); }
      else if (b.classList.contains('rg-copier')) {
        const txt = JSON.stringify(Object.fromEntries(Object.entries(tous).filter(([, r]) => !neutre({ ...zero(), ...r }))), null, 1);
        void navigator.clipboard?.writeText(txt).then(() => { b.textContent = 'Copié'; setTimeout(() => { b.textContent = 'Copier les réglages'; }, 1500); }, () => prompt('Réglages :', txt));
      } else if (b.classList.contains('rg-fermer')) fermer();
    });
    maj();
  };
  const fermer = () => { panneau?.remove(); panneau = null; imgs.forEach((im) => im.closest('.p-tirage')?.classList.remove('rg-cible')); };
  const touche = (e: KeyboardEvent) => { if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) { e.preventDefault(); if (panneau) fermer(); else ouvrir(); } };
  if (panneauPermis) addEventListener('keydown', touche);
  return () => { removeEventListener('keydown', touche); fermer(); };
}

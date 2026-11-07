/**
 * Outil de rognage des images du disque (mode test seulement : adresse avec ?debug).
 *
 *   Galerie → touche C : mode rognage (un bandeau en haut le rappelle).
 *   Clic sur une image : elle s'ouvre en grand, à plat, avec un cadre de rognage.
 *     – tirer dans l'image : tracer un nouveau cadre ;  tirer dans le cadre : le déplacer ;
 *     – tirer un bord ou un coin : l'ajuster ;  Maj : déplacement plus fin au clavier (flèches) ;
 *     – Entrée : valider ;  Échap : annuler ;  Retour arrière : enlever le rognage de cette image.
 *   « Exporter » (bandeau) : enregistre rognages.json (dans Téléchargements) — Claude l'applique ensuite pour de bon
 *   (images décodées, vignettes, proportions) avec tools/appliquer-rognages.py.
 *
 * Les rognages sont gardés dans ce navigateur tant qu'ils ne sont pas exportés (rien n'est perdu si on recharge).
 * Coordonnées : fractions (0 → 1) de l'image telle qu'elle s'affiche (même orientation que la vignette).
 */
import { chemin } from './res.ts';

type Cadre = [number, number, number, number];   // x0, y0, x1, y1 (0 → 1)
const CLE = 'voyageur-rognages';
const lire = (): Record<string, Cadre> => { try { return JSON.parse(localStorage.getItem(CLE) || '{}'); } catch { return {}; } };
const ecrire = (r: Record<string, Cadre>) => { try { localStorage.setItem(CLE, JSON.stringify(r)); } catch { /* navigateur sans stockage */ } };

export function outilRognage() {
  let actif = false, rognages = lire();
  const bandeau = document.createElement('div');
  bandeau.className = 'rgn-bandeau'; bandeau.hidden = true;
  document.body.append(bandeau);
  const majBandeau = () => {
    const n = Object.keys(rognages).length;
    bandeau.innerHTML = `<b>Rognage</b> · clique une image · C : quitter · ${n} image${n > 1 ? 's' : ''} rognée${n > 1 ? 's' : ''}
      <button type="button" class="rgn-exp"${n ? '' : ' disabled'}>Exporter rognages.json</button>
      <button type="button" class="rgn-vider"${n ? '' : ' disabled'}>Tout effacer</button>`;
  };
  bandeau.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.rgn-vider')) { if (confirm('Effacer tous les rognages de cette liste ? (ceux déjà appliqués restent)')) { rognages = {}; ecrire(rognages); majBandeau(); } return; }
    if (!(e.target as HTMLElement).closest('.rgn-exp')) return;
    const blob = new Blob([JSON.stringify(rognages, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rognages.json'; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });
  const basculer = () => { actif = !actif; bandeau.hidden = !actif; document.body.classList.toggle('mode-rognage', actif); majBandeau(); };
  addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('input, textarea, select') || document.querySelector('.rgn-edit')) return;
    if (e.key === 'c' || e.key === 'C') { e.preventDefault(); basculer(); }
  });
  // en mode rognage, un clic sur une image de la galerie ouvre l'éditeur (au lieu de la vue en volume)
  addEventListener('click', (e) => {
    if (!actif) return;
    const cell = (e.target as HTMLElement).closest('.cell, .card'); if (!cell) return;
    const src = cell.querySelector('img')?.getAttribute('src') || '', m = src.match(/(GR-\d+)\.jpg/);
    if (!m) return;
    e.preventDefault(); e.stopImmediatePropagation();
    editer(m[1]);
  }, true);

  function editer(id: string) {
    const ov = document.createElement('div'); ov.className = 'rgn-edit';
    ov.innerHTML = `<div class="rgn-zone"><img alt="" draggable="false" /><div class="rgn-voile"></div><div class="rgn-cadre"><i data-h="nw"></i><i data-h="n"></i><i data-h="ne"></i><i data-h="e"></i><i data-h="se"></i><i data-h="s"></i><i data-h="sw"></i><i data-h="w"></i></div></div>
      <p class="rgn-aide">${id} · tirer pour tracer · bords et coins pour ajuster · Entrée : valider · Échap : annuler · Retour arrière : aucun rognage<span class="rgn-dim"></span></p>`;
    document.body.append(ov);
    const zone = ov.querySelector('.rgn-zone') as HTMLElement, img = ov.querySelector('img') as HTMLImageElement, cadreEl = ov.querySelector('.rgn-cadre') as HTMLElement, voile = ov.querySelector('.rgn-voile') as HTMLElement, dim = ov.querySelector('.rgn-dim') as HTMLElement;
    let c: Cadre = rognages[id] ? [...rognages[id]] as Cadre : [0, 0, 1, 1];
    img.src = chemin(`thumbs/${id}.jpg`);
    const dessiner = () => {
      const [x0, y0, x1, y1] = c, p = (v: number) => (v * 100).toFixed(3) + '%';
      Object.assign(cadreEl.style, { left: p(x0), top: p(y0), width: p(x1 - x0), height: p(y1 - y0) });
      voile.style.clipPath = `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${p(x0)} ${p(y0)}, ${p(x0)} ${p(y1)}, ${p(x1)} ${p(y1)}, ${p(x1)} ${p(y0)}, ${p(x0)} ${p(y0)})`;
      const w = img.naturalWidth || 1, h = img.naturalHeight || 1;
      dim.textContent = ` · ${Math.round((x1 - x0) * 100)} % × ${Math.round((y1 - y0) * 100)} % (format ${((x1 - x0) * w / ((y1 - y0) * h)).toFixed(3)})`;
    };
    const taille = () => {   // l'image entière, le plus grand possible (sans déformation)
      const w = img.naturalWidth || 1, h = img.naturalHeight || 1, k = Math.min(innerWidth * 0.86 / w, innerHeight * 0.78 / h);
      img.style.width = `${Math.round(w * k)}px`; img.style.height = `${Math.round(h * k)}px`; dessiner();
    };
    img.onload = taille; dessiner();
    const pos = (e: PointerEvent) => { const r = zone.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
    let mode = '', depart: number[] = [], c0: Cadre = c;
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault(); zone.setPointerCapture(e.pointerId);
      depart = pos(e); c0 = [...c] as Cadre;
      const h = (e.target as HTMLElement).dataset.h;
      const plein = c[2] - c[0] > 0.97 && c[3] - c[1] > 0.97;   // cadre = toute l'image : on trace directement un nouveau cadre
      mode = h ? h : !plein && (e.target as HTMLElement).closest('.rgn-cadre') ? 'deplacer' : 'tracer';
    });
    zone.addEventListener('pointermove', (e) => {
      if (!mode) return;
      const [x, y] = pos(e), dx = x - depart[0], dy = y - depart[1], m = 0.01;
      let [x0, y0, x1, y1] = c0;
      if (mode === 'tracer') { x0 = Math.min(depart[0], x); x1 = Math.max(depart[0], x); y0 = Math.min(depart[1], y); y1 = Math.max(depart[1], y); }
      else if (mode === 'deplacer') { const w = x1 - x0, hh = y1 - y0; x0 = Math.min(1 - w, Math.max(0, x0 + dx)); y0 = Math.min(1 - hh, Math.max(0, y0 + dy)); x1 = x0 + w; y1 = y0 + hh; }
      else {
        if (mode.includes('w')) x0 = Math.min(x1 - m, Math.max(0, x0 + dx));
        if (mode.includes('e')) x1 = Math.max(x0 + m, Math.min(1, x1 + dx));
        if (mode.includes('n')) y0 = Math.min(y1 - m, Math.max(0, y0 + dy));
        if (mode.includes('s')) y1 = Math.max(y0 + m, Math.min(1, y1 + dy));
      }
      c = [x0, y0, x1, y1]; dessiner();
    });
    const lacher = () => { if (mode === 'tracer' && (c[2] - c[0] < 0.01 || c[3] - c[1] < 0.01)) c = c0; mode = ''; dessiner(); };
    zone.addEventListener('pointerup', lacher); zone.addEventListener('pointercancel', lacher);
    const fermer = () => { removeEventListener('keydown', touches, true); ov.remove(); majBandeau(); };
    const touches = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        const r = c.map((v) => Math.round(v * 10000) / 10000) as Cadre;
        if (r[0] <= 0.0005 && r[1] <= 0.0005 && r[2] >= 0.9995 && r[3] >= 0.9995) delete rognages[id]; else rognages[id] = r;
        ecrire(rognages); fermer();
      } else if (e.key === 'Escape') { e.preventDefault(); fermer(); }
      else if (e.key === 'Backspace') { e.preventDefault(); c = [0, 0, 1, 1]; dessiner(); }
      else if (e.key.startsWith('Arrow')) {   // déplacer le cadre au clavier (Maj : plus fin)
        e.preventDefault();
        const s = e.shiftKey ? 0.001 : 0.005, d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key] ?? [0, 0];
        const w = c[2] - c[0], hh = c[3] - c[1], x0 = Math.min(1 - w, Math.max(0, c[0] + d[0])), y0 = Math.min(1 - hh, Math.max(0, c[1] + d[1]));
        c = [x0, y0, x0 + w, y0 + hh]; dessiner();
      }
    };
    addEventListener('keydown', touches, true);
  }
}

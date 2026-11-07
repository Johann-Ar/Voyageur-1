/**
 * Le pré-accueil : à gauche, d'où viennent les images (le disque, le signal, le décodage, le volume) ;
 * à droite, l'histoire de Voyager 1 en trois photos d'archives NASA (même traitement noir et blanc d'archive).
 * Le bouton lance l'accueil — et c'est ce clic qui autorise le son.
 * Les photos sont des fichiers du projet (public/prelude/) : tout marche hors ligne.
 */
import { chemin } from './res.ts';
import { reglages } from './reglages.ts';
import { platine } from './audio.ts';
import { camera, type Pose } from './space.ts';
// l'ordre : le disque posé sur la sonde, le lancement, la sonde jusqu'à l'espace interstellaire
// (credit : gardé pour la traçabilité, plus affiché)
const ECRANS = [
  { n: '01', ratio: '1554 / 1227', coupe: [2.6, 3.0, 0.3, 0.5], titre: 'Le disque d’or, fixation sur la coque', img: 'prelude/01-disque.jpg', cuit: 'prelude/01-disque-regle.jpg', pos: '58% 55%',
    texte: 'Sur son flanc, la sonde porte le Golden Record, une bouteille à la mer cosmique contenant les sons et les images de notre monde.',
    credit: 'PIA21740 · NASA/JPL-Caltech · 1977' },
  { n: '02', ratio: '1256 / 1600', titre: 'Le lancement, depuis Cap Canaveral', img: 'prelude/02-lancement.jpg', cuit: 'prelude/02-lancement-regle.jpg', pos: '50% 22%',
    texte: 'Le 5 septembre 1977, la fusée Titan-Centaur s’arrache à la Terre, emportant avec elle notre message vers les étoiles.',
    credit: 'PIA17464 · NASA/KSC · 5.09.1977' },
  { n: '03', ratio: '453 / 614', titre: 'La sonde, jusqu’à l’espace interstellaire', img: 'prelude/03-point-bleu.png', cuit: 'prelude/03-point-bleu-regle.png', terre: true,
    texte: 'Le 14 février 1990, à environ 6 milliards de kilomètres, Voyager 1 se retourne et photographie la Terre : un point bleu pâle.',
    credit: 'PIA00452 · NASA/JPL · 14.02.1990' },
];
// la Terre dans PIA00452 (453×614), en % de l'image : le pixel le plus clair, en (344, 344)
const TERRE = { x: 75.9, y: 56 };

/**
 * Le récit, en chapitres qui défilent (texte de Johann, mots inchangés, seulement réparti au fil de l'histoire) :
 * l'ouverture, les trois photos d'archives (chacune avec sa date), le décodage, puis l'appel et le bouton.
 */
const OUVERTURE = 'En 1977, deux sondes Voyager quittent la Terre. Chacune emporte un disque d’or : des images, des voix, des sons et de la musique.';
const SUITE: Record<string, string> = {   // le texte qui prolonge la légende de chaque photo
  '01': 'Les images que vous allez découvrir ne sont pas des photographies imprimées. Elles sont gravées dans le sillon du disque, sous la forme d’un signal sonore.',
};
const DATES: Record<string, string> = { '01': '1977', '02': '5 septembre 1977', '03': '14 février 1990' };
const DECODAGE = [
  'En 2017, Ron Barry a décodé ce signal à partir d’une copie restée sur Terre. Les images qu’il en a fait ressortir gardent leurs défauts : des stries, des trames et des pertes, traces de leur passage par le son.',
  'Ici, chacune est traduite en volume, pour devenir un objet que l’on peut approcher, tourner et regarder autrement.',
];
const APPEL = 'Voyager 1 ne reviendra pas. Mais ce qu’elle emporte peut encore nous parvenir. Reprenez contact avec elle et redécouvrez son message sous une forme nouvelle : ses 116 images, décodées du signal gravé dans le sillon.';
const BOUTON = 'Établir le contact';

/** Mode test (?debug) : les images d'origine et leurs réglages en direct (panneau R). Sinon : les images déjà réglées (tools/cuire-reglages.py). */
const REGLER = new URLSearchParams(location.search).has('debug');
/** Recadre une photo (marges en % : gauche, haut, droite, bas) : l'image déborde du cadre d'autant, sans être déformée. */
const coupe = ([g, h, d, b]: number[]) => { const w = 100 - g - d, v = 100 - h - b;
  return `inset:auto;left:${(-g / w * 100).toFixed(3)}%;top:${(-h / v * 100).toFixed(3)}%;width:${(10000 / w).toFixed(3)}%;height:${(10000 / v).toFixed(3)}%`; };
/** Affiche le pré-accueil ; se résout au clic sur le bouton. */
export function prelude(): Promise<void> {
  return new Promise((resolve) => {
    const root = document.createElement('section');
    root.className = REGLER ? 'prelude attente' : 'prelude attente cuit';   // (images déjà réglées : aucun filtre à calculer)   // invisible tant que tout n'est pas prêt : tout apparaît ensemble, en fondu
    root.setAttribute('aria-label', 'Voyager 1, avant d’entrer');
    root.classList.add('recit-long');
    root.innerHTML = `
      <div class="p-long">
        <header class="p-ouverture">
          <h1 class="p-titre p-mod">Voyageur 1<br />Le disque d’or</h1>
          <p class="p-chapeau p-mod">${OUVERTURE}</p>
          <button class="p-defiler p-mod" type="button" aria-label="Lire la suite"><span>Lire la suite</span><i aria-hidden="true"></i></button>
        </header>
        ${ECRANS.map((e, k) => `
        <section class="p-chap${k % 2 ? ' p-inverse' : ''}${e.terre ? ' p-large' : ''}">
          <figure class="p-tirage p-mod" style="aspect-ratio:${e.ratio};--r:${e.ratio.replace(' / ', '/')}"><img src="${chemin(REGLER ? e.img : e.cuit)}" alt="" decoding="async"${e.coupe ? ` style="${coupe(e.coupe)}"` : ''} />${e.terre ? `
            <span class="p-terre" style="left:${TERRE.x}%;top:${TERRE.y}%" aria-hidden="true"><i></i><b>la Terre</b></span>` : ''}</figure>
          <div class="p-texte p-mod">
            <p class="p-date">${e.n} · ${DATES[e.n]}</p>
            <h2>${e.titre}</h2>
            <p>${e.texte}</p>${SUITE[e.n] ? `
            <p>${SUITE[e.n]}</p>` : ''}
          </div>
        </section>`).join('')}
        <section class="p-chap p-seul">
          <div class="p-texte p-mod">
            ${DECODAGE.map((t) => `<p>${t}</p>`).join('')}
          </div>
        </section>
        <section class="p-fin">
          <p class="p-appel p-mod">${APPEL}</p>
          <div class="p-pied p-mod"><button class="p-ecouter grave" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="1.3"/><path class="onde" d="M8.8 8.8a4.5 4.5 0 0 0 0 6.4M15.2 8.8a4.5 4.5 0 0 1 0 6.4"/><path class="onde o2" d="M6 6a8.5 8.5 0 0 0 0 12M18 6a8.5 8.5 0 0 1 0 12"/></svg><span>${BOUTON}</span></button></div>
        </section>
      </div>`;
    // « Lire la suite » : descend en douceur jusqu'au premier chapitre
    root.querySelector('.p-defiler')!.addEventListener('click', () => root.querySelector('.p-chap')!.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }));
    // chaque chapitre apparaît doucement quand il arrive à l'écran (une seule fois)
    // le ciel glisse lentement derrière le récit quand on avance (la caméra descend un peu dans l'espace)
    const flotte = matchMedia('(prefers-reduced-motion: reduce)').matches ? null : (() => {
      let lisse = root.scrollTop, avant = performance.now(), id = 0;
      const pas = (now: number) => {
        const dt = Math.min(0.05, (now - avant) / 1000); avant = now;
        lisse += (root.scrollTop - lisse) * (1 - Math.exp(-dt * 6));
        camera.repos = { ...camera.repos, y: lisse * 0.12 };
        id = requestAnimationFrame(pas);
      };
      id = requestAnimationFrame(pas);
      return () => cancelAnimationFrame(id);
    })();

    // ── le défilement guidé : comme Espace, chaque geste (molette, pavé tactile, doigt, clavier) mène d'une étape à la
    // suivante par un mouvement animé, toujours le même (accélère puis se pose en douceur). Les étapes : chaque bloc au
    // centre de l'écran ; un bloc plus haut que l'écran (téléphone) est montré en plusieurs fois (haut, puis bas), jamais coupé.
    const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const etapes = () => {
      const Hv = root.clientHeight, max = root.scrollHeight - Hv, pts: number[] = [];
      for (const el of root.querySelectorAll<HTMLElement>('.p-ouverture, .p-chap, .p-fin')) {
        const h = el.offsetHeight, top = el.offsetTop;
        if (h <= Hv * 0.92 || el.classList.contains('p-fin') || el.classList.contains('p-ouverture')) { pts.push(top + h / 2 - Hv / 2); continue; }
        const debut = top - Hv * 0.05, fin = top + h - Hv * 0.95, n = Math.max(1, Math.ceil((fin - debut) / (Hv * 0.8)));
        for (let k = 0; k <= n; k++) pts.push(debut + (fin - debut) * k / n);
      }
      return [...new Set(pts.map((y) => Math.round(Math.max(0, Math.min(max, y)))))].sort((a, b) => a - b);
    };
    let anim = 0, enCours = false;
    const allerA = (cible: number) => {
      cancelAnimationFrame(anim);
      const de = root.scrollTop, d = cible - de;
      if (Math.abs(d) < 2) return;
      if (reduit) { root.scrollTop = cible; return; }
      const duree = Math.min(1150, 420 + Math.abs(d) * 0.45), t0 = performance.now();
      const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);   // départ et arrivée en douceur
      enCours = true;
      const pas = (now: number) => {
        const u = Math.min(1, (now - t0) / duree);
        root.scrollTop = de + d * ease(u);
        if (u < 1) anim = requestAnimationFrame(pas); else enCours = false;
      };
      anim = requestAnimationFrame(pas);
    };
    const suivante = (sens: 1 | -1) => {
      const ici = root.scrollTop, cibles = etapes();
      const cible = sens > 0 ? cibles.find((y) => y > ici + 8) : [...cibles].reverse().find((y) => y < ici - 8);
      if (cible !== undefined) allerA(cible);
    };
    const touches = (ev: KeyboardEvent) => {
      if (root.classList.contains('part') || ev.metaKey || ev.ctrlKey || ev.altKey || (ev.target as HTMLElement).closest('input, textarea, button')) return;
      const bas = (ev.key === ' ' && !ev.shiftKey) || ev.key === 'PageDown' || ev.key === 'ArrowDown', haut = (ev.key === ' ' && ev.shiftKey) || ev.key === 'PageUp' || ev.key === 'ArrowUp';
      if (ev.key === 'Home' || ev.key === 'End') { ev.preventDefault(); const c = etapes(); allerA(ev.key === 'Home' ? c[0] : c[c.length - 1]); return; }
      if (!bas && !haut) return;
      ev.preventDefault(); suivante(bas ? 1 : -1);
    };
    addEventListener('keydown', touches);
    // molette, pavé tactile, doigt : on défile librement ; quand le geste s'arrête, la page se pose d'elle-même, en douceur,
    // sur l'étape la plus proche (si elle n'est pas trop loin) : guidé, sans être bloqué
    let attente = 0;
    const molette = () => {
      if (enCours || root.classList.contains('part')) return;
      clearTimeout(attente);
      attente = window.setTimeout(() => {
        if (enCours || root.classList.contains('part')) return;
        const ici = root.scrollTop, cibles = etapes();
        let proche = cibles[0]; for (const y of cibles) if (Math.abs(y - ici) < Math.abs(proche - ici)) proche = y;
        if (Math.abs(proche - ici) < root.clientHeight * 0.38) allerA(proche);
      }, 170);
    };
    root.addEventListener('scroll', molette, { passive: true });
    const reprend = () => { if (enCours) { cancelAnimationFrame(anim); enCours = false; } };   // on reprend la main pendant que la page se pose : elle s'arrête
    root.addEventListener('wheel', reprend, { passive: true }); root.addEventListener('touchstart', reprend, { passive: true });
    const vu = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('lu'); vu.unobserve(e.target); } }, { root, threshold: 0.18 });
    for (const el of root.querySelectorAll('.p-chap, .p-fin')) vu.observe(el);
    // photo absente (pas encore téléchargée) : le cadre reste, vide et sombre
    for (const img of root.querySelectorAll('img')) img.addEventListener('error', () => img.classList.add('absente'));
    document.body.append(root);
    // tout apparaît d'un seul fondu, une fois les photos et les polices prêtes (au plus 2 s d'attente)
    const pret = Promise.all([...root.querySelectorAll('img')].map((im) => im.decode().catch(() => {})).concat(document.fonts ? [document.fonts.ready.then(() => {})] : []));
    // la Terre, tout en haut : une vidéo (sa fine courbe lumineuse sur le noir de l'espace), posée dans le fond par-dessus les étoiles.
    // Mélange « écran » : le noir de la vidéo n'apparaît pas, seule la lumière de la Terre s'ajoute au ciel (pas besoin de transparence)
    const terre = document.createElement('video');
    terre.className = 'terre-video'; terre.muted = true; terre.loop = true; terre.playsInline = true; terre.autoplay = true; terre.preload = 'auto';
    terre.setAttribute('aria-hidden', 'true'); terre.setAttribute('muted', ''); terre.setAttribute('playsinline', '');
    terre.poster = chemin('prelude/terre-poster.jpg');   // (Safari en économie d'énergie refuse toute lecture automatique : on voit au moins la Terre, immobile, jusqu'au premier geste)
    // deux formats (H.264 pour Safari et Chrome, VP9 en secours) ; aucun lisible : la vidéo disparaît, rien ne change
    terre.innerHTML = `<source src="${chemin('prelude/terre.mp4')}" type='video/mp4; codecs="hvc1"' /><source src="${chemin('prelude/terre-h264.mp4')}" type="video/mp4" />`;   // 4K natif : HEVC 10 bits (décodé par la carte graphique), sinon H.264
    terre.querySelector('source:last-child')!.addEventListener('error', () => terre.remove());
    // lue à vitesse normale : ralentir une vidéo à 24 images/s n'en montre plus que 14 par seconde (c'était la cause des saccades)
    // la vidéo ne va que vers l'avant ; quand elle reboucle, un fondu bref (transparente un instant) remplace le saut d'image
    let tPrec = 0;
    terre.addEventListener('timeupdate', () => {
      const t = terre.currentTime, d = terre.duration || 0;
      if (d && d - t < 1.7) terre.classList.add('raccord');
      else if (t < tPrec || t > 0.8) terre.classList.remove('raccord');
      tPrec = t;
    });
    const ciel = document.querySelector('.scintille'); if (ciel) ciel.after(terre); else document.body.prepend(terre);
    // autour de la courbe de la Terre, le ciel (fond et étoiles) s'éteint jusqu'au noir complet
    const nuit = document.createElement('div'); nuit.className = 'terre-nuit'; nuit.setAttribute('aria-hidden', 'true'); terre.before(nuit);
    const fondu = document.createElement('div'); fondu.className = 'terre-fondu'; fondu.setAttribute('aria-hidden', 'true'); terre.after(fondu);
    // la Terre n'apparaît que si elle joue vraiment (Safari peut refuser la lecture automatique : jamais de bouton « lecture » à l'écran) ;
    // refusée, elle repart au premier geste du visiteur
    const montre = () => { terre.classList.add('vue'); void terre.play().then(() => {}, () => {
      const geste = () => { for (const e of ['pointerdown', 'keydown', 'wheel', 'touchstart']) removeEventListener(e, geste); void terre.play().catch(() => {}); };
      for (const e of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(e, geste, { passive: true });
    }); };
    terre.addEventListener('pause', () => { if (!document.hidden && terre.isConnected) void terre.play().catch(() => {}); });   // Safari la met parfois en pause toute seule : elle repart
    const veille = () => { if (document.hidden) terre.pause(); else if (terre.isConnected) void terre.play().catch(() => {}); };   // onglet caché : la vidéo s'arrête
    document.addEventListener('visibilitychange', veille);
    terre.addEventListener('emptied', () => document.removeEventListener('visibilitychange', veille));
    void Promise.race([pret, new Promise((r) => setTimeout(r, 2000))]).then(() => requestAnimationFrame(() => { root.classList.remove('attente'); montre(); }));
    setTimeout(() => platine.preparer(), 1500);   // le son se prépare en silence, pour que le clic soit instantané
    // « (son recommandé) » s'affiche en même temps que l'effet de survol du bouton (CSS) ; une fois vu, il ne clignote plus
    const bouton = root.querySelector('.p-ecouter') as HTMLElement;
    const approche = () => bouton.classList.add('vu');
    bouton.addEventListener('pointerenter', approche); bouton.addEventListener('focus', approche);
    // l'interface, cachée dessous, n'est pas atteignable au clavier pendant le pré-accueil et l'accueil (rendue dans main.ts)
    const dessous = [...document.querySelectorAll<HTMLElement>('body > header, body > main')];
    for (const el of dessous) el.inert = true;
    const finReglages = REGLER ? reglages(root, true) : () => {};   // R : panneau de réglage des images
    const btn = root.querySelector('.p-ecouter') as HTMLButtonElement;
    btn.addEventListener('click', () => {
      // l'icône se fige exactement dans l'état où elle est à l'instant du clic (pas de retour à son état de repos)
      for (const o of btn.querySelectorAll<HTMLElement | SVGElement>('.onde, .p-conseil i')) { const cs = getComputedStyle(o); o.style.opacity = cs.opacity; o.style.color = cs.color; o.style.animation = 'none'; }   // (le conseil aussi)
      btn.disabled = true; platine.autoriser(); platine.detacher(); finReglages(); flotte?.(); cancelAnimationFrame(anim); removeEventListener('keydown', touches); root.removeEventListener('scroll', molette); clearTimeout(attente); vu.disconnect(); for (const el of root.querySelectorAll('.p-chap, .p-fin')) el.classList.add('lu');
      root.classList.add('part');
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setTimeout(() => { root.remove(); terre.remove(); document.querySelector('.terre-nuit')?.remove(); document.querySelector('.terre-fondu')?.remove(); resolve(); }, 150); return; }
      voyage(root, resolve);
    }, { once: true });
  });
}

/**
 * Le voyage, au contact. Une seule caméra, une seule trajectoire, dont tout découle au même instant :
 * - la caméra part dès le clic, sur une courbe (d'abord vers la droite, puis elle s'incurve vers le bas), avec une
 *   vitesse « en cloche » : départ très doux, pleine vitesse au milieu, arrivée très douce (quintique, sans à-coup) ;
 * - au même moment, le recul du décrochage (la caméra prend du champ puis revient) et un léger roulis dans le virage ;
 * - la station (texte, images, bouton) reste dans l'espace : chaque module, lâché, dérive et pivote un peu, à sa façon ;
 * - le fond (étoiles et poussières) et le disque d'or, immobile, sont placés par la même caméra : tout reste raccord.
 */
function voyage(root: HTMLElement, resolve: () => void) {
  const W = innerWidth, H = innerHeight, cx = W / 2, cy = H / 2;
  const TV = 8.5;                                                  // durée du voyage d'origine (s)
  // la montée : avant de partir dans sa direction au hasard, la caméra file d'abord tout droit vers le haut, sur toute la
  // hauteur du récit déjà parcourue (les blocs de texte et les photos repassent devant elle), puis se disperse
  const L = (root.scrollTop || 0) + 1.15 * H;
  // la trajectoire : une courbe de Bézier, très loin vers la droite puis vers le bas (des dizaines d'écrans d'étoiles défilent)
  // une vraie courbe : la caméra part vers la droite en montant un peu, puis tourne franchement vers le bas
  const B0 = [[0, 0], [3.2 * W, -1.6 * H], [8.5 * W, 0.2 * H], [8.6 * W, 6.5 * H]];
  // la direction change à chaque visite : la même courbe (même forme, même distance, même vitesse), tournée d'un angle
  // au hasard, et parfois retournée en miroir (elle tourne alors dans l'autre sens)
  // … mais jamais vers le bas : la Terre est juste sous l'écran (sa courbe se devine en bas de l'accueil) ;
  // descendre la révélerait. On tire une direction au hasard jusqu'à ce que la trajectoire ne descende jamais de plus d'un
  // tiers d'écran (elle part vers le haut, les côtés ou en biais, jamais plein sud)
  // la vitesse et le recul (définis plus bas) servent aussi à vérifier la trajectoire : déclarés d'abord
  const erf = (x: number) => { const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)); };
  const MU = 0.72, SIG = 0.18, e0 = erf(-MU / SIG), e1 = erf((1 - MU) / SIG);
  const bell = (x: number) => (erf((x - MU) / SIG) - e0) / (e1 - e0);
  const cloche = (x: number, t: number) => 0.015 * (1 - (1 - x) * (1 - x)) * (1 - Math.exp(-Math.pow(t / 1.4, 2))) + 0.985 * bell(x);   // la caméra bouge dès le décrochage, mais très lentement la première seconde (quelques pixels), puis la vitesse s'installe
  const reculA = (t: number) => (1 - Math.exp(-Math.pow(t / 0.3, 2))) * (t < 1 ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - 1) / (TV - 1))));   // (le décrochage : exactement comme avant)
  const bezDe = (Bc: number[][], u: number, i: 0 | 1) => { const v = 1 - u; return v * v * v * Bc[0][i] + 3 * v * v * u * Bc[1][i] + 3 * v * u * u * Bc[2][i] + u * u * u * Bc[3][i]; };
  // la bande de la Terre (vidéo) telle qu'elle est à l'écran au moment du clic : jamais ses bords ne doivent apparaître
  // pendant qu'elle est encore visible (sur un écran large, le roulis et un départ trop à l'horizontale les montraient)
  type Chemin = { pos: (d: number) => number[]; Lb: number; tot: number; T: number };
  // la distance parcourue : après le décrochage, un temps lent (une allure très douce, qui s'installe sans à-coup), puis
  // la grande accélération. La vitesse ne fait que monter jusqu'à l'hypervitesse : jamais de creux (l'ancienne petite
  // dérive du début accélérait puis ralentissait avant la grande accélération : un ralentissement visible)
  const TAU = 0.7, lent = (ch: { tot: number }) => 0.0035 * ch.tot;   // (≈ la vitesse de l'ancienne dérive, mais tenue)
  const croisiere = (ch: { tot: number }, t: number) => lent(ch) * (t - TAU * (1 - Math.exp(-t / TAU)));
  const distance = (ch: { tot: number; T: number }, t: number) => { const tt = Math.min(t, ch.T), c = croisiere(ch, tt), cT = croisiere(ch, ch.T);
    return Math.min(ch.tot, c + (ch.tot - cT) * bell(Math.min(1, tt / ch.T))); };
  const chemin = (c: number[][]): Chemin => {
    const N = 400, cum = [0]; let px = 0, py = 0;
    for (let k = 1; k <= N; k++) { const u = k / N, x = bezDe(c, u, 0), y = bezDe(c, u, 1); cum.push(cum[k - 1] + Math.hypot(x - px, y - py)); px = x; py = y; }
    const Lb = cum[N], tot = L + Lb;
    const pos = (d: number) => {
      if (d <= L) return [0, -d, 0];
      const r = Math.min(Lb, d - L); let a = 0, b = N;
      while (b - a > 1) { const m = (a + b) >> 1; if (cum[m] < r) a = m; else b = m; }
      const u = (a + (r - cum[a]) / Math.max(1e-6, cum[b] - cum[a])) / N;
      return [bezDe(c, u, 0), bezDe(c, u, 1) - L, r / Lb];
    };
    return { pos, Lb, tot, T: TV * tot / Lb };   // la même allure qu'avant : le trajet est plus long, il dure d'autant plus
  };
  const enS = (c: number[][]) => {   // la courbure change-t-elle de sens le long du trajet ?
    let signe = 0;
    for (let k = 0; k <= 60; k++) {
      const u = k / 60, v = 1 - u;
      const dx = 3 * (v * v * (c[1][0] - c[0][0]) + 2 * v * u * (c[2][0] - c[1][0]) + u * u * (c[3][0] - c[2][0])), dy = 3 * (v * v * (c[1][1] - c[0][1]) + 2 * v * u * (c[2][1] - c[1][1]) + u * u * (c[3][1] - c[2][1]));
      const ddx = 6 * (v * (c[2][0] - 2 * c[1][0] + c[0][0]) + u * (c[3][0] - 2 * c[2][0] + c[1][0])), ddy = 6 * (v * (c[2][1] - 2 * c[1][1] + c[0][1]) + u * (c[3][1] - 2 * c[2][1] + c[1][1]));
      const k2 = (dx * ddy - dy * ddx) / Math.pow(Math.max(1e-6, dx * dx + dy * dy), 1.5);
      if (Math.abs(k2) < 1e-6) continue;
      const sg = Math.sign(k2); if (signe && sg !== signe) return true; signe = sg;
    }
    return false;
  };
  const montee = (c: number[][]) => { const r = Math.hypot(c[1][0], c[1][1]); return [c[0], [c[0][0], c[0][1] - r], c[2], c[3]]; };   // la courbe part tout droit vers le haut
  const tv = document.querySelector('.terre-video')?.getBoundingClientRect();
  const bordsVus = (ch: Chemin, m: number) => {
    if (!tv || !tv.width) return 0;
    let pire = 0;
    for (let k = 0; k <= 90; k++) {
      const t = ch.T * k / 90, [x, y, eb] = ch.pos(distance(ch, t)), z = 1 - 0.13 * reculA(t), r = m * (9 * Math.PI / 180) * Math.sin(Math.PI * eb), cr = Math.cos(r), sr = Math.sin(r);
      const ecran = (px: number, py: number) => { const qx = (px - cx - x) * z, qy = (py - cy - y) * z; return [cx + cr * qx - sr * qy, cy + sr * qx + cr * qy]; };
      // les bords qui comptent : le bas de la bande et le bas de ses côtés (le haut et les côtés hauts sont fondus au noir)
      const pts: number[][] = [];
      for (let j = 0; j <= 16; j++) pts.push([tv.left + tv.width * j / 16, tv.bottom]);
      for (let j = 0; j <= 6; j++) { const py = tv.top + tv.height * (0.4 + 0.6 * j / 6); pts.push([tv.left + tv.width * 0.04, py], [tv.right - tv.width * 0.04, py]); }
      for (const [px, py] of pts) { const [X, Y] = ecran(px, py); if (X > -2 && X < W + 2 && Y > -2 && Y < H + 2) pire = Math.max(pire, Math.min(X + 2, W + 2 - X, Y + 2, H + 2 - Y)); }
    }
    return pire;   // de combien (px) le bord le plus visible entre dans l'écran (0 : jamais)
  };
  let ang = 0, mir = 1, B = B0, meilleur = Infinity, Bm = montee(B0), mm = 1, am = 0;
  for (let essai = 0; essai < 400; essai++) {
    ang = Math.random() * Math.PI * 2; mir = Math.random() < 0.5 ? -1 : 1;
    const ca = Math.cos(ang), sa = Math.sin(ang), c = B0.map(([x, y]) => [ca * x - sa * y * mir, sa * x + ca * y * mir]);
    let bas = 0;
    for (let k = 0; k <= 40; k++) { const u = k / 40, v = 1 - u; bas = Math.max(bas, v * v * v * c[0][1] + 3 * v * v * u * c[1][1] + 3 * v * u * u * c[2][1] + u * u * u * c[3][1]); }
    if (!(bas < 0.06 * H && c[1][1] < -0.42 * Math.hypot(c[1][0], c[1][1]))) continue;   // jamais sous l'écran, et la dispersion part vers le haut (au moins ~25°)
    const cm = montee(c);
    if (enS(cm)) continue;   // la caméra ne tourne que dans un seul sens (aucun virage en « S », même léger)
    const vus = bordsVus(chemin(cm), mir);
    if (vus < meilleur) { meilleur = vus; Bm = cm; mm = mir; am = ang; }
    if (vus === 0) break;
  }
  B = Bm; mir = mm; ang = am;
  const CH = chemin(B), T = CH.T;                                  // durée totale du voyage (s)
  // la vitesse suit une cloche étroite et tardive : longue accélération progressive, court moment de très haute
  // vitesse (autour de 62 % du trajet), puis freinage ; la position est son intégrale (fonction d'erreur), ramenée à 0 → 1

  // la caméra part dès le clic : une petite part du trajet se fait d'emblée, à vitesse douce (qui s'installe en 0,3 s),
  // avant la grande accélération

  const sortie = (x: number) => 1 - Math.pow(1 - x, 3);
  const t0 = performance.now();
  const position = (t: number) => CH.pos(distance(CH, t));
  const etat = (now: number): Pose => {
    const t = Math.max(0, (now - t0) / 1000), u = Math.min(1, t / T);
    const [x, y, eb] = position(t);
    // vitesse (px/s), pour l'étirement des étoiles : dérivée de la position, calculée sur un court intervalle
    const p2 = position(Math.min(T, t + 0.02)), k = 0.02;
    // le recul du décrochage : il s'installe en douceur (sans à-coup) en une seconde, puis la caméra revient lentement (comme avant)
    const recul = reculA(t);
    // le roulis ne vient qu'avec la dispersion (pendant la montée droite, la caméra reste droite)
    return { x, y, zoom: 1 - 0.13 * recul, roll: mir * (9 * Math.PI / 180) * Math.sin(Math.PI * eb), vx: u >= 1 ? 0 : (p2[0] - x) / k, vy: u >= 1 ? 0 : (p2[1] - y) / k };
  };
  const y0 = camera.repos.y, decale = (p: Pose): Pose => ({ ...p, y: p.y + y0 });   // (le défilement du récit avait un peu déplacé le ciel)
  camera.voyage = (now) => decale(etat(now));
  const fin = etat(t0 + T * 1000);
  let vmax = 1; for (let k = 1; k < 200; k++) { const e = etat(t0 + T * 1000 * k / 200); vmax = Math.max(vmax, Math.hypot(e.vx, e.vy)); }   // la vitesse de pointe (pour le souffle de l'hypervitesse)

  // les modules de la station : chacun garde sa forme (image et légende ensemble), mais dérive et pivote à sa façon
  const centre = (el: Element) => { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };
  const h = (a: number, b: number) => a + Math.random() * (b - a), signe = () => (Math.random() < 0.5 ? -1 : 1);
  // chaque bloc du récit (titre, photo, texte, appel, bouton) est un module ; seuls ceux qui sont à l'écran ou tout près comptent
  const groupes: HTMLElement[][] = [...root.querySelectorAll<HTMLElement>('.p-mod')].map((el) => [el]);   // tous : ceux du haut repassent devant la caméra pendant la montée
  const modules = groupes.map((els) => {
    const cs = els.map(centre), M = [cs.reduce((s, c) => s + c[0], 0) / cs.length, cs.reduce((s, c) => s + c[1], 0) / cs.length];
    const Mo = [M[0], M[1]];   // sa vraie place (pour la forme du module)
    const a = h(0, Math.PI * 2), vit = h(0.7, 2.0);   // (chaos un peu réduit)
    // la poussée du décrochage : chaque module s'écarte doucement du centre de la station, pivote un peu et s'enfonce
    // à peine (chacun à sa profondeur), avec un léger décalage ; et il garde sa vitesse (dans le vide, rien ne freine)
    // la direction de la poussée change à chaque visite : vers l'extérieur, mais déviée au hasard (jusqu'à ±55°)
    const ox0 = M[0] - cx, oy0 = M[1] - cy, b0 = Math.atan2(oy0, ox0) + h(-0.96, 0.96), A = h(4.5, 10);
    return { els: els.map((el, i) => ({ el, E: cs[i], k: 1 })), M, Mo,
      px: Math.cos(b0) * A, py: Math.sin(b0) * A, pr: h(0.19, 0.53) * signe() * Math.PI / 180, ps: h(0.005, 0.013), del: h(0, 0.04),   // par seconde
      vx: Math.cos(a) * vit, vy: Math.sin(a) * vit, w: h(0.09, 0.25) * signe() * Math.PI / 180,   // dérive (px/s) et rotation (rad/s) : à peine
      ox: h(0.35, 0.9), oy: h(0.35, 0.9), f: h(0.6, 1.2), ph: h(0, 6.28) };                          // et un léger flottement
  });

  const fond = document.querySelector<HTMLElement>('.fond'), db = document.body, terre = document.querySelector<HTMLVideoElement>('.terre-video'), nuit = document.querySelector<HTMLElement>('.terre-nuit'), fonduT = document.querySelector<HTMLElement>('.terre-fondu');
  db.classList.add('voyage');
  const place = (now: number) => {
    const t = (now - t0) / 1000, ps = etat(now), cr = Math.cos(ps.roll), sr = Math.sin(ps.roll);
    const vue = (x: number, y: number) => { const qx = (x - cx - ps.x) * ps.zoom, qy = (y - cy - ps.y) * ps.zoom; return [cx + cr * qx - sr * qy, cy + sr * qx + cr * qy]; };
    const lache = sortie(Math.min(1, t / 0.9));                  // le décrochage : la dérive propre s'installe en douceur
    for (const m of modules) {
      const tt = Math.max(0, t - m.del), lance = tt - 0.2 * (1 - Math.exp(-tt / 0.2)) + 0.18 * (1 - Math.exp(-tt / 0.045));   // un petit à-coup au moment du choc (synchro avec le son), puis la vitesse s'installe et reste constante
      const pousse = lance, tourne = lance, enfonce = lance;
      const dx = m.px * pousse + (m.vx * t + Math.sin(t * m.f + m.ph) * m.ox) * lache, dy = m.py * pousse + (m.vy * t + Math.cos(t * m.f * 0.8 + m.ph) * m.oy) * lache;
      const rr = m.pr * tourne + (m.w * t + Math.sin(t * m.f * 0.7 + m.ph) * 0.0018) * lache, ca = Math.cos(rr), sa = Math.sin(rr);
      const sc = ps.zoom * (1 - m.ps * enfonce);
      for (const it of m.els) {
        const rx = it.E[0] - m.Mo[0], ry = it.E[1] - m.Mo[1];
        const [X, Y] = vue(m.M[0] + dx + ca * rx - sa * ry, m.M[1] + dy + sa * rx + ca * ry);   // où son centre doit être à l'écran
        it.el.style.transform = `translate(${((X - it.E[0]) * it.k).toFixed(2)}px, ${((Y - it.E[1]) * it.k).toFixed(2)}px) rotate(${(ps.roll + rr).toFixed(4)}rad) scale(${sc.toFixed(4)})`;
      }
    }
    // le fond peint (poussières et défauts) : deux fois plus grand que l'écran, il suit la caméra au départ tant qu'il
    // dépasse encore (il ne disparaît qu'une fois la caméra lancée) ; puis, à l'arrivée, un fond identique, posé là où
    // la caméra s'arrête, entre dans le champ comme le disque (il apparaît dès qu'il reste moins d'un demi-écran à faire).
    if (fond) {
      const lisse = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
      const depart = t < T * MU;
      const tx = depart ? -ps.x : fin.x - ps.x, ty = depart ? -ps.y : fin.y - ps.y;
      const zr = 1 - 0.5 / Math.max(0.6, ps.zoom), d = Math.max(Math.abs(tx) / (zr * W), Math.abs(ty) / (zr * H)),   // (avec le recul, son bord arrive un peu plus tôt)
            op = 1 - lisse((d - 0.6) / 0.33);   // 1 = le bord du fond touche celui de l'écran
      fond.style.opacity = op.toFixed(3);
      fond.style.transform = `rotate(${ps.roll.toFixed(4)}rad) scale(${ps.zoom.toFixed(4)}) translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;   // le recul du décrochage aussi (comme les étoiles et la Terre)
    }
    // la Terre : posée dans l'espace comme le reste (même caméra : déplacement, recul, roulis) ; la caméra monte, elle sort par le bas
    if (terre) terre.style.transform = `rotate(${ps.roll.toFixed(4)}rad) scale(${ps.zoom.toFixed(4)}) translate(${(-ps.x).toFixed(1)}px, ${(-ps.y).toFixed(1)}px)`;
    if (nuit) nuit.style.transform = terre?.style.transform ?? '';
    if (fonduT) fonduT.style.transform = terre?.style.transform ?? '';
    // le disque d'or, immobile là où la caméra s'arrêtera (au centre de l'écran à la fin)
    const [DX, DY] = vue(cx + fin.x, cy + fin.y);
    // (sur l'accueil lui-même, pas sur la page : sinon tout le document recalcule ses styles à chaque image)
    const wl = document.querySelector<HTMLElement>('.welcome-layer'); if (wl) wl.style.transform = `translate(${(DX - cx).toFixed(1)}px, ${(DY - cy).toFixed(1)}px) rotate(${ps.roll.toFixed(4)}rad) scale(${ps.zoom.toFixed(4)})`;
    platine.souffle(t < T ? Math.max(0.12 * (1 - t / T), Math.pow(Math.hypot(ps.vx, ps.vy) / vmax, 0.4)) : 0);   // le souffle très sourd de l'hypervitesse suit la vitesse — et reste audible tant que la caméra bouge encore
    if (t < T) { requestAnimationFrame(place); return; }
    camera.voyage = null; camera.repos = decale(fin);                    // la caméra s'arrête là : les étoiles y restent
    if (fond) { fond.style.opacity = ''; fond.style.transform = ''; }
    db.classList.remove('voyage'); const wl2 = document.querySelector<HTMLElement>('.welcome-layer'); if (wl2) wl2.style.transform = '';
    root.remove();
    if (terre) { terre.pause(); terre.innerHTML = ''; terre.load(); terre.remove(); }
    nuit?.remove(); fonduT?.remove();   // vidéo arrêtée et libérée (mémoire, décodeur)
  };
  requestAnimationFrame(place);
  // l'accueil (et son son) commence juste avant que le disque n'entre dans le champ
  let entree = T;
  for (let t = 0; t <= T; t += 0.02) {
    const ps = etat(t0 + t * 1000), cr = Math.cos(ps.roll), sr = Math.sin(ps.roll);
    const qx = fin.x - ps.x, qy = fin.y - ps.y, X = (cr * qx - sr * qy) * ps.zoom, Y = (sr * qx + cr * qy) * ps.zoom;
    if (Math.abs(X) < W / 2 + 120 && Math.abs(Y) < H / 2 + 120) { entree = t; break; }
  }
  setTimeout(resolve, Math.max(2.5, entree - 1.3) * 1000);
}

/**
 * Le son du décrochage (clic sur « Établir le contact ») : un décrochage mécanique, bref et assourdi —
 * un verrou qui lâche (un choc de matière, pas une note), puis un léger grondement grave qui accompagne l'élan
 * et s'éteint. Aucune note tenue, aucun son « électronique » : tout part de bruit filtré, comme un vrai choc.
 * Entièrement synthétisé (aucun fichier, aucun droit), calculé à l'avance pour partir sans délai au clic.
 */
const DUREE = 4.6;

/** Calcule le son (≈ 4,5 s, stéréo). */
export async function rendreDetachement(sampleRate: number): Promise<AudioBuffer | null> {
  const OAC = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!OAC) return null;
  const ctx = new OAC(2, Math.ceil(DUREE * sampleRate), sampleRate);
  const g = (v = 0) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const f = (type: BiquadFilterType, hz: number, q = 0.707) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = hz; n.Q.value = q; return n; };
  const bruit = (s: number, graine: number) => {
    const b = ctx.createBuffer(2, Math.ceil(s * sampleRate), sampleRate); let x = graine;
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) { x = (x * 1664525 + 1013904223) % 4294967296; d[i] = x / 2147483648 - 1; } }
    return b;
  };
  const sortie = g(1); sortie.connect(ctx.destination);

  // ── le décrochage : deux chocs de matière très rapprochés (le verrou, puis la pièce qui se libère), étouffés ──
  // un bruit très bref excite quelques résonances graves peu sélectives (un bloc massif, pas une cloche), sous un filtre fermé
  const etouffe = f('lowpass', 380, 0.5), etouffe2 = f('lowpass', 520, 0.5);
  etouffe.connect(etouffe2).connect(sortie);
  for (const [t0, force, graine] of [[0, 1, 11], [0.045, 0.55, 29]]) {
    const s = ctx.createBufferSource(); s.buffer = bruit(0.03, graine); s.start(t0);
    const env = g(); env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(force, t0 + 0.001); env.gain.setTargetAtTime(0, t0 + 0.001, 0.005);
    s.connect(env);
    for (const [hz, q, v] of [[92, 11, 1.6], [151, 12, 1.0], [233, 12, 0.6]]) env.connect(f('bandpass', hz * (1 + (graine % 7) * 0.004), q)).connect(g(v * 22)).connect(etouffe);
    env.connect(g(0.4)).connect(etouffe);   // un peu du choc brut, pour la matière
  }

  // ── le grondement derrière : léger, très grave, il monte avec l'élan puis s'éteint doucement ──
  {
    const s = ctx.createBufferSource(); s.buffer = bruit(DUREE, 3); s.start(0);
    const l1 = f('lowpass', 95), l2 = f('lowpass', 95), hp = f('highpass', 28), gr = g();
    gr.gain.setValueAtTime(0, 0); gr.gain.linearRampToValueAtTime(0.75, 0.35); gr.gain.linearRampToValueAtTime(0.45, 1.6); gr.gain.linearRampToValueAtTime(0, DUREE);
    s.connect(l1).connect(l2).connect(hp).connect(gr).connect(sortie);
  }

  return ctx.startRendering();
}

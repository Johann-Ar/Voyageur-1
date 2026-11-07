/**
 * Accès aux fichiers du site, en un seul endroit.
 * Les chemins sont relatifs à la page : le site fonctionne aussi bien à la racine d'un domaine
 * que dans un sous-dossier (GitHub Pages : https://<compte>.github.io/<dépôt>/).
 */
const url = (p: string) => p.split('/').map(encodeURIComponent).join('/');

/** Adresse d'un fichier affiché (image, icône). */
export function chemin(p: string): string { return p; }

/** Données JSON (liste des images, des sons, formats). */
export async function donnee<T>(p: string, defaut: T): Promise<T> {
  try { const r = await fetch(url(p)); return r.ok ? ((await r.json()) as T) : defaut; } catch { return defaut; }
}

/** Contenu d'un fichier à lire (son, image dont on lit les pixels). */
// les images du disque peuvent être demandées deux fois (l'accueil en 3D, puis le grand disque) : on garde leur lecture
const disques = new Map<string, Promise<Blob>>();
export function fichier(p: string): Promise<Blob> {
  if (!p.startsWith('disque/')) return lire(p);
  let r = disques.get(p); if (!r) { r = lire(p); disques.set(p, r); r.catch(() => disques.delete(p)); }
  return r;
}
async function lire(p: string): Promise<Blob> {
  const r = await fetch(url(p));
  if (!r.ok) throw new Error(`${p} : ${r.status}`);
  return r.blob();
}

/** Adresse d'un fichier dont on lira les pixels (même origine que la page, donc lisible par WebGL). */
export async function urlLisible(p: string): Promise<string> { return p; }

/** Chargement des données : archives et images. */
import { donnee, fichier } from './res.ts';
import type { ArchiveImage } from '../calibration/pairs.ts';

export interface Archive extends ArchiveImage { debut_s: number }

export async function loadArchives(): Promise<Archive[]> {
  const j = await donnee<{ images: Archive[] }>('data/archives.json', { images: [] });
  return j.images;
}

/** `p` : chemin depuis la racine du site, sans « / » initial. */
export async function loadBitmap(p: string): Promise<ImageBitmap> {
  return createImageBitmap(await fichier(p));
}

export async function bitmapToRGBA(bmp: ImageBitmap, maxSide = 1600): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
  const c = new OffscreenCanvas(w, h), g = c.getContext('2d')!;
  g.drawImage(bmp, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h);
  return { width: w, height: h, data: d.data };
}

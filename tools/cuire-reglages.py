# Applique une fois pour toutes les réglages du site (reglages.ts, DEFAUTS) aux images du pré-accueil :
# le site affiche ces images déjà réglées, sans filtre SVG (beaucoup plus léger, surtout pour Safari).
import sys, numpy as np
from PIL import Image
DEFAUTS = {1: dict(contraste=23, hautes=100, ombres=-100), 2: dict(contraste=26, saturation=-100, hautes=100, ombres=-12),
           3: dict(exposition=-8, contraste=100, saturation=-100, hautes=100, ombres=-5)}
NOMS = ['exposition','contraste','saturation','temperature','teinte','hautes','ombres','blancs']
def lisse(a, b, x): t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
def courbe(r):
    c, h, o = r['contraste']/100, r['hautes']/100, r['ombres']/100; pts = []
    for i in range(65):
        y = i / 64
        if c: s = y*y*(3-2*y); y = y + (s - y) * c * 1.6 if c > 0 else y + (0.5 - y) * -c * 0.6
        if h: w = lisse(0.45, 1, y) * 0.55 * h; y += w * ((1 - y) if h > 0 else y)
        if o: w = (1 - lisse(0, 0.55, y)) * 0.55 * o; y += w * ((1 - y) if o > 0 else y)
        b = r['blancs']/100
        if b:
            t0 = 0.5; w = lisse(0.4, 0.6, y)
            v = t0 + (y - t0) / ((1 - 0.35*b) if b > 0 else 1/(1 + 0.35*b))
            if b > 0:
                k = 0.9
                if v > k: v = k + (1-k) * np.tanh((v-k)/(1-k))
            y += w * (v - y)
        pts.append(min(1, max(0, y)))
    return np.array(pts)
def matrice(r):
    e = 2 ** (r['exposition']/100*1.5); s = 1 + r['saturation']/100; t = r['temperature']/100*0.12; g = r['teinte']/100*0.1
    L = [0.2126, 0.7152, 0.0722]; k = [e*(1+t), e*(1-g), e*(1-t)]
    return np.array([[k[i]*((1-s)*L[j] + (s if i == j else 0)) for j in range(3)] for i in range(3)])
def cuire(src, dst, n, gris):
    r = {k: 0 for k in NOMS}; r.update(DEFAUTS[n])
    a = np.asarray(Image.open(src).convert('RGB')).astype(np.float64) / 255
    if gris:   # filtre CSS des images 1 et 2 : grayscale(1) contrast(1.06), avant les réglages
        L = a @ np.array([0.2126, 0.7152, 0.0722]); a = np.repeat(L[..., None], 3, 2)
        a = np.clip((a - 0.5) * 1.06 + 0.5, 0, 1)
    a = np.clip(a @ matrice(r).T, 0, 1)
    t = courbe(r); x = a * 64; i = np.clip(np.floor(x).astype(int), 0, 63); f = x - i
    a = t[i] * (1 - f) + t[i + 1] * f
    out = Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))
    out.save(dst, quality=94, subsampling=0) if dst.endswith('.jpg') else out.save(dst, optimize=True)
d = sys.argv[1]
cuire(f'{d}/01-disque.jpg', f'{d}/01-disque-regle.jpg', 1, True)
cuire(f'{d}/02-lancement.jpg', f'{d}/02-lancement-regle.jpg', 2, True)
cuire(f'{d}/03-point-bleu.png', f'{d}/03-point-bleu-regle.png', 3, False)
print('ok')

#!/usr/bin/env python3
"""
Applique pour de bon les rognages faits avec l'outil du site (?debug, touche C, « Exporter rognages.json »).

  python3 tools/appliquer-rognages.py ~/Downloads/rognages.json

Pour chaque image rognée :
  - l'image décodée (golden-record-decode/images/…) est recadrée — l'original est gardé une fois pour toutes dans
    _a_supprimer/originaux-avant-rognage/ (rien n'est perdu) ;
  - sa vignette (public/thumbs/GR-xxx.jpg) est refaite, et son format est mis à jour (public/thumbs/aspects.json).
Puis : node tools/construire-cle.mjs --fichiers   (la version clé reprend les nouvelles images).

Les rognages sont relatifs à l'image telle qu'elle s'affichait au moment du rognage ; un rognage déjà appliqué
(même cadre, même image) n'est pas refait si on relance le script avec le même fichier.
"""
import json, os, sys, shutil, hashlib
from PIL import Image

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)                 # spatialbox/
PARTAGE = os.path.dirname(RACINE)             # brouillon/ (data/, golden-record-decode/)
THUMBS = os.path.join(RACINE, 'public', 'thumbs')
SAUVE = os.path.join(PARTAGE, '_a_supprimer', 'originaux-avant-rognage')
ETAT = os.path.join(THUMBS, 'rognages-appliques.json')

def main(chemin):
    rognages = json.load(open(chemin))
    archives = {a['id']: a for a in json.load(open(os.path.join(PARTAGE, 'data', 'archives.json')))['images']}
    aspects = json.load(open(os.path.join(THUMBS, 'aspects.json')))
    etat = json.load(open(ETAT)) if os.path.exists(ETAT) else {}
    os.makedirs(SAUVE, exist_ok=True)
    faits = 0
    for gid, c in sorted(rognages.items()):
        a = archives.get(gid)
        if not a: print('inconnu :', gid); continue
        f = os.path.join(PARTAGE, a['fichier_decode'])
        empreinte = hashlib.md5(open(f, 'rb').read()).hexdigest() + json.dumps(c)
        if etat.get(gid) == empreinte: print('déjà fait :', gid); continue
        dst = os.path.join(SAUVE, os.path.basename(f))
        if not os.path.exists(dst): shutil.copy2(f, dst)            # l'original, gardé une seule fois
        im = Image.open(f); w, h = im.size
        x0, y0, x1, y1 = [max(0.0, min(1.0, v)) for v in c]
        box = (round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h))
        if box[2] - box[0] < 8 or box[3] - box[1] < 8: print('trop petit :', gid); continue
        im = im.crop(box); im.save(f)
        t = im.convert('RGB'); t.thumbnail((480, 480), Image.LANCZOS)
        t.save(os.path.join(THUMBS, gid + '.jpg'), quality=85, optimize=True)
        aspects[gid] = round(im.size[0] / im.size[1], 4)
        etat[gid] = hashlib.md5(open(f, 'rb').read()).hexdigest() + json.dumps(c)
        faits += 1
        print(f'{gid} : {w}×{h} → {im.size[0]}×{im.size[1]}')
    json.dump(aspects, open(os.path.join(THUMBS, 'aspects.json'), 'w'), indent=0, ensure_ascii=False)
    json.dump(etat, open(ETAT, 'w'), indent=1)
    print(faits, 'image(s) rognée(s)')

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Downloads/rognages.json'))

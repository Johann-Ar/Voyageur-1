# Voyageur 1 — Le disque d’or

Site web de découverte du **Voyager Golden Record**, le disque d’or embarqué en 1977 à bord de Voyager 1 et Voyager 2.

En 1977, deux sondes quittent la Terre en emportant chacune un disque d’or : des images, des voix, des sons et de la musique. Les **116 images** n’y sont pas imprimées : elles sont gravées dans le sillon sous la forme d’un signal sonore. En 2017, Ron Barry a décodé ce signal à partir d’une copie restée sur Terre ; les images qu’il en a tirées gardent les traces de leur passage par le son (stries, trames, pertes).

Le site raconte cette histoire, puis fait découvrir chaque image **en volume** : elle se reforme sous forme de « splats » gaussiens, que l’on peut approcher et faire tourner.

## Le parcours

1. **Le récit** : l’histoire de Voyager 1 en trois photos d’archives NASA (le disque fixé sur la sonde, le lancement du 5 septembre 1977, le « point bleu pâle » du 14 février 1990), puis le décodage de 2017.
2. **« Établir le contact »** : un voyage dans l’espace jusqu’au disque d’or.
3. **Le disque** : les 116 images disposées autour du disque qui tourne. Glisser pour le faire tourner, cliquer sur une image pour l’ouvrir.
4. **La galerie** : toutes les images en grille (bouton en haut à droite).
5. **L’image en volume** : glisser pour tourner autour, ← → pour passer à la suivante, Échap pour fermer.

Le son accompagne tout le parcours : les salutations, le chant des baleines puis les musiques du disque, passés par un traitement « platine » (souffle, craquements). Le premier clic sur « Établir le contact » autorise le son.

## Lancer le projet

Node 22.6 ou plus récent.

```bash
npm install
npm run dev        # http://localhost:5177
```

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | site statique dans `dist/` |
| `npm run preview` | prévisualiser `dist/` |
| `npm test` | tests de la chaîne de simulation et du rendu |
| `npm run typecheck` | vérification TypeScript |

Adresses utiles : `?entrer` (passe le récit), `?image=GR-050` (ouvre une image), `?debug` (outils de réglage : touche R).

## Mise en ligne

Le site est entièrement statique (chemins relatifs) : `dist/` peut être servi depuis n’importe quel hébergeur, à la racine ou dans un sous-dossier.
Un déploiement **GitHub Pages** est prêt (`.github/workflows/pages.yml`) : dans *Settings → Pages*, choisir *Source : GitHub Actions* ; chaque push sur `main` publie le site.

## Technique

- **Rendu** : moteur WebGL 2 écrit pour le projet (`src/scene/`), sans bibliothèque. Environ 49 000 gaussiennes par image, triées de l’arrière vers l’avant. Chaque gaussienne est étirée dans le sens des traces du balayage de 1977 et se détache là où le signal a abîmé l’image, d’après une carte de perte mesurée sur l’image (`src/app/loss.ts`). Les images couleur arrivent en trois nappes R, V, B — les trois passages du disque.
- **Chaîne de simulation** (`src/chain/`) : encodage d’une image en signal (540 traces, 8,32 ms par trace, mesuré sur le vrai signal), canal (bande passante, bruit, pleurage, décalage R/V/B), décodage selon la méthode décrite par Ron Barry. Calibrée sur 28 paires NASA ↔ décodage (`calibration.html`, `tools/calibrate.ts`).
- **Aucune dépendance à l’exécution** : quelques dizaines de Ko de code ; vignettes chargées au fil du défilement, image en grand à l’ouverture.

```
├─ index.html · calibration.html
├─ src/app/          récit, disque, galerie, visionneuse
├─ src/scene/        splats gaussiens, tri, WebGL
├─ src/chain/        simulation du signal (encodage, canal, décodage)
├─ src/calibration/  page et outils de calibration
├─ public/           images décodées, vignettes, sons, photos d’archives, disque, polices
├─ presets/ · tests/ · tools/
```

## Crédits et droits

Voir [`CREDITS.md`](CREDITS.md). Images du disque : NASA / JPL ; décodage : Ron Barry (2017) ; photos d’archives : NASA / JPL-Caltech, NASA / KSC.
Projet indépendant de présentation, ni produit ni approuvé par la NASA.

**Avant une diffusion publique** : les polices *TRIAL-Vargas* et *Bagerich* sont des versions d’essai/démo (licences à acheter ou polices à remplacer), une partie des musiques du disque est encore sous droits, et plusieurs crédits d’images restent à vérifier (`public/data/archives.json`, `CREDITS.md`).

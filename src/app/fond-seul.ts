/**
 * Le fond spatial seul (poussières et points qui scintillent), pour les pages à part comme le manifeste.
 * Construit en .voyageur/fond.js par tools/construire-cle.mjs.
 */
import { paintSpace, twinkle } from './space.ts';

document.body.classList.add('vue-disque');   // le scintillement ne tourne que dans cette vue
paintSpace(); twinkle();

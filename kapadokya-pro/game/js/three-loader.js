// Three.js once yerel kopyadan (vendor/), olmazsa CDN'den yuklenir.
let T;
try { T = await import('../vendor/three.module.js'); }
catch (e) { T = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'); }
export const THREE = T;

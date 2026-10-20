// ─────────────────────────────────────────────────────────────
//  La composición del hero: dos lápices sobre la foto, en píxeles de la
//  foto (ver encuadre.js). El mundo 3D usa centímetros: px / PPCM.
//
//  giro: grados alrededor de la vertical. −90 deja el lápiz parado con la
//  punta arriba; cada uno se desvía un poco para que no queden paralelos.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

// Luz de la escena (de la izquierda y un poco de arriba); sombras suaves
// que se dibujan sobre la foto.
export const LUZ = new THREE.Vector3(-0.88, 1.1, -0.36).normalize();

export const AMBIENTE = {
  sombra: [0.19, 0.15, 0.1],
  oclusion: 0.75,
  tamLuz: 0.05,
  intensidad: 2.0,
};
export const SOMBRA_SOBRE_FOTO = { fuerza: 0.62, color: [0.09, 0.06, 0.04] };

// punta: dónde queda la punta en la foto (px). El centro sale del largo del objeto.
export const COMPOSICION = [
  { objeto: 'lapiz', variante: 'rojo', x: 593, punta: 508, giro: -88.4, rueda: 0.37 },
  { objeto: 'portaminas', variante: 'petroleo', x: 641, punta: 561, giro: -91.3 },
];

// En escritorio los lápices andan sueltos por el centro y la izquierda del hero, cada uno con su
// ángulo (giro: −90 es parado, punta arriba). fx, fz: dónde cae el centro del lápiz, como
// fracción del ancho y del alto de la pantalla —la foto queda pegada a la derecha y la
// pantalla es de cualquier tamaño, así que no se puede dar en píxeles de la foto—.
export const COMPOSICION_ESCRITORIO = [
  { objeto: 'lapiz', variante: 'rojo', fx: 0.33, fz: 0.5, giro: -66, rueda: 0.37 },
  { objeto: 'portaminas', variante: 'petroleo', fx: 0.54, fz: 0.6, giro: -116 },
];

// Lo que no se puede atravesar, en px de la foto: el borde del libro verde y
// los útiles de abajo a la derecha (cajas invisibles, altura en cm).
export const COLISIONES = [
  { x0: 663, x1: 1037, z0: 318, z1: 925, alto: 2.4 },
  { x0: 689, x1: 1037, z0: 925, z1: 1500, alto: 1.6 },
];

// Los límites del carril, en px de la foto. Los lápices pueden pisar el texto,
// pero no salirse de la hoja: arriba (el clip) y abajo. A la izquierda el límite
// es el borde de la pantalla (index.js).
export const LIMITES = { derecha: 1077, arriba: 330, abajo: 1260 };

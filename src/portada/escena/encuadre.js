// ─────────────────────────────────────────────────────────────
//  Cómo se acomoda la foto del hero en la pantalla. Lo usan el HTML
//  (la foto y el texto) y la escena 3D (la cámara y los colisionadores):
//  los dos tienen que coincidir al píxel, en cualquier pantalla.
//
//  La foto mide 823 × 985. El diseño (Figma) muestra el pedazo de 390 × 842
//  que va de x = 357 a 747 y termina abajo de todo; el resto es "aire" que se
//  ve en pantallas más anchas o más altas. Se escala (`s`) lo justo para que
//  ese pedazo cubra la pantalla, centrado y pegado abajo.
// ─────────────────────────────────────────────────────────────
export const FOTO = { ancho: 823, alto: 985 };
const DISENO = { ancho: 390, alto: 842, centroX: 552 };

// Px de la foto por centímetro del mundo 3D: la escala del lápiz rojo (18,5 cm)
// en el diseño, que coincide con la de los lápices que asoman abajo a la derecha.
export const PPCM = 36.5;

// A partir de este ancho el hero es el de escritorio: ocupa toda la pantalla, la
// foto queda pegada a la derecha y a la izquierda sobra lugar para los lápices.
export const ESCRITORIO = 900;

// W, H: tamaño de la pantalla (px de CSS). Devuelve la escala y el corrimiento
// con los que la foto (en sus píxeles) cae en la pantalla.
export function encuadreHero(W, H) {
  if (W >= ESCRITORIO) {
    // el alto del diseño cubre el alto de la pantalla; el borde derecho de la foto, el de la pantalla
    const s = H / DISENO.alto;
    return { s, tx: W - s * FOTO.ancho, ty: H - s * FOTO.alto };
  }
  const s = Math.max(W / DISENO.ancho, H / DISENO.alto);
  return { s, tx: W / 2 - s * DISENO.centroX, ty: H - s * FOTO.alto };
}

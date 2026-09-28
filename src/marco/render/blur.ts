/**
 * Desenfoque que anda en todos lados.
 *
 * `ctx.filter` es la forma directa de desenfocar en un canvas, pero Safari —el de la
 * Mac y el de todo iPhone, porque en iOS cualquier navegador es Safari por dentro— lo
 * tiene apagado detrás de una opción de desarrollador. Ahí la asignación no hace
 * nada: la sombra del cuadro salía como tres rectángulos de borde duro y el vidrio
 * mate no difuminaba. Los respaldos de acá usan lo que sí existe en todos lados.
 */

let supported: boolean | null = null

/**
 * Si el canvas desenfoca de verdad. Se prueba dibujando y no preguntando por la
 * propiedad: en Safari asignar `filter` crea un campo común y leerlo devuelve lo
 * mismo que se escribió, así que la pregunta daría que sí.
 *
 * La prueba lee píxeles de un canvas de ocho por ocho, aparte del lienzo: es el
 * lienzo el que no puede leerse sin perder la aceleración por GPU.
 */
export function canvasFilterSupported(): boolean {
  if (supported !== null) return supported
  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = 8
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return (supported = false)
  ctx.filter = 'blur(2px)'
  ctx.fillStyle = '#000'
  ctx.fillRect(4, 0, 4, 8)
  // Dos píxeles a la izquierda del borde: sin desenfoque queda vacío.
  supported = ctx.getImageData(2, 4, 1, 1).data[3] > 0
  return supported
}

/**
 * Un rectángulo desenfocado, con `blur` como radio del filtro CSS.
 *
 * El respaldo es el truco de siempre con `shadowBlur`: la forma se dibuja lejos,
 * afuera de todo lo visible, y se desplaza solo su sombra hasta el lugar. El radio
 * va al doble porque `shadowBlur` mide el doble del desvío del gaussiano y el filtro
 * mide el desvío mismo; así los dos caminos dan la misma sombra.
 *
 * Solo para un contexto sin transformación: el corrimiento de la sombra se mide en
 * píxeles del dispositivo y la forma en los del contexto, y con una escala de por
 * medio la sombra caería en otro lado.
 */
export function fillBlurredRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  blur: number,
  color: string,
) {
  ctx.save()
  if (canvasFilterSupported()) {
    ctx.filter = 'blur(' + blur.toFixed(1) + 'px)'
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  } else {
    const away = ctx.canvas.width + w + blur * 6
    ctx.shadowColor = color
    ctx.shadowBlur = blur * 2
    ctx.shadowOffsetX = away
    ctx.fillStyle = '#000'
    ctx.fillRect(x - away, y, w, h)
  }
  ctx.restore()
}

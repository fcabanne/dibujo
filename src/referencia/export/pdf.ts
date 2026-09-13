/**
 * Un PDF de una página con una imagen adentro, escrito a mano.
 *
 * Existe por una sola razón, y es de dibujante y no de programador: una grilla
 * impresa tiene que medir lo que dice que mide. Al mandar un PNG a la impresora, el
 * navegador o el visor lo reescalan "para que entre", y la casilla que iba a ser de
 * 2,5 cm sale de 2,3 — con lo cual la grilla, que servía justamente para no tener
 * que medir, deja de servir. Un PDF con la hoja declarada en su tamaño real se
 * imprime a escala 1:1 y la regla coincide.
 *
 * Es un PDF mínimo: catálogo, una página, un JPEG estirado sobre toda la hoja. Como
 * el JPEG ya viene comprimido, entra tal cual con el filtro DCTDecode y no hace
 * falta ninguna librería.
 */

/** Los objetos del archivo, en orden. El número es la referencia `n 0 R`. */
const OBJECTS = 5

export function jpegToPdf(
  jpeg: Uint8Array,
  imageWidth: number,
  imageHeight: number,
  /** Tamaño de la hoja en puntos PostScript. */
  pageWidth: number,
  pageHeight: number,
): Blob {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets = new Array<number>(OBJECTS + 1).fill(0)
  let length = 0

  const push = (bytes: Uint8Array) => {
    parts.push(bytes)
    length += bytes.length
  }
  const text = (s: string) => push(encoder.encode(s))
  /** Un objeto arranca donde termina lo escrito hasta ahora; la tabla xref lo necesita al byte. */
  const mark = (n: number) => {
    offsets[n] = length
  }

  const w = pageWidth.toFixed(2)
  const h = pageHeight.toFixed(2)

  text('%PDF-1.4\n')

  mark(1)
  text('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')

  mark(2)
  text('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')

  mark(3)
  text(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R ' +
      `/MediaBox [0 0 ${w} ${h}] ` +
      '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
  )

  mark(4)
  text(
    '4 0 obj\n<< /Type /XObject /Subtype /Image ' +
      `/Width ${imageWidth} /Height ${imageHeight} ` +
      '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ' +
      `/Length ${jpeg.length} >>\nstream\n`,
  )
  push(jpeg)
  text('\nendstream\nendobj\n')

  // La matriz estira la imagen unitaria hasta ocupar la hoja entera.
  const content = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`
  mark(5)
  text(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`)

  const startxref = length
  text(`xref\n0 ${OBJECTS + 1}\n0000000000 65535 f \n`)
  for (let n = 1; n <= OBJECTS; n++) {
    text(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`)
  }
  text(`trailer\n<< /Size ${OBJECTS + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`)

  const out = new Uint8Array(length)
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return new Blob([out], { type: 'application/pdf' })
}

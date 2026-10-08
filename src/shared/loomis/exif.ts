/**
 * La focal equivalente a 35 mm que anotó la cámara en el JPEG, si la anotó.
 *
 * Es la única forma de saber la lente sin adivinarla. La mayoría de los celulares
 * la escriben; WhatsApp, Instagram y las capturas de pantalla la borran, y ahí
 * queda la estimación (`fitLens`).
 *
 * Se lee a mano —el bloque APP1, el directorio de la imagen y de ahí el de Exif,
 * buscando la etiqueta 0xA405— porque es lo único que hace falta de todo el EXIF.
 */
export async function focal35(file: Blob): Promise<number | null> {
  try {
    const view = new DataView(await file.slice(0, 256 * 1024).arrayBuffer())
    if (view.getUint16(0) !== 0xffd8) return null
    let offset = 2
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset)
      const size = view.getUint16(offset + 2)
      // APP1 que empieza con "Exif\0\0".
      if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) {
        return readTiff(view, offset + 10)
      }
      if ((marker & 0xff00) !== 0xff00) return null
      offset += 2 + size
    }
  } catch {
    // Un archivo raro no es motivo para frenar nada: se estima.
  }
  return null
}

function readTiff(view: DataView, tiff: number): number | null {
  const little = view.getUint16(tiff) === 0x4949
  const u16 = (at: number) => view.getUint16(at, little)
  const u32 = (at: number) => view.getUint32(at, little)

  const find = (ifd: number, tag: number): number | null => {
    const count = u16(ifd)
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12
      if (u16(entry) === tag) return entry
    }
    return null
  }

  const exifPointer = find(tiff + u32(tiff + 4), 0x8769)
  if (exifPointer === null) return null
  const entry = find(tiff + u32(exifPointer + 8), 0xa405)
  if (entry === null) return null
  const mm = u16(entry + 8)
  return mm > 0 ? mm : null
}

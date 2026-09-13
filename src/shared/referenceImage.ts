/**
 * La foto de referencia vive en dos versiones a la vez, y es a propósito.
 *
 * El original es lo que se exporta: la promesa de Referencia es devolverte tu foto
 * con las líneas encima y nada más — sin recortarla, sin achicarla y sin
 * recomprimirla de más. Por eso acá no se hace lo que hace `imageFile.ts`, que
 * reescala a 2000 px: eso sirve para el probador de enmarcado, donde la imagen es
 * una vista previa, pero acá tirar píxeles sería tirar justamente el producto.
 *
 * Mover el original en cada cuadro de pantalla, en cambio, no tiene sentido: una
 * foto de celular son treinta megapíxeles para dibujar en una ventana de mil. Así
 * que de cada foto se deriva una copia liviana, y esa es la que se ve.
 *
 * El original viaja como Blob y no como data URI porque en base64 pesaría un tercio
 * más, y acá no hay ninguna razón para pagar ese tercio.
 */

/** Lado mayor de la copia que se usa en pantalla. */
const PREVIEW_MAX = 1800

export interface Reference {
  /** El archivo tal cual entró. Es lo que se vuelve a leer al exportar. */
  blob: Blob
  /** Tipo MIME del original, para salir en el mismo formato que entró. */
  type: string
  name: string
  width: number
  height: number
  /** Copia liviana, ya rasterizada, lista para subir a una textura. */
  preview: HTMLCanvasElement
}

/** Ancho dividido alto. Lo piden el cálculo de la grilla y el encaje en la hoja. */
export function aspectOf(ref: Reference): number {
  return ref.width / ref.height
}

export async function openReference(blob: Blob, name: string): Promise<Reference> {
  const img = await decodeBlob(blob)
  const width = img.naturalWidth
  const height = img.naturalHeight
  if (!width || !height) throw new Error('No se pudo leer la imagen')

  const scale = Math.min(1, PREVIEW_MAX / Math.max(width, height))
  const preview = document.createElement('canvas')
  preview.width = Math.max(1, Math.round(width * scale))
  preview.height = Math.max(1, Math.round(height * scale))
  const ctx = preview.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, preview.width, preview.height)

  return { blob, type: blob.type || 'image/png', name, width, height, preview }
}

export async function openReferenceFile(file: File): Promise<Reference> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen')
  return openReference(file, file.name)
}

/**
 * Decodifica el original a tamaño completo. Se pide solo al exportar: tenerlo
 * decodificado todo el tiempo son cientos de megas de mapa de bits esperando a que
 * alguien apriete un botón.
 */
export function decodeFull(ref: Reference): Promise<HTMLImageElement> {
  return decodeBlob(ref.blob)
}

/** El nombre del archivo sin su extensión, para poder ponerle otra. */
export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '') || 'foto'
}

function decodeBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo abrir la imagen'))
    }
    img.src = url
  })
}

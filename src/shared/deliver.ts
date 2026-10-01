/**
 * Entregar un archivo hecho en el navegador. Lo usan Referencia y Enmarcado.
 */

export interface Output {
  blob: Blob
  filename: string
}

export type Delivery = 'compartido' | 'descargado' | 'cancelado'

/**
 * Entregar el archivo por donde el dispositivo sepa entregarlo.
 *
 * En un celular la descarga de siempre es poco confiable: Safari muchas veces abre
 * el archivo en una pestaña en vez de guardarlo, y quedás sin saber dónde fue a
 * parar. La hoja de compartir del sistema sí sabe — te deja elegir Fotos, Archivos o
 * mandarlo. Donde no existe, la descarga común sigue siendo lo correcto.
 */
export async function deliver(output: Output): Promise<Delivery> {
  const file = new File([output.blob], output.filename, { type: output.blob.type })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'compartido'
    } catch (error) {
      // Cerrar la hoja de compartir no es un error: es una respuesta.
      if (error instanceof Error && error.name === 'AbortError') return 'cancelado'
      // Cualquier otra cosa, al camino de siempre.
    }
  }

  download(output)
  return 'descargado'
}

export function download({ blob, filename }: Output): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Con un respiro: revocarla en el mismo tic cancela la descarga en algunos navegadores.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

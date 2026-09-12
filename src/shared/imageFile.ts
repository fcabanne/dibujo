/** Lado mayor al que reescalamos toda obra cargada. */
const MAX_SIDE = 2000

export interface LoadedArtwork {
  src: string
  aspect: number
}

/**
 * Lee un archivo de imagen y lo normaliza. El reescalado no es cosmético: sin él,
 * una foto de cámara de 4 MB en base64 revienta la cuota de localStorage y se pierde
 * el autoguardado.
 */
export function loadArtworkFile(file: File): Promise<LoadedArtwork> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('El archivo no es una imagen'))
      return
    }

    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      const { naturalWidth: w, naturalHeight: h } = img
      if (!w || !h) {
        reject(new Error('No se pudo leer la imagen'))
        return
      }

      const scale = Math.min(1, MAX_SIDE / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('No se pudo procesar la imagen'))
        return
      }
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // PNG conserva la transparencia de un escaneo con fondo recortado.
      const hasAlpha = file.type === 'image/png'
      resolve({
        src: canvas.toDataURL(hasAlpha ? 'image/png' : 'image/jpeg', 0.92),
        aspect: w / h,
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo abrir la imagen'))
    }

    img.src = url
  })
}

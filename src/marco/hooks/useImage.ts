import { useEffect, useState } from 'react'

/** Carga una imagen y avisa cuando está lista para dibujar en el canvas. */
export function useImage(src: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (!cancelled) setImage(img)
    }
    img.onerror = () => {
      if (!cancelled) setImage(null)
    }
    img.src = src

    return () => {
      cancelled = true
    }
  }, [src])

  return image
}

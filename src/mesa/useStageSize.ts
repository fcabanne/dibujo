import { useEffect, useState, type RefObject } from 'react'

/**
 * El tamaño de la pantalla de la mesa, en píxeles, y al día.
 *
 * Las esquinas de la foto viven en fracciones y se dibujan en píxeles, así que
 * hace falta saber cuánto mide la pantalla cada vez que cambia: al girar el
 * teléfono, y cuando la barra del navegador aparece o se va.
 */
export function useStageSize(ref: RefObject<HTMLElement>): { w: number; h: number } | null {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((prev) => (prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return size
}

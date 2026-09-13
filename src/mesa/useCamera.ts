import { useCallback, useEffect, useState, type RefObject } from 'react'

/**
 * Por qué puede no haber imagen. Son estados de excepción: el camino normal es
 * `pidiendo` durante el cartel del navegador y `lista` para siempre.
 */
export type CameraStatus = 'pidiendo' | 'lista' | 'denegada' | 'sin-camara' | 'insegura'

/**
 * Prende la cámara trasera y la deja corriendo en el `<video>`.
 *
 * El permiso no se pregunta dos veces ni se explica: se llama a `getUserMedia` al
 * abrir y el que pregunta es el navegador, con su cartel de siempre. Cualquier
 * intermediario nuestro sería una pantalla más entre la foto y el papel.
 *
 * `getUserMedia` solo existe en contexto seguro (https o localhost). Abierta como
 * archivo suelto, `file://`, no hay cámara y no es algo que se arregle desde acá:
 * por eso `insegura` es un estado con su propio mensaje.
 */
export function useCamera(video: RefObject<HTMLVideoElement>) {
  const [status, setStatus] = useState<CameraStatus>('pidiendo')
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus('insegura')
      return
    }

    let stream: MediaStream | null = null
    let cancelled = false
    setStatus('pidiendo')

    // `ideal` y no `exact`: en una notebook hay una sola cámara y pedirle la trasera
    // con exact falla en vez de dar la que hay.
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((granted) => {
        if (cancelled) {
          granted.getTracks().forEach((track) => track.stop())
          return
        }
        stream = granted
        attach(video.current, granted)
        setStatus('lista')
      })
      .catch((error: DOMException) => {
        if (cancelled) return
        setStatus(error.name === 'NotAllowedError' ? 'denegada' : 'sin-camara')
      })

    // Al volver de otra app el video queda pausado y la pantalla, congelada en el
    // último cuadro. Parece que anda hasta que se mueve el papel y no pasa nada.
    const resume = () => {
      if (document.visibilityState === 'visible') void video.current?.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', resume)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', resume)
      // Sin esto la luz de la cámara queda prendida después de cerrar.
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [attempt, video])

  return { status, retry }
}

function attach(element: HTMLVideoElement | null, stream: MediaStream): void {
  if (!element) return
  element.srcObject = stream
  void element.play().catch(() => {
    // Algún navegador se niega a arrancar solo; el atributo autoplay lo cubre.
  })
}

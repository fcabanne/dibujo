import type { MouseEvent } from 'react'

/**
 * Abre Instagram en la app y no en el navegador. Un `<a href>` normal deja
 * la decisión en manos del sistema, y ahí perdía: abría siempre el
 * navegador. El esquema `instagram://` sí dispara la app cuando está
 * instalada — a la página no le llega ningún aviso de que "funcionó", así
 * que el fallback a la web es la ausencia de una señal (`visibilitychange`)
 * en vez de una confirmación.
 *
 * Lo usan las pantallas de inicio de Referencia y de la mesa de luz, para el
 * link de "Dejame sugerencias".
 */
export function openInstagram(e: MouseEvent, url: string): void {
  e.preventDefault()
  const username = new URL(url).pathname.replace(/\//g, '')
  let fellBack = false
  const fallback = () => {
    if (fellBack || document.hidden) return
    fellBack = true
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  document.addEventListener('visibilitychange', fallback, { once: true })
  window.setTimeout(fallback, 900)
  window.location.href = `instagram://user?username=${username}`
}

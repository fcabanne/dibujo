import { openInstagram } from '../shared/suggestions'

/**
 * Lo que la portada necesita de JavaScript:
 *
 * 1. Que "Dejame sugerencias" abra la app de Instagram en el celular, como en las
 *    herramientas. Sin JavaScript el link sigue funcionando y abre la web.
 * 2. El foco de cada herramienta: cuanto mas cerca del centro de la pantalla, mas
 *    se oscurece la imagen y mas se ve el texto (`--foco`, de 0 a 1).
 * 3. La escena de lapices en 3D de la primera pantalla. Se carga despues de que
 *    la pagina aparece, y solo dibuja mientras esa pantalla se ve.
 */
const link = document.querySelector<HTMLAnchorElement>('.portada-link')
link?.addEventListener('click', (e) => openInstagram(e, link.href))

document.documentElement.classList.add('js')

// --- foco de cada herramienta ----------------------------------------
const secciones = [...document.querySelectorAll<HTMLElement>('.herramienta')]
const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches

const suave = (k: number) => k * k * (3 - 2 * k)

function actualizarFoco() {
  const alto = window.innerHeight
  for (const s of secciones) {
    if (reducido) {
      s.style.setProperty('--foco', '1')
      continue
    }
    const r = s.getBoundingClientRect()
    // 0 cuando el centro de la seccion esta a una pantalla del centro, 1 cuando coincide
    const d = Math.abs(r.top + r.height / 2 - alto / 2) / (alto * 0.55)
    s.style.setProperty('--foco', suave(Math.max(0, Math.min(1, 1 - d))).toFixed(3))
  }
}

let pendiente = false
function alScroll() {
  if (pendiente) return
  pendiente = true
  requestAnimationFrame(() => {
    pendiente = false
    actualizarFoco()
  })
}
window.addEventListener('scroll', alScroll, { passive: true })
window.addEventListener('resize', alScroll)
actualizarFoco()

// --- la escena -----------------------------------------------------
const hero = document.querySelector<HTMLElement>('.hero')
const lienzo = document.querySelector<HTMLCanvasElement>('#lienzo')
const permiso = document.querySelector<HTMLButtonElement>('#permiso')

async function iniciarEscena() {
  if (!hero || !lienzo) return
  try {
    const { iniciarEscena } = await import('./escena/index.js')
    const escena = await iniciarEscena(lienzo, hero, {
      onPrimera: () => undefined,
    })
    hero.classList.add('listo')

    // En iOS el sensor se activa con un permiso que se pide con un toque.
    if (permiso && escena.necesitaPermiso()) {
      permiso.hidden = false
      permiso.addEventListener('click', async () => {
        if (await escena.pedirPermiso()) permiso.hidden = true
      })
    }

    // Solo dibuja mientras la primera pantalla se ve.
    new IntersectionObserver(([e]) => escena.activar(e.isIntersecting), { threshold: 0.05 }).observe(hero)

    ;(window as unknown as { __escena: unknown }).__escena = escena
  } catch (error) {
    // Sin WebGL queda el fondo y el titulo: la portada sigue sirviendo.
    console.warn('No se pudo iniciar la escena', error)
  }
}

if ('requestIdleCallback' in window) requestIdleCallback(() => void iniciarEscena(), { timeout: 800 })
else setTimeout(() => void iniciarEscena(), 200)

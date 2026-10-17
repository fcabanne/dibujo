import { openInstagram } from '../shared/suggestions'
import { encuadreHero } from './escena/encuadre.js'

/**
 * Lo que la portada necesita de JavaScript:
 *
 * 1. Que los links a Instagram abran la app en el celular, como en las herramientas.
 *    Sin JavaScript siguen funcionando y abren la web.
 * 2. Acomodar el hero: la foto y el texto se escalan juntos (encuadre.js), igual
 *    que la escena 3D.
 * 3. El parallax de las fotos de las tarjetas, atado al scroll.
 * 4. Los trazos a mano: se animan (stop motion) solo mientras se ven.
 * 5. La escena de lapices en 3D: se carga despues de que la pagina aparece y solo
 *    dibuja mientras el hero se ve.
 */
for (const link of document.querySelectorAll<HTMLAnchorElement>('.portada-link')) {
  link.addEventListener('click', (e) => openInstagram(e, link.href))
}

const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches
if (!reducido) document.documentElement.classList.add('anima')

// --- hero: la foto y el texto ----------------------------------------
const hero = document.querySelector<HTMLElement>('.hero')
const mundo = document.querySelector<HTMLElement>('#hero-mundo')

function acomodarHero() {
  if (!hero || !mundo) return
  const { s, tx, ty } = encuadreHero(hero.clientWidth, hero.clientHeight)
  mundo.style.setProperty('--s', String(s))
  mundo.style.setProperty('--tx', `${tx}px`)
  mundo.style.setProperty('--ty', `${ty}px`)
}
if (hero) {
  acomodarHero()
  new ResizeObserver(acomodarHero).observe(hero)
}

// --- parallax de las fotos de las tarjetas -----------------------------
const PARALLAX = 54 // px: lo que sobra de la foto arriba y abajo del marco
const tarjetas = [...document.querySelectorAll<HTMLElement>('.tarjeta')]

function alScroll() {
  document.body.classList.toggle('scrolleo', window.scrollY > 30)
  if (reducido) return
  const alto = window.innerHeight
  for (const t of tarjetas) {
    const r = t.getBoundingClientRect()
    // +1 cuando la tarjeta entra por abajo, -1 cuando sale por arriba
    const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - alto / 2) / (alto / 2 + r.height / 2)))
    t.style.setProperty('--py', `${(-p * PARALLAX).toFixed(2)}px`)
  }
}

let pendiente = false
function pedirScroll() {
  if (pendiente) return
  pendiente = true
  requestAnimationFrame(() => {
    pendiente = false
    alScroll()
  })
}
window.addEventListener('scroll', pedirScroll, { passive: true })
window.addEventListener('resize', pedirScroll)
alScroll()

// --- trazos a mano: viven mientras se ven -------------------------------
const vigia = new IntersectionObserver(
  (entradas) => {
    for (const e of entradas) e.target.classList.toggle('viva', e.isIntersecting)
  },
  { threshold: 0.4 },
)
for (const trazo of document.querySelectorAll('.trazo')) vigia.observe(trazo)

// --- la escena -----------------------------------------------------
const lienzo = document.querySelector<HTMLCanvasElement>('#lienzo')

async function iniciarEscena() {
  if (!hero || !lienzo) return
  try {
    const { iniciarEscena } = await import('./escena/index.js')
    const escena = await iniciarEscena(lienzo, hero)
    hero.classList.add('listo')
    // Solo dibuja mientras la primera pantalla se ve.
    new IntersectionObserver(([e]) => escena.activar(e.isIntersecting), { threshold: 0.05 }).observe(hero)
    ;(window as unknown as { __escena: unknown }).__escena = escena
  } catch (error) {
    // Sin WebGL queda la foto con el texto: la portada sigue sirviendo.
    console.warn('No se pudo iniciar la escena', error)
  }
}

if ('requestIdleCallback' in window) requestIdleCallback(() => void iniciarEscena(), { timeout: 800 })
else setTimeout(() => void iniciarEscena(), 200)

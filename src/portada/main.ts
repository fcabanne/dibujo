import { hasChosenLanguage, keepLanguage, language, setLanguage } from '../shared/copy'
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
 * 5. El idioma: el selector y el aviso de la primera visita (los textos ya vienen
 *    en el idioma elegido, `translateDocument`).
 * 6. La escena de lapices en 3D: se carga despues de que la pagina aparece y solo
 *    dibuja mientras el hero se ve.
 */
for (const link of document.querySelectorAll<HTMLAnchorElement>('.portada-link')) {
  link.addEventListener('click', (e) => openInstagram(e, link.href))
}

// --- idioma -----------------------------------------------------------
// Los textos del HTML ya vienen en el idioma elegido (`translateDocument`, al importar
// `copy`). Acá van los botones: elegir uno recarga la pagina en ese idioma; elegir el que ya
// esta puesto, o cerrar el aviso, solo deja asentado que ya se eligio.
const aviso = document.querySelector<HTMLElement>('#idioma-aviso')
if (aviso && !hasChosenLanguage) aviso.hidden = false

for (const boton of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
  const idioma = boton.dataset.lang ?? ''
  if (boton.classList.contains('idioma-op')) boton.setAttribute('aria-pressed', String(idioma === language))
  boton.addEventListener('click', () => {
    if (idioma === language) {
      keepLanguage()
      if (aviso) aviso.hidden = true
    } else {
      setLanguage(idioma)
    }
  })
}

document.querySelector('#idioma-cerrar')?.addEventListener('click', () => {
  keepLanguage()
  if (aviso) aviso.hidden = true
})

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

// --- escritorio ---------------------------------------------------------
// Solo con un ancho de escritorio y un mouse de verdad: el celular no pasa por acá.
const escritorio = matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)')

if (escritorio.matches) {
  const articulos = [...document.querySelectorAll<HTMLElement>('.herramienta')]

  // las tres tarjetas entran de a una (el escalonado lo hace el CSS con --orden)
  articulos.forEach((a, i) => a.style.setProperty('--orden', String(i)))
  const entrada = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue
        // entran todas juntas, escalonadas: con una que se vea alcanza
        for (const a of articulos) a.classList.add('entra')
        entrada.disconnect()
      }
    },
    { threshold: 0.25 },
  )
  for (const a of articulos) entrada.observe(a)

  // al pasar el mouse por una tarjeta, el circulo de "Probar" se vuelve a dibujar
  for (const t of tarjetas) {
    const circulo = t.querySelector('.trazo-boton')
    t.addEventListener('pointerenter', () => {
      if (!circulo || !circulo.classList.contains('viva')) return
      circulo.classList.remove('viva')
      void (circulo as SVGElement).getBoundingClientRect()
      circulo.classList.add('viva')
    })
  }

  // parallax de las fotos con el mouse: muy tenue, en horizontal y en vertical.
  // La foto se corre hacia donde esta el puntero, con un resorte suave.
  const MAX_X = 12
  const MAX_Y = 9
  let mx = innerWidth / 2
  let my = innerHeight / 2
  const actual = new Map<HTMLElement, { x: number; y: number }>()
  let corriendo = false

  function paso() {
    let quieto = true
    for (const t of tarjetas) {
      const r = t.getBoundingClientRect()
      const nx = Math.max(-1, Math.min(1, (mx - (r.left + r.width / 2)) / (innerWidth / 2)))
      const ny = Math.max(-1, Math.min(1, (my - (r.top + r.height / 2)) / (innerHeight / 2)))
      const a = actual.get(t) ?? { x: 0, y: 0 }
      const x = a.x + (nx * MAX_X - a.x) * 0.08
      const y = a.y + (ny * MAX_Y - a.y) * 0.08
      if (Math.abs(x - a.x) > 0.02 || Math.abs(y - a.y) > 0.02) quieto = false
      actual.set(t, { x, y })
      t.style.setProperty('--mx', `${x.toFixed(2)}px`)
      t.style.setProperty('--my', `${y.toFixed(2)}px`)
    }
    corriendo = !quieto
    if (corriendo) requestAnimationFrame(paso)
  }
  window.addEventListener(
    'pointermove',
    (e) => {
      if (reducido || e.pointerType !== 'mouse') return
      mx = e.clientX
      my = e.clientY
      if (!corriendo) {
        corriendo = true
        requestAnimationFrame(paso)
      }
    },
    { passive: true },
  )
}

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

/**
 * El "wobble" de los íconos.
 *
 * En Figma los íconos llevan Dynamic Stroke (frecuencia 2,19, wiggle 0,46,
 * suavizado 1): el trazo ondula apenas, unos 0,3 px, como una línea hecha
 * a mano. Acá se reproduce a partir de la línea central de cada ícono, que es
 * lo que se dibujó en Figma: se la muestrea en puntos y se corre cada uno de
 * costado con un ruido liso a lo largo del trazo.
 *
 * `frame` cambia las fases del ruido sin cambiar la forma: el frame 0 es el
 * ícono en reposo, y pasar de un frame a otro es el trazo "hirviendo", que es
 * lo que se usa en el hover de escritorio (`useBoil`).
 */

/** Cada cuántos píxeles (en el 24×24 del ícono) cae un punto del muestreo. */
const STEP = 0.6
/** Cuánto se corre el trazo, en píxeles del 24×24. Salió de medir el de Figma. */
const AMPLITUDE = 0.3
const TAU = Math.PI * 2

type Point = [number, number]
type Sub = { pts: Point[]; closed: boolean }

/** Un ícono: dónde cae su caja en el 24×24 y su línea central (M L C Z). */
export type IconSpec = readonly [x: number, y: number, d: string]

function parse([ox, oy, d]: IconSpec): Sub[] {
  const tok = d.match(/[MLCZ]|-?\d*\.?\d+/gi) ?? []
  const subs: Sub[] = []
  let cur: Sub | null = null
  let i = 0
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  let cmd = ''
  const num = () => parseFloat(tok[i++])
  const push = (x: number, y: number) => {
    cur!.pts.push([x + ox, y + oy])
    cx = x
    cy = y
  }
  const line = (x: number, y: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x - cx, y - cy) / STEP))
    const x0 = cx
    const y0 = cy
    for (let k = 1; k <= n; k++) push(x0 + ((x - x0) * k) / n, y0 + ((y - y0) * k) / n)
  }
  while (i < tok.length) {
    if (/[MLCZ]/i.test(tok[i])) cmd = tok[i++]
    if (cmd === 'M') {
      cx = num()
      cy = num()
      sx = cx
      sy = cy
      cur = { pts: [[cx + ox, cy + oy]], closed: false }
      subs.push(cur)
      cmd = 'L'
    } else if (cmd === 'L') {
      line(num(), num())
    } else if (cmd === 'C') {
      const x1 = num()
      const y1 = num()
      const x2 = num()
      const y2 = num()
      const x = num()
      const y = num()
      const len = Math.hypot(x - cx, y - cy) + Math.hypot(x1 - cx, y1 - cy) + Math.hypot(x - x2, y - y2)
      const n = Math.max(4, Math.ceil(len / STEP))
      const x0 = cx
      const y0 = cy
      for (let k = 1; k <= n; k++) {
        const t = k / n
        const u = 1 - t
        push(
          u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
          u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
        )
      }
    } else if (cmd === 'Z') {
      line(sx, sy)
      cur!.closed = true
      cmd = ''
    } else {
      break
    }
  }
  return subs
}

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Ruido liso a lo largo del trazo: dos senos de largo de onda distinto. */
function noise(s: number, seed: number, frame: number) {
  const p1 = hash(seed * 3.1 + frame * 17.3) * TAU
  const p2 = hash(seed * 7.7 + frame * 5.9 + 1) * TAU
  return 0.64 * Math.sin((TAU * s) / 11.3 + p1) + 0.36 * Math.sin((TAU * s) / 4.9 + p2)
}

const r1 = (v: number) => Math.round(v * 10) / 10

/** El muestreo de un ícono, hecho una sola vez: lo único que cambia entre frames es el ruido. */
export function prepare(spec: IconSpec, seed: number) {
  const subs = parse(spec).map((sub) => {
    const arc = [0]
    for (let k = 1; k < sub.pts.length; k++) {
      arc.push(arc[k - 1] + Math.hypot(sub.pts[k][0] - sub.pts[k - 1][0], sub.pts[k][1] - sub.pts[k - 1][1]))
    }
    return { ...sub, arc }
  })
  return (frame: number) =>
    subs
      .map((sub, si) => {
        const p = sub.pts
        const n = p.length
        const total = sub.arc[n - 1]
        const out = p.map((q, k) => {
          const a = p[Math.max(0, k - 2)]
          const b = p[Math.min(n - 1, k + 2)]
          let tx = b[0] - a[0]
          let ty = b[1] - a[1]
          const l = Math.hypot(tx, ty) || 1
          tx /= l
          ty /= l
          const m = noise(sub.arc[k], seed + si * 7, frame) * AMPLITUDE
          // Las puntas libres nacen y mueren sobre su lugar, sin corrimiento.
          const k0 = sub.closed ? 1 : Math.min(1, sub.arc[k] / 1.2, (total - sub.arc[k]) / 1.2)
          return `${r1(q[0] - ty * m * k0)} ${r1(q[1] + tx * m * k0)}`
        })
        return 'M' + out.join('L') + (sub.closed ? 'Z' : '')
      })
      .join('')
}

/** Cuántos cuadros por segundo hierve el trazo: lento, como un lápiz que tiembla. */
const BOIL_FPS = 9

/**
 * El hover de escritorio: mientras el puntero está sobre el control que
 * contiene al ícono, el trazo cambia de frame. Al salir vuelve al reposo.
 *
 * Solo con un puntero que pasa por encima (en un celular el hover queda pegado
 * después del toque) y no con `prefers-reduced-motion`. Escribe el atributo
 * directo, sin pasar por React: son nueve cuadros por segundo.
 */
export function boilOnHover(svg: SVGSVGElement, draw: (frame: number) => string) {
  const path = svg.querySelector('path')
  const host = svg.closest<HTMLElement>('button, a, label, [role="button"], .ds-option, .ds-swatch')
  if (!path || !host) return
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

  let timer = 0
  let frame = 0
  const stop = () => {
    window.clearInterval(timer)
    timer = 0
    path.setAttribute('d', draw(0))
  }
  const start = () => {
    if (timer) return
    timer = window.setInterval(() => path.setAttribute('d', draw(++frame)), 1000 / BOIL_FPS)
    path.setAttribute('d', draw(++frame))
  }
  host.addEventListener('pointerenter', start)
  host.addEventListener('pointerleave', stop)
  return () => {
    host.removeEventListener('pointerenter', start)
    host.removeEventListener('pointerleave', stop)
    window.clearInterval(timer)
  }
}

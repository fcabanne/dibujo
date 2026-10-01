import { useCallback, useEffect, useRef, useState } from 'react'
import { copy } from '../../shared/copy'
import { loadArtworkFile } from '../../shared/imageFile'
import { openInstagram } from '../../shared/suggestions'
import { BackIcon, SpeakerIcon, SpeakerOffIcon } from '../../shared/ui'
import { setMuted, useMuted } from '../sound/engine'
import { reducedMotionNow, settleSpring, stepSpring, type Spring, type SpringParams } from '../../shared/motion'
import {
  FRAME_PROFILES,
  MOLDING_FAMILIES,
  FRAME_PRESETS,
  GLASS_TYPES,
  MAT_PRESETS,
  WALL_PATTERNS,
  WALL_PRESETS,
} from '../domain/palettes'
import { anchorsFor, draggableTarget } from '../interaction/zones'
import type { Action } from '../state/reducer'
import type { AppState, GlassType, Layout } from '../types'
import type { SceneSnapshot } from './Canvas'
import { Cartela } from './hud/Cartela'
import {
  chooseDirection,
  inFan,
  layoutFan,
  type Box,
  type FanLayout,
  type Point,
} from './hud/fan'
import { ArtIcon, FrameIcon, GlassIcon, MatIcon, UploadIcon, WallIcon } from './hud/icons'
import { RadialMenu, type FanItem } from './hud/RadialMenu'
import { Swatch } from './hud/Swatch'

export type Category = 'frame' | 'mat' | 'wall' | 'glass' | 'artwork'

const CATEGORIES: { id: Category; label: string; Icon: () => JSX.Element }[] = [
  { id: 'frame', label: copy.marco.tabs.frame, Icon: FrameIcon },
  { id: 'mat', label: copy.marco.tabs.mat, Icon: MatIcon },
  { id: 'wall', label: copy.marco.tabs.wall, Icon: WallIcon },
  { id: 'glass', label: copy.marco.tabs.glass, Icon: GlassIcon },
  { id: 'artwork', label: copy.marco.tabs.artwork, Icon: ArtIcon },
]

/** Hacia dónde prefiere abrirse cada abanico: siempre hacia afuera de su lado. */
const PREFER: Record<Category, number> = {
  frame: 180,
  mat: 180,
  glass: 0,
  wall: 0,
  artwork: 90,
}

interface Props {
  state: AppState
  dispatch: (action: Action) => void
  sceneRef: React.MutableRefObject<SceneSnapshot>
  layout: Layout
  awake: boolean
  open: Category | null
  onOpenChange: (next: Category | null) => void
  /** Aplica un cambio sin confirmarlo, para ver la opción antes de elegirla. */
  onPreview: (action: Action | null) => void
  /** Vuelve a la pantalla de inicio, sin tocar el enmarcado. */
  onRemove: () => void
}

/** Un abanico ya resuelto: qué es, hacia dónde se abre y de dónde parte. */
interface Fan {
  id: Category
  deg: number
  layout: FanLayout
  origin: Point
}

const cmLabel = (n: number) => n.toFixed(1).replace('.', ',') + ' cm'

/** Cuánto pasa el puntero sobre una burbuja antes de que abra: pasar de largo no abre. */
const INTENT_MS = 80
/** Respiro al salir del cuerno del abanico. Corto: solo tapa el temblor de la mano. */
const LEAVE_MS = 140
/** Lo que tarda en desmontarse un abanico que se cierra: lo que dura su animación. */
const LINGER_MS = 260
/** La cartela se queda dos segundos más que el resto del HUD. */
const LABEL_GRACE_MS = 2000

/** Las burbujas y la cartela siguen al cuadro con resorte: llegan un poco después que él. */
const BUBBLE_FOLLOW: SpringParams = { response: 0.24, damping: 0.85 }
const LABEL_FOLLOW: SpringParams = { response: 0.3, damping: 0.85 }
/** A qué distancia del puntero empieza a despertar una burbuja, y a cuál llega entera. */
const NEAR = 40
const FAR = 200

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** Arranca suave y llega suave: la burbuja no crece de golpe al acercarte. */
const smooth = (t: number) => t * t * (3 - 2 * t)

/**
 * Capa de control sobre el lienzo. No hay barra ni panel: cada burbuja sale por el
 * medio de un lado del cuadro y los anchos se arrastran directamente sobre él.
 *
 * Las posiciones se escriben por rAF directo sobre el DOM en vez de pasar por estado
 * de React: son las mismas de cada frame del render, y hacerlo con estado sería un
 * re-render por frame. Lo mismo la proximidad, que se suaviza acá.
 */
export function Overlay({
  state,
  dispatch,
  sceneRef,
  layout,
  awake,
  open,
  onOpenChange,
  onPreview,
  onRemove,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const bubbleRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const gizmoRef = useRef<HTMLDivElement>(null)
  const gizmoValueRef = useRef<HTMLSpanElement>(null)
  /** La medida de la última vez, para notar cuándo la banda cae en otra muesca. */
  const lastCmRef = useRef<number | null>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const soundRef = useRef<HTMLButtonElement>(null)
  const muted = useMuted()
  const presence = useRef(0)
  const litRef = useRef<HTMLDivElement>(null)
  const leaderRef = useRef<SVGSVGElement>(null)
  const leaderLine = useRef<SVGLineElement>(null)
  const leaderDot = useRef<SVGCircleElement>(null)
  const mat = state.mats[0]

  const [labelAwake, setLabelAwake] = useState(false)
  const [wallLuma, setWallLuma] = useState(0.5)
  /** Abierto con un clic (o desde afuera): no se cierra solo al salir el puntero. */
  const [pinned, setPinned] = useState(false)
  const [fan, setFan] = useState<Fan | null>(null)

  // Lo que el rAF y los manejadores de ventana leen sin volver a montarse.
  const openRef = useRef(open)
  openRef.current = open
  const pinnedRef = useRef(pinned)
  pinnedRef.current = pinned
  const fanRef = useRef(fan)
  fanRef.current = fan
  const anchorPos = useRef<Partial<Record<Category, Point>>>({})
  /** Lo que acompaña al cuadro con resorte: dónde está cada cosa y a qué velocidad va. */
  const followers = useRef(new Map<string, { x: Spring; y: Spring }>())
  const follow = (key: string, to: { x: number; y: number }, params: SpringParams, dt: number) => {
    let f = followers.current.get(key)
    if (!f || reducedMotionNow()) {
      f = { x: { x: to.x, v: 0 }, y: { x: to.y, v: 0 } }
      followers.current.set(key, f)
      return to
    }
    stepSpring(f.x, to.x, params, dt)
    stepSpring(f.y, to.y, params, dt)
    settleSpring(f.x, to.x, 0.05)
    settleSpring(f.y, to.y, 0.05)
    return { x: f.x.x, y: f.y.x }
  }
  const pointer = useRef<Point | null>(null)
  const prox = useRef<Record<string, number>>({})
  /** Quién abrió la categoría abierta: si no fue el puntero, queda fija. */
  const hoverOpened = useRef<Category | null>(null)
  const intentTimer = useRef(0)
  const leaveTimer = useRef(0)
  const lingerTimer = useRef(0)

  // La cartela tarda más en irse que las burbujas: se lee, no se opera.
  useEffect(() => {
    if (awake) {
      setLabelAwake(true)
      return
    }
    const id = window.setTimeout(() => setLabelAwake(false), LABEL_GRACE_MS)
    return () => window.clearTimeout(id)
  }, [awake])

  // --- abrir, fijar y cerrar --------------------------------------------------

  const view = () => ({
    w: rootRef.current?.clientWidth ?? window.innerWidth,
    h: rootRef.current?.clientHeight ?? window.innerHeight,
  })

  /** Resuelve hacia dónde se abre una categoría, con lo que hay en pantalla ahora. */
  const prepare = (id: Category): Fan | null => {
    const scene = sceneRef.current
    if (!scene.rects) return null
    const v = view()
    const origin = anchorsFor(scene.rects, v)[id]
    const rowLayout = layoutFan(rowsFor(id).map((row) => row.length))
    const o = scene.rects.outer
    const avoid: Box[] = [{ x: o.x, y: o.y, w: o.w, h: o.h }]
    const root = rootRef.current?.getBoundingClientRect()
    for (const pill of [backRef.current, linkRef.current, soundRef.current]) {
      const r = pill?.getBoundingClientRect()
      if (r && root) avoid.push({ x: r.left - root.left, y: r.top - root.top, w: r.width, h: r.height })
    }
    return {
      id,
      origin,
      layout: rowLayout,
      deg: chooseDirection({ layout: rowLayout, origin, view: v, avoid, prefer: PREFER[id] }),
    }
  }

  const openOn = (id: Category, pin: boolean) => {
    window.clearTimeout(intentTimer.current)
    window.clearTimeout(leaveTimer.current)
    window.clearTimeout(lingerTimer.current)
    if (open === id) {
      if (pin) setPinned(true)
      return
    }
    hoverOpened.current = pin ? null : id
    onPreview(null)
    setFan(prepare(id))
    setPinned(pin)
    onOpenChange(id)
  }

  const close = useCallback(() => {
    window.clearTimeout(intentTimer.current)
    window.clearTimeout(leaveTimer.current)
    setPinned(false)
    onOpenChange(null)
  }, [onOpenChange])

  /** Pasar por encima abre, con un instante de intención: pasar de largo no abre. */
  const intend = (id: Category) => {
    const current = openRef.current
    if (current === id) return
    if (current) {
      // Con otro abanico abierto, pasar a esta burbuja lo cambia solo si el puntero ya
      // salió del cuerno del abierto: cruzar una burbuja al ir hacia una muestra no
      // puede cambiar de categoría. Fijo, se cambia con un clic.
      const f = fanRef.current
      const a = anchorPos.current[current]
      const p = pointer.current
      if (pinnedRef.current || !f || !a || !p || inFan(p, a, f.layout, f.deg)) return
    }
    window.clearTimeout(intentTimer.current)
    intentTimer.current = window.setTimeout(() => openOn(id, false), INTENT_MS)
  }

  const dismissIntent = () => window.clearTimeout(intentTimer.current)

  /**
   * Un clic fija el abanico abierto; otro sobre la misma burbuja lo cierra. Fijo, el
   * abanico deja de depender del puntero: se puede mirar el cuadro con el mouse
   * afuera y elegir después.
   */
  const clickBubble = (id: Category) => {
    dismissIntent()
    if (open === id && pinned) close()
    else openOn(id, true)
  }

  // Una categoría abierta por otra vía —soltar un dibujo abre la obra— queda fija: no
  // hay un puntero que la esté sosteniendo.
  useEffect(() => {
    if (open === null) {
      hoverOpened.current = null
      setPinned(false)
      window.clearTimeout(lingerTimer.current)
      lingerTimer.current = window.setTimeout(() => setFan(null), LINGER_MS)
      return
    }
    if (hoverOpened.current !== open) setPinned(true)
    if (!fanRef.current || fanRef.current.id !== open) setFan(prepare(open))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => () => {
    window.clearTimeout(intentTimer.current)
    window.clearTimeout(leaveTimer.current)
    window.clearTimeout(lingerTimer.current)
  }, [])

  // Al cerrarse el menú se descarta lo que estabas previsualizando: si no, el cuadro
  // se quedaría mostrando una opción que nunca elegiste.
  useEffect(() => {
    if (!open) onPreview(null)
  }, [open, onPreview])

  // El puntero, en coordenadas de la capa. Lo leen el rAF (proximidad) y la zona de cierre.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const box = rootRef.current?.getBoundingClientRect()
      if (!box) return
      const p = { x: e.clientX - box.left, y: e.clientY - box.top }
      pointer.current = p

      // Sin fijar, el abanico vive mientras el puntero esté en su cuerno o en la
      // burbuja. No hay un rectángulo invisible ni un plazo largo: es una cuenta.
      const id = openRef.current
      const f = fanRef.current
      if (!id || pinnedRef.current || !f || f.id !== id) return
      const a = anchorPos.current[id]
      if (!a) return

      const onBubble = Math.hypot(p.x - a.x, p.y - a.y) <= 34
      const onExtra = overExtra(id, p, box)
      if (onBubble || onExtra || inFan(p, a, f.layout, f.deg)) {
        window.clearTimeout(leaveTimer.current)
      } else {
        window.clearTimeout(leaveTimer.current)
        leaveTimer.current = window.setTimeout(close, LEAVE_MS)
      }
    }
    // Con el puntero fuera de la ventana no hay nada que sostenga un abanico sin fijar.
    const onLeaveWindow = () => {
      pointer.current = null
      if (openRef.current && !pinnedRef.current) {
        window.clearTimeout(leaveTimer.current)
        leaveTimer.current = window.setTimeout(close, LEAVE_MS)
      }
    }
    window.addEventListener('pointermove', onMove)
    document.documentElement.addEventListener('mouseleave', onLeaveWindow)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeaveWindow)
    }
  }, [close])

  /**
   * ¿Está el puntero sobre lo que la categoría abre fuera del abanico —la cartela de
   * la obra— o en el camino entre eso y su burbuja?
   */
  const overExtra = (id: Category, p: Point, box: DOMRect) => {
    const card = id === 'artwork' ? labelRef.current?.getBoundingClientRect() : null
    const a = anchorPos.current[id]
    if (!card || !a) return false
    const pad = 28
    const left = Math.min(card.left - box.left, a.x - 24) - pad
    const right = Math.max(card.right - box.left, a.x + 24) + pad
    const top = Math.min(card.top - box.top, a.y - 24) - pad
    const bottom = Math.max(card.bottom - box.top, a.y + 24) + pad
    return p.x >= left && p.x <= right && p.y >= top && p.y <= bottom
  }

  // Cerrar el abanico al tocar fuera del lienzo de controles, o con Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  // --- el rAF: posiciones, proximidad, luz sobre la parte, hilo, gizmo --------

  useEffect(() => {
    let frame = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = Math.min(0.064, (now - last) / 1000)
      last = now
      const scene = sceneRef.current
      const rects = scene.rects

      // Presencia: con el mouse quieto un rato, los controles se van del todo y queda
      // el cuadro solo. Aparecen rápido y se van despacio, y se suavizan acá por lo
      // mismo que la proximidad. Un abanico abierto o fijo los sostiene.
      const here = scene.awake || openRef.current !== null
      presence.current += ((here ? 1 : 0) - presence.current) * (1 - Math.exp(-dt * (here ? 14 : 3.6)))
      const root = rootRef.current
      if (root) {
        root.style.setProperty('--presence', presence.current.toFixed(3))
        root.classList.toggle('is-away', presence.current < 0.35)
      }

      if (rects) {
        const v = view()
        const anchors = anchorsFor(rects, v)
        const p = pointer.current
        const current = openRef.current

        for (const { id } of CATEGORIES) {
          const node = bubbleRefs.current[id]
          if (!node) continue
          // Cada burbuja es una cosa aparte que acompaña al cuadro: lo sigue con su
          // propio resorte, un pelo atrasada, en vez de ir pegada a él.
          const a = follow(`bubble-${id}`, anchors[id], BUBBLE_FOLLOW, dt)
          anchorPos.current[id] = a
          node.style.transform = `translate(${a.x}px, ${a.y}px)`

          // Proximidad: la burbuja despierta a medida que el puntero se acerca (y se
          // calla mientras arrastrás un ancho, que es cuando pasa cerca de ellas). Se
          // suaviza acá —más rápido al despertar que al dormirse— y no con una
          // transición de CSS, que se reinicia en cada cuadro y arrastra.
          const target =
            current === id
              ? 1
              : p && !scene.dragging
                ? smooth(clamp01(1 - (Math.hypot(p.x - a.x, p.y - a.y) - NEAR) / (FAR - NEAR)))
                : 0
          const prev = prox.current[id] ?? 0
          const next = prev + (target - prev) * (1 - Math.exp(-dt * (target > prev ? 18 : 7)))
          prox.current[id] = next
          node.style.setProperty('--p', next.toFixed(3))
        }

        // La cartela se apoya en la esquina inferior derecha del cuadro, como la
        // ficha que acompaña a una obra colgada. Editando ocupa más: no se sale.
        if (labelRef.current) {
          // Lo que ocupa a la derecha del punto de anclaje: el papel entero, menos su relleno.
          const width = current === 'artwork' ? 316 : 226
          const x = Math.min(rects.outer.x + rects.outer.w + 46, v.w - width - 16)
          // Cuelga en la pared, al lado del cuadro: cuando el cuadro crece, el cuadro la
          // corre, y ella llega un poco después, como algo que se empujó.
          const at = follow('label', { x, y: rects.outer.y + rects.outer.h }, LABEL_FOLLOW, dt)
          labelRef.current.style.transform = `translate(${at.x}px, ${at.y}px)`
        }

        // Solo cuando cruza el umbral: un setState por frame sería un re-render por frame.
        const dark = scene.wallLuma < 0.45
        setWallLuma((prevLuma) => (prevLuma < 0.45 === dark ? prevLuma : scene.wallLuma))

        // El botón de cargar se centra sobre la obra y solo aparece al pasar por ella.
        if (dropRef.current) {
          dropRef.current.style.transform = `translate(${
            rects.sight.x + rects.sight.w / 2
          }px, ${rects.sight.y + rects.sight.h / 2}px)`
          dropRef.current.classList.toggle(
            'is-shown',
            scene.zone === 'art' && scene.awake && !scene.dragging && current !== 'artwork',
          )
        }

        // La parte que edita la categoría abierta se ilumina, y un hilo la une a la
        // burbuja: qué se está tocando se entiende sin leer el ícono. La luz recorta
        // la banda con su hueco, así que solo se ve la parte y no lo que hay adentro.
        const lit = litRef.current
        const leader = leaderRef.current
        const part =
          current === 'frame' && scene.hasFrame
            ? { band: rects.outer, hole: rects.glass }
            : current === 'mat' && scene.hasMat
              ? { band: rects.glass, hole: rects.sight }
              : current === 'glass'
                ? { band: rects.glass, hole: null }
                : current === 'artwork'
                  ? { band: rects.sight, hole: null }
                  : null

        if (lit) lit.classList.toggle('is-on', part !== null && !scene.dragging)
        if (leader) leader.classList.toggle('is-on', part !== null && !scene.dragging)
        // Con el cuadro fuera de su reposo un aro derecho mentiría: se aparta hasta que
        // vuelva. Va en una clase aparte para no repetir el destello de aparecer.
        const tilted = Boolean(scene.tilted)
        lit?.classList.toggle('is-tilted', tilted)
        leader?.classList.toggle('is-tilted', tilted)
        gizmoRef.current?.classList.toggle('is-tilted', tilted)

        if (part && current) {
          const { band, hole } = part
          if (lit) {
            lit.style.left = `${band.x}px`
            lit.style.top = `${band.y}px`
            lit.style.width = `${band.w}px`
            lit.style.height = `${band.h}px`
            lit.style.setProperty('--hx', hole ? `${hole.x - band.x}px` : '0px')
            lit.style.setProperty('--hy', hole ? `${hole.y - band.y}px` : '0px')
            lit.style.setProperty('--hw', hole ? `${hole.w}px` : '0px')
            lit.style.setProperty('--hh', hole ? `${hole.h}px` : '0px')
          }

          const a = anchors[current]
          const tx = Math.min(Math.max(a.x, band.x), band.x + band.w)
          const ty = Math.min(Math.max(a.y, band.y), band.y + band.h)
          const len = Math.hypot(tx - a.x, ty - a.y)
          const line = leaderLine.current
          const dot = leaderDot.current
          if (line && dot && len > 30) {
            // Sale del borde de la burbuja, no de su centro.
            const ux = (tx - a.x) / len
            const uy = (ty - a.y) / len
            line.setAttribute('x1', String(a.x + ux * 25))
            line.setAttribute('y1', String(a.y + uy * 25))
            line.setAttribute('x2', String(tx))
            line.setAttribute('y2', String(ty))
            dot.setAttribute('cx', String(tx))
            dot.setAttribute('cy', String(ty))
          }
        }

        // El gizmo abraza la banda que está bajo el puntero.
        const gizmo = gizmoRef.current
        if (gizmo) {
          const target = scene.dragging ?? draggableTarget(scene.zone)
          if (target && scene.awake) {
            const band = target === 'frame' ? rects.outer : rects.glass
            const hole = target === 'frame' ? rects.glass : rects.sight
            gizmo.style.opacity = '1'
            gizmo.style.left = `${band.x}px`
            gizmo.style.top = `${band.y}px`
            gizmo.style.width = `${band.w}px`
            gizmo.style.height = `${band.h}px`
            gizmo.style.setProperty('--hole-x', `${hole.x - band.x}px`)
            gizmo.style.setProperty('--hole-y', `${hole.y - band.y}px`)
            gizmo.style.setProperty('--hole-w', `${hole.w}px`)
            gizmo.style.setProperty('--hole-h', `${hole.h}px`)
            gizmo.classList.toggle('is-pressed', scene.dragging !== null)
          } else {
            gizmo.style.opacity = '0'
            gizmo.classList.remove('is-pressed')
          }
        }

        // Los centímetros aparecen solo mientras arrastrás: mientras probás mirás el
        // cuadro, y cuando decidís querés el número.
        // Cada muesca late: el número y las flechas se agrandan un instante y vuelven,
        // como el clic que se oye. Se reinicia la animación sacando y poniendo la clase.
        if (gizmo && scene.dragCm !== null && lastCmRef.current !== null && scene.dragCm !== lastCmRef.current) {
          gizmo.classList.remove('is-click')
          void gizmo.offsetWidth
          gizmo.classList.add('is-click')
        }
        lastCmRef.current = scene.dragCm

        if (gizmoValueRef.current) {
          gizmoValueRef.current.textContent =
            scene.dragCm === null
              ? ''
              : scene.dragCm === 0
                ? scene.dragging === 'frame'
                  ? copy.marco.noFrame.toLowerCase()
                  : copy.marco.noMat.toLowerCase()
                : cmLabel(scene.dragCm)
        }
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [sceneRef])

  // --- lo que hay en cada abanico ------------------------------------------------

  /**
   * Cada opción previsualiza al pasar y confirma al hacer clic. El clic limpia la
   * vista previa antes de despachar para que no queden dos capas del mismo cambio.
   */
  const choose = (action: Action) => ({
    onClick: () => {
      onPreview(null)
      dispatch(action)
    },
    onHover: (on: boolean) => onPreview(on ? action : null),
  })

  const customSwatch = (value: string, onChange: (color: string) => void): FanItem => ({
    label: copy.marco.customColor,
    node: (
      <label className="swatch is-custom" aria-label={copy.marco.customColor} style={{ background: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <span aria-hidden>+</span>
      </label>
    ),
  })

  function matSwatch(p: { id: string; label: string; color: string }): FanItem {
    return {
      label: p.label,
      node: (
        <Swatch
          label={p.label}
          color={p.color}
          selected={mat.enabled && mat.color.toLowerCase() === p.color.toLowerCase()}
          {...choose({ type: 'mat/patch', patch: { color: p.color, enabled: true } })}
        />
      ),
    }
  }

  function wallSwatch(p: { id: string; label: string; color: string }): FanItem {
    return {
      label: p.label,
      node: (
        <Swatch
          label={p.label}
          color={p.color}
          selected={state.wall.color.toLowerCase() === p.color.toLowerCase()}
          {...choose({ type: 'wall/patch', patch: { color: p.color } })}
        />
      ),
    }
  }

  /**
   * Filas de cada categoría. En el marco, de adentro hacia afuera: acabado, perfil y
   * color —las mismas opciones que el celular: tres acabados, no siete—. Van así porque
   * cada arco pide un radio según cuántas muestras tiene, y los más poblados quedan
   * afuera, donde hay más largo de arco.
   */
  function rowsFor(id: Category): FanItem[][] {
    switch (id) {
      case 'frame':
        return [
          MOLDING_FAMILIES.map((t) => ({
            label: t.label,
            node: (
              <Swatch
                label={t.label}
                color={state.frame.color}
                material={t.material}
                finish={t.finish}
                profile={state.frame.profile}
                // La familia se reconoce por el material, como en el celular: un marco
                // armado con "Laca" aparece como "Pintado".
                selected={state.frame.material === t.material}
                {...choose({
                  type: 'frame/patch',
                  patch: { material: t.material, finish: t.finish },
                })}
              />
            ),
          })),
          FRAME_PROFILES.map((p) => ({
            label: p.label,
            node: (
              <Swatch
                label={p.label}
                color={state.frame.color}
                material={state.frame.material}
                finish={state.frame.finish}
                profile={p.id}
                selected={state.frame.profile === p.id}
                {...choose({ type: 'frame/patch', patch: { profile: p.id } })}
              />
            ),
          })),
          [
            ...FRAME_PRESETS.map((p) => ({
              label: p.label,
              node: (
                <Swatch
                  label={p.label}
                  color={p.color}
                  selected={state.frame.color.toLowerCase() === p.color.toLowerCase()}
                  {...choose({ type: 'frame/patch', patch: { color: p.color } })}
                />
              ),
            })),
            customSwatch(state.frame.color, (color) =>
              dispatch({ type: 'frame/patch', patch: { color } }),
            ),
          ],
        ]

      case 'mat':
        return [
          MAT_PRESETS.slice(0, 5).map(matSwatch),
          [
            ...MAT_PRESETS.slice(5).map(matSwatch),
            customSwatch(mat.color, (color) =>
              dispatch({ type: 'mat/patch', patch: { color, enabled: true } }),
            ),
          ],
        ]

      case 'wall':
        return [
          WALL_PRESETS.slice(0, 5).map(wallSwatch),
          [
            ...WALL_PRESETS.slice(5).map(wallSwatch),
            customSwatch(state.wall.color, (color) =>
              dispatch({ type: 'wall/patch', patch: { color } }),
            ),
          ],
          WALL_PATTERNS.map((p) => ({
            label: p.label,
            node: (
              <TextChip
                label={p.label}
                selected={state.wall.pattern === p.id}
                {...choose({ type: 'wall/patch', patch: { pattern: p.id } })}
              />
            ),
          })),
        ]

      case 'glass':
        return [
          GLASS_TYPES.map((g) => ({
            label: g.label + ' · ' + g.hint,
            node: (
              <GlassOption
                id={g.id}
                label={g.label}
                selected={state.glass === g.id}
                {...choose({ type: 'glass/set', value: g.id })}
              />
            ),
          })),
        ]

      case 'artwork':
        // La obra no abre un abanico: se edita en la cartela.
        return []
    }
  }

  const hasOpen = open !== null

  return (
    <div
      ref={rootRef}
      className={
        'overlay' +
        (awake || open ? ' is-awake' : '') +
        (hasOpen ? ' has-open' : '') +
        (pinned ? ' is-pinned' : '')
      }
    >
      {/* Volver abajo a la izquierda y sugerencias abajo a la derecha, como en la mesa
          de luz y en Referencia. Aparecen con los controles y se van con ellos: con
          el cuadro solo no hay nada que tape. */}
      <button
        ref={backRef}
        type="button"
        className="hud-back"
        onClick={() => (window.location.href = '../')}
        aria-label={copy.app.back}
      >
        <BackIcon />
      </button>
      {/* El sonido se calla al lado de las sugerencias, en su propia pastilla: es de
          otra conversación que el resto de los controles. */}
      <div className="hud-corner">
        <button
          ref={soundRef}
          type="button"
          className="hud-sound"
          aria-label={copy.marco.sound}
          aria-pressed={!muted}
          onClick={() => setMuted(!muted)}
        >
          {muted ? <SpeakerOffIcon /> : <SpeakerIcon />}
        </button>
        <a
          ref={linkRef}
          className="hud-link"
          href={copy.welcome.suggestionsUrl}
          onClick={(e) => openInstagram(e, copy.welcome.suggestionsUrl)}
        >
          {copy.welcome.suggestions}
        </a>
      </div>

      {/* Cargar el dibujo se pide sobre el dibujo: es donde mirás cuando querés
          reemplazarlo, y evita ir a buscarlo dentro de un menú. */}
      <div ref={dropRef} className="art-drop">
        {/* Un atajo del puntero: con teclado, cargar vive en la cartela de la obra. */}
        <button
          type="button"
          className="pill"
          tabIndex={-1}
          onClick={() => fileRef.current?.click()}
        >
          <UploadIcon />
          {copy.marco.upload}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) {
              try {
                const { src, aspect } = await loadArtworkFile(file)
                dispatch({ type: 'artwork/replace', src, aspect })
              } catch {
                // El lienzo ya avisa del error al soltar; acá no insistimos.
              }
            }
            e.target.value = ''
          }}
        />
      </div>

      <div ref={litRef} className="lit" aria-hidden />

      <svg ref={leaderRef} className="leader" aria-hidden>
        <line ref={leaderLine} pathLength={1} />
        <circle ref={leaderDot} r={3.5} />
      </svg>

      <div ref={gizmoRef} className="gizmo" aria-hidden>
        <span className="gizmo-band" />
        <span className="gizmo-arrow gizmo-arrow--h gizmo-arrow--left" />
        <span className="gizmo-arrow gizmo-arrow--h gizmo-arrow--right" />
        <span className="gizmo-arrow gizmo-arrow--v gizmo-arrow--top" />
        <span className="gizmo-arrow gizmo-arrow--v gizmo-arrow--bottom" />
        <span ref={gizmoValueRef} className="gizmo-value" />
      </div>

      {/* La cartela se aparta mientras se abre un abanico hacia ella: pared y vidrio
          están a su derecha y si no se le encimarían encima del texto. */}
      <div
        ref={labelRef}
        className={
          'wall-label-anchor' +
          ((labelAwake || open === 'artwork') && open !== 'wall' && open !== 'glass'
            ? ' is-awake'
            : '') +
          (open === 'artwork' ? ' is-editing' : '')
        }
      >
        <Cartela
          state={state}
          layout={layout}
          dispatch={dispatch}
          wallLuma={wallLuma}
          editing={open === 'artwork'}
          focusTitle={open === 'artwork' && pinned}
          onRemove={onRemove}
        />
      </div>

      {CATEGORIES.map(({ id, label, Icon }) => {
        const mine = fan && fan.id === id ? fan : null
        return (
          <div
            key={id}
            ref={(n) => {
              bubbleRefs.current[id] = n
            }}
            className={'anchor' + (open === id ? ' is-open' : '')}
          >
            <button
              type="button"
              className={'bubble' + (open === id ? ' is-open' : '')}
              onPointerEnter={() => intend(id)}
              onPointerLeave={dismissIntent}
              // El clic fija; con el teclado, Enter es un clic y hace lo mismo.
              onClick={() => clickBubble(id)}
              aria-label={label}
              aria-expanded={open === id}
            >
              <Icon />
            </button>

            {/* Después de la burbuja en el documento: con el teclado, Tab entra a las muestras. */}
            {mine && (
              <RadialMenu
                open={open === id}
                rows={rowsFor(id)}
                layout={mine.layout}
                centerDeg={mine.deg}
                origin={mine.origin}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Opción de vidrio: un preview redondo que imita el efecto. */
function GlassOption({
  id,
  label,
  selected,
  onClick,
  onHover,
}: {
  id: GlassType
  label: string
  selected: boolean
  onClick: () => void
  onHover?: (on: boolean) => void
}) {
  return (
    <button
      type="button"
      className={'text-option' + (selected ? ' is-selected' : '')}
      onClick={onClick}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
      aria-pressed={selected}
      aria-label={label}
    >
      <span className="text-option-visual" data-glass={id} />
    </button>
  )
}

/** Lo que no es un color va con nombre: los patrones de pared. */
function TextChip({
  label,
  selected,
  onClick,
  onHover,
}: {
  label: string
  selected: boolean
  onClick: () => void
  onHover?: (on: boolean) => void
}) {
  return (
    <button
      type="button"
      className={'text-chip' + (selected ? ' is-selected' : '')}
      onClick={onClick}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
      aria-pressed={selected}
    >
      {label}
    </button>
  )
}

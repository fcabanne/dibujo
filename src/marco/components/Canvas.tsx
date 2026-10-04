import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import {
  clamp,
  computeLayout,
  dimsOf,
  layoutFromDims,
  fitScale,
  type SceneRects,
} from '../domain/geometry'
import { loadArtworkFile } from '../../shared/imageFile'
import { easeOut, reducedMotionNow } from '../../shared/motion'
import {
  draggableTarget,
  hitZone,
  touchZone,
  type Point,
  type Zone,
} from '../interaction/zones'
import { useImage } from '../hooks/useImage'
import { askTiltPermission, useTilt } from '../hooks/useTilt'
import { luminance } from '../render/light'
import { dragWidth, startDrag, type DragResult, type DragState } from '../interaction/drag'
import {
  GONE,
  createBody,
  detentKick,
  hang,
  press,
  pushEnd,
  pushMove,
  pushStart,
  release,
  settle,
  shownDims,
  stepBody,
  sway,
  type BodyEvent,
} from '../physics/body'
import { DEGREES } from '../physics/pendulum'
import { eyeOf, nailOf, toObject } from '../render/pose'
import { createObjectRenderer, type ObjectRenderer } from '../gl/renderer'
import { massOf } from '../physics/mass'
import { diffScenes, type Reaction, type Seen } from '../physics/reactions'
import { logSounds, play, soundLog, unlockSound } from '../sound/engine'
import { tickFor, tickRate, type SoundName } from '../sound/recipes'
import { renderScene } from '../render/scene'
import { setGlActive } from '../gl/offscreen'
import { standoff } from '../render/shadow'
import { wallLumaAt } from '../render/wall'
import type { Action } from '../state/reducer'
import type { AppState, Layout } from '../types'

/** Lo que el overlay necesita cada frame para anclar burbujas y gizmos. */
export interface SceneSnapshot {
  rects: SceneRects | null
  zone: Zone
  dragging: 'frame' | 'mat' | null
  /** Ancho en curso mientras se arrastra, para mostrarlo sobre el gizmo. */
  dragCm: number | null
  hasFrame: boolean
  hasMat: boolean
  /**
   * Brillo 0..1 estimado de la pared donde va la cartela. No alcanza con el
   * color elegido: ahí cae la penumbra del foco, así que una pared blanca puede ser
   * oscura justo en ese punto y el texto negro desaparecería.
   */
  wallLuma: number
  /** El puntero estuvo activo hace poco: gobierna si el HUD se muestra. */
  awake: boolean
  /**
   * El cuadro está fuera de su reposo —balanceándose, girando, colgándose—: lo que
   * marca una parte con un aro derecho se aparta hasta que vuelva.
   */
  tilted?: boolean
  /**
   * Celular: dónde va la cartela, o `null` si no hay lugar para ella. Abajo del
   * cuadro el punto es el medio de su borde de arriba; al costado, su esquina de
   * abajo a la izquierda, como en el escritorio.
   */
  label?: { x: number; y: number; side: boolean } | null
  /** El paralaje con que se pintó: la luz que se ve, para que la descarga salga igual. */
  parallax?: { x: number; y: number }
}

/** Qué parte del cuadro tocó el dedo, para abrir lo que la edita. */
export type Part = 'frame' | 'mat' | 'art' | 'wall'

/**
 * El lugar que le queda al cuadro en el celular, en px del lienzo: lo que no tapan
 * los controles. `label` dice dónde entra la cartela, si entra.
 */
export interface FreeArea {
  x: number
  y: number
  w: number
  h: number
  label: 'below' | 'side' | null
  /**
   * Lo que flota arriba del lugar libre sin sacarle lugar —el botón de descargar—.
   * Si el cuadro encajado quedaría debajo, el cuadro baja lo justo para no tocarlo.
   */
  avoid?: { x: number; y: number; w: number; h: number } | null
}

interface Props {
  /** Lo que se ve: el estado con la vista previa del puntero encima. */
  state: AppState
  /** Lo confirmado, sin vista previa. Con los dos se sabe si algo se eligió o se está mirando. */
  committed?: AppState
  /**
   * Cuántos dibujos llegaron desde que se abrió la herramienta. Cuando cambia, el
   * dibujo nuevo se cuelga en la pared en vez de aparecer: al recargar no cambia, y lo
   * que ya estaba colgado no se vuelve a colgar.
   */
  arrival?: number
  dispatch: (action: Action) => void
  sceneRef: React.MutableRefObject<SceneSnapshot>
  onLayout: (layout: Layout) => void
  onArtworkDropped: (src: string, aspect: number) => void
  onAwakeChange: (awake: boolean) => void
  /** Celular: gestos de dedo, encuadre en el lugar libre, inclinación del teléfono. */
  compact?: boolean
  /** Celular: cómo medir el lugar libre. Lo registra la capa de controles. */
  freeArea?: MutableRefObject<(() => FreeArea | null) | null>
  /** Celular: un toque corto sobre una parte del cuadro. */
  onPartTap?: (part: Part) => void
}

/**
 * El HUD se apaga si el puntero se va del lienzo, si la ventana pierde el foco, o
 * si se queda quieto. Mientras haya un abanico abierto no se apaga: el overlay lo
 * mantiene visible por su cuenta, así que parar a elegir no lo hace desaparecer.
 */
const LEAVE_MS = 320
const IDLE_MS = 2000

/** Cuánto deja alejar y acercar la rueda. */
const VIEW_ZOOM = { min: 0.45, max: 2.2 }

/**
 * Celular: cuánto se acerca con los dedos. Por debajo del encuadre no hace falta —el
 * cuadro ya entra entero—, y el mínimo de `pinch` deja pasarse un poco para que
 * soltar lo devuelva a su lugar en vez de frenar en seco.
 */
const TOUCH_ZOOM = { pinch: 0.85, max: 3 }
/** Por encima de esto se está mirando de cerca: un dedo corre la vista en vez de la luz. */
const ZOOMED = 1.04
/** Lo que se reserva para la cartela: abajo del cuadro, o al costado. */
const LABEL_BELOW = 132
const LABEL_SIDE = 250
/** Lo que queda entre el cuadro y el botón que esquiva. */
const AVOID_GAP = 8
/** Un toque es poco movimiento en poco tiempo; dos seguidos en el mismo lugar, uno doble. */
const TAP = { px: 8, ms: 350 }
const DOUBLE_TAP = { px: 30, ms: 320 }
/** Cuánto dura el fundido entre un material y otro. */
const FADE_MS = 240
/**
 * En escritorio el fundido acompaña al puntero que pasa por las muestras: tiene que
 * ser corto, o barrer el abanico deja una estela de materiales.
 */
const FADE_DESK_MS = 110

/**
 * Sondas para mirar desde afuera, solo con `?debug` o `?perf` en la dirección. No
 * cambian nada de lo que se ve: exponen la escena y el cuerpo en `window.__marco`, y
 * con `?perf` además miden cuánto tarda cada cuadro.
 */
const PROBE = (() => {
  const q = new URLSearchParams(window.location.search)
  return {
    debug: q.has('debug') || q.has('perf'),
    perf: q.has('perf'),
    flat: q.has('2d'),
    split: q.get('gl') === 'split',
  }
})()

/**
 * El cuadro en 3D (`gl/`): en escritorio lo dibuja WebGL encima de la pared, que
 * sigue siendo 2D. Sin WebGL2, o si el contexto se pierde, queda el 2D de siempre.
 * Para comparar: `?2d` en la dirección fuerza el plano, `?gl=split` muestra mitad y
 * mitad, y con `?debug` (o `?gl=split`) la tecla G pasa de uno a otro.
 */
type GlMode = 'off' | 'gl' | 'split'
const GL_MODES: GlMode[] = ['gl', 'split', 'off']

/** Los últimos tiempos de cuadro, en ms, para `__marco.perf()`. */
const perfRing: number[] = []

function perfReport() {
  const sorted = [...perfRing].sort((a, b) => a - b)
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0
  return { n: sorted.length, p50: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] ?? 0 }
}

type Gesture = 'idle' | 'band' | 'look' | 'pan' | 'pinch'

/** Con qué se pintó el último cuadro: si nada de esto cambió, no hay que repintar. */
interface Painted {
  state: AppState
  image: HTMLImageElement | null
  scale: number
  x: number
  y: number
  px: number
  py: number
}

interface TouchState {
  mode: Gesture
  pointers: Map<number, Point>
  /** Dónde y cuándo apoyó el primer dedo, y sobre qué parte. */
  down: { x: number; y: number; time: number; zone: Zone } | null
  moved: boolean
  /** Si el dedo ya agarró la banda: se movió estando sobre ella. */
  grabbed: boolean
  /** El pellizco se mide contra el movimiento anterior, no contra el inicio. */
  spread: number
  mid: Point
}

/**
 * Lo que cambia de un toque sin mover nada de lugar: color, acabado, perfil, vidrio,
 * pared. Esos cambios se funden en el celular. Los que cambian medidas no, porque el
 * cuadro viejo y el nuevo no coinciden y el fundido se vería doble.
 */
function looksKey(s: AppState): string {
  const f = s.frame
  const m = s.mats[0]
  return [f.color, f.material, f.finish, f.profile, m?.color, s.glass, s.wall.color, s.wall.pattern].join(
    '|',
  )
}

function partOf(zone: Zone): Part {
  if (zone === 'frame' || zone === 'frame-ghost') return 'frame'
  if (zone === 'mat' || zone === 'mat-ghost') return 'mat'
  if (zone === 'art') return 'art'
  return 'wall'
}

export function Canvas({
  state,
  committed,
  arrival = 0,
  dispatch,
  sceneRef,
  onLayout,
  onArtworkDropped,
  onAwakeChange,
  compact = false,
  freeArea,
  onPartTap,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glCanvasRef = useRef<HTMLCanvasElement>(null)
  const fadeLayerRef = useRef<HTMLCanvasElement>(null)
  const glModeRef = useRef<GlMode>(PROBE.flat ? 'off' : PROBE.split ? 'split' : 'gl')
  const glRef = useRef<ObjectRenderer | null>(null)
  /** Si el 3D no anda en este navegador: no se vuelve a intentar en cada cuadro. */
  const glFailedRef = useRef(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const image = useImage(state.artwork.src)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scaleRef = useRef<number | null>(null)
  const pointerRef = useRef({ x: 0, y: 0, inside: false })
  const parallaxRef = useRef({ x: 0, y: 0 })
  const dragRef = useRef<DragState | null>(null)
  const sleepRef = useRef(0)
  const wallLumaRef = useRef(0.5)
  /**
   * Zoom de cámara, no de la obra: acerca o aleja la escena entera. Vive en un ref
   * y no en el estado porque es cómo estás mirando, no cómo va a quedar el cuadro,
   * y no tiene por qué guardarse con el proyecto.
   */
  const viewZoomRef = useRef(1)
  /** El cuadro como cosa: las medidas que se ven, persiguiendo a las del estado. */
  const bodyRef = useRef(createBody(state))
  /** El cursor que se puso por última vez, para no tocar el estilo en cada cuadro. */
  const cursorRef = useRef('')

  // --- solo en el celular ---------------------------------------------------
  const tilt = useTilt(compact)
  /** La cámara que piden los dedos: cuánto se acercó y cuánto se corrió del centro. */
  const camRef = useRef({ zoom: 1, x: 0, y: 0 })
  /**
   * La vista tal como se ve ahora: persigue a `camRef` con una curva. Es lo único que
   * se suaviza acá. Lo que se encaja en el lugar libre no: eso lo mueve el cajón, que
   * ya viene animado por CSS, y suavizarlo otra vez lo dejaba llegando tarde.
   */
  const camShownRef = useRef<{ zoom: number; x: number; y: number } | null>(null)
  /** Lo que la cartela le está sacando al lugar libre, abajo o al costado, que entra y sale de a poco. */
  const labelSpaceRef = useRef({ below: 0, side: 0, top: 0 })
  /** Dónde se ve el centro del cuadro ahora; persigue al pedido, como la escala. */
  const anchorRef = useRef<Point | null>(null)
  /** El centro del lugar libre, sin corrimiento. El pellizco se mide contra él. */
  const baseRef = useRef<Point>({ x: 0, y: 0 })
  /** El dedo arrastrando sobre la pared corre la luz, como el mouse en escritorio. */
  const lookRef = useRef<Point | null>(null)
  const touchRef = useRef<TouchState>({
    mode: 'idle',
    pointers: new Map(),
    down: null,
    moved: false,
    grabbed: false,
    spread: 0,
    mid: { x: 0, y: 0 },
  })
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 })
  /** El cuadro de antes de un cambio de material, fundiéndose sobre el nuevo. */
  const fadeRef = useRef<{ canvas: HTMLCanvasElement; start: number } | null>(null)
  /** Si el último cuadro lo pintó también el 3D: el fundido tiene que copiar los dos lienzos. */
  const glVisibleRef = useRef(false)
  const looksRef = useRef('')
  /** Lo último que se pintó: si nada cambió desde entonces, no se vuelve a pintar. */
  const paintedRef = useRef<Painted | null>(null)

  const committedRef = useRef(committed)
  committedRef.current = committed
  const arrivalRef = useRef(arrival)
  arrivalRef.current = arrival
  /** El último dibujo que se colgó: si `arrival` se adelanta, hay uno nuevo. */
  const hungRef = useRef(0)
  /** Lo que se vio y se confirmó en el cuadro anterior, para saber qué cambió. */
  const seenRef = useRef<Seen | null>(null)
  /** El peso del cuadro al agarrar una banda: al soltar, se asienta con la diferencia. */
  const dragKgRef = useRef(0)
  /** La mano empujando el cuadro por la obra: el ángulo al que lo agarró, respecto del clavo. */
  const pushRef = useRef<{ from: number } | null>(null)
  /** De qué lado del cuadro se agarró la banda: al soltarla, el vaivén sale de ahí. */
  const dragSideRef = useRef(0)
  /** Las medidas que pedía el estado en el cuadro anterior: si cambian, no hay fundido. */
  const targetKeyRef = useRef('')
  const stateRef = useRef(state)
  const imageRef = useRef(image)
  const onLayoutRef = useRef(onLayout)
  const onAwakeRef = useRef(onAwakeChange)
  const dispatchRef = useRef(dispatch)
  const compactRef = useRef(compact)
  const freeAreaRef = useRef(freeArea)
  const onPartTapRef = useRef(onPartTap)
  stateRef.current = state
  imageRef.current = image
  onLayoutRef.current = onLayout
  onAwakeRef.current = onAwakeChange
  dispatchRef.current = dispatch
  compactRef.current = compact
  freeAreaRef.current = freeArea
  onPartTapRef.current = onPartTap

  /**
   * Lo que hace el cuadro cuando alguien elige algo o pasa por una muestra: suena
   * según el material, y si cambió el peso se asienta en el alambre. La pared no pesa
   * nada del cuadro: suena, y el cuadro no se mueve.
   */
  const react = (reaction: Reaction, before: AppState, after: AppState, deltaKg: number) => {
    if (reaction.kind === 'hover') {
      play('hover', { pan: 0 })
      return
    }
    const pan = reaction.part === 'glass' || reaction.part === 'wall' ? 0.25 : reaction.part === 'art' ? 0 : -0.25
    const weight = Math.max(-3, Math.min(4, deltaKg * 6))
    if (reaction.width) {
      // Un paso de ancho —el deslizador del celular—: la muesca, con el tono del
      // ancho nuevo, como cuando se arrastra la banda. Se asienta, sin vaivén: al
      // deslizar llegan muchos pasos seguidos.
      const part = reaction.part === 'mat' ? 'mat' : 'frame'
      play(tickFor(part), { rate: part === 'frame' ? tickRate(after.frame.width) : 1, pan })
      if (Math.abs(deltaKg) > 0.001) settle(bodyRef.current, deltaKg)
      return
    }
    switch (reaction.part) {
      case 'frame':
        play('commit-wood', { pan, gain: weight, rate: after.frame.width === 0 ? 1.2 : 1 })
        break
      case 'mat':
        play('commit-mat', { pan })
        break
      case 'glass':
        play(after.glass === 'none' ? 'commit-unglass' : 'commit-glass', { pan })
        break
      case 'wall':
        play('commit-wall', { pan })
        return
      case 'art':
        // El tamaño se tipea: sonar en cada tecla sería un teclado. Solo se asienta.
        break
    }
    if (before !== after) {
      settle(bodyRef.current, deltaKg)
      // La mano tocó el cuadro del lado de la burbuja que se usó.
      const side = reaction.part === 'frame' || reaction.part === 'mat' ? -1 : reaction.part === 'glass' ? 1 : 0
      sway(bodyRef.current, deltaKg, side)
    }
  }

  /**
   * Lo que pasa con cada movimiento de una banda agarrada: el cuerpo sigue a la mano
   * —con el tirón entre muescas y la resistencia pasado el máximo—, y cada muesca
   * nueva suena, más fuerte cuanto más rápido va la mano.
   */
  const handleDrag = (result: DragResult, x: number, width: number) => {
    const drag = dragRef.current
    if (!drag) return
    const before = bodyRef.current.hand?.value ?? result.shown
    bodyRef.current.hand = { key: drag.target, value: result.shown, over: result.over }
    if (result.changed) {
      detentKick(bodyRef.current, drag.target, result.shown - before)
      play(tickFor(drag.target), {
        rate: drag.target === 'frame' ? tickRate(result.snapped) : 1,
        gain: Math.min(5, drag.speed * 4) - 1,
        pan: panOf(x, width),
      })
    }
  }

  // --- loop de render -------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    let frame = 0
    let last = performance.now()

    // El 3D nace recién cuando hace falta —en el celular todavía no—, y si el
    // navegador pierde el contexto (se quedó sin memoria de video, cambió de placa)
    // se vuelve al 2D hasta que lo devuelva.
    const glCanvas = glCanvasRef.current
    const onLost = (e: Event) => {
      e.preventDefault()
      glRef.current = null
      glFailedRef.current = true
    }
    const onRestored = () => {
      glFailedRef.current = false
    }
    glCanvas?.addEventListener('webglcontextlost', onLost)
    glCanvas?.addEventListener('webglcontextrestored', onRestored)

    const onGlKey = (e: KeyboardEvent) => {
      if (!(PROBE.debug || PROBE.split) || e.key.toLowerCase() !== 'g' || e.target instanceof HTMLInputElement) return
      const i = GL_MODES.indexOf(glModeRef.current)
      glModeRef.current = GL_MODES[(i + 1) % GL_MODES.length]
    }
    window.addEventListener('keydown', onGlKey)

    const loop = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now

      const ctx = canvas.getContext('2d')
      const box = wrap.getBoundingClientRect()

      if (ctx && box.width > 0 && box.height > 0) {
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        const dw = Math.round(box.width * dpr)
        const dh = Math.round(box.height * dpr)
        let resized = false
        if (canvas.width !== dw || canvas.height !== dh) {
          canvas.width = dw
          canvas.height = dh
          resized = true
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        const current = stateRef.current
        const touch = compactRef.current
        const drag = dragRef.current
        const k = 1 - Math.exp(-dt / 70)

        // El cuerpo persigue al estado. En el celular llega en el acto: ahí la capa
        // de controles todavía no sabe acompañarlo.
        const body = bodyRef.current
        body.dragging = Boolean(drag)

        // Qué pasó desde el cuadro anterior: se eligió algo, o se está pasando por
        // encima de una muestra. Cada cosa suena y, si cambia el peso, se asienta.
        const confirmed = committedRef.current ?? current
        const kg = massOf(confirmed, dimsOf(confirmed)).kg
        const seen = seenRef.current
        if (seen) {
          for (const reaction of diffScenes(seen, { shown: current, committed: confirmed }, Boolean(drag))) {
            react(reaction, seen.committed, confirmed, kg - body.kg)
          }
        }
        seenRef.current = { shown: current, committed: confirmed }
        body.kg = kg
        const instant = reducedMotionNow()
        if (arrivalRef.current !== hungRef.current) {
          hungRef.current = arrivalRef.current
          if (!instant) hang(body, Math.random() < 0.5 ? -1 : 1)
        }
        // El teléfono que gira en su plano gira la pared, pero el cuadro sigue colgando
        // a plomo: en la pantalla se lo ve girar al revés, y llega con su peso.
        body.plumbTarget = touch ? -tilt.current.roll : 0
        const moving = stepBody(body, current, dt, instant)
        for (const event of body.events) play(EVENT_SOUND[event], { pan: 0 })
        const dims = shownDims(body)
        const layout = layoutFromDims(dims)

        let labelMode: FreeArea['label'] = null

        if (touch) {
          // El cuadro se encaja en lo que dejan libre los controles, y los persigue
          // cuadro a cuadro: cuando el cajón sube, el cuadro sube y se achica con él.
          const free = freeAreaRef.current?.current?.() ?? {
            x: 0,
            y: 0,
            w: box.width,
            h: box.height,
            label: null,
          }
          const cam = camRef.current
          labelMode = cam.zoom > ZOOMED ? null : free.label

          // La cartela reserva su lugar de a poco: que aparezca o se vaya no puede
          // agrandar o achicar el cuadro de golpe. Al abrir un cajón, por ejemplo, se
          // va la cartela (más lugar) justo cuando el cajón sube (menos lugar), y si
          // uno se anticipaba al otro el cuadro crecía un poco antes de achicarse.
          const space = labelSpaceRef.current
          const kl = 1 - Math.exp(-dt / 120)
          const belowTarget = labelMode === 'below' ? LABEL_BELOW : 0
          const sideTarget = labelMode === 'side' ? LABEL_SIDE : 0
          space.below += (belowTarget - space.below) * kl
          space.side += (sideTarget - space.side) * kl
          if (Math.abs(belowTarget - space.below) < 0.5) space.below = belowTarget
          if (Math.abs(sideTarget - space.side) < 0.5) space.side = sideTarget

          const margin = clamp(Math.min(free.w, free.h) * 0.07, 16, 40)
          const usableW = Math.max(40, free.w - margin * 2 - space.side)

          // El botón de arriba no le saca lugar al cuadro salvo que lo toque: se mira
          // dónde caería el cuadro sin correrlo y, si su esquina pisa el botón, se baja
          // lo justo. La pregunta se hace siempre contra el encaje sin correr, así la
          // respuesta no cambia por haber corrido, y el corrimiento entra de a poco,
          // como la cartela.
          const avoid = free.avoid
          let topTarget = 0
          if (avoid) {
            const plainH = Math.max(40, free.h - margin * 2 - space.below)
            const plain = Math.min(usableW / layout.outer.w, plainH / layout.outer.h)
            const right = free.x + margin + usableW / 2 + (layout.outer.w * plain) / 2
            const top = free.y + margin + plainH / 2 - (layout.outer.h * plain) / 2
            const clear = avoid.y + avoid.h + AVOID_GAP
            if (right > avoid.x && top < clear) topTarget = clear - margin - free.y
          }
          space.top += (topTarget - space.top) * kl
          if (Math.abs(topTarget - space.top) < 0.5) space.top = topTarget

          const usableH = Math.max(40, free.h - margin * 2 - space.below - space.top)
          const fit = Math.min(usableW / layout.outer.w, usableH / layout.outer.h)
          const base = {
            x: free.x + margin + usableW / 2,
            y: free.y + margin + space.top + usableH / 2,
          }
          baseRef.current = base

          // Como en Referencia: la vista solo se corre hacia donde sobra cuadro.
          const s = fit * cam.zoom
          const spareX = Math.max(0, (layout.outer.w * s - usableW) / 2 + margin)
          const spareY = Math.max(0, (layout.outer.h * s - usableH) / 2 + margin)
          cam.x = clamp(cam.x, -spareX, spareX)
          cam.y = clamp(cam.y, -spareY, spareY)

          // Con los dedos encima la vista va pegada a ellos; si no, llega con la curva.
          const follow = touchRef.current.mode === 'pinch' || touchRef.current.mode === 'pan'
          let shown = camShownRef.current
          if (!shown || follow) {
            shown = camShownRef.current = { zoom: cam.zoom, x: cam.x, y: cam.y }
          } else {
            shown.zoom += (cam.zoom - shown.zoom) * k
            shown.x += (cam.x - shown.x) * k
            shown.y += (cam.y - shown.y) * k
            if (Math.abs(cam.zoom - shown.zoom) < 0.002) shown.zoom = cam.zoom
            if (Math.abs(cam.x - shown.x) < 0.1) shown.x = cam.x
            if (Math.abs(cam.y - shown.y) < 0.1) shown.y = cam.y
          }

          // El encaje es directo: sigue al cajón cuadro a cuadro, sin un segundo
          // suavizado encima del suyo.
          scaleRef.current = drag ? drag.frozenScale : fit * shown.zoom
          anchorRef.current = { x: base.x + shown.x, y: base.y + shown.y }
        } else {
          // Escala: persigue el encaje, salvo mientras arrastrás.
          const target = drag
            ? drag.frozenScale
            : fitScale(turnedBox(layout.outer, body.pose.turn), box.width, box.height) * viewZoomRef.current

          if (scaleRef.current === null) scaleRef.current = target
          else {
            scaleRef.current += (target - scaleRef.current) * k
            if (Math.abs(target - scaleRef.current) < 0.01) scaleRef.current = target
          }
        }

        // Paralaje: -1..1, suavizado. En escritorio es el puntero; en el celular, el
        // dedo arrastrando sobre la pared o, si no hay dedo, la inclinación del
        // teléfono. Sin ninguno de los dos vuelve al centro.
        const p = pointerRef.current
        let aimX = 0
        let aimY = 0
        if (touch) {
          const look = lookRef.current
          const t = tilt.current
          if (look) {
            aimX = look.x
            aimY = look.y
          } else if (t.active) {
            aimX = t.x
            aimY = t.y
          }
        } else if (p.inside) {
          aimX = clamp((p.x / box.width) * 2 - 1, -1, 1)
          aimY = clamp((p.y / box.height) * 2 - 1, -1, 1)
        }
        const kp = 1 - Math.exp(-dt / 130)
        const par = parallaxRef.current
        par.x += (aimX - par.x) * kp
        par.y += (aimY - par.y) * kp

        // Un material nuevo se funde sobre el anterior en vez de saltar: se copia lo
        // último que se pintó y se lo va apagando encima de la escena nueva. Si además
        // cambiaron las medidas no: el cuadro viejo y el nuevo no coinciden, y el
        // fundido se vería doble. Las medidas ya llegan con su resorte.
        const looks = looksKey(current)
        const targetKey = Object.values(dimsOf(current)).join('|')
        if (looks !== looksRef.current) {
          const sized = targetKey !== targetKeyRef.current
          if (looksRef.current && !resized && (touch || !sized) && !reducedMotionNow()) {
            fadeRef.current = snapshot(fadeLayerRef.current, canvas, glVisibleRef.current ? glCanvasRef.current : null, now)
          }
          looksRef.current = looks
        }
        targetKeyRef.current = targetKey

        if (touch) {
          // Llega y se queda quieto, en vez de acercarse para siempre sin llegar: es
          // lo que deja reconocer que no hay nada nuevo que pintar.
          if (Math.abs(aimX - par.x) < 0.001) par.x = aimX
          if (Math.abs(aimY - par.y) < 0.001) par.y = aimY

          // Nada se movió y nada cambió desde el último cuadro pintado: la escena de
          // la pantalla ya es la correcta. En un teléfono, pintar sesenta veces por
          // segundo una imagen quieta es gastar batería mirando una pared.
          const painted = paintedRef.current
          const anchor = anchorRef.current
          if (
            painted &&
            anchor &&
            !resized &&
            !drag &&
            !moving &&
            !fadeRef.current &&
            painted.state === current &&
            painted.image === imageRef.current &&
            painted.scale === scaleRef.current &&
            painted.x === anchor.x &&
            painted.y === anchor.y &&
            painted.px === par.x &&
            painted.py === par.y
          ) {
            frame = requestAnimationFrame(loop)
            return
          }
        }

        if (glModeRef.current !== 'off' && !glRef.current && !glFailedRef.current && glCanvasRef.current) {
          glRef.current = createObjectRenderer(glCanvasRef.current)
          if (!glRef.current) glFailedRef.current = true
        }
        const glMode: GlMode = !glRef.current ? 'off' : glModeRef.current
        const t0 = PROBE.perf ? performance.now() : 0
        const { rects, light, layout: shown } = renderScene(ctx, current, imageRef.current, {
          width: box.width,
          height: box.height,
          pxPerCm: scaleRef.current,
          dpr,
          parallax: par,
          anchor: touch && anchorRef.current ? anchorRef.current : undefined,
          pose: body.pose,
          dims,
          objectArea: glMode === 'gl' ? null : glMode === 'split' ? { x: 0, y: 0, w: box.width / 2, h: box.height } : undefined,
        })

        const gl = glRef.current
        const glCanvas = glCanvasRef.current
        if (glCanvas) glCanvas.style.visibility = glMode === 'off' ? 'hidden' : 'visible'
        glVisibleRef.current = glMode !== 'off'
        setGlActive(glMode === 'gl')
        if (gl && glMode !== 'off') {
          gl.render({
            state: current,
            rects,
            pose: body.pose,
            pxPerCm: scaleRef.current,
            // En el teléfono, a densidad 1,5: casi no se distingue de 2 y es la mitad
            // de píxeles que sombrear.
            dpr: touch ? Math.min(1.5, dpr) : dpr,
            width: box.width,
            height: box.height,
            eye: eyeOf(par),
            image: imageRef.current,
            hasFrame: dims.frame > GONE,
            hasMat: Boolean(current.mats[0]) && dims.mat > GONE,
            depthCm: shown.depth,
            wallCm: shown.depth + standoff(shown.outer.h) / 2,
            standoffCm: standoff(shown.outer.h),
            scissor: glMode === 'split' ? { x: box.width / 2, y: 0, w: box.width / 2, h: box.height } : undefined,
          })
        }
        if (PROBE.perf) {
          perfRing.push(performance.now() - t0)
          if (perfRing.length > 240) perfRing.shift()
        }

        // El fundido va en su propia capa, encima de la pared y del cuadro en 3D: si
        // se pintara en el lienzo de la pared, el 3D lo taparía.
        const fade = fadeRef.current
        if (fade) {
          const t = (now - fade.start) / (touch ? FADE_MS : FADE_DESK_MS)
          if (t >= 1) {
            fadeRef.current = null
            fade.canvas.style.opacity = '0'
          } else {
            fade.canvas.style.opacity = String(1 - easeOut(t))
          }
        }

        if (touch) {
          paintedRef.current = {
            state: current,
            image: imageRef.current,
            scale: scaleRef.current,
            x: anchorRef.current?.x ?? 0,
            y: anchorRef.current?.y ?? 0,
            px: par.x,
            py: par.y,
          }
        }

        const hasFrame = current.frame.width > 0
        const hasMat = Boolean(current.mats[0]?.enabled)
        // El puntero se lleva al espacio del cuadro: a mitad de un balanceo, la banda
        // que se agarra es la que está debajo, no la del cuadro quieto.
        const zone =
          !touch && p.inside ? hitZone(toObject(p, body.pose, rects, scaleRef.current), rects, hasFrame, hasMat) : 'wall'

        const label =
          labelMode === 'below'
            ? { x: rects.outer.x + rects.outer.w / 2, y: rects.outer.y + rects.outer.h + 24, side: false }
            : labelMode === 'side'
              ? { x: rects.outer.x + rects.outer.w + 34, y: rects.outer.y + rects.outer.h, side: true }
              : null

        wallLumaRef.current = wallLumaAt(
          label ? (label.side ? label.x + 100 : label.x) : rects.outer.x + rects.outer.w + 110,
          label ? (label.side ? label.y - 50 : label.y + 50) : rects.outer.y + rects.outer.h * 0.4,
          rects.outer,
          light,
          luminance(current.wall.color),
        )

        const dragging = dragRef.current?.target ?? null
        sceneRef.current = {
          rects,
          zone,
          dragging,
          dragCm: dragging
            ? dragging === 'frame'
              ? current.frame.width
              : hasMat
                ? current.mats[0].width
                : 0
            : null,
          hasFrame,
          hasMat,
          wallLuma: wallLumaRef.current,
          awake: sceneRef.current.awake,
          tilted: Math.abs(body.pose.roll) > 0.3 * DEGREES || body.turning || body.hanging > 0,
          label,
          parallax: { x: par.x, y: par.y },
        }
        // La cartela recibe las medidas de verdad, no las que van llegando.
        onLayoutRef.current(computeLayout(current))

        if (!touch) {
          const cursor =
            dragRef.current || pushRef.current
              ? 'grabbing'
              : draggableTarget(zone) || zone === 'art'
                ? 'grab'
                : 'default'
          if (cursor !== cursorRef.current) {
            wrap.style.cursor = cursor
            cursorRef.current = cursor
          }
        }
      }

      frame = requestAnimationFrame(loop)
    }

    frame = requestAnimationFrame(loop)
    if (PROBE.debug) {
      logSounds(true)
      ;(window as unknown as { __marco: unknown }).__marco = {
        scene: sceneRef,
        body: bodyRef,
        sounds: soundLog,
        perf: perfReport,
        perfReset: () => (perfRing.length = 0),
      }
    }
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onGlKey)
      glCanvas?.removeEventListener('webglcontextlost', onLost)
      glCanvas?.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [sceneRef, tilt])

  // El audio se despierta con el primer gesto, sea cual sea, en la compu y en el
  // celular: el navegador no deja sonar antes. Así el primer clic sobre una burbuja
  // ya puede sonar. Safari de iPhone cuenta como gesto el final del toque, no el
  // comienzo, así que se escuchan los dos.
  useEffect(() => {
    const events = ['pointerdown', 'touchend', 'click', 'keydown']
    for (const e of events) window.addEventListener(e, unlockSound, true)
    return () => {
      for (const e of events) window.removeEventListener(e, unlockSound, true)
    }
  }, [])

  // --- puntero --------------------------------------------------------------
  // A nivel ventana para que el paralaje no se congele al pasar por una burbuja.
  // Es del escritorio: en el celular no hay un puntero que pase por encima, y los
  // dedos los atienden los manejadores de más abajo.
  useEffect(() => {
    if (compact) return

    const sleepAfter = (ms: number) => {
      window.clearTimeout(sleepRef.current)
      sleepRef.current = window.setTimeout(() => {
        if (dragRef.current) return
        onAwakeRef.current(false)
        sceneRef.current.awake = false
      }, ms)
    }

    const onMove = (e: PointerEvent) => {
      const box = wrapRef.current?.getBoundingClientRect()
      if (!box) return
      const x = e.clientX - box.left
      const y = e.clientY - box.top
      const inside = x >= 0 && y >= 0 && x <= box.width && y <= box.height
      pointerRef.current = { x, y, inside }

      if (inside) {
        onAwakeRef.current(true)
        sceneRef.current.awake = true
        sleepAfter(IDLE_MS)
      } else {
        sleepAfter(LEAVE_MS)
      }

      const rects = sceneRef.current.rects
      const push = pushRef.current
      if (push && rects) {
        const nail = nailOf(rects)
        nail.y += bodyRef.current.pose.drop * (scaleRef.current ?? 1)
        pushMove(bodyRef.current, Math.atan2(y - nail.y, x - nail.x) - push.from)
        return
      }
      const drag = dragRef.current
      if (!drag || !rects) return
      handleDrag(dragWidth(drag, { x, y }, rects, stateRef.current, dispatchRef.current), x, box.width)
    }

    const onUp = () => {
      const body = bodyRef.current
      if (pushRef.current) {
        pushRef.current = null
        pushEnd(body)
      }
      // Soltada pasada del máximo, la banda vuelve a su medida con un golpe sordo.
      if (dragRef.current && body.hand && body.hand.over > 0) {
        play('stretch', { pan: panOf(pointerRef.current.x, wrapRef.current?.clientWidth ?? 1) })
      }
      body.hand = null
      if (dragRef.current) {
        release(body)
        // El cuadro quedó con otro peso: al soltarlo se asienta con la diferencia.
        // Soltar la banda es sacarle la mano de encima: un vaivén chico del lado de
        // donde se la tiraba, aunque haya vuelto a la misma medida.
        const delta = body.kg - dragKgRef.current
        if (Math.abs(delta) > 0.001) settle(body, delta)
        sway(body, delta, dragSideRef.current, 0.45)
      }
      dragRef.current = null
      sceneRef.current.dragging = null
      sceneRef.current.dragCm = null
    }

    // Al perder el foco el HUD se va de inmediato: si volvés a la ventana y el
    // puntero quedó quieto encima, no tendría por qué seguir mostrándose.
    const onBlur = () => {
      pointerRef.current.inside = false
      sleepAfter(0)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', onBlur)
      window.clearTimeout(sleepRef.current)
    }
  }, [sceneRef, compact])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const rects = sceneRef.current.rects
      if (!rects || !scaleRef.current) return

      const box = wrapRef.current?.getBoundingClientRect()
      if (!box) return
      const p = { x: e.clientX - box.left, y: e.clientY - box.top }
      const current = stateRef.current

      // La zona se resuelve desde el evento, no desde la que calculó el último
      // frame: apretar sin haber movido antes dejaría una zona vieja.
      const zone = hitZone(
        toObject(p, bodyRef.current.pose, rects, scaleRef.current),
        rects,
        current.frame.width > 0,
        Boolean(current.mats[0]?.enabled),
      )

      // Agarrado por la obra, el cuadro se empuja: se inclina sobre el clavo hacia
      // donde va la mano, y al soltarlo se balancea. Un juguete, no una función: no
      // cambia nada de lo que se encarga.
      if (zone === 'art') {
        const body = bodyRef.current
        const nail = nailOf(rects)
        nail.y += body.pose.drop * scaleRef.current
        if (Math.hypot(p.x - nail.x, p.y - nail.y) < 24) return
        pushRef.current = { from: Math.atan2(p.y - nail.y, p.x - nail.x) - body.swing.angle }
        pushStart(body)
        unlockSound()
        play('grab', { pan: panOf(p.x, box.width), gain: -6 })
        e.preventDefault()
        return
      }

      const target = draggableTarget(zone)
      if (!target) return

      dragRef.current = startDrag(target, current, p, rects, scaleRef.current)
      sceneRef.current.dragging = target
      press(bodyRef.current, (p.y - rects.outer.y) / Math.max(1, rects.outer.h))
      dragKgRef.current = bodyRef.current.kg
      dragSideRef.current = p.x < rects.center.x ? -1 : 1
      unlockSound()
      play('grab', { pan: panOf(p.x, box.width) })
      e.preventDefault()
    },
    [sceneRef],
  )

  // --- dedos ----------------------------------------------------------------
  // Un dedo sobre la moldura o el passe-partout los ensancha, igual que el mouse.
  // Sobre la pared o la obra corre la luz —o la vista, si se está mirando de
  // cerca—. Dos dedos acercan, anclados al medio de los dedos. Un toque corto abre
  // lo que edita la parte tocada, y un doble toque, de cerca, vuelve al encuadre.

  const local = (e: React.PointerEvent): Point | null => {
    const box = wrapRef.current?.getBoundingClientRect()
    return box ? { x: e.clientX - box.left, y: e.clientY - box.top } : null
  }

  const onTouchDown = useCallback(
    (e: React.PointerEvent) => {
      const p = local(e)
      if (!p) return
      const g = touchRef.current
      g.pointers.set(e.pointerId, p)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Un toque muy corto puede dejar de existir antes de capturarlo.
      }

      if (g.pointers.size === 1) {
        const rects = sceneRef.current.rects
        const current = stateRef.current
        const hasMat = Boolean(current.mats[0]?.enabled)
        const zone = rects ? touchZone(toObject(p, bodyRef.current.pose, rects, scaleRef.current ?? 1), rects, current.frame.width > 0, hasMat) : 'wall'
        g.down = { x: p.x, y: p.y, time: performance.now(), zone }
        g.moved = false

        const target = draggableTarget(zone)
        if (target && rects && scaleRef.current) {
          dragRef.current = startDrag(target, current, p, rects, scaleRef.current)
          sceneRef.current.dragging = target
          g.mode = 'band'
        } else {
          g.mode = camRef.current.zoom > ZOOMED ? 'pan' : 'look'
        }
      } else if (g.pointers.size === 2 && g.mode !== 'band') {
        const [a, b] = [...g.pointers.values()]
        g.mode = 'pinch'
        g.moved = true
        g.spread = Math.hypot(a.x - b.x, a.y - b.y)
        g.mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        lookRef.current = null
      }
      e.preventDefault()
    },
    [sceneRef],
  )

  const onTouchMove = useCallback(
    (e: React.PointerEvent) => {
      const g = touchRef.current
      const previous = g.pointers.get(e.pointerId)
      const p = local(e)
      if (!previous || !p) return
      g.pointers.set(e.pointerId, p)

      const down = g.down
      if (down && Math.hypot(p.x - down.x, p.y - down.y) > TAP.px) g.moved = true

      const cam = camRef.current
      if (g.mode === 'band') {
        const drag = dragRef.current
        const rects = sceneRef.current.rects
        if (drag && rects) {
          const box = wrapRef.current?.getBoundingClientRect()
          // Recién cuando el dedo se mueve es agarrar: un toque quieto sobre la banda
          // abre su cajón, y no tiene por qué apretar el cuadro ni sonar.
          if (g.moved && !g.grabbed) {
            g.grabbed = true
            press(bodyRef.current, (p.y - rects.outer.y) / Math.max(1, rects.outer.h))
            dragKgRef.current = bodyRef.current.kg
            dragSideRef.current = p.x < rects.center.x ? -1 : 1
            play('grab', { pan: panOf(p.x, box?.width ?? 1) })
          }
          if (g.grabbed) handleDrag(dragWidth(drag, p, rects, stateRef.current, dispatchRef.current), p.x, box?.width ?? 1)
        }
      } else if (g.mode === 'look') {
        // Relativo a donde apoyó: la luz arranca quieta y se corre con el dedo, en
        // vez de saltar hacia el lugar de la pantalla donde cayó el toque.
        const box = wrapRef.current?.getBoundingClientRect()
        if (g.moved && down && box) {
          const reach = Math.min(box.width, box.height) * 0.42
          lookRef.current = {
            x: clamp((p.x - down.x) / reach, -1, 1),
            y: clamp((p.y - down.y) / reach, -1, 1),
          }
        }
      } else if (g.mode === 'pan') {
        cam.x += p.x - previous.x
        cam.y += p.y - previous.y
      } else if (g.mode === 'pinch' && g.pointers.size >= 2) {
        const [a, b] = [...g.pointers.values()]
        const spread = Math.hypot(a.x - b.x, a.y - b.y)
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const anchor = anchorRef.current
        const scale = scaleRef.current
        if (g.spread > 0 && anchor && scale) {
          // Lo que estaba bajo el medio de los dedos sigue bajo el medio de los dedos.
          const zoom = clamp((cam.zoom * spread) / g.spread, TOUCH_ZOOM.pinch, TOUCH_ZOOM.max)
          const f = zoom / cam.zoom
          const next = { x: mid.x - (g.mid.x - anchor.x) * f, y: mid.y - (g.mid.y - anchor.y) * f }
          cam.zoom = zoom
          cam.x = next.x - baseRef.current.x
          cam.y = next.y - baseRef.current.y
          anchorRef.current = next
          scaleRef.current = scale * f
        }
        g.spread = spread
        g.mid = mid
      }
    },
    [sceneRef],
  )

  const onTouchEnd = useCallback(
    (e: React.PointerEvent, cancelled = false) => {
      const g = touchRef.current
      if (!g.pointers.delete(e.pointerId)) return

      if (g.mode === 'band' && g.pointers.size === 0) {
        const body = bodyRef.current
        if (g.grabbed) {
          // Como con el mouse: pasada del máximo vuelve con un golpe sordo, y soltarla
          // deja el cuadro asentándose con su peso nuevo.
          if (body.hand && body.hand.over > 0) play('stretch', { pan: 0 })
          release(body)
          const delta = body.kg - dragKgRef.current
          if (Math.abs(delta) > 0.001) settle(body, delta)
          sway(body, delta, dragSideRef.current, 0.45)
          g.grabbed = false
        }
        body.hand = null
        dragRef.current = null
        sceneRef.current.dragging = null
        sceneRef.current.dragCm = null
      }

      if (g.pointers.size > 0) {
        // Queda un dedo de un pellizco: sigue moviendo la vista, sin salto.
        if (g.mode === 'pinch') g.mode = camRef.current.zoom > ZOOMED ? 'pan' : 'idle'
        return
      }

      const down = g.down
      const now = performance.now()
      const cam = camRef.current
      if (!cancelled && down && !g.moved && now - down.time < TAP.ms) {
        const lastTap = lastTapRef.current
        const double =
          now - lastTap.time < DOUBLE_TAP.ms &&
          Math.hypot(down.x - lastTap.x, down.y - lastTap.y) < DOUBLE_TAP.px
        lastTapRef.current = double ? { time: 0, x: 0, y: 0 } : { time: now, x: down.x, y: down.y }

        if (cam.zoom > ZOOMED) {
          if (double) {
            cam.zoom = 1
            cam.x = 0
            cam.y = 0
          }
        } else {
          onPartTapRef.current?.(partOf(down.zone))
        }
      }

      // Soltar por debajo del encuadre, o apenas por encima, vuelve solo a su lugar.
      if (cam.zoom < ZOOMED) {
        cam.zoom = 1
        cam.x = 0
        cam.y = 0
      }
      lookRef.current = null
      g.mode = 'idle'
      g.down = null
      askTiltPermission()
    },
    [sceneRef],
  )

  // La rueda acerca y aleja la escena. Mientras arrastrás no hace nada: la escala
  // está congelada a propósito para que el cuadro no se escape del cursor.
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (dragRef.current) return
    if (compactRef.current) {
      // Una tableta con trackpad: acerca como el pellizco, contra el centro.
      const cam = camRef.current
      cam.zoom = clamp(cam.zoom * Math.exp(-e.deltaY * 0.0011), 1, TOUCH_ZOOM.max)
      return
    }
    viewZoomRef.current = clamp(
      viewZoomRef.current * Math.exp(-e.deltaY * 0.0011),
      VIEW_ZOOM.min,
      VIEW_ZOOM.max,
    )
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const { src, aspect } = await loadArtworkFile(file)
        onArtworkDropped(src, aspect)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar la imagen')
        window.setTimeout(() => setError(null), 3200)
      }
    },
    [onArtworkDropped],
  )

  return (
    <div
      ref={wrapRef}
      className={'canvas-wrap' + (dragOver ? ' is-dragging' : '')}
      onPointerDown={compact ? onTouchDown : onPointerDown}
      onPointerMove={compact ? onTouchMove : undefined}
      onPointerUp={compact ? (e) => onTouchEnd(e) : undefined}
      onPointerCancel={compact ? (e) => onTouchEnd(e, true) : undefined}
      onClick={compact ? askTiltPermission : undefined}
      onWheel={onWheel}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) void handleFile(file)
      }}
    >
      <canvas ref={canvasRef} />
      <canvas ref={glCanvasRef} className="gl-layer" aria-hidden />
      <canvas ref={fadeLayerRef} className="fade-layer" aria-hidden />
      {dragOver && (
        <div className="drop-hint">
          <span>Solta tu dibujo aca</span>
        </div>
      )}
      {error && <div className="canvas-error">{error}</div>}
    </div>
  )
}

/**
 * La caja que ocupa el cuadro girado `angle`: lo que hay que hacer entrar en pantalla
 * mientras gira. Si se encuadrara el cuadro derecho, a mitad del giro se saldría.
 */
function turnedBox(size: { w: number; h: number }, angle: number) {
  const c = Math.abs(Math.cos(angle))
  const s = Math.abs(Math.sin(angle))
  return { w: size.w * c + size.h * s, h: size.w * s + size.h * c }
}

/** Lo que suena cuando le pasa algo al cuadro como cosa. */
const EVENT_SOUND: Record<BodyEvent, SoundName> = {
  'turn-start': 'turn-lift',
  'turn-land': 'turn-land',
  'hang-wire': 'wire',
  'hang-wall': 'thud',
}

/** De dónde suena algo, según dónde está en pantalla: apenas corrido, nunca de un solo oído. */
function panOf(x: number, width: number): number {
  return ((x / Math.max(1, width)) * 2 - 1) * 0.35
}

/**
 * Una copia de lo que hay pintado ahora —la pared y, si está, el cuadro en 3D—, en
 * la capa del fundido, para que se apague encima de lo que venga.
 */
function snapshot(
  layer: HTMLCanvasElement | null,
  canvas: HTMLCanvasElement,
  gl: HTMLCanvasElement | null,
  start: number,
) {
  if (!layer) return null
  if (layer.width !== canvas.width || layer.height !== canvas.height) {
    layer.width = canvas.width
    layer.height = canvas.height
  }
  const ctx = layer.getContext('2d')
  ctx?.clearRect(0, 0, layer.width, layer.height)
  ctx?.drawImage(canvas, 0, 0)
  if (gl && gl.width > 0) ctx?.drawImage(gl, 0, 0, layer.width, layer.height)
  layer.style.opacity = '1'
  return { canvas: layer, start }
}

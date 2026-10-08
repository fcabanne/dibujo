import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { copy } from '../../shared/copy'
import { easeOut, prefersReducedMotion, tween } from '../../shared/motion'
import { aspectOf, type Reference } from '../../shared/referenceImage'
import { createEffects, type EffectsRenderer } from '../render/effects'
import type { HeadScene } from '../../shared/loomis/head'
import { fitRect, paintGrid, paintHead, paintPhoto } from '../render/scene'
import type { AppState, GridState } from '../types'

interface Props {
  reference: Reference | null
  state: AppState
  onFile: (file: File) => void
  /** Se avisa una vez si la máquina no puede correr los efectos. */
  onEffectsSupport: (supported: boolean) => void
  /**
   * Celular: el cajón de controles, que sube desde abajo y tapa el pie del lienzo. La
   * foto se acomoda en lo que queda libre arriba de él y lo persigue mientras se
   * despliega, en vez de quedar tapada.
   */
  drawer?: HTMLElement | null
  /** Las cabezas de la foto, ya resueltas con su lente; null si no hay. */
  head?: HeadScene | null
}

const ZOOM = { min: 0.4, max: 8 }
/** Aire alrededor de la foto, para que la grilla no muera contra el borde de la ventana. */
const PAD = 32
/** Cuánto dura un fundido del lienzo: una grilla sobre otra, o un modo de Ajustes sobre otro. */
const FADE = 220
/** Cuánto tarda la vista en volver sola a su lugar: doble tap, o soltar fuera de rango. */
const SETTLE = 340
/** Dos toques más juntos que esto, en tiempo y en distancia, son un doble tap. */
const DOUBLE_TAP = { ms: 300, px: 30 }

interface View {
  zoom: number
  x: number
  y: number
}

/**
 * Cómo se aplica el recorte de la vista en `draw`:
 * - `clamp`: al rango, sin más. El estado de siempre.
 * - `elastic`: mientras un dedo arrastra. Se deja pasar del borde con
 *   resistencia —cuanto más se tira, menos avanza— y al soltar vuelve. Es la
 *   forma de decir "hasta acá" sin frenar en seco, que se siente como un
 *   error.
 * - `free`: mientras la vista vuelve sola a su lugar. Sin recorte, porque el
 *   recorrido arranca afuera del rango y tiene que poder terminar adentro sin
 *   pegar un salto en el primer cuadro.
 */
type Bounds = 'clamp' | 'elastic' | 'free'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Pasarse del borde, como al estirar algo: cuanto más se tira, menos avanza,
 * y nunca pasa de `reach`. La curva es la de iOS (el `0.55`), la que
 * cualquiera que haya usado un celular ya tiene en la mano.
 */
function rubber(value: number, limit: number, reach: number): number {
  const over = Math.abs(value) - limit
  if (over <= 0) return value
  return Math.sign(value) * (limit + (1 - 1 / ((over * 0.55) / reach + 1)) * reach)
}

/**
 * Lo que de la grilla cambia de un toque y conviene fundir: el tipo, la
 * cantidad, el color. El espesor y la opacidad no — se arrastran, y fundir
 * cada paso del arrastre haría que la grilla llegue siempre tarde al dedo.
 */
function gridJumped(a: GridState, b: GridState): boolean {
  return a.mode !== b.mode || a.count !== b.count || a.style.color !== b.style.color
}

/** La misma escena, con la grilla dada y su opacidad multiplicada por `alpha`. */
function withGrid(state: AppState, grid: GridState, alpha: number): AppState {
  return { ...state, grid: { ...grid, style: { ...grid.style, opacity: grid.style.opacity * alpha } } }
}

export function Canvas({
  reference,
  state,
  onFile,
  onEffectsSupport,
  drawer = null,
  head = null,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const effectsRef = useRef<EffectsRenderer | null>(null)
  const photoRef = useRef<CanvasImageSource | null>(null)
  const viewRef = useRef<View>({ zoom: 1, x: 0, y: 0 })
  const boundsRef = useRef<Bounds>('clamp')
  /** Dónde quedó la foto en el último cuadro, ya con el recorte o la resistencia aplicados. */
  const shownRef = useRef({ x: 0, y: 0 })
  /** Lo último que se dibujó, para poder anclar el zoom al puntero. */
  const placedRef = useRef({ x: 0, y: 0, w: 0, h: 0 })
  const frameRef = useRef(0)
  /** Los dedos apoyados. Uno mueve la foto; dos la acercan. */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  /** Sin arrastre: el pellizco solo cambia el zoom, nunca la posición. */
  const pinchRef = useRef<{ spread: number } | null>(null)
  /** Corta la vuelta animada en curso, si hay una. Un dedo nuevo siempre gana. */
  const stopSettle = useRef<() => void>(() => {})
  const wheelTimer = useRef(0)
  /** El toque en curso, para saber al soltar si fue un toque o un arrastre. */
  const pressRef = useRef({ time: 0, x: 0, y: 0, moved: false })
  /** El último toque suelto, para reconocer el segundo de un doble tap. */
  const tapRef = useRef({ time: 0, x: 0, y: 0 })
  const touchDoubleRef = useRef(0)

  /** Una grilla que se está yendo, fundida debajo de la que llega. */
  const gridFadeRef = useRef<{ from: GridState; start: number } | null>(null)
  const previousGrid = useRef(state.grid)
  /** La foto en el modo de Ajustes anterior, fundida debajo del nuevo. */
  const photoFadeRef = useRef<{ from: HTMLCanvasElement; start: number } | null>(null)
  const previousEffects = useRef({ reference, mode: state.effects.mode })
  /**
   * Lo que le importa al shader, sin cuánto se ve la foto: esa se aplica al pintar,
   * y arrastrar su slider no tiene por qué volver a pasar la foto por la placa.
   */
  const { mode, bw, light, contrast, edges, tones } = state.effects
  const shaderEffects = useMemo(
    () => ({ mode, bw, light, contrast, edges, tones, opacity: 1 }),
    [mode, bw, light, contrast, edges, tones],
  )

  const stateRef = useRef(state)
  const refRef = useRef(reference)
  const headRef = useRef(head)
  stateRef.current = state
  refRef.current = reference
  headRef.current = head

  const [dragOver, setDragOver] = useState(false)

  const drawRef = useRef<() => void>(() => {})

  /**
   * Cuánto del alto del lienzo está tapado por el cajón ahora mismo. Se lee del DOM y
   * no se calcula: el cajón crece con una transición de CSS, y midiéndolo en cada
   * cuadro la foto lo acompaña sin que nadie le avise.
   */
  const drawerRef = useRef(drawer)
  drawerRef.current = drawer
  const coveredHeight = () => drawerRef.current?.getBoundingClientRect().height ?? 0

  /**
   * Se dibuja cuando cambia algo y no sesenta veces por segundo: acá no hay nada
   * animado salvo durante un fundido o una vuelta, y un loop permanente sería
   * tener la placa encendida mirando una foto quieta.
   */
  const schedule = useCallback(() => {
    if (frameRef.current) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0
      drawRef.current()
    })
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const current = refRef.current
    if (!canvas || !wrap) return

    const box = wrap.getBoundingClientRect()
    if (box.width < 2 || box.height < 2) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const dw = Math.round(box.width * dpr)
    const dh = Math.round(box.height * dpr)
    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width = dw
      canvas.height = dh
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, box.width, box.height)

    const photo = photoRef.current
    if (!current || !photo) return

    const aspect = aspectOf(current)
    const view = viewRef.current
    // La foto se encuadra en lo que el cajón deja libre, no en el lienzo entero.
    const freeH = Math.max(80, box.height - coveredHeight())
    const availH = freeH - PAD * 2
    const base = fitRect(aspect, { w: box.width - PAD * 2, h: availH })
    const w = base.w * view.zoom
    const h = base.h * view.zoom

    // Como en Lightroom: solo se puede mover hacia el lado que sobra. Si la
    // foto zoomeada no excede el ancho o el alto disponible, ese eje no se
    // mueve nunca. Se recalcula en cada cuadro, así que un cambio de tamaño
    // de la ventana (o del panel de abajo) vuelve a dejar la vista adentro de
    // rango en vez de dejar la foto descentrada.
    // De referencia va `freeH` y no `availH`: el PAD se cancela solo, porque entra
    // igual arriba y abajo tanto en `base` como en el centrado de acá abajo — el
    // centro de la foto es siempre el centro del lugar libre, sin importar el zoom.
    const overflowX = Math.max(0, (w - box.width) / 2)
    const overflowY = Math.max(0, (h - freeH) / 2)
    let dx = view.x
    let dy = view.y
    if (boundsRef.current === 'clamp') {
      view.x = dx = clamp(view.x, -overflowX, overflowX)
      view.y = dy = clamp(view.y, -overflowY, overflowY)
    } else if (boundsRef.current === 'elastic') {
      // Poco recorrido a propósito: tiene que leerse como resistencia, no
      // como que la foto se mueve igual.
      const reach = Math.min(box.width, freeH) * 0.08
      dx = rubber(view.x, overflowX, reach)
      dy = rubber(view.y, overflowY, reach)
    }
    shownRef.current = { x: dx, y: dy }

    const rect = {
      x: (box.width - w) / 2 + dx,
      y: PAD + (availH - h) / 2 + dy,
      w,
      h,
    }
    placedRef.current = rect

    const now = performance.now()
    let fading = false
    ctx.imageSmoothingQuality = 'high'

    const scene = stateRef.current
    const opacity = scene.effects.opacity
    const photoFade = photoFadeRef.current
    if (photoFade) {
      const t = Math.min(1, (now - photoFade.start) / FADE)
      paintPhoto(ctx, rect, photoFade.from, opacity)
      paintPhoto(ctx, rect, photo, opacity, easeOut(t))
      if (t < 1) fading = true
      else photoFadeRef.current = null
    } else {
      paintPhoto(ctx, rect, photo, opacity)
    }

    const gridFade = gridFadeRef.current
    if (gridFade) {
      const e = easeOut(Math.min(1, (now - gridFade.start) / FADE))
      paintGrid(ctx, rect, withGrid(scene, gridFade.from, 1 - e), aspect)
      paintGrid(ctx, rect, withGrid(scene, scene.grid, e), aspect)
      if (e < 1) fading = true
      else gridFadeRef.current = null
    } else {
      paintGrid(ctx, rect, scene, aspect)
    }
    paintHead(ctx, rect, scene, headRef.current)

    if (fading) schedule()
  }, [schedule])
  drawRef.current = draw

  // Los efectos se recalculan solo cuando cambian ellos o la foto. Es el paso caro
  // del cuadro: mover la grilla no tiene por qué volver a pasar la foto por el shader.
  useEffect(() => {
    if (!reference) {
      photoRef.current = null
      photoFadeRef.current = null
      schedule()
      return
    }
    if (!effectsRef.current) {
      effectsRef.current = createEffects()
      onEffectsSupport(effectsRef.current !== null)
    }
    const { preview } = reference

    // Cambiar de modo de Ajustes funde la foto de un modo al otro en vez de
    // cambiarla de golpe: pasar de color a blanco y negro se ve como un
    // cambio de luz, no como otra foto. La de antes se copia acá porque el
    // renderizador reusa su lienzo y la va a pisar en la línea de abajo.
    // Solo al cambiar de modo: las perillas de adentro se arrastran, y un
    // fundido por cada paso haría que la foto llegue siempre tarde al dedo.
    const before = previousEffects.current
    previousEffects.current = { reference, mode: shaderEffects.mode }
    if (
      before.reference === reference &&
      before.mode !== shaderEffects.mode &&
      photoRef.current &&
      !prefersReducedMotion()
    ) {
      const snapshot = document.createElement('canvas')
      snapshot.width = preview.width
      snapshot.height = preview.height
      snapshot.getContext('2d')?.drawImage(photoRef.current, 0, 0, preview.width, preview.height)
      photoFadeRef.current = { from: snapshot, start: performance.now() }
    }

    photoRef.current = effectsRef.current
      ? effectsRef.current.apply(preview, preview.width, preview.height, shaderEffects)
      : preview
    schedule()
  }, [reference, shaderEffects, schedule, onEffectsSupport])

  // La grilla que cambia de un toque se funde con la anterior.
  useEffect(() => {
    const before = previousGrid.current
    previousGrid.current = state.grid
    if (before !== state.grid && gridJumped(before, state.grid) && !prefersReducedMotion()) {
      gridFadeRef.current = { from: before, start: performance.now() }
    }
  }, [state.grid])

  // Cualquier otro cambio —grilla, color, medidas— solo repinta.
  useEffect(schedule, [state, head, schedule])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver(schedule)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [schedule])

  // El cajón crece y se achica con una transición: cada cambio de su alto repinta en
  // el acto —el aviso llega antes de pintar la pantalla, así que la foto y el cajón
  // van en el mismo cuadro— y no un cuadro después, que se vería como un arrastre.
  useEffect(() => {
    if (!drawer) return
    const observer = new ResizeObserver(() => drawRef.current())
    observer.observe(drawer)
    return () => observer.disconnect()
  }, [drawer])

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current)
      // Volver a cero no es cosmético: `schedule` usa este ref como candado, y si
      // queda con el número de un cuadro ya cancelado no vuelve a pedir ninguno.
      frameRef.current = 0
      stopSettle.current()
      window.clearTimeout(wheelTimer.current)
      effectsRef.current?.dispose()
      effectsRef.current = null
    },
    [],
  )

  // Al cambiar de foto, la vista vuelve a encuadrar sola: el zoom de la anterior
  // no tiene por qué tener sentido en la nueva. Y la foto nueva aparece
  // fundiéndose desde un poco más chica, en vez de reemplazar a la otra de un
  // cuadro al siguiente — se lee como "llegó", no como un parpadeo.
  useEffect(() => {
    stopSettle.current()
    viewRef.current = { zoom: 1, x: 0, y: 0 }
    boundsRef.current = 'clamp'
    if (reference && !prefersReducedMotion()) {
      canvasRef.current?.animate(
        [
          { opacity: 0, transform: 'scale(0.985)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      )
    }
  }, [reference])

  /**
   * Lleva la vista a `target` en un recorrido, en vez de saltar. Arranca de
   * donde la foto se ve ahora (con la resistencia del borde incluida, si se
   * está soltando un arrastre), así el primer cuadro coincide con el último
   * que se vio.
   */
  const settleTo = useCallback(
    (target: View) => {
      stopSettle.current()
      const view = viewRef.current
      const from = { zoom: view.zoom, ...shownRef.current }
      if (from.zoom === target.zoom && from.x === target.x && from.y === target.y) {
        boundsRef.current = 'clamp'
        schedule()
        return
      }
      boundsRef.current = 'free'
      stopSettle.current = tween(
        SETTLE,
        (t) => {
          view.zoom = from.zoom + (target.zoom - from.zoom) * t
          view.x = from.x + (target.x - from.x) * t
          view.y = from.y + (target.y - from.y) * t
          drawRef.current()
        },
        () => {
          boundsRef.current = 'clamp'
          stopSettle.current = () => {}
          schedule()
        },
      )
    },
    [schedule],
  )

  /**
   * Después de un gesto, la vista se acomoda sola: si quedó más chica que el
   * encuadre vuelve a él —achicar por debajo se puede, como en la galería del
   * celular, pero no se queda así—, y si un arrastre la dejó pasada del borde
   * vuelve al borde.
   */
  const settle = useCallback(() => {
    const wrap = wrapRef.current
    const rect = placedRef.current
    if (!wrap || !rect.w) return
    const box = wrap.getBoundingClientRect()
    const view = viewRef.current
    const zoom = Math.max(1, view.zoom)
    const w = (rect.w / view.zoom) * zoom
    const h = (rect.h / view.zoom) * zoom
    const reachX = Math.max(0, (w - box.width) / 2)
    const reachY = Math.max(0, (h - Math.max(80, box.height - coveredHeight())) / 2)
    const shown = shownRef.current
    settleTo({ zoom, x: clamp(shown.x, -reachX, reachX), y: clamp(shown.y, -reachY, reachY) })
  }, [settleTo])

  const reset = useCallback(() => settleTo({ zoom: 1, x: 0, y: 0 }), [settleTo])

  /**
   * Acercar dejando quieto un punto de la pantalla: el puntero con la rueda,
   * el medio de los dedos con el pellizco. El recorte de `draw` es lo que hace
   * seguro anclar en el punto que se está mirando: como mucho la vista llega
   * al borde de lo que sobra, nunca se va a la deriva.
   */
  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    const wrap = wrapRef.current
    const rect = placedRef.current
    if (!wrap || !rect.w) return

    const box = wrap.getBoundingClientRect()
    const u = (cx - rect.x) / rect.w
    const v = (cy - rect.y) / rect.h

    const view = viewRef.current
    const zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, view.zoom * factor))
    const w = (rect.w / view.zoom) * zoom
    const h = (rect.h / view.zoom) * zoom

    view.zoom = zoom
    view.x = cx - u * w - (box.width - w) / 2
    view.y = cy - v * h - (Math.max(80, box.height - coveredHeight()) - h) / 2
  }, [])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const box = wrapRef.current?.getBoundingClientRect()
      if (!box) return
      stopSettle.current()
      boundsRef.current = 'clamp'
      zoomAt(e.clientX - box.left, e.clientY - box.top, Math.exp(-e.deltaY * 0.0012))
      schedule()
      // La rueda no tiene un "soltar": se da por terminado el gesto cuando deja
      // de girar un momento.
      window.clearTimeout(wheelTimer.current)
      wheelTimer.current = window.setTimeout(settle, 180)
    },
    [schedule, settle, zoomAt],
  )

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    stopSettle.current()
    const pointers = pointersRef.current
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    pinchRef.current = null

    if (pointers.size === 1) {
      pressRef.current = { time: performance.now(), x: e.clientX, y: e.clientY, moved: false }
      boundsRef.current = 'elastic'
    } else {
      // Entra el segundo dedo: lo que el primero estiraba de más queda donde
      // se ve, y el pellizco sigue desde ahí con el recorte normal.
      pressRef.current.moved = true
      Object.assign(viewRef.current, shownRef.current)
      boundsRef.current = 'clamp'
    }

    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // Un toque muy corto puede dejar de existir antes de que lleguemos a capturarlo.
      // Sin captura el gesto anda igual mientras el dedo no salga del lienzo.
    }
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pointers = pointersRef.current
      const previous = pointers.get(e.pointerId)
      if (!previous) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      const box = wrapRef.current?.getBoundingClientRect()
      if (!box) return
      const view = viewRef.current

      if (pointers.size >= 2) {
        // Dos dedos: solo zoom, ancla al medio de los dedos. La distancia
        // entre ellos se mide de nuevo en cada movimiento en vez de contra el
        // inicio del gesto, así levantar y volver a apoyar uno no pega un salto.
        const [a, b] = [...pointers.values()]
        const spread = Math.hypot(a.x - b.x, a.y - b.y)
        const middle = { x: (a.x + b.x) / 2 - box.left, y: (a.y + b.y) / 2 - box.top }
        const last = pinchRef.current

        if (last && last.spread > 0) zoomAt(middle.x, middle.y, spread / last.spread)
        pinchRef.current = { spread }
      } else {
        view.x += e.clientX - previous.x
        view.y += e.clientY - previous.y
        const press = pressRef.current
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) press.moved = true
      }

      schedule()
    },
    [schedule, zoomAt],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const pointers = pointersRef.current
      pointers.delete(e.pointerId)
      // Que el dedo que queda no arrastre con el salto de haber sido parte del pellizco.
      pinchRef.current = null

      if (pointers.size > 0) {
        boundsRef.current = 'elastic'
        return
      }

      // Doble tap, reconocido a mano: `dblclick` no llega en todos los
      // celulares. Solo toques cortos y quietos — un arrastre que termina cerca
      // de donde empezó el anterior no es un doble tap.
      const now = performance.now()
      const press = pressRef.current
      if (e.pointerType !== 'mouse' && !press.moved && now - press.time < 250) {
        const tap = tapRef.current
        if (now - tap.time < DOUBLE_TAP.ms && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < DOUBLE_TAP.px) {
          tapRef.current = { time: 0, x: 0, y: 0 }
          touchDoubleRef.current = now
          reset()
          return
        }
        tapRef.current = { time: now, x: e.clientX, y: e.clientY }
      }

      settle()
    },
    [reset, settle],
  )

  // Con mouse el doble clic llega como `dblclick`. En un celular que además lo
  // manda, ya lo resolvió el doble tap de arriba: no se recentra dos veces.
  const onDoubleClick = useCallback(() => {
    if (performance.now() - touchDoubleRef.current < 500) return
    reset()
  }, [reset])

  return (
    <div
      ref={wrapRef}
      className={'stage' + (dragOver ? ' is-dragging' : '')}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) onFile(file)
      }}
    >
      <canvas ref={canvasRef} />

      {dragOver && (
        <div className="drop">
          <span>{copy.canvas.drop}</span>
        </div>
      )}
    </div>
  )
}

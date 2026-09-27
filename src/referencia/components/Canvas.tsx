import { useCallback, useEffect, useRef, useState } from 'react'
import { copy } from '../../shared/copy'
import { aspectOf, type Reference } from '../../shared/referenceImage'
import { createEffects, type EffectsRenderer } from '../render/effects'
import { fitRect, paintScene } from '../render/scene'
import type { AppState } from '../types'

interface Props {
  reference: Reference | null
  state: AppState
  onFile: (file: File) => void
  /** Se avisa una vez si la máquina no puede correr los efectos. */
  onEffectsSupport: (supported: boolean) => void
}

const ZOOM = { min: 0.4, max: 8 }
/** Aire alrededor de la foto, para que la grilla no muera contra el borde de la ventana. */
const PAD = 32

interface View {
  zoom: number
  x: number
  y: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function Canvas({ reference, state, onFile, onEffectsSupport }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const effectsRef = useRef<EffectsRenderer | null>(null)
  const photoRef = useRef<CanvasImageSource | null>(null)
  const viewRef = useRef<View>({ zoom: 1, x: 0, y: 0 })
  /** Lo último que se dibujó, para poder anclar el zoom al puntero. */
  const placedRef = useRef({ x: 0, y: 0, w: 0, h: 0 })
  const frameRef = useRef(0)
  /** Los dedos apoyados. Uno mueve la foto; dos la acercan. */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  /** Sin arrastre: el pellizco solo cambia el zoom, nunca la posición. */
  const pinchRef = useRef<{ spread: number } | null>(null)

  const stateRef = useRef(state)
  const refRef = useRef(reference)
  stateRef.current = state
  refRef.current = reference

  const [dragOver, setDragOver] = useState(false)

  /**
   * Se dibuja cuando cambia algo y no sesenta veces por segundo: acá no hay nada
   * animado, y un loop permanente sería tener la placa encendida mirando una foto
   * quieta.
   */
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
    const availH = box.height - PAD * 2
    const base = fitRect(aspect, { w: box.width - PAD * 2, h: availH })
    const w = base.w * view.zoom
    const h = base.h * view.zoom

    // Como en Lightroom: solo se puede mover hacia el lado que sobra. Si la
    // foto zoomeada no excede el ancho o el alto disponible, ese eje no se
    // mueve nunca — ni con el dedo ni con un pellizco que ancle lejos del
    // centro. Se recalcula en cada cuadro, así que un cambio de tamaño de la
    // ventana (o del panel de abajo) vuelve a dejar la vista adentro de rango
    // en vez de dejar la foto descentrada.
    // De referencia va `box.height` y no `availH`: el PAD se cancela solo,
    // porque entra igual arriba y abajo tanto en `base` como en el centrado
    // de acá abajo — el centro de la foto es siempre el centro de la
    // ventana, sin importar el zoom. Usar `availH` acá dejaba un margen de
    // PAD que ningún arrastre podía correr.
    const overflowX = Math.max(0, (w - box.width) / 2)
    const overflowY = Math.max(0, (h - box.height) / 2)
    view.x = clamp(view.x, -overflowX, overflowX)
    view.y = clamp(view.y, -overflowY, overflowY)

    const rect = {
      x: (box.width - w) / 2 + view.x,
      y: PAD + (availH - h) / 2 + view.y,
      w,
      h,
    }
    placedRef.current = rect

    ctx.imageSmoothingQuality = 'high'
    paintScene(ctx, rect, photo, stateRef.current, aspect)
  }, [])

  const schedule = useCallback(() => {
    if (frameRef.current) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0
      draw()
    })
  }, [draw])

  // Los efectos se recalculan solo cuando cambian ellos o la foto. Es el paso caro
  // del cuadro: mover la grilla no tiene por qué volver a pasar la foto por el shader.
  useEffect(() => {
    if (!reference) {
      photoRef.current = null
      schedule()
      return
    }
    if (!effectsRef.current) {
      effectsRef.current = createEffects()
      onEffectsSupport(effectsRef.current !== null)
    }
    const { preview } = reference
    photoRef.current = effectsRef.current
      ? effectsRef.current.apply(preview, preview.width, preview.height, state.effects)
      : preview
    schedule()
  }, [reference, state.effects, schedule, onEffectsSupport])

  // Cualquier otro cambio —grilla, color, medidas— solo repinta.
  useEffect(schedule, [state, schedule])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver(schedule)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [schedule])

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current)
      // Volver a cero no es cosmético: `schedule` usa este ref como candado, y si
      // queda con el número de un cuadro ya cancelado no vuelve a pedir ninguno.
      frameRef.current = 0
      effectsRef.current?.dispose()
      effectsRef.current = null
    },
    [],
  )

  // Al cambiar de foto, la vista vuelve a encuadrar sola: el zoom de la anterior no
  // tiene por qué tener sentido en la nueva.
  useEffect(() => {
    viewRef.current = { zoom: 1, x: 0, y: 0 }
  }, [reference])

  const reset = useCallback(() => {
    viewRef.current = { zoom: 1, x: 0, y: 0 }
    schedule()
  }, [schedule])

  /**
   * Acercar dejando quieto un punto de la pantalla: el puntero con la rueda,
   * el medio de los dedos con el pellizco. Antes esto se ancló al centro de
   * la ventana para el pellizco, porque sin el recorte de más abajo un punto
   * que tiembla hacía parecer que la foto se arrastraba. Con la foto
   * recortada a lo que sobra, anclar en el punto que se está mirando vuelve
   * a ser seguro: como mucho el pellizco corrige la vista al límite del
   * recorte, nunca la deja a la deriva.
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
    view.y = cy - v * h - (box.height - h) / 2
  }, [])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const box = wrapRef.current?.getBoundingClientRect()
      if (!box) return
      zoomAt(e.clientX - box.left, e.clientY - box.top, Math.exp(-e.deltaY * 0.0012))
      schedule()
    },
    [schedule, zoomAt],
  )

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    pinchRef.current = null
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
        // inicio del gesto, así levantar y volver a apoyar uno no pega un
        // salto. El recorte de más abajo (en `draw`) es lo que hace que
        // anclar acá sea seguro: como mucho la vista llega al borde de lo
        // que sobra, nunca se va a la deriva.
        const [a, b] = [...pointers.values()]
        const spread = Math.hypot(a.x - b.x, a.y - b.y)
        const middle = { x: (a.x + b.x) / 2 - box.left, y: (a.y + b.y) / 2 - box.top }
        const last = pinchRef.current

        if (last && last.spread > 0) zoomAt(middle.x, middle.y, spread / last.spread)
        pinchRef.current = { spread }
      } else {
        view.x += e.clientX - previous.x
        view.y += e.clientY - previous.y
      }

      schedule()
    },
    [schedule, zoomAt],
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId)
    // Que el dedo que queda no arrastre con el salto de haber sido parte del pellizco.
    pinchRef.current = null
  }, [])

  return (
    <div
      ref={wrapRef}
      className={'stage' + (dragOver ? ' is-dragging' : '')}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={reset}
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

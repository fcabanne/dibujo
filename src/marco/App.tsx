import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Canvas, type FreeArea, type Part, type SceneSnapshot } from './components/Canvas'
import { MobileUI, type Tab } from './components/mobile/MobileUI'
import { Welcome } from './components/Welcome'
import { Overlay, type Category } from './components/Overlay'
import { computeLayout } from './domain/geometry'
import { exportScene } from './export'
import { useCompact } from './hooks/useCompact'
import { deliver } from '../shared/deliver'
import { loadArtwork } from '../shared/imageStore'
import { DEFAULT_STATE } from './state/defaults'
import { loadSession, saveSession } from './state/persistence'
import { reducer, type Action } from './state/reducer'
import type { Layout } from './types'

/** Qué pestaña abre, en el celular, tocar cada parte del cuadro. */
const TAB_FOR: Record<Exclude<Part, 'wall'>, Tab> = {
  frame: 'marco',
  mat: 'passe',
  art: 'obra',
}

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadSession)
  const [open, setOpen] = useState<Category | null>(null)
  const [awake, setAwake] = useState(false)
  const [layout, setLayout] = useState<Layout>(() => computeLayout(loadSession()))

  /**
   * Celular o escritorio. No son dos apps: el mismo lienzo, el mismo estado y el
   * mismo render, con dos capas de controles encima. Ver `useCompact` para por qué
   * acá la pregunta no es solo el ancho.
   */
  const compact = useCompact()
  /** La pestaña abierta en el celular. Vive acá porque también la abre tocar el cuadro. */
  const [tab, setTab] = useState<Tab | null>(null)
  /** Si ya se leyó IndexedDB: antes no se sabe si el dibujo de ejemplo se va a quedar. */
  const [ready, setReady] = useState(false)
  /** Lo registra la capa del celular y lo lee el lienzo en cada cuadro. */
  const freeArea = useRef<(() => FreeArea | null) | null>(null)

  /**
   * Vista previa al pasar por una opción: se ve el cambio en el cuadro antes de
   * elegirlo. Como el reducer es puro, alcanza con aplicarlo sin guardar el
   * resultado — no hace falta una segunda manera de mezclar estados, y lo que se
   * autoguarda sigue siendo lo que confirmaste.
   */
  const [preview, setPreview] = useState<Action | null>(null)
  const shown = preview ? reducer(state, preview) : state

  // Lo que el lienzo publica cada frame y el overlay lee para anclarse.
  const sceneRef = useRef<SceneSnapshot>({
    rects: null,
    zone: 'wall',
    dragging: null,
    dragCm: null,
    hasFrame: true,
    hasMat: true,
    wallLuma: 0.5,
    awake: false,
  })

  // La obra vive en IndexedDB y se lee sin bloquear el arranque: la escena aparece
  // enseguida con el placeholder y la imagen guardada entra un instante después.
  useEffect(() => {
    let cancelled = false
    void loadArtwork('marco').then((src) => {
      if (cancelled) return
      if (src) dispatch({ type: 'artwork/restore', src })
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Autoguardado con respiro: arrastrar un gizmo dispara muchísimos cambios seguidos.
  useEffect(() => {
    const id = window.setTimeout(() => saveSession(state), 400)
    return () => window.clearTimeout(id)
  }, [state])

  // Al pasar de una capa a la otra no queda nada abierto de la anterior.
  useEffect(() => {
    setOpen(null)
    setPreview(null)
    setTab(null)
  }, [compact])

  const handleLayout = useCallback((next: Layout) => {
    setLayout((prev) =>
      prev.outer.w === next.outer.w &&
      prev.outer.h === next.outer.h &&
      prev.sight.w === next.sight.w &&
      prev.sight.h === next.sight.h &&
      prev.depth === next.depth
        ? prev
        : next,
    )
  }, [])

  // Una obra nueva abre lo suyo: en escritorio la burbuja de la obra, en el celular
  // su pestaña, con el tamaño real arriba — es lo que sigue después de subirla.
  /** Cuántos dibujos llegaron en esta visita: cada uno nuevo se cuelga en la pared. */
  const [arrival, setArrival] = useState(0)

  const handleArtworkDropped = useCallback(
    (src: string, aspect: number) => {
      dispatch({ type: 'artwork/replace', src, aspect })
      setArrival((n) => n + 1)
      if (compact) setTab('obra')
      else setOpen('artwork')
    },
    [compact],
  )

  // Tocar una parte del cuadro abre lo que la edita. Tocar la pared cierra el cajón:
  // es tocar "afuera", y devuelve el cuadro entero con su cartela.
  const handlePartTap = useCallback((part: Part) => {
    setTab(part === 'wall' ? null : TAB_FOR[part])
  }, [])

  /**
   * Quitar el dibujo vuelve a la pantalla de inicio y **no toca el enmarcado**, como
   * quitar la foto en Referencia: probar la misma moldura en otro dibujo de la serie
   * no tiene por qué costar armarla de nuevo. El dibujo de ejemplo vuelve a ser la
   * obra —es la obra "vacía"— y se guarda como tal.
   */
  const handleRemove = useCallback(() => {
    setTab(null)
    setOpen(null)
    setPreview(null)
    dispatch({ type: 'artwork/patch', patch: { src: DEFAULT_STATE.artwork.src } })
  }, [])

  /**
   * Descargar la foto del cuadro colgado, con la luz como se está viendo. Va lo
   * confirmado y no la vista previa: el clic sobre el botón ya no está sobre una
   * muestra. En el celular sale por la hoja de compartir, que guarda en Fotos.
   */
  const handleSave = useCallback(async () => {
    const output = await exportScene(state, sceneRef.current.parallax ?? { x: 0, y: 0 }, compact)
    await deliver(output)
  }, [state, compact])

  /**
   * Sin un dibujo propio va la pantalla de inicio, como en Referencia y la mesa de luz,
   * en el celular y en el escritorio: el dibujo de ejemplo hacía creer que ya había
   * algo cargado. Mientras IndexedDB no contestó no se muestra ninguna de las dos
   * cosas, porque si había un dibujo guardado la bienvenida parpadearía un instante y
   * parecería que se perdió.
   */
  const placeholder = state.artwork.src === DEFAULT_STATE.artwork.src
  const welcome = placeholder
  const showCanvas = ready && !placeholder

  return (
    <div className={'app' + (compact ? ' is-compact' : '') + (compact || !showCanvas ? ' ds' : '')}>
      {showCanvas && (
        <Canvas
          state={shown}
          committed={state}
          arrival={arrival}
          dispatch={dispatch}
          sceneRef={sceneRef}
          onLayout={handleLayout}
          onArtworkDropped={handleArtworkDropped}
          onAwakeChange={setAwake}
          compact={compact}
          freeArea={freeArea}
          onPartTap={handlePartTap}
        />
      )}

      {ready &&
        (welcome ? (
          <Welcome onArtwork={handleArtworkDropped} />
        ) : compact ? (
          <MobileUI
            state={state}
            dispatch={dispatch}
            sceneRef={sceneRef}
            layout={layout}
            tab={tab}
            onTab={setTab}
            freeArea={freeArea}
            onArtwork={handleArtworkDropped}
            onRemove={handleRemove}
            onSave={handleSave}
          />
        ) : (
          <Overlay
            state={shown}
            onPreview={setPreview}
            dispatch={dispatch}
            sceneRef={sceneRef}
            layout={layout}
            awake={awake}
            open={open}
            onOpenChange={setOpen}
            onRemove={handleRemove}
            onSave={handleSave}
          />
        ))}
    </div>
  )
}

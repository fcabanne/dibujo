import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Canvas, type SceneSnapshot } from './components/Canvas'
import { Overlay, type Category } from './components/Overlay'
import { computeLayout } from './domain/geometry'
import { loadSession, saveSession } from './state/persistence'
import { reducer, type Action } from './state/reducer'
import type { Layout } from './types'

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadSession)
  const [open, setOpen] = useState<Category | null>(null)
  const [awake, setAwake] = useState(false)
  const [layout, setLayout] = useState<Layout>(() => computeLayout(loadSession()))

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

  // Autoguardado con respiro: arrastrar un gizmo dispara muchísimos cambios seguidos.
  useEffect(() => {
    const id = window.setTimeout(() => saveSession(state), 400)
    return () => window.clearTimeout(id)
  }, [state])

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

  const handleArtworkDropped = useCallback((src: string, aspect: number) => {
    dispatch({ type: 'artwork/replace', src, aspect })
    setOpen('artwork')
  }, [])

  return (
    <div className="app">
      <Canvas
        state={shown}
        dispatch={dispatch}
        sceneRef={sceneRef}
        onLayout={handleLayout}
        onArtworkDropped={handleArtworkDropped}
        onAwakeChange={setAwake}
      />

      <Overlay
        state={shown}
        onPreview={setPreview}
        dispatch={dispatch}
        sceneRef={sceneRef}
        layout={layout}
        awake={awake}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  )
}

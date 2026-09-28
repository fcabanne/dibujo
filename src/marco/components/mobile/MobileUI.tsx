import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'
import { copy } from '../../../shared/copy'
import { loadArtworkFile } from '../../../shared/imageFile'
import { BackIcon, IconButton, PhotoIcon } from '../../../shared/ui'
import type { Action } from '../../state/reducer'
import type { AppState, Layout } from '../../types'
import type { FreeArea, SceneSnapshot } from '../Canvas'
import { FrameIcon, GlassIcon, MatIcon, WallIcon } from '../hud/icons'
import { WallLabel } from '../hud/WallLabel'
import { FieldEditor, type Editing } from './FieldEditor'
import {
  ArtworkPanel,
  cm,
  FramePanel,
  GlassPanel,
  MatPanel,
  WallPanel,
  type Picker,
} from './panels'

export type Tab = 'obra' | 'marco' | 'passe' | 'vidrio' | 'pared'

/**
 * Las cinco pestañas, en el orden en que se decide un cuadro: la obra, la moldura,
 * el passe-partout, el vidrio y, al final, la pared donde va a colgar. Es el mismo
 * orden del PRD —la pared es lo último y lo más al margen—.
 */
const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'obra', label: copy.marco.tabs.artwork, icon: <PhotoIcon /> },
  { id: 'marco', label: copy.marco.tabs.frame, icon: <FrameIcon /> },
  { id: 'passe', label: copy.marco.tabs.mat, icon: <MatIcon /> },
  { id: 'vidrio', label: copy.marco.tabs.glass, icon: <GlassIcon /> },
  { id: 'pared', label: copy.marco.tabs.wall, icon: <WallIcon /> },
]

interface Props {
  state: AppState
  dispatch: (action: Action) => void
  sceneRef: MutableRefObject<SceneSnapshot>
  layout: Layout
  tab: Tab | null
  onTab: (tab: Tab | null) => void
  /** Dónde se registra la medición del lugar libre que lee el lienzo. */
  freeArea: MutableRefObject<(() => FreeArea | null) | null>
  onArtwork: (src: string, aspect: number) => void
  /** Quitar el dibujo: vuelve a la pantalla de inicio. */
  onRemove: () => void
}

/** Cuánto tiempo se muestran las cotas sobre el marco al abrir su pestaña. */
const HINT_MS = 2400
/** Y al mover el ancho desde el slider: lo justo para ver dónde cae. */
const HINT_WIDTH_MS = 1400
/** El aviso de un error se lee y se va. */
const NOTE_MS = 3600
/** Lo que espera un picker antes de cerrarse, para que se vea qué se eligió. */
const PICKER_CLOSE_MS = 180

/** En qué pestaña vive cada picker. */
const PICKER_TAB: Record<Picker, Tab> = { finish: 'marco', profile: 'marco', texture: 'pared' }

/**
 * El alto natural de la vista del cajón, medido y no fijado: cada pestaña mide lo
 * que necesita su contenido. Es la misma idea que el cajón de Referencia —un
 * `ResizeObserver` sobre la vista, que sigue al contenido aunque no cambie de vista—.
 */
function useContentHeight() {
  const [height, setHeight] = useState<number | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  const ref = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect()
    if (!node) return
    const measure = () => setHeight(node.scrollHeight)
    measure()
    observer.current = new ResizeObserver(measure)
    observer.current.observe(node)
  }, [])
  useEffect(() => () => observer.current?.disconnect(), [])
  return { height, ref }
}

/**
 * Cuadros en el celular.
 *
 * El cuadro ocupa la pantalla y los controles flotan abajo, en pastillas del fondo
 * claro del sistema de diseño —las de Mesa de luz, que también flotan sobre una
 * imagen—: volver a un lado, las cinco pestañas al otro. Una pestaña abre un cajón
 * que mide lo que mide su contenido, y **el cuadro se corre arriba y se achica con
 * él, cuadro a cuadro**: nunca queda tapado lo que se está eligiendo.
 *
 * Sin cajón abierto, la cartela con las medidas cuelga debajo del cuadro, como en
 * un museo. Es lo que uno se lleva: lo que se le dicta al enmarcador.
 *
 * El cuadro también se toca: la moldura y el passe-partout se ensanchan
 * arrastrándolos, igual que en escritorio, y un toque sobre una parte abre lo que la
 * edita. Nada de esto depende de pasar por encima: no hay "encima" con un dedo.
 */
export function MobileUI({
  state,
  dispatch,
  sceneRef,
  layout,
  tab,
  onTab,
  freeArea,
  onArtwork,
  onRemove,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const safeRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const gizmoRef = useRef<HTMLDivElement>(null)
  const gizmoValueRef = useRef<HTMLSpanElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const content = useContentHeight()

  const [picker, setPicker] = useState<Picker | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const titleInput = useRef<HTMLInputElement>(null)
  const widthInput = useRef<HTMLInputElement>(null)
  const heightInput = useRef<HTMLInputElement>(null)
  const inputs = { title: titleInput, w: widthInput, h: heightInput }
  const [note, setNote] = useState<string | null>(null)
  const [wallLuma, setWallLuma] = useState(0.5)
  const noteTimer = useRef(0)
  const pickerTimer = useRef(0)
  /** Hasta cuándo se muestran las cotas sobre la banda de la pestaña abierta. */
  const hintUntil = useRef(0)

  const tabRef = useRef(tab)
  tabRef.current = tab

  /** La última pestaña abierta: la que se sigue viendo mientras el cajón baja. */
  const lastTab = useRef<Tab>('marco')
  if (tab) lastTab.current = tab

  useEffect(() => {
    if (tab === 'marco' || tab === 'passe') hintUntil.current = performance.now() + HINT_MS
  }, [tab])

  // Un dibujo nuevo no deja un picker abierto del anterior.
  useEffect(() => {
    window.clearTimeout(pickerTimer.current)
    setPicker(null)
  }, [state.artwork.src])

  useEffect(
    () => () => {
      window.clearTimeout(noteTimer.current)
      window.clearTimeout(pickerTimer.current)
    },
    [],
  )

  const notify = useCallback((text: string) => {
    setNote(text)
    window.clearTimeout(noteTimer.current)
    noteTimer.current = window.setTimeout(() => setNote(null), NOTE_MS)
  }, [])

  /**
   * Abrir o cerrar un picker. Al elegir se cierra con una pausa chica, como en
   * Referencia: sin ella se iba antes de que se viera qué tarjeta se tocó, y
   * elegir se sentía como errarle al botón.
   */
  const choosePicker = useCallback((next: Picker | null, soon = false) => {
    window.clearTimeout(pickerTimer.current)
    if (soon) pickerTimer.current = window.setTimeout(() => setPicker(next), PICKER_CLOSE_MS)
    else setPicker(next)
  }, [])

  const showWidth = useCallback(() => {
    hintUntil.current = Math.max(hintUntil.current, performance.now() + HINT_WIDTH_MS)
  }, [])

  const pickFile = useCallback(() => fileRef.current?.click(), [])

  /**
   * Abrir el editor con el teclado ya arriba. En iPhone el teclado solo sale si el
   * foco llega **en el mismo toque**: si el campo aparece en el render siguiente y
   * se enfoca desde un efecto, ya es tarde y el teclado no se abre. Por eso el editor
   * se monta en el acto (`flushSync`) y se enfoca acá mismo.
   */
  const edit = useCallback((field: Editing) => {
    flushSync(() => setEditing(field))
    const input = (field === 'title' ? titleInput : field === 'w' ? widthInput : heightInput).current
    input?.focus()
  }, [])

  const onFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      // Vaciar el input: si no, elegir dos veces el mismo archivo no dispara nada.
      event.target.value = ''
      if (!file) return
      try {
        const { src, aspect } = await loadArtworkFile(file)
        onArtwork(src, aspect)
      } catch (error) {
        notify(error instanceof Error ? error.message : copy.marco.loadFailed)
      }
    },
    [notify, onArtwork],
  )

  /**
   * Lo que el lienzo lee en cada cuadro para encajar el cuadro: el espacio que no
   * tapan los controles. Se mide del DOM y no se calcula, así acompaña al cajón
   * mientras se despliega —la transición es de CSS y el lienzo la persigue—.
   *
   * Parado, el cajón está sobre la barra y el lugar libre es lo de arriba. Acostado
   * y bajito, el cajón va a la derecha y el lugar libre es lo de la izquierda. La
   * cartela va abajo del cuadro, o al costado si el teléfono está acostado; con un
   * cajón abierto no hay lugar para ella y se va.
   */
  useEffect(() => {
    freeArea.current = () => {
      const root = rootRef.current
      const dock = dockRef.current
      if (!root || !dock) return null
      const box = root.getBoundingClientRect()
      const top = safeRef.current?.getBoundingClientRect().height ?? 0
      const dockTop = dock.getBoundingClientRect().top - box.top
      const drawer = drawerRef.current?.getBoundingClientRect()

      if (drawer && drawer.height > 1 && drawer.left - box.left > box.width * 0.4) {
        return { x: 0, y: top, w: drawer.left - box.left, h: dockTop - top, label: null }
      }

      const h = dockTop - top
      const wide = box.width > h * 1.25
      return {
        x: 0,
        y: top,
        w: box.width,
        h,
        label: tabRef.current ? null : wide ? 'side' : 'below',
      }
    }
    return () => {
      freeArea.current = null
    }
  }, [freeArea])

  // La cartela y las cotas se anclan al cuadro que pinta el lienzo, cuadro a
  // cuadro. Van directo al DOM y no por estado de React: son las posiciones de cada
  // frame del render, y con estado sería un re-render por frame.
  useEffect(() => {
    let frame = 0

    const tick = () => {
      const scene = sceneRef.current
      const rects = scene.rects

      const label = labelRef.current
      if (label) {
        const at = scene.label
        if (at && rects) {
          label.style.transform = `translate(${at.x}px, ${at.y}px)`
          label.dataset.side = at.side ? 'true' : 'false'
        }
        label.classList.toggle('is-shown', Boolean(at) && !scene.dragging)
        const dark = scene.wallLuma < 0.45
        setWallLuma((prev) => (prev < 0.45 === dark ? prev : scene.wallLuma))
      }

      const gizmo = gizmoRef.current
      if (gizmo && rects) {
        // Mientras se arrastra, la banda que se arrastra. Si no, un rato después de
        // abrir su pestaña o de mover su ancho: las cotas dicen que eso se estira.
        const hinted = performance.now() < hintUntil.current
        const current = tabRef.current
        const target =
          scene.dragging ??
          (hinted && current === 'marco' && scene.hasFrame
            ? 'frame'
            : hinted && current === 'passe' && scene.hasMat
              ? 'mat'
              : null)

        if (target) {
          const band = target === 'frame' ? rects.outer : rects.glass
          const hole = target === 'frame' ? rects.glass : rects.sight
          gizmo.style.opacity = scene.dragging ? '1' : '0.9'
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

      if (gizmoValueRef.current) {
        gizmoValueRef.current.textContent =
          scene.dragCm === null
            ? ''
            : scene.dragCm === 0
              ? scene.dragging === 'frame'
                ? copy.marco.noFrame
                : copy.marco.noMat
              : cm(scene.dragCm)
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [sceneRef])

  // --- qué se ve en el cajón, y cómo entra ----------------------------------
  const shown = tab ?? lastTab.current
  const viewKey = picker && PICKER_TAB[picker] === shown ? `${shown}:${picker}` : shown
  const previous = useRef({ key: viewKey, open: tab !== null })
  const motion = useRef('is-rise')
  if (viewKey !== previous.current.key || (tab !== null) !== previous.current.open) {
    const [fromTab, fromPicker] = previous.current.key.split(':')
    if (!previous.current.open) motion.current = 'is-rise'
    else if (fromTab !== shown) {
      const from = TABS.findIndex((t) => t.id === fromTab)
      const to = TABS.findIndex((t) => t.id === shown)
      motion.current = to > from ? 'is-from-right' : 'is-from-left'
    } else motion.current = fromPicker ? 'is-back' : 'is-deeper'
    previous.current = { key: viewKey, open: tab !== null }
  }

  const panel = (() => {
    switch (shown) {
      case 'obra':
        return (
          <ArtworkPanel
            state={state}
            dispatch={dispatch}
            onEdit={edit}
            onPick={pickFile}
            onRemove={onRemove}
          />
        )
      case 'marco':
        return (
          <FramePanel
            state={state}
            dispatch={dispatch}
            picker={picker && PICKER_TAB[picker] === 'marco' ? picker : null}
            onPicker={choosePicker}
            onWidth={showWidth}
          />
        )
      case 'passe':
        return <MatPanel state={state} dispatch={dispatch} onWidth={showWidth} />
      case 'vidrio':
        return <GlassPanel state={state} dispatch={dispatch} />
      case 'pared':
        return (
          <WallPanel
            state={state}
            dispatch={dispatch}
            picker={picker && PICKER_TAB[picker] === 'pared' ? picker : null}
            onPicker={choosePicker}
          />
        )
    }
  })()

  // La marca oscura de la pestaña abierta es un elemento propio que viaja de botón
  // en botón, como en Referencia. Con todo cerrado se achica donde estaba.
  const thumbIndex = TABS.findIndex((t) => t.id === shown)

  return (
    <div ref={rootRef} className="m-ui">
      <div ref={safeRef} className="m-safe" aria-hidden />

      <div ref={labelRef} className="m-label">
        <WallLabel state={state} layout={layout} wallLuma={wallLuma} />
      </div>

      <div ref={gizmoRef} className="gizmo m-gizmo" aria-hidden>
        <span className="gizmo-band" />
        <span className="gizmo-arrow gizmo-arrow--h gizmo-arrow--left" />
        <span className="gizmo-arrow gizmo-arrow--h gizmo-arrow--right" />
        <span className="gizmo-arrow gizmo-arrow--v gizmo-arrow--top" />
        <span className="gizmo-arrow gizmo-arrow--v gizmo-arrow--bottom" />
        <span ref={gizmoValueRef} className="gizmo-value" />
      </div>

      <div ref={dockRef} className="m-dock">
        <div
          ref={drawerRef}
          className={'m-drawer' + (tab ? ' is-open' : '')}
          style={
            content.height ? ({ '--content-height': `${content.height}px` } as CSSProperties) : undefined
          }
          aria-hidden={tab ? undefined : true}
        >
          <div className="m-drawer-scroll">
            <div className={'m-view ' + motion.current} key={viewKey} ref={content.ref}>
              {panel}
            </div>
          </div>
        </div>

        <div className="m-bar">
          <nav className="m-pill">
            <IconButton label={copy.app.back} onClick={() => (window.location.href = '../')}>
              <BackIcon />
            </IconButton>
          </nav>
          <nav className="m-pill m-tabs">
            <span
              className={'m-tabs-thumb' + (tab ? '' : ' is-hidden')}
              style={{ '--i': thumbIndex } as CSSProperties}
              aria-hidden
            />
            {TABS.map((t) => (
              <IconButton
                key={t.id}
                label={t.label}
                selected={t.id === tab}
                onClick={() => onTab(t.id === tab ? null : t.id)}
              >
                {t.icon}
              </IconButton>
            ))}
          </nav>
        </div>
      </div>

      {note && <div className="m-note">{note}</div>}

      {editing && (
        <FieldEditor
          editing={editing}
          state={state}
          dispatch={dispatch}
          inputs={inputs}
          onDone={() => setEditing(null)}
        />
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      <h1 className="ds-sr">{copy.marco.name}</h1>
    </div>
  )
}

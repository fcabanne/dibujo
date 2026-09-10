import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { LIMITS } from '../domain/geometry'
import {
  FRAME_PROFILES,
  MOLDING_TYPES,
  FRAME_PRESETS,
  GLASS_TYPES,
  MAT_PRESETS,
  WALL_PATTERNS,
  WALL_PRESETS,
} from '../domain/palettes'
import { loadArtworkFile } from '../domain/imageFile'
import { anchorsFor, draggableTarget } from '../interaction/zones'
import type { Action } from '../state/reducer'
import type { AppState, GlassType, Layout } from '../types'
import type { SceneSnapshot } from './Canvas'
import { ArcSlider } from './hud/ArcSlider'
import { ArtworkTray } from './hud/ArtworkControl'
import { ArtIcon, FrameIcon, GlassIcon, MatIcon, UploadIcon, WallIcon } from './hud/icons'
import { fanReach, RadialMenu } from './hud/RadialMenu'
import { Swatch } from './hud/Swatch'
import { WallLabel } from './hud/WallLabel'

export type Category = 'frame' | 'mat' | 'wall' | 'glass' | 'artwork'

const CATEGORIES: { id: Category; label: string; Icon: () => JSX.Element }[] = [
  { id: 'frame', label: 'Marco', Icon: FrameIcon },
  { id: 'mat', label: 'Passe-partout', Icon: MatIcon },
  { id: 'wall', label: 'Pared', Icon: WallIcon },
  { id: 'glass', label: 'Vidrio', Icon: GlassIcon },
  { id: 'artwork', label: 'Obra', Icon: ArtIcon },
]

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
}

const cmLabel = (n: number) => n.toFixed(1).replace('.', ',') + ' cm'

/**
 * Rectángulo invisible que mantiene el menú abierto mientras el puntero esté sobre
 * su territorio. Cubre el abanico entero del lado en el que se abrió —o el panel,
 * cuando la categoría usa panel en vez de arcos— más un margen.
 */
function shieldStyle(id: Category, fanDeg: number, rowCount: number): CSSProperties {
  if (id === 'artwork') {
    return { left: -70, top: -70, width: 470, height: 330 }
  }
  const reach = fanReach(rowCount)
  const back = 50
  return {
    left: fanDeg === 180 ? -reach : -back,
    top: -reach,
    width: reach + back,
    height: reach * 2,
  }
}

/** Respiro antes de cerrar el abanico al salir con el mouse. */
const HOVER_OUT_MS = 260

/** La cartela se queda dos segundos más que el resto del HUD. */
const LABEL_GRACE_MS = 2000

/**
 * Capa de control sobre el lienzo. No hay barra ni panel: cada burbuja se apoya
 * sobre la parte que edita, y los anchos se arrastran directamente sobre el cuadro.
 *
 * Las posiciones se escriben por rAF directo sobre el DOM en vez de pasar por estado
 * de React: son las mismas de cada frame del render, y hacerlo con estado sería un
 * re-render por frame.
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
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const bubbleRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const gizmoRef = useRef<HTMLDivElement>(null)
  const gizmoValueRef = useRef<HTMLSpanElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mat = state.mats[0]

  const [fanDeg, setFanDeg] = useState(-90)
  const [labelAwake, setLabelAwake] = useState(false)
  const [wallLuma, setWallLuma] = useState(0.5)

  // La cartela tarda más en irse que las burbujas: se lee, no se opera.
  useEffect(() => {
    if (awake) {
      setLabelAwake(true)
      return
    }
    const id = window.setTimeout(() => setLabelAwake(false), LABEL_GRACE_MS)
    return () => window.clearTimeout(id)
  }, [awake])

  /**
   * El abanico se abre hacia el lado del cuadro en el que está la burbuja: a la
   * izquierda las de la moldura y la obra, a la derecha las de la pared y el vidrio.
   * Solo dos direcciones posibles, así el menú cae siempre donde uno lo espera.
   *
   * Se resuelve al hacer clic y no en un efecto: calculado después del primer
   * render, el menú se dibujaba hacia arriba y recién entonces se corría al
   * costado, y esa corrida se veía como un salto de un lado al otro.
   */
  const aim = (id: Category) => {
    const scene = sceneRef.current
    if (!scene.rects) return
    const a = anchorsFor(scene.rects, scene.hasFrame, scene.hasMat)[id]
    setFanDeg(a.x < scene.rects.center.x ? 180 : 0)
  }

  /**
   * El abanico se abre al pasar por encima, y se cierra con un respiro.
   *
   * Entre la burbuja y sus opciones hay un hueco de más de cien píxeles, así que un
   * cierre inmediato al salir haría desaparecer el menú justo mientras vas a
   * elegir. El temporizador se cancela al entrar a cualquier parte del grupo.
   */
  const hoverOut = useRef(0)

  const openOn = (id: Category) => {
    window.clearTimeout(hoverOut.current)
    if (open === id) return
    aim(id)
    onOpenChange(id)
  }

  const closeSoon = () => {
    window.clearTimeout(hoverOut.current)
    hoverOut.current = window.setTimeout(() => onOpenChange(null), HOVER_OUT_MS)
  }

  // Al cerrarse el menú se descarta lo que estabas previsualizando: si no, el
  // cuadro se quedaría mostrando una opción que nunca elegiste.
  useEffect(() => {
    if (!open) onPreview(null)
  }, [open, onPreview])

  useEffect(() => {
    let frame = 0

    const tick = () => {
      const scene = sceneRef.current
      const rects = scene.rects

      if (rects) {
        const anchors = anchorsFor(rects, scene.hasFrame, scene.hasMat)
        for (const { id } of CATEGORIES) {
          const node = bubbleRefs.current[id]
          if (!node) continue
          const a = anchors[id]
          node.style.transform = `translate(${a.x}px, ${a.y}px)`
        }

        // La cartela se apoya en la esquina inferior derecha del cuadro, como la
        // ficha que acompaña a una obra colgada.
        if (labelRef.current) {
          labelRef.current.style.transform = `translate(${
            rects.outer.x + rects.outer.w + 46
          }px, ${rects.outer.y + rects.outer.h}px)`
        }

        // Solo cuando cruza el umbral: un setState por frame sería un re-render por frame.
        const dark = scene.wallLuma < 0.45
        setWallLuma((prev) => (prev < 0.45 === dark ? prev : scene.wallLuma))

        // El botón de cargar se centra sobre la obra y solo aparece al pasar por ella.
        if (dropRef.current) {
          dropRef.current.style.transform = `translate(${
            rects.sight.x + rects.sight.w / 2
          }px, ${rects.sight.y + rects.sight.h / 2}px)`
          dropRef.current.classList.toggle(
            'is-shown',
            scene.zone === 'art' && scene.awake && !scene.dragging,
          )
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

        // Los centímetros aparecen solo mientras arrastrás: mientras probás mirás
        // el cuadro, y cuando decidís querés el número.
        if (gizmoValueRef.current) {
          gizmoValueRef.current.textContent =
            scene.dragCm === null
              ? ''
              : scene.dragCm === 0
                ? scene.dragging === 'frame'
                  ? 'sin marco'
                  : 'sin passe-partout'
                : cmLabel(scene.dragCm)
        }
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [sceneRef])

  // Cerrar el abanico al tocar el lienzo o con Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onOpenChange(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(null)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

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

  const customSwatch = (value: string, onChange: (color: string) => void) => (
    <label key="custom" className="swatch is-custom" title="Color a medida" style={{ background: value }}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <span aria-hidden>+</span>
    </label>
  )

  /** Filas de cada categoría: de lo más elemental a lo más específico. */
  const rowsFor = (id: Category): JSX.Element[][] => {
    switch (id) {
      case 'frame':
        // De afuera hacia adentro: color, forma, acabado y espesor. Es el orden en
        // que se decide un marco, y deja el color en el arco más a la izquierda.
        return [
          MOLDING_TYPES.map((t) => (
            <Swatch
              key={t.id}
              label={t.label}
              caption={t.label}
              color={state.frame.color}
              material={t.material}
              finish={t.finish}
              profile={state.frame.profile}
              selected={state.frame.material === t.material && state.frame.finish === t.finish}
              {...choose({
                type: 'frame/patch',
                patch: { material: t.material, finish: t.finish },
              })}
            />
          )),
          FRAME_PROFILES.map((p) => (
            <Swatch
              key={p.id}
              label={p.label}
              caption={p.label}
              color={state.frame.color}
              material={state.frame.material}
              finish={state.frame.finish}
              profile={p.id}
              selected={state.frame.profile === p.id}
              {...choose({ type: 'frame/patch', patch: { profile: p.id } })}
            />
          )),
          [
            ...FRAME_PRESETS.map((p) => (
              <Swatch
                key={p.id}
                label={p.label}
                color={p.color}
                selected={state.frame.color.toLowerCase() === p.color.toLowerCase()}
                {...choose({ type: 'frame/patch', patch: { color: p.color } })}
              />
            )),
            customSwatch(state.frame.color, (color) =>
              dispatch({ type: 'frame/patch', patch: { color } }),
            ),
          ],
        ]

      case 'mat':
        return [
          MAT_PRESETS.slice(0, 5).map((p) => matSwatch(p)),
          [...MAT_PRESETS.slice(5).map((p) => matSwatch(p)), customSwatch(mat.color, (color) =>
            dispatch({ type: 'mat/patch', patch: { color, enabled: true } }),
          )],
        ]

      case 'wall':
        return [
          WALL_PRESETS.slice(0, 5).map((p) => wallSwatch(p)),
          [...WALL_PRESETS.slice(5).map((p) => wallSwatch(p)), customSwatch(state.wall.color, (color) =>
            dispatch({ type: 'wall/patch', patch: { color } }),
          )],
          WALL_PATTERNS.map((p) => (
            <TextChip
              key={p.id}
              label={p.label}
              selected={state.wall.pattern === p.id}
              {...choose({ type: 'wall/patch', patch: { pattern: p.id } })}
            />
          )),
        ]

      case 'glass':
        return [
          GLASS_TYPES.map((g) => (
            <GlassOption
              key={g.id}
              id={g.id}
              label={g.label}
              hint={g.hint}
              selected={state.glass === g.id}
              {...choose({ type: 'glass/set', value: g.id })}
            />
          )),
        ]

      case 'artwork':
        return []
    }
  }

  function matSwatch(p: { id: string; label: string; color: string }) {
    return (
      <Swatch
        key={p.id}
        label={p.label}
        color={p.color}
        selected={mat.enabled && mat.color.toLowerCase() === p.color.toLowerCase()}
        {...choose({ type: 'mat/patch', patch: { color: p.color, enabled: true } })}
      />
    )
  }

  function wallSwatch(p: { id: string; label: string; color: string }) {
    return (
      <Swatch
        key={p.id}
        label={p.label}
        color={p.color}
        selected={state.wall.color.toLowerCase() === p.color.toLowerCase()}
        {...choose({ type: 'wall/patch', patch: { color: p.color } })}
      />
    )
  }

  return (
    <div ref={rootRef} className={'overlay' + (awake || open ? ' is-awake' : '')}>
      {/* Cargar el dibujo se pide sobre el dibujo: es donde mirás cuando querés
          reemplazarlo, y evita ir a buscarlo dentro de un menú. */}
      <div ref={dropRef} className="art-drop">
        <button type="button" className="pill" onClick={() => fileRef.current?.click()}>
          <UploadIcon />
          Cargar dibujo
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
          ((labelAwake || open) && open !== 'wall' && open !== 'glass' ? ' is-awake' : '')
        }
      >
        <WallLabel state={state} layout={layout} wallLuma={wallLuma} />
      </div>

      {CATEGORIES.map(({ id, label, Icon }, i) => (
        <div
          key={id}
          ref={(n) => {
            bubbleRefs.current[id] = n
          }}
          className="anchor"
          style={{ transitionDelay: `${i * 40}ms` }}
          onPointerEnter={() => openOn(id)}
          onPointerLeave={closeSoon}
        >
          {/* Zona de gracia: cubre todo el abanico y sus huecos. Sin esto, cruzar
              el espacio entre dos opciones ya contaba como salir del menú y lo
              cerraba justo mientras estabas eligiendo. */}
          {open === id && (
            <span
              className="hover-shield"
              style={shieldStyle(id, fanDeg, rowsFor(id).length)}
              onClick={() => onOpenChange(null)}
            />
          )}

          <RadialMenu
            open={open === id}
            rows={open === id ? rowsFor(id) : []}
            centerDeg={fanDeg}
            // Las opciones con etiqueta necesitan más aire o los nombres se pisan.
            spacing={id === 'glass' ? 82 : 62}
            arc={
              id === 'frame'
                ? (radius, centerDeg, span) => (
                    <ArcSlider
                      label="Espesor de la moldura"
                      value={state.frame.depth}
                      min={LIMITS.frameDepth.min}
                      max={LIMITS.frameDepth.max}
                      step={LIMITS.frameDepth.step}
                      format={cmLabel}
                      onChange={(depth) => dispatch({ type: 'frame/patch', patch: { depth } })}
                      radius={radius}
                      centerDeg={centerDeg}
                      spanDeg={span}
                    />
                  )
                : undefined
            }
          />

          <button
            type="button"
            className={'bubble' + (open === id ? ' is-open' : '')}
            // El clic queda para teclado y touch, donde no hay hover.
            onClick={() => (open === id ? onOpenChange(null) : openOn(id))}
            onFocus={() => openOn(id)}
            aria-label={label}
            aria-expanded={open === id}
            title={label}
          >
            <Icon />
          </button>

          {open === id && id === 'artwork' && (
            <div className="bubble-panel">
              <ArtworkTray state={state} dispatch={dispatch} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/** Opción de vidrio: un preview redondo que imita el efecto, con el nombre debajo. */
function GlassOption({
  id,
  label,
  hint,
  selected,
  onClick,
  onHover,
}: {
  id: GlassType
  label: string
  hint: string
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
      title={label + ' — ' + hint}
    >
      <span className="text-option-visual" data-glass={id} />
      <strong>{label}</strong>
    </button>
  )
}

/** Lo que no es un color va con nombre: materiales y patrones de pared. */
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

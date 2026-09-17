import { useEffect, useState, type ReactNode } from 'react'
import { copy, fill, formatNumber } from '../../shared/copy'
import type { Reference } from '../../shared/referenceImage'
import {
  BackIcon,
  Button,
  Checkbox,
  ChoiceGroup,
  CloseIcon,
  DownloadIcon,
  FileIcon,
  GridIcon,
  IconButton,
  PaintIcon,
  PhotoIcon,
  Slider,
  Stepper,
  UploadIcon,
  type ChoiceOption,
} from '../../shared/ui'
import { GRID_LIMITS } from '../domain/grid'
import { PAPER_PRESETS, sheetName } from '../domain/paper'
import { ColorRow, Hint, Row, Section } from './controls'
import type { Action } from '../state/reducer'
import type { AppState, EffectsMode, PaperId } from '../types'

interface Props {
  state: AppState
  dispatch: (action: Action) => void
  reference: Reference | null
  onPickFile: () => void
  onRemove: () => void
  onDownload: () => void
  effectsSupported: boolean
  /** Pantalla angosta: los controles van abajo en pestañas en vez de al costado. */
  compact: boolean
}

/**
 * El tamaño del dibujo está escondido: se usa en otro momento.
 *
 * Escondido y no borrado. El estado, el dominio y los textos siguen enteros —es
 * lo que hace que las cotas en centímetros puedan volver sin rearmar nada— y lo
 * único que falta es esta sección en la lista. Prenderla es cambiar este `false`.
 */
const SHOW_PAPER: boolean = false

/** Las tres maneras de mirar la referencia. */
const MODES: ChoiceOption<EffectsMode>[] = [
  { value: 'original', label: copy.adjust.original, title: copy.adjust.originalHint },
  { value: 'edges', label: copy.adjust.edges, title: copy.adjust.edgesHint },
  { value: 'facets', label: copy.adjust.facets, title: copy.adjust.facetsHint },
]

interface PanelSection {
  id: string
  /** Nombre largo, para el título de la columna en escritorio. */
  title: string
  /** Nombre corto, para la pestaña de abajo en pantalla angosta. */
  label: string
  icon: ReactNode
  content: ReactNode
}

/**
 * Los controles, definidos una sola vez y servidos de tres formas: la columna
 * de escritorio, la barra de pestañas de celular, y la versión sin foto —donde
 * no hay nada que configurar y solo queda la barra de arriba.
 *
 * Lo que **no** cambia entre las tres es el contenido. Un solo lugar donde está
 * escrito qué controles hay.
 */
export function Panel({
  state,
  dispatch,
  reference,
  onPickFile,
  onRemove,
  onDownload,
  effectsSupported,
  compact,
}: Props) {
  const [thumb, setThumb] = useState<string | null>(null)
  const [openTab, setOpenTab] = useState<string | null>('grilla')
  const { grid, paper, effects } = state

  // La miniatura sale del archivo original, no del lienzo: es la foto como entró.
  // La URL se revoca al cambiar de foto, si no cada carga deja una colgada.
  useEffect(() => {
    if (!reference) {
      setThumb(null)
      return
    }
    const url = URL.createObjectURL(reference.blob)
    setThumb(url)
    return () => URL.revokeObjectURL(url)
  }, [reference])

  /**
   * Cada foto nueva abre la grilla.
   *
   * Es a lo que se viene: subir la foto y ponerle la grilla encima. Dejar la
   * pestaña de la foto abierta después de subirla sería mostrarle a alguien lo
   * que acaba de hacer en vez de lo que sigue.
   */
  useEffect(() => {
    if (reference) setOpenTab('grilla')
  }, [reference])

  const topBar = (
    <div className="topbar">
      <IconButton label={copy.app.back} onClick={() => (window.location.href = '../')}>
        <BackIcon />
      </IconButton>
      {/* El diseño deja la barra con el botón de volver y nada más: en 18:88 y en
          22:63 el lugar del título es un espaciador vacío. El nombre sigue
          estando para el lector de pantalla — que no se dibuje no quiere decir
          que la página no se llame. */}
      <h1 className="ds-sr">{copy.app.name}</h1>
      <span className="topbar-gap" />
      {reference && (
        <IconButton label={copy.download.action} onClick={onDownload}>
          <DownloadIcon />
        </IconButton>
      )}
    </div>
  )

  const photoSection: PanelSection = {
    id: 'foto',
    title: copy.photo.title,
    label: copy.photo.tab,
    icon: <PhotoIcon />,
    content: (
      <>
        <div className="thumb">
          {thumb && <img src={thumb} alt={reference?.name ?? copy.canvas.alt} />}
        </div>

        {reference && (
          <p className="photo-meta">
            <strong>{reference.name}</strong>
            <em>
              {fill(copy.photo.size, {
                width: formatNumber(reference.width),
                height: formatNumber(reference.height),
              })}
            </em>
          </p>
        )}

        {/* Cambiar y quitar van juntos y visibles. Antes el botón aparecía al
            pasar el puntero por encima de la miniatura, y donde no hay puntero
            —un celular— no había forma de llegar a él. */}
        <div className="photo-actions">
          <Button variant="quiet" icon={<UploadIcon />} onClick={onPickFile}>
            {copy.photo.change}
          </Button>
          <IconButton label={copy.photo.remove} onClick={onRemove}>
            <CloseIcon />
          </IconButton>
        </div>
      </>
    ),
  }

  const paperSection: PanelSection = {
    id: 'tamano',
    title: copy.paper.title,
    label: copy.paper.tab,
    icon: <FileIcon />,
    content: (
      <>
        <ChoiceGroup
          className="ds-choice-group--start"
          label={copy.paper.title}
          value={paper.id}
          onChange={(id) => {
            const preset = PAPER_PRESETS.find((sheet) => sheet.id === id)
            dispatch({
              type: 'paper/patch',
              patch: preset ? { id, w: preset.w, h: preset.h } : { id },
            })
          }}
          options={[
            { value: 'none' as PaperId, label: copy.paper.none },
            ...PAPER_PRESETS.map((preset) => ({
              value: preset.id as PaperId,
              label: sheetName(preset.id),
            })),
            { value: 'custom' as PaperId, label: copy.paper.custom },
          ]}
        />

        {paper.id === 'custom' && (
          <div className="numbers">
            <span className="unit">
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={300}
                step={0.1}
                value={paper.w}
                aria-label={copy.paper.width}
                onChange={(e) =>
                  dispatch({
                    type: 'paper/patch',
                    patch: { w: Math.max(1, Number(e.target.value) || 1) },
                  })
                }
              />
            </span>
            <span>×</span>
            <span className="unit">
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={300}
                step={0.1}
                value={paper.h}
                aria-label={copy.paper.height}
                onChange={(e) =>
                  dispatch({
                    type: 'paper/patch',
                    patch: { h: Math.max(1, Number(e.target.value) || 1) },
                  })
                }
              />
            </span>
          </div>
        )}
      </>
    ),
  }

  const gridSection: PanelSection = {
    id: 'grilla',
    title: copy.grid.title,
    label: copy.grid.tab,
    icon: <GridIcon />,
    content: (
      <>
        {/* El color arriba de todo, como en el diseño: es lo primero que hay que
            corregir cuando la grilla cae sobre una foto clara y no se ve. */}
        <ColorRow
          value={grid.style.color}
          onChange={(color) => dispatch({ type: 'grid/style', patch: { color } })}
        />

        <Row label={copy.grid.type}>
          <ChoiceGroup
            label={copy.grid.type}
            value={grid.mode}
            onChange={(mode) => dispatch({ type: 'grid/patch', patch: { mode } })}
            options={[
              {
                value: 'proportional',
                label: copy.grid.proportional,
                title: copy.grid.proportionalHint,
              },
              { value: 'square', label: copy.grid.square, title: copy.grid.squareHint },
            ]}
          />
        </Row>

        {/* El mismo número para los dos modos: cambiar de uno a otro muestra en
            qué se diferencian, sin que además salte el tamaño. Y de a uno con el
            stepper, no arrastrando: seis divisiones es una decisión, no un punto
            que se busca. */}
        <Row label={copy.grid.divisions}>
          <Stepper
            label={copy.grid.divisions}
            value={grid.count}
            min={GRID_LIMITS.min}
            max={GRID_LIMITS.max}
            onChange={(count) => dispatch({ type: 'grid/patch', patch: { count } })}
            decrementLabel={copy.grid.fewer}
            incrementLabel={copy.grid.more}
          />
        </Row>

        <Row label={copy.grid.weight}>
          <Slider
            label={copy.grid.weight}
            value={grid.style.weight}
            min={1}
            max={6}
            step={1}
            onChange={(weight) => dispatch({ type: 'grid/style', patch: { weight } })}
          />
        </Row>

        {/* Llega hasta cero, y no es un extremo cualquiera: en cero no hay grilla.
            Es la forma de sacarla ahora que "ninguna" dejó de ser un tipo. */}
        <Row label={copy.grid.opacity}>
          <Slider
            label={copy.grid.opacity}
            value={Math.round(grid.style.opacity * 100)}
            min={0}
            max={100}
            step={5}
            onChange={(v) => dispatch({ type: 'grid/style', patch: { opacity: v / 100 } })}
            format={(v) => fill(copy.grid.opacityValue, { n: v })}
          />
        </Row>

        <Checkbox
          label={copy.grid.subdivide}
          checked={grid.subdivide}
          onChange={(subdivide) => dispatch({ type: 'grid/patch', patch: { subdivide } })}
        />
        <Checkbox
          label={copy.grid.labels}
          checked={grid.style.labels}
          onChange={(labels) => dispatch({ type: 'grid/style', patch: { labels } })}
        />
      </>
    ),
  }

  const adjustSection: PanelSection = {
    id: 'ajustes',
    title: copy.adjust.title,
    label: copy.adjust.tab,
    icon: <PaintIcon />,
    content: !effectsSupported ? (
      <Hint>{copy.adjust.unsupported}</Hint>
    ) : (
      <>
        <ChoiceGroup
          className="ds-choice-group--start"
          label={copy.adjust.title}
          value={effects.mode}
          onChange={(mode) => dispatch({ type: 'effects/mode', mode })}
          options={MODES}
        />

        {/* Cada modo muestra solo la perilla que le importa. El resto de los
            valores los fija él, y esconderlos es el punto: son los que hay que
            entender para usar esto, y no hay por qué entenderlos. */}
        {effects.mode === 'edges' && (
          <Row label={copy.adjust.contrast}>
            <Slider
              label={copy.adjust.contrast}
              value={effects.edges}
              min={0}
              max={100}
              step={1}
              onChange={(edges) => dispatch({ type: 'effects/patch', patch: { edges } })}
            />
          </Row>
        )}

        {effects.mode === 'facets' && (
          <>
            <Row label={copy.adjust.amount}>
              <Stepper
                label={copy.adjust.amount}
                value={effects.tones}
                min={2}
                max={4}
                onChange={(tones) => dispatch({ type: 'effects/patch', patch: { tones } })}
                decrementLabel={copy.grid.fewer}
                incrementLabel={copy.grid.more}
              />
            </Row>
            <Row label={copy.adjust.light}>
              <Slider
                label={copy.adjust.light}
                value={effects.light}
                min={-100}
                max={100}
                step={1}
                onChange={(light) => dispatch({ type: 'effects/patch', patch: { light } })}
                format={signed}
              />
            </Row>
            <Row label={copy.adjust.contrast}>
              <Slider
                label={copy.adjust.contrast}
                value={effects.contrast}
                min={-100}
                max={100}
                step={1}
                onChange={(contrast) => dispatch({ type: 'effects/patch', patch: { contrast } })}
                format={signed}
              />
            </Row>
          </>
        )}

        {/* Abajo, con las casillas, pero independiente de los modos: pasar a
            blanco y negro sobrevive a cambiar de Bordes a Facetado. */}
        <Checkbox
          label={copy.adjust.blackAndWhite}
          checked={effects.bw}
          onChange={(bw) => dispatch({ type: 'effects/patch', patch: { bw } })}
        />
      </>
    ),
  }

  const sections: PanelSection[] = [
    photoSection,
    ...(SHOW_PAPER ? [paperSection] : []),
    gridSection,
    adjustSection,
  ]

  const tabBar = (
    <nav className="tabbar">
      {sections.map((section) => (
        <IconButton
          key={section.id}
          label={section.label}
          selected={section.id === openTab}
          onClick={() => setOpenTab(section.id === openTab ? null : section.id)}
        >
          {section.icon}
        </IconButton>
      ))}
    </nav>
  )

  // --- sin foto: la barra de arriba y nada más ------------------------------
  // El diseño de la pantalla de inicio (18:76) no lleva pestañas: no hay nada
  // que configurar todavía, y una barra de botones apagados es una barra que
  // promete algo y no lo cumple.
  if (!reference) return topBar

  // --- pantalla angosta: pestañas abajo --------------------------------------
  if (compact) {
    const open = sections.find((section) => section.id === openTab) ?? null
    return (
      <>
        {topBar}
        <div className="controls">
          {open && (
            <div className="tab-panel" key={open.id}>
              {open.content}
            </div>
          )}
          {tabBar}
        </div>
      </>
    )
  }

  // --- escritorio: columna al costado ---------------------------------------
  return (
    <aside className="panel">
      <header>
        <IconButton label={copy.app.back} onClick={() => (window.location.href = '../')}>
          <BackIcon />
        </IconButton>
        <h1>{copy.app.name}</h1>
      </header>

      <div className="scroll">
        {sections.map((section) => (
          <Section key={section.id} title={section.title}>
            {section.content}
          </Section>
        ))}
      </div>

      {/* Fuera del scroll: es la acción que cierra el trabajo, y tener que buscarla
          al pie de una columna larga la esconde justo cuando se la necesita. */}
      <div className="footer">
        <Button variant="loud" icon={<DownloadIcon />} onClick={onDownload}>
          {copy.download.action}
        </Button>
      </div>
    </aside>
  )
}

const signed = (v: number) => (v > 0 ? `+${v}` : String(v))

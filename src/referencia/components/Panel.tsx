import { useEffect, useState, type ReactNode } from 'react'
import { copy, fill, formatNumber } from '../../shared/copy'
import type { Reference } from '../../shared/referenceImage'
import {
  BackIcon,
  Button,
  Checkbox,
  CloseIcon,
  DownloadIcon,
  FileIcon,
  GridIcon,
  IconButton,
  PaintIcon,
  UploadIcon,
} from '../../shared/ui'
import { GRID_LIMITS } from '../domain/grid'
import { PAPER_PRESETS, sheetName } from '../domain/paper'
import { ColorRow, Hint, Section, Segmented, Slider } from './controls'
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

/** Las tres maneras de mirar la referencia, con el ícono que las nombra. */
const MODES: { id: EffectsMode; label: string; title: string }[] = [
  { id: 'original', label: copy.adjust.original, title: copy.adjust.originalHint },
  { id: 'edges', label: copy.adjust.edges, title: copy.adjust.edgesHint },
  { id: 'facets', label: copy.adjust.facets, title: copy.adjust.facetsHint },
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
  const [openTab, setOpenTab] = useState<string | null>(null)
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

  const topBar = (
    <div className="topbar">
      <IconButton label={copy.app.back} onClick={() => (window.location.href = '../')}>
        <BackIcon />
      </IconButton>
      <strong>{copy.app.name}</strong>
      {reference && (
        <IconButton label={copy.download.action} onClick={onDownload}>
          <DownloadIcon />
        </IconButton>
      )}
    </div>
  )

  const sections: PanelSection[] = [
    {
      id: 'foto',
      title: copy.photo.title,
      label: copy.photo.tab,
      icon: <UploadIcon />,
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
    },
    {
      id: 'tamano',
      title: copy.paper.title,
      label: copy.paper.tab,
      icon: <FileIcon />,
      content: (
        <>
          <div className="papers">
            <button
              type="button"
              className={paper.id === 'none' ? 'is-on' : ''}
              onClick={() => dispatch({ type: 'paper/patch', patch: { id: 'none' } })}
            >
              {copy.paper.none}
            </button>
            {PAPER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={paper.id === preset.id ? 'is-on' : ''}
                onClick={() =>
                  dispatch({
                    type: 'paper/patch',
                    patch: { id: preset.id as PaperId, w: preset.w, h: preset.h },
                  })
                }
              >
                {sheetName(preset.id)}
              </button>
            ))}
            <button
              type="button"
              className={paper.id === 'custom' ? 'is-on' : ''}
              onClick={() => dispatch({ type: 'paper/patch', patch: { id: 'custom' } })}
            >
              {copy.paper.custom}
            </button>
          </div>

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
    },
    {
      id: 'grilla',
      title: copy.grid.title,
      label: copy.grid.tab,
      icon: <GridIcon />,
      content: (
        <>
          <Segmented
            value={grid.mode}
            onChange={(mode) => dispatch({ type: 'grid/patch', patch: { mode } })}
            options={[
              { value: 'none', label: copy.grid.none },
              {
                value: 'proportional',
                label: copy.grid.proportional,
                title: copy.grid.proportionalHint,
              },
              { value: 'square', label: copy.grid.square, title: copy.grid.squareHint },
            ]}
          />

          {grid.mode !== 'none' && (
            <>
              {/* El mismo número para los dos modos: cambiar de uno a otro muestra
                  en qué se diferencian, sin que además salte el tamaño. */}
              <Slider
                label={grid.mode === 'proportional' ? copy.grid.divisions : copy.grid.squares}
                value={grid.count}
                min={GRID_LIMITS.min}
                max={GRID_LIMITS.max}
                step={1}
                onChange={(count) => dispatch({ type: 'grid/patch', patch: { count } })}
                format={(v) =>
                  grid.mode === 'proportional'
                    ? fill(copy.grid.divisionsValue, { n: v, total: v * v })
                    : fill(copy.grid.squaresValue, { n: v })
                }
              />
              <ColorRow
                value={grid.style.color}
                onChange={(color) => dispatch({ type: 'grid/style', patch: { color } })}
              />
              <Slider
                label={copy.grid.weight}
                value={grid.style.weight}
                min={1}
                max={6}
                step={1}
                onChange={(weight) => dispatch({ type: 'grid/style', patch: { weight } })}
              />
              <Slider
                label={copy.grid.opacity}
                value={Math.round(grid.style.opacity * 100)}
                min={10}
                max={100}
                step={5}
                onChange={(v) => dispatch({ type: 'grid/style', patch: { opacity: v / 100 } })}
                format={(v) => fill(copy.grid.opacityValue, { n: v })}
              />
              <Checkbox
                label={copy.grid.labels}
                checked={grid.style.labels}
                onChange={(labels) => dispatch({ type: 'grid/style', patch: { labels } })}
              />
              <Checkbox
                label={copy.grid.subdivide}
                checked={grid.subdivide}
                onChange={(subdivide) => dispatch({ type: 'grid/patch', patch: { subdivide } })}
              />
            </>
          )}
        </>
      ),
    },
    {
      id: 'ajustes',
      title: copy.adjust.title,
      label: copy.adjust.tab,
      icon: <PaintIcon />,
      content: !effectsSupported ? (
        <Hint>{copy.adjust.unsupported}</Hint>
      ) : (
        <>
          {/* Arriba de los modos porque es independiente de ellos: pasar a blanco y
              negro sobrevive a cambiar de Bordes a Facetado. */}
          <Checkbox
            label={copy.adjust.blackAndWhite}
            checked={effects.bw}
            onChange={(bw) => dispatch({ type: 'effects/patch', patch: { bw } })}
          />

          <div className="presets">
            {MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                title={mode.title}
                className={effects.mode === mode.id ? 'is-on' : ''}
                onClick={() => dispatch({ type: 'effects/mode', mode: mode.id })}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Cada modo muestra solo la perilla que le importa. El resto de los valores
              los fija él, y esconderlos es el punto: son los que hay que entender
              para usar esto, y no hay por qué entenderlos. */}
          {effects.mode === 'edges' && (
            <Slider
              label={copy.adjust.contrast}
              value={effects.edges}
              min={0}
              max={100}
              step={1}
              onChange={(edges) => dispatch({ type: 'effects/patch', patch: { edges } })}
            />
          )}

          {effects.mode === 'facets' && (
            <>
              <Slider
                label={copy.adjust.amount}
                value={effects.tones}
                min={2}
                max={4}
                step={1}
                onChange={(tones) => dispatch({ type: 'effects/patch', patch: { tones } })}
                format={(v) => fill(copy.adjust.amountValue, { n: v })}
              />
              <Slider
                label={copy.adjust.light}
                value={effects.light}
                min={-100}
                max={100}
                step={1}
                onChange={(light) => dispatch({ type: 'effects/patch', patch: { light } })}
                format={signed}
              />
              <Slider
                label={copy.adjust.contrast}
                value={effects.contrast}
                min={-100}
                max={100}
                step={1}
                onChange={(contrast) => dispatch({ type: 'effects/patch', patch: { contrast } })}
                format={signed}
              />
            </>
          )}
        </>
      ),
    },
  ]

  const tabBar = (
    <nav className="tabbar">
      {sections.map((section) => (
        <IconButton
          key={section.id}
          label={section.label}
          // Sin foto la primera queda marcada, como en el diseño, y ninguna se
          // puede tocar: configurar una grilla sin imagen no lleva a ningún lado.
          selected={reference ? section.id === openTab : section.id === 'foto'}
          disabled={!reference}
          onClick={() => setOpenTab(section.id === openTab ? null : section.id)}
        >
          {section.icon}
        </IconButton>
      ))}
    </nav>
  )

  // --- sin foto: solo la barra de arriba, y las pestañas si hay lugar --------
  if (!reference) {
    return (
      <>
        {topBar}
        {compact && <div className="controls">{tabBar}</div>}
      </>
    )
  }

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

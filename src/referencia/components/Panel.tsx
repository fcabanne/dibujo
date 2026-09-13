import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Reference } from '../../shared/referenceImage'
import { GRID_LIMITS } from '../domain/grid'
import { PAPER_PRESETS } from '../domain/paper'
import { ColorRow, Hint, Section, Segmented, Slider, Toggle } from './controls'
import { BackIcon, DownloadIcon, GridIcon, PhotoIcon, SizeIcon, TuneIcon } from './icons'
import type { Action } from '../state/reducer'
import type { AppState, EffectsMode, PaperId } from '../types'

interface Props {
  state: AppState
  dispatch: (action: Action) => void
  reference: Reference | null
  onFile: (file: File) => void
  onDownload: () => void
  effectsSupported: boolean
  /** Pantalla angosta: los controles van abajo en pestañas en vez de al costado. */
  compact: boolean
}

/**
 * Las tres maneras de mirar la referencia. Son caminos cerrados y no perillas
 * sueltas: lo que se elige acá es cómo leer la foto, y para eso no hace falta saber
 * qué es una curva ni un sobel.
 */
const MODES: { id: EffectsMode; label: string; title: string }[] = [
  { id: 'original', label: 'Original', title: 'La foto tal cual' },
  { id: 'edges', label: 'Bordes', title: 'Deja los contornos, como un dibujo de línea' },
  { id: 'facets', label: 'Facetado', title: 'Aplasta la foto a unas pocas manchas de valor' },
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
 * Los controles, definidos una sola vez y servidos de dos formas.
 *
 * En escritorio son una columna al costado. En una pantalla angosta el panel y la
 * foto no entran juntos —medido: de 375 px de ancho, el panel se llevaba 315 y a la
 * foto le quedaban 59— así que pasan a ser una barra de pestañas abajo, al estilo de
 * Lightroom: tocás una y suben sus perillas sobre la foto.
 *
 * Lo que **no** cambia es el contenido. Un solo lugar donde está escrito qué
 * controles hay, dos maneras de acomodarlos.
 */
export function Panel({
  state,
  dispatch,
  reference,
  onFile,
  onDownload,
  effectsSupported,
  compact,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
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

  const picker = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => {
        const file = e.target.files?.[0]
        if (file) onFile(file)
        e.target.value = ''
      }}
    />
  )

  const sections: PanelSection[] = [
    {
      id: 'foto',
      title: 'Foto',
      label: 'Foto',
      icon: <PhotoIcon />,
      content: (
        /* La original, sin efectos ni grilla: es la referencia contra la que se mira
           lo que está pasando en el lienzo. En escritorio el nombre y el botón
           aparecen al pasar por encima; donde no hay puntero que pase por encima,
           el CSS los deja fijos. */
        <div className="thumb">
          {thumb && <img src={thumb} alt={reference?.name ?? 'Foto de referencia'} />}
          <div className="thumb-over">
            <button type="button" onClick={() => fileRef.current?.click()}>
              Cambiar foto
            </button>
            {reference && (
              <span className="thumb-meta">
                <strong>{reference.name}</strong>
                <em>
                  {reference.width.toLocaleString('es-AR')} ×{' '}
                  {reference.height.toLocaleString('es-AR')} px
                </em>
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'tamano',
      title: 'Tamaño del dibujo',
      label: 'Tamaño',
      icon: <SizeIcon />,
      content: (
        <>
          <div className="papers">
            <button
              type="button"
              className={paper.id === 'none' ? 'is-on' : ''}
              onClick={() => dispatch({ type: 'paper/patch', patch: { id: 'none' } })}
            >
              Sin definir
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
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              className={paper.id === 'custom' ? 'is-on' : ''}
              onClick={() => dispatch({ type: 'paper/patch', patch: { id: 'custom' } })}
            >
              A medida
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
                  aria-label="Ancho en cm"
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
                  aria-label="Alto en cm"
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
      title: 'Grilla',
      label: 'Grilla',
      icon: <GridIcon />,
      content: (
        <>
          <Segmented
            value={grid.mode}
            onChange={(mode) => dispatch({ type: 'grid/patch', patch: { mode } })}
            options={[
              { value: 'none', label: 'Ninguna' },
              { value: 'proportional', label: 'Proporcional', title: 'Divide la foto en partes iguales' },
              { value: 'square', label: 'Cuadrada', title: 'Cuadrados exactos desde arriba a la izquierda' },
            ]}
          />

          {grid.mode !== 'none' && (
            <>
              {/* El mismo número para los dos modos: cambiar de uno a otro muestra
                  en qué se diferencian, sin que además salte el tamaño. */}
              <Slider
                label={grid.mode === 'proportional' ? 'Divisiones' : 'Cuadrados a lo ancho'}
                value={grid.count}
                min={GRID_LIMITS.min}
                max={GRID_LIMITS.max}
                step={1}
                onChange={(count) => dispatch({ type: 'grid/patch', patch: { count } })}
                format={(v) =>
                  grid.mode === 'proportional'
                    ? `${v} × ${v} · ${v * v} casillas`
                    : `${v} a lo ancho`
                }
              />
              <ColorRow
                value={grid.style.color}
                onChange={(color) => dispatch({ type: 'grid/style', patch: { color } })}
              />
              <Slider
                label="Espesor"
                value={grid.style.weight}
                min={1}
                max={6}
                step={1}
                onChange={(weight) => dispatch({ type: 'grid/style', patch: { weight } })}
              />
              <Slider
                label="Opacidad"
                value={Math.round(grid.style.opacity * 100)}
                min={10}
                max={100}
                step={5}
                onChange={(v) => dispatch({ type: 'grid/style', patch: { opacity: v / 100 } })}
                format={(v) => `${v}%`}
              />
              <Toggle
                label="Etiquetas"
                checked={grid.style.labels}
                onChange={(labels) => dispatch({ type: 'grid/style', patch: { labels } })}
              />
              <Toggle
                label="Subdividir"
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
      title: 'Ajustes',
      label: 'Ajustes',
      icon: <TuneIcon />,
      content: !effectsSupported ? (
        <Hint>
          Este navegador no puede aplicar los ajustes (le falta WebGL). La grilla y el
          export andan igual.
        </Hint>
      ) : (
        <>
          {/* Arriba de los modos porque es independiente de ellos: pasar a blanco y
              negro sobrevive a cambiar de Bordes a Facetado. */}
          <Toggle
            label="Blanco y negro"
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
              label="Contraste"
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
                label="Cantidad"
                value={effects.tones}
                min={2}
                max={4}
                step={1}
                onChange={(tones) => dispatch({ type: 'effects/patch', patch: { tones } })}
                format={(v) => `${v} tonos`}
              />
              <Slider
                label="Luz"
                value={effects.light}
                min={-100}
                max={100}
                step={1}
                onChange={(light) => dispatch({ type: 'effects/patch', patch: { light } })}
                format={signed}
              />
              <Slider
                label="Contraste"
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

  if (compact) {
    const open = sections.find((section) => section.id === openTab) ?? null
    return (
      <>
        <div className="topbar">
          <a className="back" href="../" title="Volver a las herramientas">
            <BackIcon />
          </a>
          <strong>Referencia</strong>
          <button
            type="button"
            className="icon"
            disabled={!reference}
            onClick={onDownload}
            aria-label="Descargar"
            title="Descargar"
          >
            <DownloadIcon />
          </button>
        </div>

        <div className="controls">
          {open && (
            <div className="tab-panel" key={open.id}>
              {open.content}
            </div>
          )}

          <nav className="tabbar">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={section.id === openTab ? 'is-on' : ''}
                aria-pressed={section.id === openTab}
                // Tocar la pestaña abierta la cierra: es la forma más rápida de
                // volver a ver la foto entera sin buscar una cruz.
                onClick={() => setOpenTab(section.id === openTab ? null : section.id)}
              >
                {section.icon}
                <span>{section.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {picker}
      </>
    )
  }

  return (
    <aside className="panel">
      <header>
        <a className="back" href="../" title="Volver a las herramientas">
          <BackIcon />
        </a>
        <h1>Referencia</h1>
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
        <button type="button" className="wide primary" disabled={!reference} onClick={onDownload}>
          Descargar
        </button>
      </div>

      {picker}
    </aside>
  )
}

const signed = (v: number) => (v > 0 ? `+${v}` : String(v))

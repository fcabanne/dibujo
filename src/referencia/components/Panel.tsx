import { useEffect, useRef, useState } from 'react'
import type { Reference } from '../../shared/referenceImage'
import { GRID_LIMITS } from '../domain/grid'
import { PAPER_PRESETS } from '../domain/paper'
import { ColorRow, Hint, Section, Segmented, Slider, Toggle } from './controls'
import type { Action } from '../state/reducer'
import type { AppState, EffectsMode, PaperId } from '../types'

interface Props {
  state: AppState
  dispatch: (action: Action) => void
  reference: Reference | null
  onFile: (file: File) => void
  onDownload: () => void
  effectsSupported: boolean
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

export function Panel({
  state,
  dispatch,
  reference,
  onFile,
  onDownload,
  effectsSupported,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [thumb, setThumb] = useState<string | null>(null)
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

  return (
    <aside className="panel">
      <header>
        <a className="back" href="../" title="Volver a las herramientas">
          ←
        </a>
        <h1>Referencia</h1>
      </header>

      <div className="scroll">
        <Section title="Foto">
          {/* La original, sin efectos ni grilla: es la referencia contra la que se
              mira lo que está pasando en el lienzo. El nombre y las medidas aparecen
              al pasar por encima — se consultan una vez, no hace falta que ocupen
              lugar todo el tiempo. */}
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
        </Section>

        <Section title="Tamaño del dibujo">
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
        </Section>

        <Section title="Grilla">
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
        </Section>

        <Section title="Ajustes">
          {!effectsSupported ? (
            <Hint>
              Este navegador no puede aplicar los ajustes (le falta WebGL). La grilla y el
              export andan igual.
            </Hint>
          ) : (
            <>
              {/* Arriba de los modos porque es independiente de ellos: pasar a blanco
                  y negro sobrevive a cambiar de Bordes a Facetado. */}
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

              {/* Cada modo muestra solo la perilla que le importa. El resto de los
                  valores los fija él, y esconderlos es el punto: son los que hay que
                  entender para usar esto, y no hay por qué entenderlos. */}
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
                    onChange={(contrast) =>
                      dispatch({ type: 'effects/patch', patch: { contrast } })
                    }
                    format={signed}
                  />
                </>
              )}
            </>
          )}
        </Section>

      </div>

      {/* Fuera del scroll: es la acción que cierra el trabajo, y tener que buscarla
          al pie de una columna larga la esconde justo cuando se la necesita. */}
      <div className="footer">
        <button
          type="button"
          className="wide primary"
          disabled={!reference}
          onClick={onDownload}
        >
          Descargar
        </button>
      </div>
    </aside>
  )
}

const signed = (v: number) => (v > 0 ? `+${v}` : String(v))

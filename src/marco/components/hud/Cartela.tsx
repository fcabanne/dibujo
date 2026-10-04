import { useEffect, useRef } from 'react'
import { copy } from '../../../shared/copy'
import { loadArtworkFile } from '../../../shared/imageFile'
import { clamp, LIMITS } from '../../domain/geometry'
import { buildMeasurements } from '../../domain/measurements'
import type { Action } from '../../state/reducer'
import type { AppState, Layout } from '../../types'
import { CloseIcon } from '../../../shared/ui'
import { LinkIcon, RotateIcon, UnlinkIcon, UploadIcon } from './icons'

interface Props {
  state: AppState
  layout: Layout
  dispatch: (action: Action) => void
  /** Brillo de la pared ya renderizada bajo la cartela, 0..1. */
  wallLuma: number
  /** La obra está abierta: la cartela se escribe en el lugar en vez de abrir un panel. */
  editing: boolean
  /** Se abrió con un clic, no pasando por encima: ahí sí se le da el foco al título. */
  focusTitle: boolean
  /** Quita el dibujo y vuelve a la pantalla de inicio. */
  onRemove: () => void
}

/**
 * La cartela de museo de la pared, que además es donde se edita la obra.
 *
 * Antes, tocar la obra abría un panel negro con campos: lo único del menú que parecía
 * otro producto. La cartela ya dice todo eso —título y medidas—, así que ahora es la
 * misma hoja la que se vuelve editable: el título y el tamaño se escriben ahí mismo,
 * subrayados como campo, y debajo aparecen cargar y girar. Lo que se lee y lo que se
 * escribe es lo mismo, en el mismo lugar.
 *
 * El texto no se mueve al pasar a edición: la hoja crece a su alrededor con un margen
 * negativo que compensa su relleno.
 */
export function Cartela({ state, layout, dispatch, wallLuma, editing, focusTitle, onRemove }: Props) {
  const rows = buildMeasurements(state, layout).slice(1)
  const { artwork } = state
  const fileRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  // Los campos muestran la medida tal como cuelga: con el cuadro girado eso es la obra
  // con los lados intercambiados, y así coincide con lo que dice la cartela.
  const rotated = artwork.rotation === 90 || artwork.rotation === 270
  const shown = rotated
    ? { w: artwork.size.h, h: artwork.size.w }
    : { w: artwork.size.w, h: artwork.size.h }

  useEffect(() => {
    if (editing && focusTitle) {
      titleRef.current?.focus()
      titleRef.current?.select()
    }
    // Al cerrarse no queda un campo con el foco y su texto seleccionado sobre la pared.
    if (!editing && document.activeElement === titleRef.current) titleRef.current?.blur()
  }, [editing, focusTitle])

  /**
   * Mientras escribís no se corrige nada: acotar en cada tecla hacía imposible tipear
   * "1" camino a "18", porque el campo saltaba al mínimo apenas soltabas el primer
   * dígito. El límite se aplica recién al salir del campo.
   */
  const typeSize = (side: 'w' | 'h', raw: string) => {
    const value = Number(raw.replace(',', '.'))
    if (!raw || Number.isNaN(value)) return
    dispatch({ type: 'artwork/resize', side, value })
  }

  const commitSize = (side: 'w' | 'h', raw: string) => {
    const value = Number(raw.replace(',', '.'))
    dispatch({
      type: 'artwork/resize',
      side,
      value:
        Number.isFinite(value) && value > 0
          ? clamp(value, LIMITS.artSide.min, LIMITS.artSide.max)
          : LIMITS.artSide.min,
    })
  }

  const pick = async (file: File | undefined) => {
    if (!file) return
    try {
      const { src, aspect } = await loadArtworkFile(file)
      dispatch({ type: 'artwork/replace', src, aspect })
    } catch {
      // El lienzo avisa del error al soltar; acá no insistimos.
    }
  }

  return (
    <div
      className={
        'wall-label cartela' + (wallLuma < 0.45 ? ' on-dark' : '') + (editing ? ' is-editing' : '')
      }
    >
      <input
        ref={titleRef}
        className="cartela-title"
        type="text"
        value={artwork.title}
        maxLength={60}
        placeholder={copy.marco.titlePlaceholder}
        aria-label={copy.marco.title}
        readOnly={!editing}
        tabIndex={editing ? 0 : -1}
        onChange={(e) => dispatch({ type: 'artwork/patch', patch: { title: e.target.value } })}
      />

      <dl>
        <div>
          <dt>Obra</dt>
          <dd className="cartela-size">
            {editing ? (
              <>
                <input
                  className="cartela-field"
                  type="text"
                  inputMode="decimal"
                  value={String(shown.w).replace('.', ',')}
                  aria-label={copy.marco.width}
                  onChange={(e) => typeSize('w', e.target.value)}
                  onBlur={(e) => commitSize('w', e.target.value)}
                />
                <span>x</span>
                <input
                  className="cartela-field"
                  type="text"
                  inputMode="decimal"
                  value={String(shown.h).replace('.', ',')}
                  aria-label={copy.marco.height}
                  onChange={(e) => typeSize('h', e.target.value)}
                  onBlur={(e) => commitSize('h', e.target.value)}
                />
                <span>{copy.marco.unit}</span>
                <button
                  type="button"
                  className={'cartela-lock' + (artwork.lockRatio ? ' is-on' : '')}
                  onClick={() =>
                    dispatch({ type: 'artwork/patch', patch: { lockRatio: !artwork.lockRatio } })
                  }
                  title={artwork.lockRatio ? copy.marco.lockOn : copy.marco.lockOff}
                  aria-label={artwork.lockRatio ? copy.marco.lockOn : copy.marco.lockOff}
                  aria-pressed={artwork.lockRatio}
                >
                  {artwork.lockRatio ? <LinkIcon /> : <UnlinkIcon />}
                </button>
              </>
            ) : (
              buildMeasurements(state, layout)[0].value
            )}
          </dd>
        </div>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      {/* Crece desde cero: la fila de botones no existe hasta que se edita. */}
      <div className="cartela-actions" aria-hidden={!editing}>
        <div>
          <button
            type="button"
            className="pill"
            tabIndex={editing ? 0 : -1}
            onClick={() => fileRef.current?.click()}
          >
            <UploadIcon />
            {copy.marco.change}
          </button>
          <button
            type="button"
            className="pill"
            tabIndex={editing ? 0 : -1}
            onClick={() => dispatch({ type: 'artwork/rotate' })}
          >
            <RotateIcon />
            {copy.marco.rotate}
          </button>
          <button
            type="button"
            className="pill"
            tabIndex={editing ? 0 : -1}
            onClick={onRemove}
          >
            <CloseIcon />
            {copy.marco.remove}
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}

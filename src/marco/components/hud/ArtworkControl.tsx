import { useRef } from 'react'
import { clamp, LIMITS } from '../../domain/geometry'
import { loadArtworkFile } from '../../../shared/imageFile'
import type { Action } from '../../state/reducer'
import type { AppState } from '../../types'
import { LinkIcon, RotateIcon, UnlinkIcon, UploadIcon } from './icons'

interface Props {
  state: AppState
  dispatch: (action: Action) => void
}

/**
 * Todo lo que depende de la obra en sí. El tamaño real vive acá porque es el dato
 * que convierte el juego visual en medidas que se pueden encargar.
 */
export function ArtworkTray({ state, dispatch }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { artwork } = state

  // Los campos muestran la medida tal como cuelga: con el cuadro girado eso es la
  // obra con los lados intercambiados, y así coincide con la cartela de la pared.
  const rotated = artwork.rotation === 90 || artwork.rotation === 270
  const shown = rotated
    ? { w: artwork.size.h, h: artwork.size.w }
    : { w: artwork.size.w, h: artwork.size.h }

  /**
   * Mientras escribís no se corrige nada: acotar en cada tecla hacía imposible
   * tipear "1" camino a "18", porque el campo saltaba al mínimo apenas soltabas el
   * primer dígito. El límite se aplica recién al salir del campo.
   */
  const typeSize = (side: 'w' | 'h', raw: string) => {
    const value = Number(raw)
    if (!raw || Number.isNaN(value)) return
    dispatch({ type: 'artwork/resize', side, value })
  }

  const commitSize = (side: 'w' | 'h', raw: string) => {
    const value = Number(raw)
    dispatch({
      type: 'artwork/resize',
      side,
      value: Number.isFinite(value) && value > 0
        ? clamp(value, LIMITS.artSide.min, LIMITS.artSide.max)
        : LIMITS.artSide.min,
    })
  }

  return (
    <>
      <label className="title-field">
        <span>Título</span>
        <input
          type="text"
          value={artwork.title}
          maxLength={60}
          placeholder="Obra maestra"
          onChange={(e) => dispatch({ type: 'artwork/patch', patch: { title: e.target.value } })}
        />
      </label>

      <div className="size-fields">
        <span className="size-title">Tamaño real</span>
        <div className="size-inputs">
          <input
            type="number"
            value={shown.w}
            step={0.5}
            onChange={(e) => typeSize('w', e.target.value)}
            onBlur={(e) => commitSize('w', e.target.value)}
            aria-label="Ancho de la obra en centímetros"
          />
          <span>×</span>
          <input
            type="number"
            value={shown.h}
            step={0.5}
            onChange={(e) => typeSize('h', e.target.value)}
            onBlur={(e) => commitSize('h', e.target.value)}
            aria-label="Alto de la obra en centímetros"
          />
          <span className="unit">cm</span>
          <button
            type="button"
            className={'ratio-lock' + (artwork.lockRatio ? ' is-on' : '')}
            onClick={() =>
              dispatch({ type: 'artwork/patch', patch: { lockRatio: !artwork.lockRatio } })
            }
            title={
              artwork.lockRatio
                ? 'Proporción trabada: el otro lado acompaña'
                : 'Proporción libre: cada lado va por su cuenta'
            }
            aria-pressed={artwork.lockRatio}
          >
            {artwork.lockRatio ? <LinkIcon /> : <UnlinkIcon />}
          </button>
        </div>
      </div>

      <div className="tray-row">
        <button type="button" className="pill" onClick={() => inputRef.current?.click()}>
          <UploadIcon />
          Cargar dibujo
        </button>
        <button
          type="button"
          className="pill"
          onClick={() => dispatch({ type: 'artwork/rotate' })}
          title="Girar el cuadro 90°"
        >
          <RotateIcon />
          Girar
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              const { src, aspect } = await loadArtworkFile(file)
              dispatch({ type: 'artwork/replace', src, aspect })
            } catch {
              // El mensaje de error lo muestra el lienzo al soltar; acá no molestamos.
            }
            e.target.value = ''
          }}
        />
      </div>
    </>
  )
}

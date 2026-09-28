import type { CSSProperties } from 'react'
import { copy, fill, formatNumber } from '../../../shared/copy'
import {
  Button,
  ChoiceGroup,
  Dropdown,
  IconButton,
  OptionPicker,
  Slider,
  Swatch,
  SwatchPicker,
  UploadIcon,
  type PickerOption,
} from '../../../shared/ui'
import { clamp, LIMITS } from '../../domain/geometry'
import {
  FRAME_PRESETS,
  FRAME_PROFILES,
  GLASS_TYPES,
  MAT_PRESETS,
  MOLDING_TYPES,
  WALL_PATTERNS,
  WALL_PRESETS,
} from '../../domain/palettes'
import type { Action } from '../../state/reducer'
import type { AppState, FrameProfile, GlassType, WallPattern } from '../../types'
import { LinkIcon, RotateIcon, UnlinkIcon } from '../hud/icons'
import { CmField, Heading, MoldingChip, MoldingSwatch, NoneSwatch, Row, Strip } from './controls'

/** Lo que tiene cada cajón para trabajar. */
interface PanelProps {
  state: AppState
  dispatch: (action: Action) => void
}

/** Medio centímetro, siempre con su decimal: es la precisión con que se encarga. */
export const cm = (n: number) =>
  fill(copy.marco.cm, { n: formatNumber(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** Cómo se llama un color: el de la lista si es uno de ellos, "A medida" si no. */
function nameOf(color: string, presets: { color: string; label: string }[]): string {
  return presets.find((p) => same(p.color, color))?.label ?? copy.marco.custom
}

// ---------------------------------------------------------------------- obra

/**
 * La obra: cuánto mide de verdad, cómo se llama, cambiarla y girarla.
 *
 * El tamaño va arriba de todo porque es lo que convierte el juego en medidas que se
 * pueden encargar, y es lo que se viene a completar después de subir un dibujo. Los
 * campos muestran la medida como cuelga: con el cuadro girado, los lados cambiados,
 * igual que en la cartela.
 */
export function ArtworkPanel({
  state,
  dispatch,
  placeholder,
  onPick,
}: PanelProps & { placeholder: boolean; onPick: () => void }) {
  const { artwork } = state
  const rotated = artwork.rotation === 90 || artwork.rotation === 270
  const shown = rotated
    ? { w: artwork.size.h, h: artwork.size.w }
    : { w: artwork.size.w, h: artwork.size.h }

  const commit = (side: 'w' | 'h', value: number) =>
    dispatch({
      type: 'artwork/resize',
      side,
      value:
        Number.isFinite(value) && value > 0
          ? clamp(value, LIMITS.artSide.min, LIMITS.artSide.max)
          : LIMITS.artSide.min,
    })

  return (
    <>
      <Heading label={copy.marco.size} />
      <div className="m-size">
        <CmField
          value={shown.w}
          label={copy.marco.width}
          onType={(value) => dispatch({ type: 'artwork/resize', side: 'w', value })}
          onCommit={(value) => commit('w', value)}
        />
        <span className="m-times" aria-hidden>
          ×
        </span>
        <CmField
          value={shown.h}
          label={copy.marco.height}
          onType={(value) => dispatch({ type: 'artwork/resize', side: 'h', value })}
          onCommit={(value) => commit('h', value)}
        />
        <IconButton
          label={artwork.lockRatio ? copy.marco.lockOn : copy.marco.lockOff}
          selected={artwork.lockRatio}
          onClick={() => dispatch({ type: 'artwork/patch', patch: { lockRatio: !artwork.lockRatio } })}
        >
          {artwork.lockRatio ? <LinkIcon /> : <UnlinkIcon />}
        </IconButton>
      </div>

      <Row label={copy.marco.title}>
        <input
          className="m-field m-title"
          type="text"
          value={artwork.title}
          maxLength={60}
          placeholder={copy.marco.titlePlaceholder}
          enterKeyHint="done"
          aria-label={copy.marco.title}
          onChange={(e) => dispatch({ type: 'artwork/patch', patch: { title: e.target.value } })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
      </Row>

      <div className="m-actions">
        {/* Con el dibujo de ejemplo puesto, subir el propio es lo que sigue: por eso
            ahí el botón es el principal. Después pasa a ser un cambio más. */}
        <Button variant={placeholder ? 'loud' : 'quiet'} icon={<UploadIcon />} onClick={onPick}>
          {placeholder ? copy.marco.upload : copy.marco.change}
        </Button>
        <IconButton label={copy.marco.rotate} onClick={() => dispatch({ type: 'artwork/rotate' })}>
          <RotateIcon />
        </IconButton>
      </div>
    </>
  )
}

// --------------------------------------------------------------------- marco

export type FramePicker = 'finish' | 'profile'

/**
 * La moldura: el color en una tira, el acabado y el perfil en filas que llevan a
 * sus tarjetas, y las dos medidas.
 *
 * El color es lo que más se prueba —se pasa el dedo por la tira mirando el cuadro—
 * y por eso está a la vista y de un toque. Acabado y perfil se deciden menos veces y
 * tienen nombres que hay que leer ("Caveta", "Bombé"), así que van como en
 * Referencia: la fila cerrada lleva a una pantalla de tarjetas grandes, cada una con
 * la moldura pintada.
 */
export function FramePanel({
  state,
  dispatch,
  picker,
  onPicker,
  onWidth,
}: PanelProps & {
  picker: FramePicker | null
  onPicker: (picker: FramePicker | null, soon?: boolean) => void
  onWidth: () => void
}) {
  const { frame } = state
  const hasFrame = frame.width > 0
  const molding =
    MOLDING_TYPES.find((m) => m.material === frame.material && m.finish === frame.finish) ??
    MOLDING_TYPES[0]
  const profileName = FRAME_PROFILES.find((p) => p.id === frame.profile)?.label ?? ''

  if (picker === 'finish') {
    const options: PickerOption<string>[] = MOLDING_TYPES.map((m) => ({
      value: m.id,
      label: m.label,
      icon: (
        <MoldingChip color={frame.color} material={m.material} finish={m.finish} profile={frame.profile} />
      ),
    }))
    return (
      <OptionPicker
        label={copy.marco.finish}
        value={molding.id}
        columns={3}
        options={options}
        onChange={(id) => {
          const m = MOLDING_TYPES.find((type) => type.id === id)
          if (m) dispatch({ type: 'frame/patch', patch: { material: m.material, finish: m.finish } })
          onPicker(null, true)
        }}
      />
    )
  }

  if (picker === 'profile') {
    const options: PickerOption<FrameProfile>[] = FRAME_PROFILES.map((p) => ({
      value: p.id,
      label: p.label,
      icon: (
        <MoldingChip
          color={frame.color}
          material={frame.material}
          finish={frame.finish}
          profile={p.id}
          look="bottom"
        />
      ),
    }))
    return (
      <OptionPicker
        label={copy.marco.profile}
        value={frame.profile}
        columns={3}
        options={options}
        onChange={(profile) => {
          dispatch({ type: 'frame/patch', patch: { profile } })
          onPicker(null, true)
        }}
      />
    )
  }

  const custom = !FRAME_PRESETS.some((p) => same(p.color, frame.color))

  return (
    <>
      <Heading
        label={copy.marco.color}
        value={hasFrame ? nameOf(frame.color, FRAME_PRESETS) : copy.marco.noFrame}
      />
      <Strip label={copy.marco.color}>
        <NoneSwatch
          label={copy.marco.noFrame}
          selected={!hasFrame}
          onSelect={() => dispatch({ type: 'frame/patch', patch: { width: 0 } })}
        />
        {FRAME_PRESETS.map((p) => (
          <MoldingSwatch
            key={p.id}
            label={p.label}
            color={p.color}
            material={frame.material}
            finish={frame.finish}
            profile={frame.profile}
            selected={hasFrame && same(p.color, frame.color)}
            onSelect={() => dispatch({ type: 'frame/patch', patch: { color: p.color } })}
          />
        ))}
        <SwatchPicker
          value={frame.color}
          selected={hasFrame && custom}
          label={copy.marco.customColor}
          onChange={(color) => dispatch({ type: 'frame/patch', patch: { color } })}
        />
      </Strip>

      <Row label={copy.marco.finish} disabled={!hasFrame}>
        <Dropdown label={copy.marco.finish} value={molding.label} onClick={() => onPicker('finish')} />
      </Row>
      <Row label={copy.marco.profile} disabled={!hasFrame}>
        <Dropdown label={copy.marco.profile} value={profileName} onClick={() => onPicker('profile')} />
      </Row>

      {/* Llega a cero, y cero no es un extremo cualquiera: es el cuadro sin marco,
          con los ganchitos. El mismo camino que la muestra de "sin". */}
      <Row label={copy.marco.frameWidth}>
        <Slider
          label={copy.marco.frameWidth}
          value={frame.width}
          min={LIMITS.frameWidth.min}
          max={LIMITS.frameWidth.max}
          step={LIMITS.frameWidth.step}
          format={(v) => (v === 0 ? copy.marco.noFrame : cm(v))}
          onChange={(width) => {
            dispatch({ type: 'frame/patch', patch: { width } })
            onWidth()
          }}
        />
      </Row>
      <Row label={copy.marco.depth} disabled={!hasFrame}>
        <Slider
          label={copy.marco.depth}
          value={frame.depth}
          min={LIMITS.frameDepth.min}
          max={LIMITS.frameDepth.max}
          step={LIMITS.frameDepth.step}
          format={cm}
          disabled={!hasFrame}
          onChange={(depth) => dispatch({ type: 'frame/patch', patch: { depth } })}
        />
      </Row>
    </>
  )
}

// ------------------------------------------------------------- passe-partout

/** El passe-partout: color —o ninguno— y ancho. */
export function MatPanel({ state, dispatch, onWidth }: PanelProps & { onWidth: () => void }) {
  const mat = state.mats[0]
  const on = Boolean(mat?.enabled)
  const custom = !MAT_PRESETS.some((p) => same(p.color, mat.color))

  return (
    <>
      <Heading label={copy.marco.color} value={on ? nameOf(mat.color, MAT_PRESETS) : copy.marco.noMat} />
      <Strip label={copy.marco.color}>
        <NoneSwatch
          label={copy.marco.noMat}
          selected={!on}
          onSelect={() => dispatch({ type: 'mat/patch', patch: { enabled: false } })}
        />
        {MAT_PRESETS.map((p) => (
          <Swatch
            key={p.id}
            color={p.color}
            label={p.label}
            selected={on && same(p.color, mat.color)}
            onSelect={() => dispatch({ type: 'mat/patch', patch: { color: p.color, enabled: true } })}
          />
        ))}
        <SwatchPicker
          value={mat.color}
          selected={on && custom}
          label={copy.marco.customColor}
          onChange={(color) => dispatch({ type: 'mat/patch', patch: { color, enabled: true } })}
        />
      </Strip>

      <Row label={copy.marco.matWidth} disabled={!on}>
        <Slider
          label={copy.marco.matWidth}
          value={mat.width}
          min={LIMITS.matWidth.min}
          max={LIMITS.matWidth.max}
          step={LIMITS.matWidth.step}
          format={cm}
          disabled={!on}
          onChange={(width) => {
            dispatch({ type: 'mat/patch', patch: { width, enabled: true } })
            onWidth()
          }}
        />
      </Row>
    </>
  )
}

// -------------------------------------------------------------------- vidrio

/**
 * Los cuatro vidrios, en tarjetas y sin fila cerrada: no hay nada más que ajustar
 * en esta pestaña, igual que Ajustes en Referencia abre directo en sus tarjetas.
 *
 * Son las tarjetas del sistema (`.ds-option`) con un renglón más —qué hace cada
 * vidrio, "refleja", "difumina"—, que `OptionPicker` no tiene. La diferencia entre
 * cristal y antirreflejo es justamente la que no se adivina por el nombre.
 */
export function GlassPanel({ state, dispatch }: PanelProps) {
  return (
    <div className="ds-option-picker">
      <p className="ds-option-header">{copy.marco.glass}</p>
      <div className="ds-option-grid ds-option-grid--2">
        {GLASS_TYPES.map((g, index) => (
          <button
            key={g.id}
            type="button"
            className={'ds-option m-glass-option' + (state.glass === g.id ? ' is-selected' : '')}
            style={{ '--i': index } as CSSProperties}
            aria-pressed={state.glass === g.id}
            onClick={() => dispatch({ type: 'glass/set', value: g.id as GlassType })}
          >
            <span className="m-glass" data-glass={g.id} aria-hidden />
            <span>{g.label}</span>
            <em>{g.hint}</em>
          </button>
        ))}
      </div>
    </div>
  )
}

// --------------------------------------------------------------------- pared

/** La pared: el color en una tira y la textura en cuatro botones. */
export function WallPanel({ state, dispatch }: PanelProps) {
  const { wall } = state
  const custom = !WALL_PRESETS.some((p) => same(p.color, wall.color))

  return (
    <>
      <Heading label={copy.marco.color} value={nameOf(wall.color, WALL_PRESETS)} />
      <Strip label={copy.marco.color}>
        {WALL_PRESETS.map((p) => (
          <Swatch
            key={p.id}
            color={p.color}
            label={p.label}
            selected={same(p.color, wall.color)}
            onSelect={() => dispatch({ type: 'wall/patch', patch: { color: p.color } })}
          />
        ))}
        <SwatchPicker
          value={wall.color}
          selected={custom}
          label={copy.marco.customColor}
          onChange={(color) => dispatch({ type: 'wall/patch', patch: { color } })}
        />
      </Strip>

      <Heading label={copy.marco.texture} />
      <ChoiceGroup<WallPattern>
        className="ds-choice-group--start m-choices"
        label={copy.marco.texture}
        value={wall.pattern}
        onChange={(pattern) => dispatch({ type: 'wall/patch', patch: { pattern } })}
        options={WALL_PATTERNS.map((p) => ({ value: p.id, label: p.label }))}
      />
    </>
  )
}

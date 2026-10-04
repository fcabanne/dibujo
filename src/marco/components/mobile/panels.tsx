import { copy, fill, formatDecimal, formatNumber } from '../../../shared/copy'
import {
  Button,
  CloseIcon,
  Dropdown,
  IconButton,
  OptionPicker,
  Slider,
  Swatch,
  SwatchPicker,
  UploadIcon,
  type PickerOption,
} from '../../../shared/ui'
import { LIMITS } from '../../domain/geometry'
import {
  FRAME_PRESETS,
  FRAME_PROFILES,
  GLASS_TYPES,
  MAT_PRESETS,
  MOLDING_FAMILIES,
  WALL_PATTERNS,
  WALL_PRESETS,
} from '../../domain/palettes'
import type { Action } from '../../state/reducer'
import type { AppState, FrameProfile, GlassType, WallPattern } from '../../types'
import { LinkIcon, RotateIcon, UnlinkIcon } from '../hud/icons'
import type { Editing } from './FieldEditor'
import {
  FieldButton,
  Heading,
  MoldingChip,
  MoldingSwatch,
  NoneSwatch,
  Row,
  Strip,
  WallChip,
} from './controls'

/** Lo que tiene cada cajón para trabajar. */
interface PanelProps {
  state: AppState
  dispatch: (action: Action) => void
}

/** Las pantallas de tarjetas a las que llevan las filas cerradas (`Dropdown`). */
export type Picker = 'finish' | 'profile' | 'texture'

interface PickerProps {
  picker: Picker | null
  /** Abrir un picker, o cerrarlo; `soon` deja ver la tarjeta elegida antes de irse. */
  onPicker: (picker: Picker | null, soon?: boolean) => void
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
 * La obra: cómo se llama, cuánto mide de verdad, y cambiarla, girarla o quitarla.
 *
 * El título arriba y las medidas abajo, como en la cartela. Ninguno de los dos se
 * escribe acá: tocarlos abre el editor a pantalla completa, porque con el teclado
 * encima del cajón el campo quedaba tapado. Las medidas se muestran como cuelga el
 * cuadro: girado, con los lados cambiados.
 */
export function ArtworkPanel({
  state,
  dispatch,
  onEdit,
  onPick,
  onRemove,
}: PanelProps & { onEdit: (field: Editing) => void; onPick: () => void; onRemove: () => void }) {
  const { artwork } = state
  const rotated = artwork.rotation === 90 || artwork.rotation === 270
  const shown = rotated
    ? { w: artwork.size.h, h: artwork.size.w }
    : { w: artwork.size.w, h: artwork.size.h }

  return (
    <>
      <Row label={copy.marco.title}>
        <FieldButton
          value={artwork.title || copy.marco.titlePlaceholder}
          placeholder={!artwork.title}
          label={copy.marco.title}
          onEdit={() => onEdit('title')}
        />
      </Row>

      <Heading label={copy.marco.size} />
      <div className="m-size">
        <FieldButton
          value={formatDecimal(shown.w)}
          unit={copy.marco.unit}
          label={copy.marco.width}
          onEdit={() => onEdit('w')}
        />
        <span className="m-times" aria-hidden>
          x
        </span>
        <FieldButton
          value={formatDecimal(shown.h)}
          unit={copy.marco.unit}
          label={copy.marco.height}
          onEdit={() => onEdit('h')}
        />
        <IconButton
          label={artwork.lockRatio ? copy.marco.lockOn : copy.marco.lockOff}
          selected={artwork.lockRatio}
          onClick={() => dispatch({ type: 'artwork/patch', patch: { lockRatio: !artwork.lockRatio } })}
        >
          {artwork.lockRatio ? <LinkIcon /> : <UnlinkIcon />}
        </IconButton>
      </div>

      {/* Cambiar, girar y quitar juntos y a la vista, como la foto en Referencia.
          Quitar vuelve a la pantalla de inicio y conserva el enmarcado: probar la
          misma moldura en otro dibujo no tiene por qué costar armarla de nuevo. */}
      <div className="m-actions">
        <Button variant="quiet" icon={<UploadIcon />} onClick={onPick}>
          {copy.marco.change}
        </Button>
        <IconButton label={copy.marco.rotate} onClick={() => dispatch({ type: 'artwork/rotate' })}>
          <RotateIcon />
        </IconButton>
        <IconButton label={copy.marco.remove} onClick={onRemove}>
          <CloseIcon />
        </IconButton>
      </div>
    </>
  )
}

// --------------------------------------------------------------------- marco

/**
 * La moldura: el color en una tira, la familia y el perfil en filas que llevan a sus
 * tarjetas, y las dos medidas.
 *
 * El color es lo que más se prueba —se pasa el dedo por la tira mirando el cuadro—
 * y por eso está a la vista y de un toque. La familia (madera, pintado, metal) y el
 * perfil se deciden menos y tienen nombres que hay que leer, así que van como en
 * Referencia: la fila cerrada lleva a una pantalla de tarjetas grandes, cada una con
 * la moldura pintada.
 */
export function FramePanel({
  state,
  dispatch,
  picker,
  onPicker,
  onWidth,
}: PanelProps & PickerProps & { onWidth: () => void }) {
  const { frame } = state
  const hasFrame = frame.width > 0
  const family = MOLDING_FAMILIES.find((m) => m.material === frame.material) ?? MOLDING_FAMILIES[0]
  const profileName = FRAME_PROFILES.find((p) => p.id === frame.profile)?.label ?? ''

  if (picker === 'finish') {
    const options: PickerOption<string>[] = MOLDING_FAMILIES.map((m) => ({
      value: m.id,
      label: m.label,
      icon: (
        <MoldingChip color={frame.color} material={m.material} finish={m.finish} profile={frame.profile} />
      ),
    }))
    return (
      <OptionPicker
        label={copy.marco.finish}
        value={family.id}
        columns={3}
        options={options}
        onChange={(id) => {
          const m = MOLDING_FAMILIES.find((type) => type.id === id)
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
        <Dropdown label={copy.marco.finish} value={family.label} onClick={() => onPicker('finish')} />
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
    </>
  )
}

// ------------------------------------------------------------- passe-partout

/**
 * El passe-partout: color —o ninguno— y ancho. El ancho llega a cero como el del
 * marco, y cero es "sin passe-partout": las dos formas de sacarlo —la muestra de
 * "sin" y bajar el ancho— hacen lo mismo en las dos pestañas.
 *
 * Por debajo del centímetro no hay passe-partout que cortar, así que el primer paso
 * después del cero lo trae de vuelta en su ancho mínimo en vez de dejar un valor que
 * no existe.
 */
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

      <Row label={copy.marco.matWidth}>
        <Slider
          label={copy.marco.matWidth}
          value={on ? mat.width : 0}
          min={0}
          max={LIMITS.matWidth.max}
          step={LIMITS.matWidth.step}
          format={(v) => (v === 0 ? copy.marco.noMatShort : cm(v))}
          onChange={(v) => {
            dispatch({
              type: 'mat/patch',
              patch:
                v === 0
                  ? { enabled: false }
                  : { enabled: true, width: Math.max(LIMITS.matWidth.min, v) },
            })
            onWidth()
          }}
        />
      </Row>
    </>
  )
}

// -------------------------------------------------------------------- vidrio

/** Los cuatro vidrios, directo en sus tarjetas: no hay nada más que ajustar acá. */
const GLASS_OPTIONS: PickerOption<GlassType>[] = GLASS_TYPES.map((g) => ({
  value: g.id,
  label: g.label,
  icon: <span className="m-glass" data-glass={g.id} aria-hidden />,
}))

export function GlassPanel({ state, dispatch }: PanelProps) {
  return (
    <OptionPicker
      label={copy.marco.glass}
      value={state.glass}
      columns={2}
      options={GLASS_OPTIONS}
      onChange={(value) => dispatch({ type: 'glass/set', value })}
    />
  )
}

// --------------------------------------------------------------------- pared

/**
 * La pared: el color en una tira y la textura en una fila que lleva a sus tarjetas.
 * Cada tarjeta muestra un pedazo de esa pared, acercado: en el cuadro, a su escala,
 * la diferencia entre yeso y gotelé es sutil, y en un botón con el nombre no se veía.
 */
export function WallPanel({ state, dispatch, picker, onPicker }: PanelProps & PickerProps) {
  const { wall } = state
  const custom = !WALL_PRESETS.some((p) => same(p.color, wall.color))
  const texture = WALL_PATTERNS.find((p) => p.id === wall.pattern) ?? WALL_PATTERNS[0]

  if (picker === 'texture') {
    const options: PickerOption<WallPattern>[] = WALL_PATTERNS.map((p) => ({
      value: p.id,
      label: p.label,
      icon: <WallChip color={wall.color} pattern={p.id} />,
    }))
    return (
      <OptionPicker
        label={copy.marco.texture}
        value={wall.pattern}
        columns={2}
        options={options}
        onChange={(pattern) => {
          dispatch({ type: 'wall/patch', patch: { pattern } })
          onPicker(null, true)
        }}
      />
    )
  }

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

      <Row label={copy.marco.texture}>
        <Dropdown label={copy.marco.texture} value={texture.label} onClick={() => onPicker('texture')} />
      </Row>
    </>
  )
}

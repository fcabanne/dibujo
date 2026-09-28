import { forwardRef, useState, type RefObject } from 'react'
import { copy, fill, formatDecimal } from '../../../shared/copy'
import { Button, Switch } from '../../../shared/ui'
import { clamp, computeLayout, LIMITS } from '../../domain/geometry'
import type { Action } from '../../state/reducer'
import type { AppState } from '../../types'

/** Qué se está escribiendo: el título, o una de las dos medidas. */
export type Editing = 'title' | 'w' | 'h'

interface Props {
  editing: Editing
  state: AppState
  dispatch: (action: Action) => void
  inputs: Record<Editing, RefObject<HTMLInputElement>>
  onDone: () => void
}

/**
 * Escribir a pantalla completa.
 *
 * Con el teclado abierto el celular se come media pantalla, y el cajón de abajo —con
 * el campo adentro— quedaba tapado o empujaba todo: el cuadro se achicaba a nada y
 * el campo que se estaba escribiendo se iba de la vista. Acá el campo está arriba de
 * todo, lejos de donde sube el teclado, con "Listo" al lado del título: en un
 * teclado numérico de iPhone no hay tecla de "Aceptar", y sin ese botón no habría
 * cómo salir.
 *
 * Lo que se escribe se aplica en el acto, como el resto de la herramienta: "Listo"
 * cierra, no confirma. Las medidas se acotan al salir de cada campo.
 */
export function FieldEditor({ editing, state, dispatch, inputs, onDone }: Props) {
  const { artwork } = state
  const rotated = artwork.rotation === 90 || artwork.rotation === 270
  const shown = rotated
    ? { w: artwork.size.h, h: artwork.size.w }
    : { w: artwork.size.w, h: artwork.size.h }
  const outer = computeLayout(state).outer

  const done = () => {
    // Salir del campo primero: es lo que acota y prolija la medida que quedó a medias.
    ;(document.activeElement as HTMLElement | null)?.blur()
    onDone()
  }

  const resize = (side: 'w' | 'h', value: number, commit: boolean) =>
    dispatch({
      type: 'artwork/resize',
      side,
      value: commit
        ? Number.isFinite(value) && value > 0
          ? clamp(value, LIMITS.artSide.min, LIMITS.artSide.max)
          : LIMITS.artSide.min
        : value,
    })

  const title = editing === 'title' ? copy.marco.title : copy.marco.size

  return (
    <div className="m-editor" role="dialog" aria-modal="true" aria-label={title}>
      <header className="m-editor-header">
        <h2>{title}</h2>
        <Button variant="loud" onClick={done}>
          {copy.marco.done}
        </Button>
      </header>

      {editing === 'title' ? (
        <input
          ref={inputs.title}
          className="m-field m-editor-title"
          type="text"
          value={artwork.title}
          maxLength={60}
          placeholder={copy.marco.titlePlaceholder}
          enterKeyHint="done"
          aria-label={copy.marco.title}
          onChange={(e) => dispatch({ type: 'artwork/patch', patch: { title: e.target.value } })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') done()
          }}
        />
      ) : (
        <>
          <label className="m-editor-row">
            <span>{copy.marco.widthShort}</span>
            <CmInput
              ref={inputs.w}
              value={shown.w}
              label={copy.marco.width}
              onType={(v) => resize('w', v, false)}
              onCommit={(v) => resize('w', v, true)}
              onEnter={() => inputs.h.current?.focus()}
            />
          </label>
          <label className="m-editor-row">
            <span>{copy.marco.heightShort}</span>
            <CmInput
              ref={inputs.h}
              value={shown.h}
              label={copy.marco.height}
              onType={(v) => resize('h', v, false)}
              onCommit={(v) => resize('h', v, true)}
              onEnter={done}
            />
          </label>
          <div className="m-editor-row m-editor-row--switch">
            <span>{copy.marco.keepRatio}</span>
            <Switch
              label={copy.marco.keepRatio}
              checked={artwork.lockRatio}
              onChange={(lockRatio) => dispatch({ type: 'artwork/patch', patch: { lockRatio } })}
            />
          </div>
          {/* Lo que la medida de la obra termina siendo: el número que se encarga. */}
          <p className="m-editor-meta">
            {fill(copy.marco.finished, {
              width: formatDecimal(outer.w),
              height: formatDecimal(outer.h),
            })}
          </p>
        </>
      )}
    </div>
  )
}

/**
 * Un campo de centímetros.
 *
 * Es de texto y no `type="number"`: en un teléfono en castellano el teclado ofrece la
 * coma, y un campo numérico la rechaza en silencio. Mientras se escribe se respeta lo
 * que se tipeó —acotar en cada tecla hacía imposible escribir "1" camino a "18"— y
 * cada valor que ya se puede leer se aplica. Al salir se acota y se reescribe prolijo.
 */
const CmInput = forwardRef<
  HTMLInputElement,
  {
    value: number
    label: string
    onType: (value: number) => void
    onCommit: (value: number) => void
    onEnter: () => void
  }
>(function CmInput({ value, label, onType, onCommit, onEnter }, ref) {
  const [draft, setDraft] = useState<string | null>(null)
  const parse = (raw: string) => Number(raw.replace(',', '.').trim())

  return (
    <span className="m-unit" data-unit={copy.marco.unit}>
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        enterKeyHint="next"
        className="m-field"
        aria-label={label}
        value={draft ?? formatDecimal(value)}
        onFocus={(e) => {
          setDraft(formatDecimal(value))
          e.currentTarget.select()
        }}
        onChange={(e) => {
          setDraft(e.target.value)
          const next = parse(e.target.value)
          if (e.target.value && Number.isFinite(next) && next > 0) onType(next)
        }}
        onBlur={(e) => {
          onCommit(parse(e.target.value))
          setDraft(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter()
        }}
      />
    </span>
  )
})

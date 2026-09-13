import { useEffect, useRef } from 'react'
import { PRINT_SHEETS } from '../domain/paper'
import { Segmented } from './controls'
import type { Action } from '../state/reducer'
import type { ExportSize, ExportState } from '../types'

interface Props {
  open: boolean
  value: ExportState
  dispatch: (action: Action) => void
  onConfirm: () => void
  onClose: () => void
  busy: boolean
}

const SIZES: { value: ExportSize; label: string; title: string }[] = [
  { value: 'original', label: 'Original', title: 'La foto con sus propios píxeles' },
  ...PRINT_SHEETS.map((sheet) => ({
    value: sheet.id as ExportSize,
    label: sheet.label,
    title: `${sheet.w} × ${sheet.h} cm`,
  })),
]

/**
 * Las dos preguntas del export, recién cuando se va a exportar.
 *
 * Antes vivían abiertas en el panel, y eran dos controles que no se tocan mientras
 * se trabaja compitiendo por la atención con los que sí. Acá es un `<dialog>` nativo
 * y no un div: el foco queda atrapado adentro y Escape cierra, gratis.
 */
export function DownloadDialog({ open, value, dispatch, onConfirm, onClose, busy }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // A mano y no con `onClose`: el evento `close` no burbujea, y el sistema de
  // eventos de React lo entrega de forma despareja. Escape tiene que cerrar siempre.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.addEventListener('close', onClose)
    return () => dialog.removeEventListener('close', onClose)
  }, [onClose])

  return (
    <dialog
      ref={ref}
      className="sheet"
      // Escape a mano. Un <dialog> modal debería cerrarse solo, pero no todos los
      // navegadores —ni todas las vistas empotradas— lo hacen, y quedarse encerrado
      // en un modal es de las peores cosas que puede hacer una interfaz. Si el
      // navegador ya lo cerró, este `close` no hace nada.
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          ref.current?.close()
        }
      }}
      // Un clic en el fondo tiene como destino el propio <dialog>, no su contenido.
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="sheet-body">
        <h2>Descargar</h2>

        <Segmented
          label="Tamaño"
          value={value.size}
          onChange={(size) => dispatch({ type: 'export/patch', patch: { size } })}
          options={SIZES}
        />

        <Segmented
          label="Formato"
          value={value.format}
          onChange={(format) => dispatch({ type: 'export/patch', patch: { format } })}
          options={[
            { value: 'pdf', label: 'PDF', title: 'Se imprime sin reescalar' },
            { value: 'jpg', label: 'JPG', title: 'Una imagen común' },
          ]}
        />

        <div className="sheet-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="primary" disabled={busy} onClick={onConfirm}>
            {busy ? 'Preparando…' : 'Descargar'}
          </button>
        </div>
      </div>
    </dialog>
  )
}

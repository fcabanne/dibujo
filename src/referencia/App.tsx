import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { openReferenceFile, type Reference } from '../shared/referenceImage'
import { loadOriginal, saveOriginal } from '../shared/imageStore'
import { Canvas } from './components/Canvas'
import { useCompact } from './hooks/useCompact'
import { DownloadDialog } from './components/DownloadDialog'
import { Panel } from './components/Panel'
import { deliver, exportFile } from './export/exporters'
import { placeholderReference } from './state/placeholder'
import { loadSession, saveSession } from './state/persistence'
import { reducer } from './state/reducer'

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadSession)
  const [reference, setReference] = useState<Reference | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [effectsSupported, setEffectsSupported] = useState(true)
  const compact = useCompact()
  const noteTimer = useRef(0)

  // Estable: el diálogo se suscribe a `close` con ella, y una función nueva por
  // render lo haría re-suscribirse en cada cambio de estado.
  const closeDialog = useCallback(() => setDialog(false), [])

  const notify = useCallback((text: string) => {
    setNote(text)
    window.clearTimeout(noteTimer.current)
    noteTimer.current = window.setTimeout(() => setNote(null), 3600)
  }, [])

  // La foto guardada se lee de IndexedDB; si no hay ninguna, abre con el ejemplo.
  // Abrir con algo ya cargado es lo que invita a mover las perillas antes de ir a
  // buscar el archivo propio.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const saved = await loadOriginal('referencia')
      if (saved) {
        const restored = await openReferenceFile(
          new File([saved.blob], saved.name, { type: saved.blob.type }),
        ).catch(() => null)
        if (cancelled) return
        if (restored) {
          setReference(restored)
          return
        }
      }
      const example = await placeholderReference().catch(() => null)
      if (!cancelled && example) setReference(example)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Autoguardado con respiro: arrastrar un slider dispara cambios a sesenta por segundo.
  useEffect(() => {
    const id = window.setTimeout(() => saveSession(state), 400)
    return () => window.clearTimeout(id)
  }, [state])

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const next = await openReferenceFile(file)
        setReference(next)
        void saveOriginal('referencia', next.blob, next.name)
      } catch (error) {
        notify(error instanceof Error ? error.message : 'No se pudo cargar la imagen')
      }
    },
    [notify],
  )

  const handleDownload = useCallback(async () => {
    if (!reference || busy) return
    setBusy(true)
    try {
      const output = await exportFile(reference, state)
      const how = await deliver(output)
      setDialog(false)
      if (how !== 'cancelado') {
        notify(how === 'compartido' ? 'Compartido' : `Listo: ${output.filename}`)
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo descargar')
    } finally {
      setBusy(false)
    }
  }, [busy, notify, reference, state])

  return (
    <div className={'app' + (compact ? ' is-compact' : '')}>
      <Canvas
        reference={reference}
        state={state}
        onFile={(file) => void handleFile(file)}
        onEffectsSupport={setEffectsSupported}
        compact={compact}
      />

      <Panel
        state={state}
        dispatch={dispatch}
        reference={reference}
        onFile={(file) => void handleFile(file)}
        onDownload={() => setDialog(true)}
        effectsSupported={effectsSupported}
        compact={compact}
      />

      <DownloadDialog
        open={dialog}
        value={state.export}
        dispatch={dispatch}
        onConfirm={() => void handleDownload()}
        onClose={closeDialog}
        busy={busy}
      />

      {note && <div className="note">{note}</div>}
    </div>
  )
}

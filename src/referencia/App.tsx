import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { copy, fill } from '../shared/copy'
import { openReferenceFile, type Reference } from '../shared/referenceImage'
import { deleteOriginal, loadOriginal, saveOriginal } from '../shared/imageStore'
import { Canvas } from './components/Canvas'
import { useCompact } from './hooks/useCompact'
import { DownloadDialog } from './components/DownloadDialog'
import { Panel } from './components/Panel'
import { Welcome } from './components/Welcome'
import { deliver, exportFile } from './export/exporters'
import { loadSession, saveSession } from './state/persistence'
import { reducer } from './state/reducer'

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadSession)
  const [reference, setReference] = useState<Reference | null>(null)
  /**
   * Si ya terminamos de mirar si había una foto guardada. Sin esto, al abrir con
   * una foto en memoria se ve un parpadeo de la pantalla de inicio antes de que
   * IndexedDB conteste, y parece que se hubiera perdido.
   */
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [effectsSupported, setEffectsSupported] = useState(true)
  const compact = useCompact()
  const noteTimer = useRef(0)
  const fileRef = useRef<HTMLInputElement>(null)

  // Estable: el diálogo se suscribe a `close` con ella, y una función nueva por
  // render lo haría re-suscribirse en cada cambio de estado.
  const closeDialog = useCallback(() => setDialog(false), [])

  const notify = useCallback((text: string) => {
    setNote(text)
    window.clearTimeout(noteTimer.current)
    noteTimer.current = window.setTimeout(() => setNote(null), 3600)
  }, [])

  // La foto guardada se lee de IndexedDB. Si no hay ninguna, se abre con la
  // pantalla de inicio: la herramienta dice qué es y qué hacer, en vez de mostrar
  // un dibujo de ejemplo que hacía creer que ya había algo cargado.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const saved = await loadOriginal('referencia')
      if (saved && !cancelled) {
        const restored = await openReferenceFile(
          new File([saved.blob], saved.name, { type: saved.blob.type }),
        ).catch(() => null)
        if (!cancelled && restored) setReference(restored)
      }
      if (!cancelled) setReady(true)
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
        notify(error instanceof Error ? error.message : copy.notices.loadFailed)
      }
    },
    [notify],
  )

  const pickFile = useCallback(() => fileRef.current?.click(), [])

  /**
   * Quitar la foto la borra del navegador y vuelve a la pantalla de inicio, pero
   * **no toca los ajustes**: si estás preparando varias fotos de la misma serie,
   * tu grilla y tu modo siguen puestos y no hay que reconfigurar cada vez.
   */
  const removePhoto = useCallback(() => {
    setReference(null)
    setDialog(false)
    void deleteOriginal('referencia')
  }, [])

  const handleDownload = useCallback(async () => {
    if (!reference || busy) return
    setBusy(true)
    try {
      const output = await exportFile(reference, state)
      const how = await deliver(output)
      setDialog(false)
      if (how !== 'cancelado') {
        notify(
          how === 'compartido'
            ? copy.notices.shared
            : fill(copy.notices.done, { file: output.filename }),
        )
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : copy.notices.downloadFailed)
    } finally {
      setBusy(false)
    }
  }, [busy, notify, reference, state])

  // Sin foto no hay columna que mostrar al costado, así que el escritorio usa el
  // mismo acomodo apilado que el celular.
  const stacked = compact || !reference

  return (
    <div className={'app ds' + (stacked ? ' is-compact' : '') + (reference ? '' : ' is-empty')}>
      {reference ? (
        <Canvas
          reference={reference}
          state={state}
          onFile={(file) => void handleFile(file)}
          onEffectsSupport={setEffectsSupported}
          compact={compact}
        />
      ) : (
        <div
          className="stage empty-stage"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) void handleFile(file)
          }}
        >
          {ready && <Welcome onUpload={pickFile} />}
        </div>
      )}

      <Panel
        state={state}
        dispatch={dispatch}
        reference={reference}
        onPickFile={pickFile}
        onRemove={removePhoto}
        onDownload={() => setDialog(true)}
        effectsSupported={effectsSupported}
        compact={compact}
      />

      {/* Uno solo para toda la app: lo usan la pantalla de inicio y el botón de
          cambiar foto, y dos inputs escondidos serían dos formas de la misma cosa. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
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

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { copy, fill } from '../shared/copy'
import { loadArtworkFile } from '../shared/imageFile'
import { loadArtwork, saveArtwork } from '../shared/imageStore'
import { openInstagram } from '../shared/suggestions'
import { BackIcon, Button, IconButton, PhotoIcon, Slider, UploadIcon } from '../shared/ui'
import type { Quad } from './corners'
import { Overlay } from './Overlay'
import { loadSession, saveSession } from './persistence'
import { useCamera, type CameraStatus } from './useCamera'
import { useIdle } from './useIdle'
import { useStageSize } from './useStageSize'
import { useWakeLock } from './useWakeLock'

/** Lo que tarda en irse la interfaz cuando nadie toca la pantalla. */
const IDLE_MS = 3500

const goBack = () => (window.location.href = '../')

/**
 * La mesa de luz: la cámara de atrás mirando el papel y la foto encima, translúcida.
 *
 * Sin foto, la misma pantalla de inicio que Referencia. Con foto, la cámara, las
 * cuatro esquinas para calzarla sobre la hoja y, abajo, volver por un lado y la
 * foto por el otro: cambiarla y cuánto se ve.
 */
export function App() {
  const app = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  /** Lo mismo que en Referencia: sin esperar a IndexedDB parpadea el inicio. */
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState(loadSession)
  // La cámara se pide recién con la foto puesta: primero se dice qué es esto.
  const camera = useCamera(video, photo !== null)
  const stage = useStageSize(app)

  useWakeLock(camera.status === 'lista')
  // Sin foto no hay nada abajo de los controles que valga la pena destapar.
  const idle = useIdle(IDLE_MS, photo !== null)

  useEffect(() => {
    let cancelled = false
    void loadArtwork('mesa').then((saved) => {
      if (cancelled) return
      if (saved) setPhoto(saved)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Con respiro: arrastrar una esquina dispara cambios a sesenta por segundo.
  useEffect(() => {
    const id = window.setTimeout(() => saveSession(session), 300)
    return () => window.clearTimeout(id)
  }, [session])

  const choose = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Vaciar el input: si no, elegir dos veces la misma foto no dispara el cambio.
    event.target.value = ''
    if (!file) return
    try {
      const { src } = await loadArtworkFile(file)
      setPhoto(src)
      // Otra foto trae otra proporción: las esquinas de la anterior la deformarían.
      setSession((s) => ({ ...s, corners: null }))
      void saveArtwork('mesa', src)
    } catch {
      // Un archivo que no se puede abrir no rompe nada: queda la foto de antes.
    }
  }, [])

  const pickFile = useCallback(() => fileRef.current?.click(), [])
  const setCorners = useCallback((corners: Quad | null) => {
    setSession((s) => ({ ...s, corners }))
  }, [])

  const trouble = camera.status !== 'lista' && camera.status !== 'pidiendo'

  return (
    <div
      ref={app}
      className={'app ds' + (photo ? ' has-photo' : '')}
      data-idle={idle || undefined}
    >
      <h1 className="ds-sr">{copy.mesa.name}</h1>

      {photo ? (
        <>
          {/* muted + playsInline: sin los dos, el celular se niega a arrancar solo. */}
          <video className="camera" ref={video} autoPlay muted playsInline />

          {stage && (
            <Overlay
              src={photo}
              opacity={session.opacity}
              corners={session.corners}
              stage={stage}
              onChange={setCorners}
            />
          )}

          {trouble && <Trouble status={camera.status} onRetry={camera.retry} />}

          <div className="controls">
            {/* Solo si hay algo que deshacer: un botón que no cambiaría nada es un
                botón que hay que leer para nada. */}
            {session.corners && (
              <div className="reset">
                <Button variant="quiet" onClick={() => setCorners(null)}>
                  {copy.mesa.reset}
                </Button>
              </div>
            )}

            {/* Volver por un lado, la foto por el otro: son de dos conversaciones
                distintas y no se tocan por error una por la otra. */}
            <div className="bottombar">
              <nav className="pill">
                <IconButton label={copy.app.back} onClick={goBack}>
                  <BackIcon />
                </IconButton>
              </nav>
              <nav className="pill dock">
                <IconButton label={copy.mesa.change} onClick={pickFile}>
                  <PhotoIcon />
                </IconButton>
                <Slider
                  label={copy.mesa.opacity}
                  value={Math.round(session.opacity * 100)}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => setSession((s) => ({ ...s, opacity: v / 100 }))}
                  format={(v) => fill(copy.mesa.opacityValue, { n: v })}
                />
              </nav>
            </div>
          </div>
        </>
      ) : (
        ready && (
          <>
            {/* La pantalla de inicio de Referencia, con el texto de la mesa. */}
            <div className="welcome">
              <div className="welcome-text">
                <h2>{copy.welcome.greeting}</h2>
                <p>{copy.mesa.intro}</p>
                <p>{copy.mesa.hint}</p>
              </div>
              <Button variant="loud" icon={<UploadIcon />} onClick={pickFile}>
                {copy.welcome.upload}
              </Button>
            </div>

            <div className="welcome-bottombar">
              <nav className="tabbar">
                <IconButton label={copy.app.back} onClick={goBack}>
                  <BackIcon />
                </IconButton>
              </nav>
              <a
                className="ds-link"
                href={copy.welcome.suggestionsUrl}
                onClick={(e) => openInstagram(e, copy.welcome.suggestionsUrl)}
              >
                {copy.welcome.suggestions}
              </a>
            </div>
          </>
        )
      )}

      {/* Uno solo: lo usan la bienvenida y el botón de cambiar foto. */}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={choose} />
    </div>
  )
}

/**
 * Lo único que se explica sin que nadie lo pida: qué pasó con la cámara. Una
 * pantalla negra sin motivo es peor que un cartel.
 */
function Trouble({ status, onRetry }: { status: CameraStatus; onRetry: () => void }) {
  if (status === 'insegura') {
    return (
      <div className="card trouble">
        <p>{copy.mesa.insecure}</p>
        <a className="ds-button ds-button--quiet" href={copy.mesa.siteUrl}>
          {copy.mesa.openSite}
        </a>
      </div>
    )
  }

  return (
    <div className="card trouble">
      <p>{status === 'denegada' ? copy.mesa.denied : copy.mesa.noCamera}</p>
      <Button variant="quiet" onClick={onRetry}>
        {copy.mesa.retry}
      </Button>
    </div>
  )
}

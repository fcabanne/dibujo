import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MutableRefObject,
  type RefObject,
} from 'react'
import { copy, fill } from '../shared/copy'
import { loadArtworkFile } from '../shared/imageFile'
import { loadArtwork, saveArtwork } from '../shared/imageStore'
import { openInstagram } from '../shared/suggestions'
import { useCamera, type CameraStatus, type Facing } from '../shared/useCamera'
import {
  BackIcon,
  Button,
  CameraIcon,
  FlashlightIcon,
  FlipCameraIcon,
  IconButton,
  PhotoIcon,
  Slider,
  UploadIcon,
} from '../shared/ui'
import { CANONICAL } from '../shared/loomis/canonical'
import { detectFaces, detectFrame, prepareVideo, preload, type DetectedFace } from '../shared/loomis/detect'
import { focal35 } from '../shared/loomis/exif'
import { estimateLens, solveHeads } from '../shared/loomis/head'
import { drawLoomis } from '../shared/loomis/loomis'
import {
  LENS_MAX,
  LENS_MIN,
  project,
  type Camera,
  type Pose,
} from '../shared/loomis/pose'

const goBack = () => (window.location.href = '../')

/**
 * Lo que se recuerda aparte de la foto: la lente que anotó la cámara —el EXIF se
 * pierde al reescalar la foto— y cuánto se ve la foto.
 */
const SETTINGS_KEY = 'dibujo:cabeza'

interface Settings {
  /** La focal equivalente a 35 mm que trajo el archivo, si la trajo. */
  cameraLens: number | null
  /** Cuánto se ve la foto, de 0 a 100. */
  opacity: number
}

function loadSettings(): Settings {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? '{}')
    return {
      cameraLens: saved.cameraLens > 0 ? saved.cameraLens : null,
      opacity: saved.opacity >= 0 && saved.opacity <= 100 ? saved.opacity : 100,
    }
  } catch {
    return { cameraLens: null, opacity: 100 }
  }
}

function saveSettings(settings: Settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Sin localStorage la próxima vez se estima la lente y la foto se ve entera.
  }
}

/**
 * Guardar la foto nueva y recargar la página entera.
 *
 * A propósito: arrancar de cero con cada foto deja limpio el detector, la lente y
 * todo lo que la foto anterior hubiera dejado a medio camino. La foto y la lente
 * quedan guardadas y la página las levanta al volver.
 */
async function replacePhoto(src: string, cameraLens: number | null) {
  await saveArtwork('cabeza', src)
  saveSettings({ ...loadSettings(), cameraLens })
  window.location.reload()
}

/** Lado mayor de la foto que se saca con la cámara: el mismo tope que al subir una. */
const MAX_SIDE = 2000
/** El aire entre la foto y los bordes, y entre la foto y los controles. */
const GUTTER = 16
/** La lente con la que arranca la cámara en vivo hasta estimar la suya. */
const DEFAULT_CAMERA_LENS = 26

type Status = 'idle' | 'looking' | 'ready' | 'none' | 'failed'
type Mode = 'photo' | 'camera'

/** El slider de la lente va en escala logarítmica: un paso es siempre "un poco más". */
const toSlider = (mm: number) =>
  Math.round((100 * Math.log(mm / LENS_MIN)) / Math.log(LENS_MAX / LENS_MIN))
const fromSlider = (v: number) => LENS_MIN * Math.pow(LENS_MAX / LENS_MIN, v / 100)

/** `?puntos` en la dirección: los puntos detectados y los de la cara modelo, para revisar el calce. */
const SHOW_POINTS = new URLSearchParams(window.location.search).has('puntos')

/**
 * Cabeza: la foto de una persona —o la cámara en vivo— con la cabeza de Loomis
 * encima, girada como la cabeza de la foto y en la perspectiva de su lente.
 *
 * Abajo, como en la mesa de luz: volver por un lado y, por el otro, la foto, la
 * cámara y cuánto se ve la imagen de abajo. La lente vive en el cajón de la foto,
 * con su miniatura, como la foto en Referencia.
 */
export function App() {
  const fileRef = useRef<HTMLInputElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const captureRef = useRef<() => void>(() => {})
  const [photo, setPhoto] = useState<string | null>(null)
  /** Lo mismo que en Referencia: sin esperar a IndexedDB parpadea el inicio. */
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState(loadSettings)
  const [mode, setMode] = useState<Mode>('photo')
  const [drawer, setDrawer] = useState(false)
  const [facing, setFacing] = useState<Facing>('user')
  /** La lente que eligió a mano quien la usa; null mientras no la toque. */
  const [manualLens, setManualLens] = useState<number | null>(null)

  const camera = useCamera(videoRef, mode === 'camera', facing)

  useEffect(() => {
    preload()
    let cancelled = false
    void loadArtwork('cabeza').then((saved) => {
      if (cancelled) return
      setPhoto(saved)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Con respiro: el slider dispara cambios a sesenta por segundo.
  useEffect(() => {
    const id = window.setTimeout(() => saveSettings(settings), 300)
    return () => window.clearTimeout(id)
  }, [settings])

  const { image, faces, status, guessedLens } = usePhotoFaces(mode === 'photo' ? photo : null)

  const autoLens = settings.cameraLens ?? guessedLens
  const lens = manualLens ?? autoLens ?? 50

  const choose = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      // El EXIF se lee del archivo original: el reescalado lo pierde.
      const [mm, { src }] = await Promise.all([focal35(file), loadArtworkFile(file)])
      await replacePhoto(src, mm)
    } catch {
      // Un archivo que no se puede abrir no rompe nada: queda la foto de antes.
    }
  }, [])

  const pickFile = useCallback(() => fileRef.current?.click(), [])

  const showPhoto = useCallback(() => {
    if (!photo) {
      pickFile()
      return
    }
    if (mode === 'camera') {
      setMode('photo')
      setDrawer(false)
    } else {
      setDrawer((open) => !open)
    }
  }, [photo, mode, pickFile])

  const toggleCamera = useCallback(() => {
    setDrawer(false)
    setManualLens(null)
    setMode((m) => (m === 'camera' ? 'photo' : 'camera'))
  }, [])

  const lensSource =
    manualLens !== null
      ? copy.cabeza.lensManual
      : settings.cameraLens
        ? copy.cabeza.lensCamera
        : copy.cabeza.lensGuess

  const message =
    mode !== 'photo'
      ? null
      : status === 'looking'
        ? copy.cabeza.looking
        : status === 'none'
          ? copy.cabeza.noFace
          : status === 'failed'
            ? copy.cabeza.failed
            : null

  const welcome = mode === 'photo' && !photo

  return (
    <div className={'app ds' + (welcome ? '' : ' has-photo')}>
      <h1 className="ds-sr">{copy.cabeza.name}</h1>

      {welcome ? (
        ready && (
          <>
            <div className="welcome">
              <div className="welcome-text">
                <h2>{copy.welcome.greeting}</h2>
                <p>{copy.cabeza.intro}</p>
              </div>
              <div className="welcome-actions">
                <Button variant="loud" icon={<UploadIcon />} onClick={pickFile}>
                  {copy.welcome.upload}
                </Button>
                <Button variant="quiet" icon={<CameraIcon />} onClick={toggleCamera}>
                  {copy.cabeza.useCamera}
                </Button>
              </div>
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
      ) : (
        <>
          {mode === 'photo' && image && (
            <PhotoStage
              image={image}
              faces={faces}
              lens={lens}
              opacity={settings.opacity / 100}
              controls={controlsRef}
            />
          )}

          {/* muted + playsInline: sin los dos, el celular se niega a arrancar solo. */}
          {mode === 'camera' && (
            <>
              <video className="camera" ref={videoRef} autoPlay muted playsInline />
              {camera.status === 'lista' && (
                <CameraStage
                  video={videoRef}
                  mirror={facing === 'user'}
                  opacity={settings.opacity / 100}
                  capture={captureRef}
                />
              )}
              {camera.status !== 'lista' && camera.status !== 'pidiendo' && (
                <Trouble status={camera.status} onRetry={camera.retry} />
              )}
            </>
          )}

          {message && <p className="pill status">{message}</p>}

          <div className="controls" ref={controlsRef}>
            {mode === 'photo' && drawer && photo && (
              <div className="card drawer">
                <div className="drawer-photo">
                  <div className="thumb">
                    <img src={photo} alt="" />
                  </div>
                  <p className="photo-meta">{lensSource}</p>
                </div>
                <div className="field-row">
                  <span className="field-name">{copy.cabeza.lens}</span>
                  <Slider
                    label={copy.cabeza.lens}
                    value={toSlider(lens)}
                    min={0}
                    max={100}
                    step={1}
                    disabled={!faces.length}
                    onChange={(v) => setManualLens(fromSlider(v))}
                    // En la posición de la lente actual, su número exacto: el slider
                    // tiene cien pasos y redondeado diría otro.
                    format={(v) =>
                      fill(copy.cabeza.lensValue, {
                        n: Math.round(v === toSlider(lens) ? lens : fromSlider(v)),
                      })
                    }
                  />
                </div>
                <div className="drawer-actions">
                  {manualLens !== null && autoLens !== null && (
                    <Button variant="quiet" onClick={() => setManualLens(null)}>
                      {fill(copy.cabeza.reset, {
                        source: settings.cameraLens ? copy.cabeza.fromCamera : copy.cabeza.estimated,
                      })}
                    </Button>
                  )}
                  <Button variant="quiet" icon={<UploadIcon />} onClick={pickFile}>
                    {copy.cabeza.change}
                  </Button>
                </div>
              </div>
            )}

            {/* La cámara: dar vuelta, sacar la foto y el flash, cada uno a mano. */}
            {mode === 'camera' && camera.status === 'lista' && (
              <div className="shutter">
                <nav className="pill">
                  <IconButton
                    label={copy.cabeza.flip}
                    onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
                  >
                    <FlipCameraIcon />
                  </IconButton>
                  <Button variant="loud" onClick={() => captureRef.current()}>
                    {copy.cabeza.shoot}
                  </Button>
                  {camera.torchSupported && (
                    <IconButton
                      label={camera.torch ? copy.cabeza.torchOff : copy.cabeza.torchOn}
                      selected={camera.torch}
                      onClick={camera.toggleTorch}
                    >
                      <FlashlightIcon />
                    </IconButton>
                  )}
                </nav>
              </div>
            )}

            <div className="bottombar">
              <nav className="pill">
                <IconButton label={copy.app.back} onClick={goBack}>
                  <BackIcon />
                </IconButton>
              </nav>
              <nav className="pill dock">
                <IconButton
                  label={copy.cabeza.photo}
                  selected={mode === 'photo' && drawer}
                  onClick={showPhoto}
                >
                  <PhotoIcon />
                </IconButton>
                <IconButton
                  label={copy.cabeza.camera}
                  selected={mode === 'camera'}
                  onClick={toggleCamera}
                >
                  <CameraIcon />
                </IconButton>
                <Slider
                  label={copy.cabeza.opacity}
                  value={settings.opacity}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => setSettings((s) => ({ ...s, opacity: v }))}
                  format={(v) => fill(copy.cabeza.opacityValue, { n: v })}
                />
              </nav>
            </div>
          </div>
        </>
      )}

      {/* En el celular, image/* ofrece también sacar la foto con la app de la cámara. */}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={choose} />
    </div>
  )
}

/** De la foto a las caras: cargarla como imagen, pasarla por el detector y estimar la lente. */
function usePhotoFaces(photo: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [faces, setFaces] = useState<DetectedFace[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [guessedLens, setGuessedLens] = useState<number | null>(null)

  useEffect(() => {
    if (!photo) return
    let cancelled = false
    setStatus('looking')
    const img = new Image()
    img.onload = async () => {
      if (cancelled) return
      setImage(img)
      try {
        const found = await detectFaces(img)
        if (cancelled) return
        setFaces(found)
        setStatus(found.length ? 'ready' : 'none')
        // La estimación es la parte cara —treinta lentes por cara—: una vez por foto.
        if (found.length) {
          const w = img.naturalWidth
          const h = img.naturalHeight
          setGuessedLens(estimateLens(found, w, h))
        }
      } catch {
        if (!cancelled) setStatus('failed')
      }
    }
    img.src = photo
    return () => {
      cancelled = true
    }
  }, [photo])

  return { image, faces, status, guessedLens }
}

interface PaintInput {
  source: CanvasImageSource
  width: number
  height: number
  /** contain: la foto entera arriba de los controles. cover: la cámara, de borde a borde. */
  fit: 'contain' | 'cover'
  /** Dónde arrancan los controles, en píxeles desde arriba: la foto entera va arriba de eso. */
  bottom: number
  opacity: number
  mirror: boolean
  cam: Camera
  poses: Pose[]
  faces: DetectedFace[]
}

/**
 * Pinta la imagen y las cabezas. Lo usan la foto y la cámara: la imagen entra
 * encajada o de borde a borde, y la cabeza va en las mismas coordenadas.
 */
function paint(canvas: HTMLCanvasElement, input: PaintInput) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = window.innerWidth
  const h = window.innerHeight
  const dpr = window.devicePixelRatio || 1
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const { width: iw, height: ih } = input
  let scale: number
  let x: number
  let y: number
  if (input.fit === 'cover') {
    scale = Math.max(w / iw, h / ih)
    x = (w - iw * scale) / 2
    y = (h - ih * scale) / 2
  } else {
    const top = GUTTER
    const boxW = w - GUTTER * 2
    const boxH = Math.max(1, input.bottom - GUTTER - top)
    scale = Math.min(boxW / iw, boxH / ih)
    x = (w - iw * scale) / 2
    y = top + (boxH - ih * scale) / 2
  }

  ctx.save()
  ctx.translate(x, y)
  if (input.mirror) {
    // La de adelante se muestra como un espejo, que es como uno espera verse.
    ctx.translate(iw * scale, 0)
    ctx.scale(-1, 1)
  }
  ctx.globalAlpha = input.opacity
  ctx.drawImage(input.source, 0, 0, iw * scale, ih * scale)
  ctx.globalAlpha = 1
  // Recortar a la imagen: una cabeza cortada por el borde no tiene que pintar el fondo.
  ctx.beginPath()
  ctx.rect(0, 0, iw * scale, ih * scale)
  ctx.clip()

  // Lápiz sobre papel: la línea oscura, con un halo del color del papel para que se
  // lea también sobre una cara oscura. Con la foto apagada queda el dibujo solo.
  const styles = getComputedStyle(canvas)
  const style = {
    color: styles.getPropertyValue('--ds-black').trim() || '#000',
    halo: styles.getPropertyValue('--ds-background').trim() || '#fff',
    width: 1.6,
  }
  for (const pose of input.poses) drawLoomis(ctx, input.cam, pose, scale, style)

  if (SHOW_POINTS) {
    input.faces.forEach((face, k) => {
      for (let i = 0; i < 468; i++) {
        // Rojo lo que vio el detector, cian dónde cae la cara modelo con esta pose.
        const [u, v] = project(input.cam, input.poses[k], [
          CANONICAL[i * 3],
          CANONICAL[i * 3 + 1],
          CANONICAL[i * 3 + 2],
        ])
        ctx.fillStyle = '#0ff'
        ctx.fillRect(u * scale - 1, v * scale - 1, 2, 2)
        ctx.fillStyle = '#f00'
        ctx.fillRect(face.points[i * 2] * scale - 1, face.points[i * 2 + 1] * scale - 1, 2, 2)
      }
    })
  }
  ctx.restore()
}

/** La foto encajada arriba de los controles —y del cajón, si está abierto—, y las cabezas encima. */
function PhotoStage({
  image,
  faces,
  lens,
  opacity,
  controls,
}: {
  image: HTMLImageElement
  faces: DetectedFace[]
  lens: number
  opacity: number
  controls: RefObject<HTMLDivElement>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const iw = image.naturalWidth
  const ih = image.naturalHeight
  const solved = useMemo(() => solveHeads(faces, lens, iw, ih), [faces, lens, iw, ih])

  useEffect(() => {
    const canvas = canvasRef.current
    const bar = controls.current
    if (!canvas) return
    const draw = () =>
      paint(canvas, {
        source: image,
        width: iw,
        height: ih,
        fit: 'contain',
        bottom: bar?.getBoundingClientRect().top ?? window.innerHeight,
        opacity,
        mirror: false,
        cam: solved.cam,
        poses: solved.poses,
        faces,
      })
    draw()
    // El cajón cambia el alto de los controles al abrirse: la foto se acomoda arriba
    // en el mismo cuadro, sin esperar al siguiente.
    const observer = new ResizeObserver(draw)
    if (bar) observer.observe(bar)
    window.addEventListener('resize', draw)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', draw)
    }
  }, [image, iw, ih, solved, faces, opacity, controls])

  return <canvas ref={canvasRef} className="stage" />
}

/**
 * La cámara en vivo: en cada cuadro nuevo se busca la cara y se dibuja la cabeza.
 *
 * Todo pasa en el bucle de `requestAnimationFrame` y no en el estado de React: son
 * treinta cuadros por segundo. La lente se estima una vez, con la primera cara que
 * aparece, y se queda; hasta entonces, la de un celular típico.
 */
function CameraStage({
  video,
  mirror,
  opacity,
  capture,
}: {
  video: RefObject<HTMLVideoElement>
  mirror: boolean
  opacity: number
  capture: MutableRefObject<() => void>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let frame = 0
    let last = -1
    let lens: number | null = null
    let faces: DetectedFace[] = []
    let cancelled = false
    void prepareVideo().catch(() => {})

    const loop = () => {
      frame = requestAnimationFrame(loop)
      const v = video.current
      const canvas = canvasRef.current
      if (!v || !canvas || v.readyState < 2 || !v.videoWidth) return
      const w = v.videoWidth
      const h = v.videoHeight
      if (v.currentTime !== last) {
        last = v.currentTime
        faces = detectFrame(v, performance.now()) ?? faces
        if (lens === null && faces.length) {
          lens = estimateLens(faces, w, h)
        }
      }
      const solved = solveHeads(faces, lens ?? DEFAULT_CAMERA_LENS, w, h)
      paint(canvas, {
        source: v,
        width: w,
        height: h,
        fit: 'cover',
        bottom: window.innerHeight,
        opacity,
        mirror,
        cam: solved.cam,
        poses: solved.poses,
        faces,
      })
    }
    frame = requestAnimationFrame(loop)

    // Sacar la foto: el cuadro tal como se ve —en espejo si es la de adelante—, al
    // mismo tope que una foto subida, y se recarga con ella.
    capture.current = () => {
      const v = video.current
      if (!v || !v.videoWidth || cancelled) return
      const scale = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight))
      const out = document.createElement('canvas')
      out.width = Math.round(v.videoWidth * scale)
      out.height = Math.round(v.videoHeight * scale)
      const ctx = out.getContext('2d')
      if (!ctx) return
      if (mirror) {
        ctx.translate(out.width, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(v, 0, 0, out.width, out.height)
      // Sin EXIF: la lente de esta foto se vuelve a estimar al abrirla.
      void replacePhoto(out.toDataURL('image/jpeg', 0.92), null)
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      capture.current = () => {}
    }
  }, [video, mirror, opacity, capture])

  return <canvas ref={canvasRef} className="stage" />
}

/** Lo único que se explica sin que nadie lo pida: qué pasó con la cámara. */
function Trouble({ status, onRetry }: { status: CameraStatus; onRetry: () => void }) {
  return (
    <div className="card trouble">
      <p>
        {status === 'insegura'
          ? copy.cabeza.insecure
          : status === 'denegada'
            ? copy.cabeza.denied
            : copy.cabeza.noCamera}
      </p>
      {status !== 'insegura' && (
        <Button variant="quiet" onClick={onRetry}>
          {copy.cabeza.retry}
        </Button>
      )}
    </div>
  )
}

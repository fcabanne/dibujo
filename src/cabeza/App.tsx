import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { copy, fill } from '../shared/copy'
import { loadArtworkFile } from '../shared/imageFile'
import { loadArtwork, saveArtwork } from '../shared/imageStore'
import { openInstagram } from '../shared/suggestions'
import { BackIcon, Button, IconButton, PhotoIcon, Slider, UploadIcon } from '../shared/ui'
import { detectFaces, preload, type DetectedFace } from './detect'
import { focal35 } from './exif'
import { drawLoomis } from './loomis'
import {
  LENS_MAX,
  LENS_MIN,
  MEDIAPIPE_VFOV,
  fitLens,
  focalPx,
  rescale,
  solvePose,
  type Camera,
  type Pose,
} from './pose'

const goBack = () => (window.location.href = '../')

/** La lente que anotó la cámara, para la próxima vez: el EXIF se pierde al reescalar. */
const LENS_KEY = 'dibujo:cabeza:lente'

/** Lo que tapa la barra de abajo: la foto se encaja arriba de ella. */
const BAR_SPACE = 88
const GUTTER = 16

type Status = 'idle' | 'looking' | 'ready' | 'none' | 'failed'

/** El slider va en escala logarítmica: de 14 a 200 mm, un paso es siempre "un poco más". */
const toSlider = (mm: number) =>
  Math.round((100 * Math.log(mm / LENS_MIN)) / Math.log(LENS_MAX / LENS_MIN))
const fromSlider = (v: number) => LENS_MIN * Math.pow(LENS_MAX / LENS_MIN, v / 100)

/**
 * Cabeza: la foto de una persona con la cabeza de Loomis encima, girada como la
 * cabeza de la foto y en la perspectiva de su lente.
 *
 * Prueba de concepto: sin la mitad del pulido de las otras. La foto, la cabeza y la
 * lente; nada más.
 */
export function App() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [faces, setFaces] = useState<DetectedFace[]>([])
  const [status, setStatus] = useState<Status>('idle')
  /** La lente que anotó la cámara, si la anotó. */
  const [cameraLens, setCameraLens] = useState<number | null>(null)
  /** La que se estimó mirando la cara. */
  const [guessedLens, setGuessedLens] = useState<number | null>(null)
  /** La que eligió a mano quien la usa; null mientras no la toque. */
  const [manualLens, setManualLens] = useState<number | null>(null)

  useEffect(() => {
    preload()
    let cancelled = false
    void loadArtwork('cabeza').then((saved) => {
      if (cancelled) return
      if (saved) {
        setPhoto(saved)
        try {
          const mm = Number(window.localStorage.getItem(LENS_KEY))
          setCameraLens(mm > 0 ? mm : null)
        } catch {
          // Sin localStorage, se estima.
        }
      }
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // De la foto a las caras: cargarla como imagen y pasarla por el detector.
  useEffect(() => {
    if (!photo) return
    let cancelled = false
    setStatus('looking')
    // Lo de la foto anterior se va enseguida: nada de cabezas viejas sobre la nueva.
    setImage(null)
    setFaces([])
    setGuessedLens(null)
    const img = new Image()
    img.onload = async () => {
      if (cancelled) return
      setImage(img)
      try {
        const found = await detectFaces(img)
        if (cancelled) return
        setFaces(found)
        setStatus(found.length ? 'ready' : 'none')
      } catch {
        if (!cancelled) setStatus('failed')
      }
    }
    img.src = photo
    return () => {
      cancelled = true
    }
  }, [photo])

  const width = image?.naturalWidth ?? 1
  const height = image?.naturalHeight ?? 1
  const baseCam: Camera = useMemo(() => ({ f: 1, cx: width / 2, cy: height / 2 }), [width, height])

  // La estimación es la parte cara —treinta lentes por cara—, así que va una vez por foto.
  useEffect(() => {
    if (!faces.length) return
    setGuessedLens(fitLens(faces, baseCam, width, height))
  }, [faces, baseCam, width, height])

  const autoLens = cameraLens ?? guessedLens
  const lens = manualLens ?? autoLens ?? 50

  const poses = useMemo(() => {
    const f = focalPx(lens, width, height)
    const startF = height / 2 / Math.tan(MEDIAPIPE_VFOV / 2)
    return faces.map(
      (face) => solvePose(face.points, { ...baseCam, f }, rescale(face.start, startF, f)).pose,
    )
  }, [faces, lens, baseCam, width, height])

  const choose = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      // El EXIF se lee del archivo original: el reescalado lo pierde.
      const [mm, { src }] = await Promise.all([focal35(file), loadArtworkFile(file)])
      setCameraLens(mm)
      setManualLens(null)
      setPhoto(src)
      void saveArtwork('cabeza', src)
      try {
        if (mm) window.localStorage.setItem(LENS_KEY, String(mm))
        else window.localStorage.removeItem(LENS_KEY)
      } catch {
        // Sin localStorage, la próxima vez se estima.
      }
    } catch {
      // Un archivo que no se puede abrir no rompe nada: queda la foto de antes.
    }
  }, [])

  const pickFile = useCallback(() => fileRef.current?.click(), [])

  const lensLabel = (mm: number) => {
    const n = Math.round(mm)
    if (manualLens !== null) return fill(copy.cabeza.lensValue, { n })
    if (cameraLens) return fill(copy.cabeza.lensCamera, { n })
    return fill(copy.cabeza.lensGuess, { n })
  }

  const message =
    status === 'looking'
      ? copy.cabeza.looking
      : status === 'none'
        ? copy.cabeza.noFace
        : status === 'failed'
          ? copy.cabeza.failed
          : null

  return (
    <div className={'app ds' + (photo ? ' has-photo' : '')}>
      <h1 className="ds-sr">{copy.cabeza.name}</h1>

      {photo ? (
        <>
          {image && <Stage image={image} poses={poses} cam={{ ...baseCam, f: focalPx(lens, width, height) }} />}

          {/* Recargar la página entera: en el celular no hay otra forma a mano de
              traer la última versión, ni de empezar de cero si algo se trabó. */}
          <div className="topbar">
            <Button variant="quiet" onClick={() => window.location.reload()}>
              {copy.cabeza.reload}
            </Button>
          </div>

          {message && <p className="pill status">{message}</p>}

          <div className="controls">
            {manualLens !== null && autoLens !== null && (
              <div className="reset">
                <Button variant="quiet" onClick={() => setManualLens(null)}>
                  {fill(copy.cabeza.reset, {
                    source: cameraLens ? copy.cabeza.fromCamera : copy.cabeza.estimated,
                  })}
                </Button>
              </div>
            )}
            <div className="bottombar">
              <nav className="pill">
                <IconButton label={copy.app.back} onClick={goBack}>
                  <BackIcon />
                </IconButton>
              </nav>
              <nav className="pill dock">
                <IconButton label={copy.cabeza.change} onClick={pickFile}>
                  <PhotoIcon />
                </IconButton>
                <Slider
                  label={copy.cabeza.lens}
                  value={toSlider(lens)}
                  min={0}
                  max={100}
                  step={1}
                  disabled={!faces.length}
                  onChange={(v) => setManualLens(fromSlider(v))}
                  format={(v) => lensLabel(fromSlider(v))}
                />
              </nav>
            </div>
          </div>
        </>
      ) : (
        ready && (
          <>
            <div className="welcome">
              <div className="welcome-text">
                <h2>{copy.welcome.greeting}</h2>
                <p>{copy.cabeza.intro}</p>
                <p>{copy.cabeza.hint}</p>
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

      {/* En el celular, image/* ofrece también sacar la foto en el momento. */}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={choose} />
    </div>
  )
}

/** La foto encajada arriba de la barra, y las cabezas encima. */
function Stage({ image, poses, cam }: { image: HTMLImageElement; poses: Pose[]; cam: Camera }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size.w * dpr)
    canvas.height = Math.round(size.h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)

    const iw = image.naturalWidth
    const ih = image.naturalHeight
    const boxW = size.w - GUTTER * 2
    const boxH = size.h - GUTTER - BAR_SPACE
    const scale = Math.min(boxW / iw, boxH / ih)
    const x = (size.w - iw * scale) / 2
    const y = GUTTER + (boxH - ih * scale) / 2

    ctx.drawImage(image, x, y, iw * scale, ih * scale)
    ctx.save()
    ctx.translate(x, y)
    // Recortar a la foto: una cabeza cortada por el borde no tiene que pintar el fondo.
    ctx.beginPath()
    ctx.rect(0, 0, iw * scale, ih * scale)
    ctx.clip()
    const styles = getComputedStyle(canvas)
    for (const pose of poses) {
      drawLoomis(ctx, cam, pose, scale, {
        color: styles.getPropertyValue('--ds-white').trim() || '#fff',
        halo: styles.getPropertyValue('--ds-black').trim() || '#000',
        width: 1.6,
      })
    }
    ctx.restore()
  }, [image, poses, cam, size])

  return <canvas ref={canvasRef} className="stage" style={{ width: size.w, height: size.h }} />
}

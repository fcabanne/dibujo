import { useEffect, useRef, useState } from 'react'
import { copy } from '../../shared/copy'
import { detectFrame, prepareVideo, type DetectedFace } from '../../shared/loomis/detect'
import { estimateLens, paintHeads, solveHeads } from '../../shared/loomis/head'
import { useCamera, type CameraStatus, type Facing } from '../../shared/useCamera'
import {
  Button,
  CloseIcon,
  FlashlightIcon,
  FlipCameraIcon,
  IconButton,
} from '../../shared/ui'
import { lineWidthFor } from '../render/grid'
import type { AppState } from '../types'

/** Si este navegador puede prestar una cámara: https, y no un archivo abierto con doble clic. */
export const canUseCamera =
  window.location.protocol !== 'file:' &&
  window.isSecureContext &&
  typeof navigator.mediaDevices?.getUserMedia === 'function'

/** La lente con la que arranca el visor hasta estimar la suya con la primera cara. */
const DEFAULT_LENS = 26

/**
 * Sacar la foto de referencia con la cámara, sin salir de Referencia.
 *
 * Un visor a pantalla completa: la cámara en vivo y, si la cabeza está prendida, el
 * Loomis encima en cada cuadro, para encuadrar la pose antes de sacar. La foto que
 * sale entra como cualquier foto subida (`onCapture`), así que después se trabaja
 * igual: grilla, cabeza, ajustes, export.
 *
 * La detección corre en el bucle de `requestAnimationFrame` y no en el estado de
 * React: son treinta cuadros por segundo. La de adelante se ve, y se saca, en espejo.
 */
export function CameraCapture({
  head,
  onCapture,
  onClose,
}: {
  head: AppState['head']
  onCapture: (file: File) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [facing, setFacing] = useState<Facing>('user')
  const camera = useCamera(videoRef, true, facing)
  const mirror = facing === 'user'
  const headRef = useRef(head)
  headRef.current = head

  useEffect(() => {
    if (camera.status !== 'lista') return
    let frame = 0
    let last = -1
    let lens: number | null = null
    let faces: DetectedFace[] = []
    const wantsHead = () => headRef.current.mode !== 'none'
    if (wantsHead()) void prepareVideo().catch(() => {})

    const loop = () => {
      frame = requestAnimationFrame(loop)
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!video || !canvas || !ctx || video.readyState < 2 || !video.videoWidth) return
      const vw = video.videoWidth
      const vh = video.videoHeight

      if (wantsHead() && video.currentTime !== last) {
        last = video.currentTime
        faces = detectFrame(video, performance.now()) ?? faces
        if (lens === null && faces.length) lens = estimateLens(faces, vw, vh)
      }

      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // De borde a borde, como cualquier cámara.
      const scale = Math.max(w / vw, h / vh)
      const rect = { x: (w - vw * scale) / 2, y: (h - vh * scale) / 2, w: vw * scale, h: vh * scale }
      ctx.save()
      if (mirror) {
        ctx.translate(w, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(video, rect.x, rect.y, rect.w, rect.h)
      const style = headRef.current.style
      if (wantsHead() && faces.length) {
        paintHeads(ctx, rect, solveHeads(faces, lens ?? DEFAULT_LENS, vw, vh), {
          color: style.color,
          opacity: style.opacity,
          lineWidth: lineWidthFor(rect, style),
        })
      }
      ctx.restore()
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [camera.status, mirror])

  // Escape cierra, como cualquier capa encima de la herramienta.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /** El cuadro tal como se ve —en espejo si es la de adelante—, a la resolución de la cámara. */
  const shoot = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const out = document.createElement('canvas')
    out.width = video.videoWidth
    out.height = video.videoHeight
    const ctx = out.getContext('2d')
    if (!ctx) return
    if (mirror) {
      ctx.translate(out.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)
    out.toBlob(
      (blob) => {
        if (!blob) return
        const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
        onCapture(new File([blob], `camara-${stamp}.jpg`, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92,
    )
  }

  return (
    <div className="camera-capture ds">
      {/* muted + playsInline: sin los dos, el celular se niega a arrancar solo. El
          video no se ve: lo pinta el lienzo, con la cabeza encima. */}
      <video ref={videoRef} autoPlay muted playsInline />
      <canvas ref={canvasRef} />

      {camera.status !== 'lista' && camera.status !== 'pidiendo' && (
        <Trouble status={camera.status} onRetry={camera.retry} />
      )}

      <div className="camera-bar">
        <nav className="tabbar">
          <IconButton label={copy.camera.close} onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </nav>
        {camera.status === 'lista' && (
          <nav className="tabbar">
            <IconButton
              label={copy.camera.flip}
              onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
            >
              <FlipCameraIcon />
            </IconButton>
            <Button variant="loud" onClick={shoot}>
              {copy.camera.shoot}
            </Button>
            {camera.torchSupported && (
              <IconButton
                label={camera.torch ? copy.camera.torchOff : copy.camera.torchOn}
                selected={camera.torch}
                onClick={camera.toggleTorch}
              >
                <FlashlightIcon />
              </IconButton>
            )}
          </nav>
        )}
      </div>
    </div>
  )
}

/** Lo único que se explica sin que nadie lo pida: qué pasó con la cámara. */
function Trouble({ status, onRetry }: { status: CameraStatus; onRetry: () => void }) {
  return (
    <div className="camera-trouble">
      <p>
        {status === 'insegura'
          ? copy.camera.insecure
          : status === 'denegada'
            ? copy.camera.denied
            : copy.camera.noCamera}
      </p>
      {status !== 'insegura' && (
        <Button variant="quiet" onClick={onRetry}>
          {copy.camera.retry}
        </Button>
      )}
    </div>
  )
}

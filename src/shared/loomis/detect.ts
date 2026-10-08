import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import { fromMediaPipe, type Landmarks, type Pose } from './pose'

/**
 * Encontrar las caras: MediaPipe Face Landmarker, corriendo en el navegador.
 *
 * El modelo y el WebAssembly se sirven desde el mismo sitio (`public/caras/`), no
 * desde un CDN de terceros: la foto no sale de la máquina y la herramienta no
 * depende de que otro siga publicando sus archivos. Pesan unos quince megas, así
 * que se bajan recién la primera vez que se busca una cara.
 *
 * Abierta como archivo suelto (`file://`) no hay de dónde bajarlos: `canDetect`
 * lo dice antes de ofrecer nada.
 */

/** Si hay de dónde bajar el detector: en un archivo abierto con doble clic, no. */
export const canDetect = window.location.protocol !== 'file:'

/**
 * Dónde están el modelo y el WebAssembly. Relativo a la página y un nivel arriba,
 * porque todas las herramientas viven en una carpeta propia al lado de `caras/`.
 */
const ASSETS = () => new URL('../caras/', window.location.href)

export interface DetectedFace {
  /** Los 468 puntos de la malla, en píxeles de la imagen. */
  points: Landmarks
  /** La pose que estimó MediaPipe con su lente fija: el punto de partida. */
  start: Pose
}

type Mode = 'IMAGE' | 'VIDEO'

/**
 * Uno por modo. MediaPipe deja cambiar de modo sobre la marcha, pero el de video
 * arrastra lo que vio en el cuadro anterior para seguir la cara: mezclarlos es pedir
 * que una foto herede la cara del video.
 */
const landmarkers: Partial<Record<Mode, Promise<FaceLandmarker>>> = {}

function load(mode: Mode): Promise<FaceLandmarker> {
  const cached = landmarkers[mode]
  if (cached) return cached
  const created = (async () => {
    const base = ASSETS()
    const fileset = await FilesetResolver.forVisionTasks(new URL('wasm', base).href)
    // En el procesador y no en la placa: en celulares Android el camino de la GPU
    // devolvía caras corridas o ninguna, sin dar error. Para una foto el procesador
    // tarda una fracción de segundo; en video da unos quince cuadros por segundo.
    return await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: new URL('face_landmarker.task', base).href,
        delegate: 'CPU',
      },
      runningMode: mode,
      numFaces: mode === 'IMAGE' ? 4 : 1,
      outputFacialTransformationMatrixes: true,
    })
  })()
  landmarkers[mode] = created
  // Si falló, que el próximo intento empiece de cero y no herede el error.
  created.catch(() => delete landmarkers[mode])
  return created
}

/** Empezar a bajar el modelo antes de que haga falta: pesa unos megas. */
export function preload() {
  void load('IMAGE').catch(() => {})
}

/** Prepara el detector de video; mientras no esté, `detectFrame` devuelve null. */
export function prepareVideo(): Promise<unknown> {
  return load('VIDEO')
}

/** Las caras de una imagen quieta: una foto, o la copia liviana de una referencia. */
export async function detectFaces(image: HTMLImageElement | HTMLCanvasElement): Promise<DetectedFace[]> {
  const detector = await load('IMAGE')
  const w = image instanceof HTMLImageElement ? image.naturalWidth : image.width
  const h = image instanceof HTMLImageElement ? image.naturalHeight : image.height
  return toFaces(detector.detect(image), w, h)
}

let videoDetector: FaceLandmarker | null = null

/**
 * Las caras de un cuadro de video. Sincrónico, para llamarlo en cada cuadro: si el
 * detector todavía no cargó, null.
 */
export function detectFrame(video: HTMLVideoElement, time: number): DetectedFace[] | null {
  if (!videoDetector) {
    void landmarkers.VIDEO?.then((d) => (videoDetector = d))
    return null
  }
  return toFaces(videoDetector.detectForVideo(video, time), video.videoWidth, video.videoHeight)
}

function toFaces(result: FaceLandmarkerResult, w: number, h: number): DetectedFace[] {
  const faces: DetectedFace[] = []
  result.faceLandmarks.forEach((marks, i) => {
    const matrix = result.facialTransformationMatrixes[i]
    if (!matrix || marks.length < 468) return
    // Los últimos diez son los iris: la cara canónica tiene 468.
    const points = new Float64Array(468 * 2)
    for (let k = 0; k < 468; k++) {
      points[k * 2] = marks[k].x * w
      points[k * 2 + 1] = marks[k].y * h
    }
    faces.push({ points, start: fromMediaPipe(matrix.data) })
  })
  return faces
}

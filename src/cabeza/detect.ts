import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { fromMediaPipe, type Landmarks, type Pose } from './pose'

/**
 * Encontrar las caras: MediaPipe Face Landmarker, corriendo en el navegador.
 *
 * El modelo y el WebAssembly se sirven desde el mismo sitio (`public/cabeza/`), no
 * desde un CDN de terceros: la foto no sale de la máquina y la herramienta no
 * depende de que otro siga publicando sus archivos.
 */

export interface DetectedFace {
  /** Los 468 puntos de la malla, en píxeles de la foto. */
  points: Landmarks
  /** La pose que estimó MediaPipe con su lente fija: el punto de partida. */
  start: Pose
}

let landmarker: Promise<FaceLandmarker> | null = null

function load(): Promise<FaceLandmarker> {
  landmarker ??= (async () => {
    const base = new URL('./', window.location.href)
    const fileset = await FilesetResolver.forVisionTasks(new URL('wasm', base).href)
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: new URL('face_landmarker.task', base).href, delegate },
      runningMode: 'IMAGE' as const,
      numFaces: 4,
      outputFacialTransformationMatrixes: true,
    })
    try {
      return await FaceLandmarker.createFromOptions(fileset, options('GPU'))
    } catch {
      // Sin WebGL que le sirva, en el procesador: más lento, pero anda.
      return await FaceLandmarker.createFromOptions(fileset, options('CPU'))
    }
  })()
  // Si falló, que el próximo intento empiece de cero y no herede el error.
  landmarker.catch(() => (landmarker = null))
  return landmarker
}

/** Empezar a bajar el modelo antes de que haga falta: pesa unos megas. */
export function preload() {
  void load().catch(() => {})
}

export async function detectFaces(image: HTMLImageElement): Promise<DetectedFace[]> {
  const detector = await load()
  const result = detector.detect(image)
  const w = image.naturalWidth
  const h = image.naturalHeight
  return result.faceLandmarks.map((marks, i) => {
    // Los últimos diez son los iris: la cara canónica tiene 468.
    const points = new Float64Array(468 * 2)
    for (let k = 0; k < 468; k++) {
      points[k * 2] = marks[k].x * w
      points[k * 2 + 1] = marks[k].y * h
    }
    return { points, start: fromMediaPipe(result.facialTransformationMatrixes[i].data) }
  })
}

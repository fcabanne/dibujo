import { useEffect, useMemo, useState } from 'react'
import type { Reference } from '../../shared/referenceImage'
import { canDetect, detectFaces, type DetectedFace } from '../../shared/loomis/detect'
import { focal35 } from '../../shared/loomis/exif'
import { estimateLens, solveHeads, type HeadScene } from '../../shared/loomis/head'

export type HeadStatus = 'idle' | 'looking' | 'ready' | 'none' | 'failed'

interface Found {
  reference: Reference
  faces: DetectedFace[]
  /** La lente que anotó la cámara en el archivo, si la anotó. */
  cameraLens: number | null
  /** La que mejor explica las caras, para cuando la cámara no anotó nada. */
  guessedLens: number | null
}

/**
 * Las cabezas de la referencia.
 *
 * El detector se baja y corre recién cuando se pide una cabeza (`wanted`): son unos
 * quince megas que quien solo quiere la grilla no tiene por qué pagar. Corre una vez
 * por foto, sobre la copia liviana —la misma que se ve—, y lo encontrado se queda:
 * apagar y prender la cabeza no vuelve a buscar.
 *
 * La lente sale de la que anotó la cámara en el EXIF del original o, si no anotó,
 * de la estimada mirando las caras. No se elige a mano: con la foto bien detectada
 * no hace falta, y era una perilla que nadie sabía para qué estaba.
 */
export function useHeads(reference: Reference | null, wanted: boolean) {
  const [found, setFound] = useState<Found | null>(null)
  const [status, setStatus] = useState<HeadStatus>('idle')

  const current = found && found.reference === reference ? found : null

  useEffect(() => {
    if (!reference || !wanted || !canDetect || current) return
    let cancelled = false
    setStatus('looking')
    void (async () => {
      try {
        const [faces, cameraLens] = await Promise.all([
          detectFaces(reference.preview),
          focal35(reference.blob),
        ])
        if (cancelled) return
        const { width, height } = reference.preview
        // La estimación es la parte cara —treinta lentes por cara—: solo si la
        // cámara no dijo cuál era.
        const guessedLens = faces.length && !cameraLens ? estimateLens(faces, width, height) : null
        setFound({ reference, faces, cameraLens, guessedLens })
        setStatus(faces.length ? 'ready' : 'none')
      } catch {
        if (!cancelled) setStatus('failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reference, wanted, current])

  const lens = (current ? (current.cameraLens ?? current.guessedLens) : null) ?? 50

  const scene: HeadScene | null = useMemo(() => {
    if (!current || !current.faces.length) return null
    const { width, height } = current.reference.preview
    return solveHeads(current.faces, lens, width, height)
  }, [current, lens])

  return {
    status: current || status === 'looking' || status === 'failed' ? status : 'idle',
    scene,
  }
}

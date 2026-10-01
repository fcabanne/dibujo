import type { FrameMaterial } from '../types'
import { modal, noiseBurst } from './synth'

/**
 * Los sonidos de Enmarcado, cada uno con su receta, cuánto suena y cada cuánto puede
 * repetirse. Son bajitos a propósito: tienen que oírse en una habitación callada y
 * desaparecer en cuanto hay otra cosa sonando. Un sonido que se nota es un sonido de
 * más.
 *
 * Los niveles están en dB respecto del máximo. Para subir o bajar todo junto está
 * `MASTER` en `engine.ts`; esto es cómo suenan unos contra otros.
 */
export interface Recipe {
  build: (sampleRate: number) => Float32Array<ArrayBuffer>
  /** Volumen del pico, en dB. */
  level: number
  /** Lo mínimo entre dos veces seguidas, en ms: una ráfaga de clics se lee como ruido. */
  gap: number
}

/** La frecuencia a la que está construido el tic: el tono real sale de `playbackRate`. */
export const TICK_BASE = 2000

export const RECIPES = {
  /**
   * La muesca de la moldura de madera o pintada: un golpecito seco con cuerpo, como
   * el de un trinquete de madera. Se apaga en unos veinte milisegundos.
   */
  'tick-wood': {
    build: (sr) =>
      modal(sr, {
        modes: [
          { f: TICK_BASE, decay: 0.022, amp: 1 },
          { f: TICK_BASE * 2.71, decay: 0.012, amp: 0.45 },
          { f: TICK_BASE * 5.1, decay: 0.006, amp: 0.25 },
        ],
        click: { amp: 0.6, decay: 0.0015, freq: 4200 },
        seed: 11,
      }),
    level: -32,
    gap: 30,
  },
  /** La muesca de la moldura de metal: más aguda y con una cola corta que canta. */
  'tick-metal': {
    build: (sr) =>
      modal(sr, {
        modes: [
          { f: TICK_BASE * 1.55, decay: 0.06, amp: 1 },
          { f: TICK_BASE * 3.7, decay: 0.035, amp: 0.5 },
        ],
        click: { amp: 0.4, decay: 0.001, freq: 6000 },
        seed: 13,
      }),
    level: -36,
    gap: 30,
  },
  /** La muesca del passe-partout: papel, un roce de seis milisegundos. */
  'tick-mat': {
    build: (sr) => noiseBurst(sr, { from: 2500, to: 5000, q: 1.2, attack: 0.0008, decay: 0.006, length: 0.04, seed: 17 }),
    level: -36,
    gap: 30,
  },
  /**
   * Agarrar el cuadro: el "tuc" de apoyar la mano en una moldura y empujarla contra la
   * pared. Grave y corto.
   */
  grab: {
    build: (sr) =>
      modal(sr, {
        modes: [
          { f: 190, decay: 0.045, amp: 1 },
          { f: 470, decay: 0.025, amp: 0.55 },
          { f: 1050, decay: 0.012, amp: 0.3 },
        ],
        click: { amp: 0.35, decay: 0.003, freq: 2500 },
        seed: 19,
      }),
    level: -28,
    gap: 120,
  },
  /**
   * Soltarlo pasado del máximo: la moldura que vuelve a su medida, un "tunk" más
   * grave que la muesca.
   */
  stretch: {
    build: (sr) =>
      modal(sr, {
        modes: [
          { f: 150, decay: 0.06, amp: 1 },
          { f: 380, decay: 0.03, amp: 0.4 },
        ],
        click: { amp: 0.25, decay: 0.002, freq: 1800 },
        seed: 23,
      }),
    level: -30,
    gap: 200,
  },
} satisfies Record<string, Recipe>

export type SoundName = keyof typeof RECIPES

/** El tic que corresponde a cada material: el passe-partout aparte, que es de cartón. */
export function tickFor(target: 'frame' | 'mat', material: FrameMaterial): SoundName {
  if (target === 'mat') return 'tick-mat'
  return material === 'metal' ? 'tick-metal' : 'tick-wood'
}

/**
 * El tono de la muesca según el ancho: una moldura angosta suena aguda y una ancha,
 * más grave, como una tabla más grande. De 2,6 kHz a medio centímetro a 1,4 kHz a
 * diez, en escala logarítmica, que es como se oye.
 */
export function tickRate(widthCm: number): number {
  const t = Math.min(1, Math.max(0, (widthCm - 0.5) / 9.5))
  const f = 2600 * Math.pow(1400 / 2600, t)
  return f / TICK_BASE
}

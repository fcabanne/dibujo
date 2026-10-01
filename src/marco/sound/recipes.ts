import type { FrameMaterial } from '../types'
import { knock, modal, noiseBurst } from './synth'

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
  /** Arma el sonido; `variant` elige cuál de las versiones (si hay más de una). */
  build: (sampleRate: number, variant: number) => Float32Array<ArrayBuffer>
  /** Cuántas versiones distintas hay, para turnarlas: dos golpes nunca son el mismo. */
  variants?: number
  /** Volumen del pico, en dB. */
  level: number
  /** Lo mínimo entre dos veces seguidas, en ms: una ráfaga de clics se lee como ruido. */
  gap: number
}

/** La frecuencia a la que está construido el tic de metal: el tono real sale de `playbackRate`. */
const TICK_BASE = 2000

export const RECIPES = {
  /**
   * La muesca de la moldura de madera o pintada: el golpecito seco de un trinquete de
   * madera. Es ruido haciendo resonar el cuerpo de la pieza —un golpe con color, sin
   * nota—, y cuatro versiones que se turnan.
   */
  'tick-wood': {
    build: (sr, v) =>
      knock(sr, {
        resonances: [
          { f: 720, q: 9, amp: 1 },
          { f: 1180, q: 11, amp: 0.55 },
          { f: 2350, q: 14, amp: 0.35 },
        ],
        strike: 0.0016,
        thump: { f: 165, decay: 0.012, amp: 0.35 },
        seed: 11 + v * 97,
        detune: 0.06,
      }),
    variants: 4,
    level: -30,
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
    build: (sr, v) =>
      knock(sr, {
        resonances: [
          { f: 260, q: 6, amp: 1 },
          { f: 540, q: 8, amp: 0.6 },
          { f: 1250, q: 10, amp: 0.25 },
        ],
        strike: 0.003,
        thump: { f: 110, decay: 0.03, amp: 0.8 },
        seed: 19 + v * 53,
        detune: 0.05,
      }),
    variants: 3,
    level: -28,
    gap: 120,
  },
  /**
   * Soltarlo pasado del máximo: la moldura que vuelve a su medida, un golpe más sordo
   * y más grave que la muesca.
   */
  stretch: {
    build: (sr, v) =>
      knock(sr, {
        resonances: [
          { f: 330, q: 7, amp: 1 },
          { f: 760, q: 9, amp: 0.45 },
        ],
        strike: 0.0025,
        thump: { f: 95, decay: 0.04, amp: 0.9 },
        seed: 23 + v * 41,
        detune: 0.05,
      }),
    variants: 2,
    level: -30,
    gap: 200,
  },
  /**
   * Elegir una moldura de madera: la pieza que se apoya en el cuadro, un golpe con
   * más cuerpo que la muesca.
   */
  'commit-wood': {
    build: (sr, v) =>
      knock(sr, {
        resonances: [
          { f: 420, q: 8, amp: 1 },
          { f: 780, q: 10, amp: 0.6 },
          { f: 1650, q: 12, amp: 0.3 },
        ],
        strike: 0.0025,
        thump: { f: 120, decay: 0.03, amp: 0.7 },
        seed: 31 + v * 61,
        detune: 0.05,
      }),
    variants: 3,
    level: -24,
    gap: 60,
  },
  /** Pintada: la misma madera con una capa de laca encima, más apagada y más corta. */
  'commit-painted': {
    build: (sr, v) =>
      knock(sr, {
        resonances: [
          { f: 380, q: 6, amp: 1 },
          { f: 700, q: 7, amp: 0.45 },
        ],
        strike: 0.002,
        thump: { f: 115, decay: 0.025, amp: 0.7 },
        seed: 37 + v * 59,
        detune: 0.05,
      }),
    variants: 3,
    level: -24,
    gap: 60,
  },
  /** Metal: el perfil de aluminio, que sí canta un momento. */
  'commit-metal': {
    build: (sr, v) =>
      modal(sr, {
        modes: [
          { f: 1250 * (1 + v * 0.03), decay: 0.38, amp: 1 },
          { f: 3460 * (1 + v * 0.02), decay: 0.24, amp: 0.5 },
          { f: 6820, decay: 0.12, amp: 0.2 },
        ],
        click: { amp: 0.5, decay: 0.002, freq: 3000 },
        seed: 41 + v,
      }),
    variants: 2,
    level: -30,
    gap: 60,
  },
  /** El passe-partout: un cartón que se desliza en su lugar. */
  'commit-mat': {
    build: (sr, v) =>
      noiseBurst(sr, { from: 1200, to: 2800, q: 1.4, attack: 0.03, decay: 0.05, length: 0.16, seed: 43 + v }),
    variants: 2,
    level: -30,
    gap: 60,
  },
  /** El vidrio: un "clink" corto, el canto que toca la moldura. */
  'commit-glass': {
    build: (sr, v) =>
      modal(sr, {
        modes: [
          { f: 2650 * (1 + v * 0.02), decay: 0.42, amp: 1 },
          { f: 6100, decay: 0.26, amp: 0.45 },
          { f: 9400, decay: 0.16, amp: 0.2 },
        ],
        click: { amp: 0.3, decay: 0.001, freq: 5000 },
        seed: 47 + v,
      }),
    variants: 2,
    level: -32,
    gap: 60,
  },
  /** Sacar el vidrio: se desliza afuera, un roce. */
  'commit-unglass': {
    build: (sr) => noiseBurst(sr, { from: 2600, to: 1400, q: 1.1, attack: 0.04, decay: 0.08, length: 0.22, seed: 53 }),
    level: -34,
    gap: 60,
  },
  /** La pared: una pasada de pincel, casi nada. */
  'commit-wall': {
    build: (sr) => noiseBurst(sr, { from: 250, to: 900, q: 0.8, attack: 0.05, decay: 0.08, length: 0.24, seed: 59 }),
    level: -36,
    gap: 60,
  },
  /**
   * Pasar por encima de una muestra: un clic mínimo, como pasar el dedo por un
   * muestrario. Tiene que oírse solo si se lo busca.
   */
  hover: {
    build: (sr, v) =>
      knock(sr, {
        resonances: [{ f: 3200, q: 4, amp: 1 }],
        strike: 0.0008,
        seed: 61 + v * 13,
        detune: 0.08,
      }),
    variants: 3,
    level: -40,
    gap: 45,
  },
  /** Despegar el cuadro de la pared para girarlo: un roce del fondo contra la pared. */
  'turn-lift': {
    build: (sr) => noiseBurst(sr, { from: 900, to: 2200, q: 0.9, attack: 0.06, decay: 0.12, length: 0.32, seed: 67 }),
    level: -34,
    gap: 200,
  },
  /** Volver a apoyarlo derecho: el golpe sordo del canto de abajo contra la pared. */
  'turn-land': {
    build: (sr, v) =>
      knock(sr, {
        resonances: [
          { f: 210, q: 5, amp: 1 },
          { f: 480, q: 7, amp: 0.5 },
          { f: 1100, q: 9, amp: 0.2 },
        ],
        strike: 0.004,
        thump: { f: 85, decay: 0.05, amp: 1 },
        seed: 71 + v * 29,
        detune: 0.05,
      }),
    variants: 2,
    level: -24,
    gap: 200,
  },
  /** El alambre que se engancha en el clavo: un tic metálico, chiquito. */
  wire: {
    build: (sr) =>
      modal(sr, {
        modes: [
          { f: 3900, decay: 0.05, amp: 1 },
          { f: 6700, decay: 0.03, amp: 0.5 },
        ],
        click: { amp: 0.6, decay: 0.001, freq: 5000 },
        seed: 73,
      }),
    level: -34,
    gap: 200,
  },
  /** El cuadro recién colgado que se apoya contra la pared. */
  thud: {
    build: (sr, v) =>
      knock(sr, {
        resonances: [
          { f: 160, q: 4, amp: 1 },
          { f: 420, q: 6, amp: 0.45 },
        ],
        strike: 0.005,
        thump: { f: 70, decay: 0.06, amp: 1 },
        seed: 79 + v * 31,
        detune: 0.04,
      }),
    variants: 2,
    level: -24,
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
 * El tono de la muesca según el ancho: una moldura angosta suena un poco más aguda
 * y una ancha, un poco más grave, como una tabla más grande. Poco: tres semitonos
 * para cada lado. Más que eso ya es una escala, y la madera no toca escalas.
 */
export function tickRate(widthCm: number): number {
  const t = Math.min(1, Math.max(0, (widthCm - 0.5) / 9.5))
  return Math.pow(2, (3 - 6 * t) / 12)
}

/** El golpe de elegir una moldura, según de qué es. */
export function commitFor(material: FrameMaterial): SoundName {
  return material === 'metal' ? 'commit-metal' : material === 'painted' ? 'commit-painted' : 'commit-wood'
}

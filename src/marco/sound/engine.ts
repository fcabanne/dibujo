import { useSyncExternalStore } from 'react'
import { RECIPES, type SoundName } from './recipes'
import { roomIR } from './synth'

/**
 * El que hace sonar los sonidos.
 *
 * Los navegadores no dejan que una página suene antes de que la persona haga algo:
 * el `AudioContext` nace recién con el primer gesto (`unlockSound`). Hasta entonces
 * `play` no hace nada, y está bien: todo lo que suena acá responde a un gesto.
 *
 * La cadena es corta: cada sonido pasa por su volumen y su paneo, después por un
 * poco de sala para que suene en un cuarto y no pegado al parlante, un pasabajos que
 * le saca el filo y un compresor que impide que una ráfaga lastime.
 */

/** El volumen de todo junto. Si todo suena bajo o alto, es este número. */
const MASTER = 1
/** Cuánta sala se mezcla. Poca: se tiene que sentir, no oír. */
const WET = 0.12
/** Más voces que esto a la vez y la nueva se descarta: nadie distingue nueve clics. */
const MAX_VOICES = 8

const MUTED_KEY = 'cuadros:sonido'

interface Engine {
  ctx: AudioContext
  bus: GainNode
  buffers: Map<SoundName, AudioBuffer>
  last: Map<SoundName, number>
  voices: number
  /** Energía reciente, para bajar un poco el volumen cuando suena mucho seguido. */
  energy: number
  energyAt: number
}

let engine: Engine | null = null
let muted = readMuted()
const listeners = new Set<() => void>()
/** Con `?debug`, cada sonido que se pidió queda anotado acá. */
export const soundLog: { name: SoundName; at: number; rate: number; gain: number }[] = []
let logging = false

export function logSounds(on: boolean) {
  logging = on
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === 'off'
  } catch {
    return false
  }
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean) {
  muted = value
  try {
    localStorage.setItem(MUTED_KEY, value ? 'off' : 'on')
  } catch {
    // Sin almacenamiento la elección dura lo que dura la página.
  }
  listeners.forEach((l) => l())
}

/** Si está callado, para la interfaz. */
export function useMuted(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => muted,
  )
}

/**
 * Despierta el audio. Se llama desde el primer gesto de la persona —un toque, una
 * tecla—, que es lo único que el navegador acepta como permiso para sonar.
 */
export function unlockSound() {
  if (engine) {
    if (engine.ctx.state === 'suspended' && !document.hidden) void engine.ctx.resume()
    return
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return

  const ctx = new Ctor()
  const out = ctx.createGain()
  out.gain.value = MASTER

  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -24
  comp.ratio.value = 3
  comp.knee.value = 12
  comp.attack.value = 0.003
  comp.release.value = 0.12

  const soften = ctx.createBiquadFilter()
  soften.type = 'lowpass'
  soften.frequency.value = 9000

  const bus = ctx.createGain()
  const wet = ctx.createGain()
  wet.gain.value = WET
  const room = ctx.createConvolver()
  const [l, r] = roomIR(ctx.sampleRate, 0.45)
  const ir = ctx.createBuffer(2, l.length, ctx.sampleRate)
  ir.copyToChannel(l, 0)
  ir.copyToChannel(r, 1)
  room.buffer = ir

  bus.connect(soften)
  bus.connect(room)
  room.connect(wet)
  wet.connect(soften)
  soften.connect(comp)
  comp.connect(out)
  out.connect(ctx.destination)

  const buffers = new Map<SoundName, AudioBuffer>()
  for (const name of Object.keys(RECIPES) as SoundName[]) {
    const data = RECIPES[name].build(ctx.sampleRate)
    const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate)
    buffer.copyToChannel(data, 0)
    buffers.set(name, buffer)
  }

  engine = { ctx, bus, buffers, last: new Map(), voices: 0, energy: 0, energyAt: 0 }

  // En segundo plano no hay nada que oír: se suspende y vuelve con la pestaña.
  document.addEventListener('visibilitychange', () => {
    if (!engine) return
    if (document.hidden) void engine.ctx.suspend()
    else void engine.ctx.resume()
  })
  if (ctx.state === 'suspended') void ctx.resume()
}

export interface PlayOptions {
  /** Tono: 1 es el de la receta, 2 una octava arriba. */
  rate?: number
  /** Volumen extra, en dB, sobre el de la receta. */
  gain?: number
  /** De -1 (izquierda) a 1 (derecha). */
  pan?: number
}

const dbToGain = (db: number) => Math.pow(10, db / 20)

/** Hace sonar `name`. Callado, sin audio todavía, o demasiado pegado al anterior: no hace nada. */
export function play(name: SoundName, options: PlayOptions = {}) {
  if (muted || !engine || engine.ctx.state !== 'running') return
  const e = engine
  const recipe = RECIPES[name]
  const now = performance.now()

  const last = e.last.get(name) ?? -Infinity
  if (now - last < recipe.gap) return
  if (e.voices >= MAX_VOICES) return
  e.last.set(name, now)

  // Dos golpes nunca son idénticos: un pelo de tono y de volumen distinto cada vez.
  const cents = (Math.random() * 2 - 1) * 25
  const rate = (options.rate ?? 1) * Math.pow(2, cents / 1200)
  const jitter = (Math.random() * 2 - 1) * 1.5

  // Lo que sonó hace poco baja un poco lo que viene: una ráfaga no sube y sube.
  e.energy *= Math.exp(-(now - e.energyAt) / 400)
  e.energyAt = now
  const duck = -Math.min(6, e.energy * 1.5)
  e.energy += 1

  const db = recipe.level + (options.gain ?? 0) + jitter + duck
  if (logging) soundLog.push({ name, at: now, rate, gain: db })

  const source = e.ctx.createBufferSource()
  source.buffer = e.buffers.get(name) ?? null
  source.playbackRate.value = rate
  const gain = e.ctx.createGain()
  gain.gain.value = dbToGain(db)
  const pan = e.ctx.createStereoPanner()
  pan.pan.value = Math.max(-1, Math.min(1, options.pan ?? 0))
  source.connect(gain)
  gain.connect(pan)
  pan.connect(e.bus)

  e.voices++
  source.onended = () => {
    e.voices--
    pan.disconnect()
  }
  source.start()
}

/**
 * Los sonidos se fabrican acá, con cuentas, en vez de venir en archivos: así la
 * herramienta sigue siendo un único .html, y cada sonido es una receta que se puede
 * afinar cambiando un número.
 *
 * Todo devuelve muestras crudas (`Float32Array`) a una frecuencia de muestreo dada.
 * Son funciones puras: la misma receta da siempre el mismo sonido. La variación —que
 * dos clics seguidos no suenen idénticos, que es lo que delata una máquina— la pone
 * el motor al reproducirlas, con el tono y el volumen.
 */

/** Ruido blanco determinístico: un generador congruencial chico, sembrado. */
function noise(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return (s / 4294967296) * 2 - 1
  }
}

/**
 * Un filtro pasabanda de segundo orden (el de los "cookbook" de audio), aplicado en
 * el lugar. Es lo que convierte ruido blanco en papel, en cartón o en roce.
 */
function bandpass(data: Float32Array, sampleRate: number, freq: number, q: number) {
  const w = (2 * Math.PI * freq) / sampleRate
  const alpha = Math.sin(w) / (2 * q)
  const a0 = 1 + alpha
  const b0 = alpha / a0
  const b2 = -alpha / a0
  const a1 = (-2 * Math.cos(w)) / a0
  const a2 = (1 - alpha) / a0
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < data.length; i++) {
    const x = data[i]
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    data[i] = y
  }
}

/** Lleva el pico a 1: el volumen lo decide la receta, no cómo salió la cuenta. */
function normalize(data: Float32Array<ArrayBuffer>): Float32Array<ArrayBuffer> {
  let peak = 0
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]))
  if (peak > 0) for (let i = 0; i < data.length; i++) data[i] /= peak
  return data
}

export interface Mode {
  /** Frecuencia, en Hz. */
  f: number
  /** Cuánto tarda en apagarse, en segundos (el tiempo en caer a un tercio). */
  decay: number
  amp: number
}

export interface ModalRecipe {
  modes: Mode[]
  /** Un chasquido de ruido al principio: el golpe, antes de que suene el cuerpo. */
  click?: { amp: number; decay: number; freq: number }
  seed?: number
}

/**
 * Un objeto que suena al golpearlo: madera, metal, vidrio. Suena en sus modos —unas
 * pocas frecuencias que no son armónicas entre sí, por eso no es una nota— y cada uno
 * se apaga a su ritmo. La madera se apaga enseguida; el metal y el vidrio cantan.
 */
export function modal(sampleRate: number, recipe: ModalRecipe): Float32Array<ArrayBuffer> {
  const longest = Math.max(...recipe.modes.map((m) => m.decay), recipe.click?.decay ?? 0)
  const length = Math.ceil(sampleRate * longest * 6) + 1
  const data = new Float32Array(length)
  const attack = sampleRate * 0.0008

  recipe.modes.forEach((m, k) => {
    // Cada modo arranca en una fase distinta: si no, el golpe sale con un pico raro.
    const phase = k * 1.7
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate
      const env = Math.exp(-t / m.decay) * Math.min(1, i / attack)
      data[i] += Math.sin(2 * Math.PI * m.f * t + phase) * m.amp * env
    }
  })

  if (recipe.click) {
    const c = recipe.click
    const burst = new Float32Array(Math.ceil(sampleRate * c.decay * 6))
    const rnd = noise(recipe.seed ?? 7)
    for (let i = 0; i < burst.length; i++) burst[i] = rnd() * Math.exp(-i / sampleRate / c.decay)
    bandpass(burst, sampleRate, c.freq, 0.9)
    for (let i = 0; i < burst.length && i < length; i++) data[i] += burst[i] * c.amp
  }

  return normalize(data)
}

export interface NoiseRecipe {
  /** La banda del ruido, en Hz: de dónde a dónde barre durante el sonido. */
  from: number
  to: number
  q: number
  attack: number
  decay: number
  /** Cuánto dura en total, en segundos. */
  length: number
  seed?: number
}

/**
 * Ruido con forma: papel, cartón que se desliza, un roce. La banda puede moverse
 * mientras suena —un deslizamiento sube de tono a medida que acelera—, así que se
 * filtra de a tramos cortos.
 */
export function noiseBurst(sampleRate: number, recipe: NoiseRecipe): Float32Array<ArrayBuffer> {
  const length = Math.ceil(sampleRate * recipe.length)
  const data = new Float32Array(length)
  const rnd = noise(recipe.seed ?? 3)
  for (let i = 0; i < length; i++) data[i] = rnd()

  const chunk = Math.max(64, Math.floor(sampleRate * 0.004))
  for (let start = 0; start < length; start += chunk) {
    const t = start / length
    const freq = recipe.from * Math.pow(recipe.to / recipe.from, t)
    const piece = data.subarray(start, Math.min(length, start + chunk))
    bandpass(piece, sampleRate, freq, recipe.q)
  }

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate
    const rise = Math.min(1, t / Math.max(1e-4, recipe.attack))
    data[i] *= rise * Math.exp(-Math.max(0, t - recipe.attack) / recipe.decay)
  }
  return normalize(data)
}

/**
 * La respuesta de una habitación chica, para darle aire a todo: ruido que se apaga
 * en menos de medio segundo, distinto en cada oído. Sin esto los sonidos suenan
 * pegados al parlante; con un poco, suenan en un cuarto.
 */
export function roomIR(
  sampleRate: number,
  seconds: number,
): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const make = (seed: number) => {
    const length = Math.ceil(sampleRate * seconds)
    const data = new Float32Array(length)
    const rnd = noise(seed)
    let lp = 0
    for (let i = 0; i < length; i++) {
      // Un pasabajos de un polo que se va cerrando: la cola es más opaca que el principio.
      const t = i / length
      const k = 0.55 - t * 0.4
      lp += (rnd() - lp) * k
      data[i] = lp * Math.pow(1 - t, 2.4)
    }
    return normalize(data)
  }
  return [make(101), make(202)]
}

export interface Resonance {
  /** Dónde resuena, en Hz. */
  f: number
  /** Qué tan angosta es la resonancia: más alto, más tiempo canta. */
  q: number
  amp: number
}

export interface KnockRecipe {
  /** Las resonancias del cuerpo que se golpea. */
  resonances: Resonance[]
  /** Cuánto dura el golpe que las excita, en segundos: unos pocos milisegundos. */
  strike: number
  /** Un golpe grave debajo: el peso de la pieza. */
  thump?: { f: number; decay: number; amp: number }
  seed: number
  /** Cuánto se corren las resonancias en esta variante, ±fracción. */
  detune?: number
}

/**
 * Un golpe a un objeto de madera, cartón o lo que no cante.
 *
 * La madera no suena a nota: un seno puro que se apaga suena a xilofón de juguete.
 * Suena a golpe con color, y ese color son unas pocas resonancias anchas del cuerpo
 * que el golpe pone a vibrar un instante. Así está hecho acá: un chasquido de ruido
 * cortísimo pasa por unos pasabandas angostos —cada uno resuena un poco y se apaga
 * solo— y debajo va un golpe grave que es el peso de la pieza.
 */
export function knock(sampleRate: number, recipe: KnockRecipe): Float32Array<ArrayBuffer> {
  const length = Math.ceil(sampleRate * 0.12)
  const data = new Float32Array(length)
  const rnd = noise(recipe.seed)

  // El golpe: ruido que se apaga en unos milisegundos.
  const strike = new Float32Array(length)
  for (let i = 0; i < length; i++) strike[i] = rnd() * Math.exp(-i / sampleRate / recipe.strike)

  const jitter = noise(recipe.seed * 7 + 3)
  for (const r of recipe.resonances) {
    const f = r.f * (1 + jitter() * (recipe.detune ?? 0))
    const band = strike.slice()
    // Dos pasadas: la resonancia queda más definida y el ruido de afuera, más lejos.
    bandpass(band, sampleRate, f, r.q)
    bandpass(band, sampleRate, f, r.q)
    let peak = 0
    for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(band[i]))
    const k = peak > 0 ? r.amp / peak : 0
    for (let i = 0; i < length; i++) data[i] += band[i] * k
  }

  // Un poco del golpe crudo, filtrado, para el ataque: el contacto de las dos superficies.
  const attack = strike.slice()
  bandpass(attack, sampleRate, 3200, 0.7)
  for (let i = 0; i < length; i++) data[i] += attack[i] * 0.35

  if (recipe.thump) {
    const t = recipe.thump
    let phase = 0
    for (let i = 0; i < length; i++) {
      const s = i / sampleRate
      // El golpe grave baja un poco de tono mientras se apaga, como uno de verdad.
      const f = t.f * (1 + 0.4 * Math.exp(-s / 0.004))
      phase += (2 * Math.PI * f) / sampleRate
      data[i] += Math.sin(phase) * Math.exp(-s / t.decay) * t.amp * Math.min(1, i / (sampleRate * 0.0005))
    }
  }

  return normalize(data)
}

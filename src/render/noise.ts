/**
 * Ruido de valor multi-octava.
 *
 * La versión anterior tileaba un patrón de 256 px y el período se leía a simple
 * vista, sobre todo en la pared. La solución no es agrandar el tile: es separar el
 * grano fino (ruido por píxel, cuyo período nadie percibe) de la variación de baja
 * frecuencia, que se genera al tamaño del lienzo y no se repite nunca.
 */

function hash(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return n - Math.floor(n)
}

const smooth = (t: number) => t * t * (3 - 2 * t)

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const u = smooth(x - xi)
  const v = smooth(y - yi)

  const a = hash(xi, yi, seed)
  const b = hash(xi + 1, yi, seed)
  const c = hash(xi, yi + 1, seed)
  const d = hash(xi + 1, yi + 1, seed)

  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}

/** Suma de octavas: 0..1, con detalle a varias escalas. */
export function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0
  let amp = 0.5
  let freq = 1
  let norm = 0

  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, seed + i * 17) * amp
    norm += amp
    amp *= 0.5
    freq *= 2
  }

  return sum / norm
}

const fieldCache = new Map<string, HTMLCanvasElement>()

/**
 * Campo de manchas en gris, del tamaño del lienzo. Se genera a baja resolución y se
 * estira: la variación que interesa es de baja frecuencia, y calcularla por píxel a
 * resolución completa costaría cientos de milisegundos sin verse mejor.
 *
 * Se compone sobre la pared con `soft-light`, que aclara donde el gris pasa de 50 %
 * y oscurece donde no llega.
 */
export function blotchField(width: number, height: number, seed: number): HTMLCanvasElement {
  // Cuantizado: redimensionar la ventana no debe regenerar el campo en cada píxel.
  const key = `${Math.round(width / 64)}x${Math.round(height / 64)}|${seed}`
  const hit = fieldCache.get(key)
  if (hit) return hit

  const scale = 6
  const w = Math.max(8, Math.ceil(width / scale))
  const h = Math.max(8, Math.ceil(height / scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const img = ctx.createImageData(w, h)
  const data = img.data

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Frecuencia baja: manchas del orden de un tercio de pared.
      const n = fbm(x / 26, y / 26, seed, 4)
      // Comprimido alrededor del gris medio: es una modulación, no una textura.
      const v = Math.round(128 + (n - 0.5) * 116)
      const i = (y * w + x) * 4
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }

  ctx.putImageData(img, 0, 0)
  fieldCache.set(key, canvas)
  return canvas
}

/**
 * Tile de grano fino por píxel. Acá el tile sí sirve: el ruido blanco a un píxel no
 * tiene estructura, así que el ojo no puede engancharse con el período.
 */
export function grainTile(size: number, strength: number, seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const img = ctx.createImageData(size, size)
  const data = img.data

  for (let i = 0; i < data.length; i += 4) {
    const px = (i / 4) % size
    const py = Math.floor(i / 4 / size)
    const v = Math.round(128 + (hash(px, py, seed) - 0.5) * strength)
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
    data[i + 3] = 255
  }

  ctx.putImageData(img, 0, 0)
  return canvas
}

/** Ruido 1D determinista, para jitter de vetas y salpicados. */
export function rand1(i: number, seed: number): number {
  return hash(i, i * 0.731 + 11.3, seed)
}

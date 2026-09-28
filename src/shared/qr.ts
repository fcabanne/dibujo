/**
 * Un generador de códigos QR, mínimo y sin librerías.
 *
 * Existe para una sola cosa: que la mesa de luz, abierta en una compu, se pueda pasar al
 * celular escaneando la pantalla. Por eso hace lo justo: texto en bytes (UTF-8), corrección
 * de errores nivel M y versiones 1 a 6 —hasta 106 bytes, de sobra para una dirección—. Si
 * el texto no entra, avisa; agrandar las tablas es el camino, no cambiar de librería.
 *
 * Devuelve la matriz de módulos (`true` = oscuro), sin el margen blanco que exige el
 * estándar: eso lo pone quien lo dibuja.
 */

/** Palabras de corrección de errores por bloque, nivel M, versiones 1 a 6. */
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16]
const NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4]
/** Centros de los patrones de alineación (los de las esquinas de buscadores no van). */
const ALIGNMENT = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]]
const MAX_VERSION = 6

export function makeQr(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text)

  let version = 1
  while (version <= MAX_VERSION && bytes.length > capacity(version)) version++
  if (version > MAX_VERSION) throw new Error('El texto no entra en el QR')

  const codewords = interleave(dataCodewords(bytes, version), version)
  return draw(codewords, version)
}

/** Bytes de texto que entran: menos 4 bits de modo y 8 de largo. */
function capacity(version: number): number {
  return totalData(version) - 2
}

function totalCodewords(version: number): number {
  let modules = (16 * version + 128) * version + 64
  if (version >= 2) {
    const n = Math.floor(version / 7) + 2
    modules -= (25 * n - 10) * n - 55
  }
  return Math.floor(modules / 8)
}

function totalData(version: number): number {
  return totalCodewords(version) - ECC_PER_BLOCK[version] * NUM_BLOCKS[version]
}

/** Modo bytes, largo, texto, cierre y relleno hasta llenar los datos. */
function dataCodewords(bytes: Uint8Array, version: number): number[] {
  const bits: number[] = []
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, 8)
  bytes.forEach((b) => push(b, 8))

  const limit = totalData(version) * 8
  push(0, Math.min(4, limit - bits.length))
  while (bits.length % 8) bits.push(0)
  for (let pad = 0xec; bits.length < limit; pad ^= 0xec ^ 0x11) push(pad, 8)

  const out: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    out.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0))
  }
  return out
}

/** Parte los datos en bloques, les calcula la corrección y los entrevera. */
function interleave(data: number[], version: number): number[] {
  const blocks = NUM_BLOCKS[version]
  const ecc = ECC_PER_BLOCK[version]
  const total = totalCodewords(version)
  const shortBlocks = blocks - (total % blocks)
  const shortLength = Math.floor(total / blocks) - ecc

  const divisor = reedSolomonDivisor(ecc)
  const dataBlocks: number[][] = []
  const eccBlocks: number[][] = []
  for (let i = 0, k = 0; i < blocks; i++) {
    const length = shortLength + (i < shortBlocks ? 0 : 1)
    const block = data.slice(k, k + length)
    k += length
    dataBlocks.push(block)
    eccBlocks.push(reedSolomonRemainder(block, divisor))
  }

  const out: number[] = []
  for (let i = 0; i <= shortLength; i++) {
    dataBlocks.forEach((block) => {
      if (i < block.length) out.push(block[i])
    })
  }
  for (let i = 0; i < ecc; i++) eccBlocks.forEach((block) => out.push(block[i]))
  return out
}

/** Multiplicación en GF(256) con el polinomio 0x11D. */
function multiply(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function reedSolomonDivisor(degree: number): number[] {
  const result: number[] = new Array(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = multiply(result[j], root)
      if (j + 1 < degree) result[j] ^= result[j + 1]
    }
    root = multiply(root, 2)
  }
  return result
}

function reedSolomonRemainder(data: number[], divisor: number[]): number[] {
  const result: number[] = new Array(divisor.length).fill(0)
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number)
    result.push(0)
    divisor.forEach((coef, i) => (result[i] ^= multiply(coef, factor)))
  }
  return result
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

function draw(codewords: number[], version: number): boolean[][] {
  const size = version * 4 + 17
  const modules: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false))
  const isFunction: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false))

  const set = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark
    isFunction[y][x] = true
  }

  // Líneas de sincronía.
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0)
    set(i, 6, i % 2 === 0)
  }

  // Los tres buscadores, con su separador blanco.
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx
        const y = cy + dy
        if (x < 0 || y < 0 || x >= size || y >= size) continue
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        set(x, y, dist !== 2 && dist !== 4)
      }
    }
  }
  finder(3, 3)
  finder(size - 4, 3)
  finder(3, size - 4)

  // Alineación: en todas las combinaciones menos las que pisan un buscador.
  const centers = ALIGNMENT[version]
  centers.forEach((cy, i) => {
    centers.forEach((cx, j) => {
      const onFinder =
        (i === 0 && j === 0) ||
        (i === 0 && j === centers.length - 1) ||
        (i === centers.length - 1 && j === 0)
      if (onFinder) return
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
        }
      }
    })
  })

  // Los bits de formato: nivel M (00) y máscara. Se reservan ahora y se escriben al final.
  const drawFormat = (mask: number) => {
    const data = mask // nivel M = 0b00
    let rem = data
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((data << 10) | rem) ^ 0x5412
    const bit = (i: number) => ((bits >>> i) & 1) !== 0
    for (let i = 0; i <= 5; i++) set(8, i, bit(i))
    set(8, 7, bit(6))
    set(8, 8, bit(7))
    set(7, 8, bit(8))
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i))
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i))
    set(8, size - 8, true)
  }
  drawFormat(0)

  // Los datos, en zigzag de a dos columnas desde abajo a la derecha.
  let bit = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vert : vert
        if (!isFunction[y][x] && bit < codewords.length * 8) {
          modules[y][x] = ((codewords[bit >>> 3] >>> (7 - (bit & 7))) & 1) !== 0
          bit++
        }
      }
    }
  }

  // La máscara que deja el dibujo más parejo, que es la que mejor se lee.
  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!isFunction[y][x] && MASKS[mask](x, y)) modules[y][x] = !modules[y][x]
      }
    }
  }
  let best = 0
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask)
    drawFormat(mask)
    const score = penalty(modules)
    if (score < bestScore) {
      best = mask
      bestScore = score
    }
    applyMask(mask)
  }
  applyMask(best)
  drawFormat(best)
  return modules
}

/**
 * Qué tan desparejo quedó el dibujo: rachas largas del mismo color, bloques de 2 × 2 y
 * un balance lejos de mitad y mitad. Es una versión resumida de la del estándar —sin el
 * chequeo de falsos buscadores—: cualquier máscara da un código válido, esto solo elige
 * la que mejor se lee.
 */
function penalty(modules: boolean[][]): number {
  const size = modules.length
  let score = 0

  for (const transpose of [false, true]) {
    for (let a = 0; a < size; a++) {
      let run = 1
      for (let b = 1; b < size; b++) {
        const same = transpose
          ? modules[b][a] === modules[b - 1][a]
          : modules[a][b] === modules[a][b - 1]
        if (same) {
          run++
          if (run === 5) score += 3
          else if (run > 5) score++
        } else {
          run = 1
        }
      }
    }
  }

  let dark = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) dark++
      if (
        x + 1 < size &&
        y + 1 < size &&
        modules[y][x] === modules[y][x + 1] &&
        modules[y][x] === modules[y + 1][x] &&
        modules[y][x] === modules[y + 1][x + 1]
      ) {
        score += 3
      }
    }
  }
  const percent = (dark * 100) / (size * size)
  return score + Math.floor(Math.abs(percent - 50) / 5) * 10
}

import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Deja el WebAssembly de MediaPipe en `public/cabeza/wasm`, para que el sitio lo
 * sirva él mismo y no dependa de un CDN.
 *
 * Se copia desde node_modules en vez de commitearlo: son veinte megas que ya
 * trae `npm install`, y así la versión es siempre la del package.json. Corre antes
 * de `dev` (como `predev`) y de cada build.
 */
const FROM = 'node_modules/@mediapipe/tasks-vision/wasm'
const TO = 'public/cabeza/wasm'
// Con y sin SIMD: el cargador elige según el navegador.
const FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]

mkdirSync(TO, { recursive: true })
for (const file of FILES) copyFileSync(join(FROM, file), join(TO, file))

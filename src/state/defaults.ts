import type { AppState } from '../types'

/**
 * Dibujo de línea de ejemplo. Va como SVG inline para no depender de ningún asset
 * binario: la app abre con algo ya enmarcado y eso es lo que invita a tocar los
 * controles antes de cargar la obra propia.
 */
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
  <rect width="600" height="800" fill="#f0eadc"/>
  <g fill="none" stroke="#3a332c" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M300 764 C292 656 312 548 297 438 C287 348 302 268 301 196"/>
    <path d="M301 196 C296 172 305 150 318 138 C330 152 330 176 316 194 Z" fill="#3a332c" opacity="0.08"/>
    <path d="M301 196 C296 172 305 150 318 138 C330 152 330 176 316 194 Z"/>
    <path d="M299 672 C352 692 414 668 442 622 C398 606 332 626 299 672 Z"/>
    <path d="M299 672 C344 656 396 638 442 622" stroke-width="2"/>
    <path d="M296 604 C243 626 181 604 155 557 C199 542 265 561 296 604 Z"/>
    <path d="M296 604 C251 587 199 570 155 557" stroke-width="2"/>
    <path d="M302 512 C355 530 415 505 441 459 C397 445 333 466 302 512 Z"/>
    <path d="M302 512 C347 496 397 476 441 459" stroke-width="2"/>
    <path d="M295 444 C244 464 186 442 162 398 C204 384 266 403 295 444 Z"/>
    <path d="M295 444 C252 428 204 412 162 398" stroke-width="2"/>
    <path d="M299 356 C346 372 399 350 422 309 C383 297 327 315 299 356 Z"/>
    <path d="M299 356 C339 341 383 323 422 309" stroke-width="2"/>
    <path d="M297 292 C254 308 205 289 185 252 C220 240 272 257 297 292 Z"/>
    <path d="M297 292 C261 278 220 264 185 252" stroke-width="2"/>
  </g>
  <g stroke="#3a332c" stroke-width="1.1" opacity="0.3" stroke-linecap="round">
    <path d="M120 700 L172 648 M138 712 L196 654 M158 722 L216 664 M178 730 L238 670"/>
    <path d="M432 214 L474 172 M448 228 L494 182 M466 240 L512 194"/>
  </g>
  <path d="M420 742 C432 730 446 734 448 746" fill="none" stroke="#3a332c" stroke-width="2" opacity="0.55" stroke-linecap="round"/>
</svg>`

export const PLACEHOLDER_SRC = `data:image/svg+xml;utf8,${encodeURIComponent(PLACEHOLDER_SVG)}`

/** Un A3 aproximado con moldura de nogal: el punto de partida más común. */
export const DEFAULT_STATE: AppState = {
  artwork: {
    src: PLACEHOLDER_SRC,
    title: 'Obra maestra',
    size: { w: 30, h: 40 },
    rotation: 0,
    sizeConfirmed: false,
    lockRatio: true,
  },
  frame: {
    width: 3,
    depth: 2,
    color: '#6b4326',
    material: 'wood',
    finish: 'grained',
    profile: 'scoop',
  },
  mats: [{ enabled: true, width: 5, color: '#ece5d6' }],
  glass: 'clear',
  wall: { color: '#cfcdc8', pattern: 'plaster' },
  snapshots: [],
}

/**
 * Los íconos propios de Enmarcado: las cinco partes del cuadro, girar, la regla y el
 * candado de la proporción. No están en Figma, así que van dibujados con la métrica del
 * sistema (24×24, trazo de 1,8) y pasan por el mismo `Drawn` que los de Figma: el mismo
 * temblor en reposo y el mismo hervor al pasar el mouse. Subir sale de `shared/ui`.
 */

import { Drawn, type IconSpec } from '../../../shared/ui'

const FRAME: IconSpec = [0, 0, 'M 4.5 3 L 19.5 3 C 20.33 3 21 3.67 21 4.5 L 21 19.5 C 21 20.33 20.33 21 19.5 21 L 4.5 21 C 3.67 21 3 20.33 3 19.5 L 3 4.5 C 3 3.67 3.67 3 4.5 3 Z M 7.5 7 L 16.5 7 C 16.78 7 17 7.22 17 7.5 L 17 16.5 C 17 16.78 16.78 17 16.5 17 L 7.5 17 C 7.22 17 7 16.78 7 16.5 L 7 7.5 C 7 7.22 7.22 7 7.5 7 Z M 3 3 L 7 7 M 21 3 L 17 7 M 21 21 L 17 17 M 3 21 L 7 17']
const MAT: IconSpec = [0, 0, 'M 4.5 3 L 19.5 3 C 20.33 3 21 3.67 21 4.5 L 21 19.5 C 21 20.33 20.33 21 19.5 21 L 4.5 21 C 3.67 21 3 20.33 3 19.5 L 3 4.5 C 3 3.67 3.67 3 4.5 3 Z M 8.5 8 L 15.5 8 C 15.78 8 16 8.22 16 8.5 L 16 15.5 C 16 15.78 15.78 16 15.5 16 L 8.5 16 C 8.22 16 8 15.78 8 15.5 L 8 8.5 C 8 8.22 8.22 8 8.5 8 Z']
const GLASS: IconSpec = [0, 0, 'M 4.5 3 L 19.5 3 C 20.33 3 21 3.67 21 4.5 L 21 19.5 C 21 20.33 20.33 21 19.5 21 L 4.5 21 C 3.67 21 3 20.33 3 19.5 L 3 4.5 C 3 3.67 3.67 3 4.5 3 Z M 5 16 L 16 5 M 11 19 L 19 11']
const WALL: IconSpec = [0, 0, 'M 4 4 L 20 4 C 20.83 4 21.5 4.67 21.5 5.5 L 21.5 18.5 C 21.5 19.33 20.83 20 20 20 L 4 20 C 3.17 20 2.5 19.33 2.5 18.5 L 2.5 5.5 C 2.5 4.67 3.17 4 4 4 Z M 2.5 9.5 L 21.5 9.5 M 2.5 15 L 21.5 15 M 9 4 L 9 9.5 M 15 9.5 L 15 15 M 9 15 L 9 20']
const ART: IconSpec = [0, 0, 'M 4.5 4 L 19.5 4 C 20.33 4 21 4.67 21 5.5 L 21 18.5 C 21 19.33 20.33 20 19.5 20 L 4.5 20 C 3.67 20 3 19.33 3 18.5 L 3 5.5 C 3 4.67 3.67 4 4.5 4 Z M 7.4 9.5 L 7.43 9.17 L 7.54 8.85 L 7.71 8.56 L 7.93 8.31 L 8.2 8.11 L 8.51 7.98 L 8.83 7.91 L 9.17 7.91 L 9.49 7.98 L 9.8 8.11 L 10.07 8.31 L 10.29 8.56 L 10.46 8.85 L 10.57 9.17 L 10.6 9.5 L 10.57 9.83 L 10.46 10.15 L 10.29 10.44 L 10.07 10.69 L 9.8 10.89 L 9.49 11.02 L 9.17 11.09 L 8.83 11.09 L 8.51 11.02 L 8.2 10.89 L 7.93 10.69 L 7.71 10.44 L 7.54 10.15 L 7.43 9.83 L 7.4 9.5 M 3.5 17 L 8.5 12 L 12.5 16 L 15.5 13.5 L 20.5 17.5']
const ROTATE: IconSpec = [0, 0, 'M 20 11 L 19.8 9.32 L 19.26 7.73 L 18.39 6.28 L 17.24 5.04 L 15.86 4.08 L 14.3 3.42 L 12.65 3.11 L 10.96 3.15 L 9.32 3.55 L 7.8 4.28 L 6.46 5.31 L 5.37 6.6 L 4.58 8.09 L 4.12 9.72 L 4.01 11.4 L 4.25 13.07 L 4.84 14.65 L 5.75 16.07 L 6.93 17.27 L 8.34 18.2 L 9.92 18.81 L 11.58 19.08 L 13.27 18.99 L 14.9 18.54 L 16.4 17.77 L 17.7 16.7 M 20 4.5 L 20 11 L 13.8 11']
const RULER: IconSpec = [0, 0, 'M 3.3 8 L 20.7 8 C 21.42 8 22 8.58 22 9.3 L 22 14.7 C 22 15.42 21.42 16 20.7 16 L 3.3 16 C 2.58 16 2 15.42 2 14.7 L 2 9.3 C 2 8.58 2.58 8 3.3 8 Z M 6.5 8 L 6.5 11 M 10 8 L 10 12.5 M 13.5 8 L 13.5 11 M 17 8 L 17 12.5']
const LINK: IconSpec = [0, 0, 'M 10 13.5 L 10.7 14.07 L 11.52 14.46 L 12.4 14.67 L 13.3 14.67 L 14.18 14.46 L 15 14.07 L 15.7 13.5 L 18.7 10.5 L 19.23 9.85 L 19.61 9.09 L 19.83 8.28 L 19.87 7.44 L 19.74 6.61 L 19.44 5.82 L 18.98 5.11 L 18.39 4.52 L 17.68 4.06 L 16.89 3.76 L 16.06 3.63 L 15.22 3.67 L 14.41 3.89 L 13.65 4.27 L 13 4.8 L 11.6 6.2 M 14 10.5 L 13.3 9.93 L 12.48 9.54 L 11.6 9.33 L 10.7 9.33 L 9.82 9.54 L 9 9.93 L 8.3 10.5 L 5.3 13.5 L 4.77 14.15 L 4.39 14.91 L 4.17 15.72 L 4.13 16.56 L 4.26 17.39 L 4.56 18.18 L 5.02 18.89 L 5.61 19.48 L 6.32 19.94 L 7.11 20.24 L 7.94 20.37 L 8.78 20.33 L 9.59 20.11 L 10.35 19.73 L 11 19.2 L 12.4 17.8']
const UNLINK: IconSpec = [0, 0, 'M 10.5 13 L 11.2 13.57 L 12.02 13.96 L 12.9 14.17 L 13.8 14.17 L 14.68 13.96 L 15.5 13.57 L 16.2 13 L 18.2 11 L 18.73 10.35 L 19.11 9.59 L 19.33 8.78 L 19.37 7.94 L 19.24 7.11 L 18.94 6.32 L 18.48 5.61 L 17.89 5.02 L 17.18 4.56 L 16.39 4.26 L 15.56 4.13 L 14.72 4.17 L 13.91 4.39 L 13.15 4.77 L 12.5 5.3 L 11.5 6.3 M 13.5 11 L 12.8 10.43 L 11.98 10.04 L 11.1 9.83 L 10.2 9.83 L 9.32 10.04 L 8.5 10.43 L 7.8 11 L 5.8 13 L 5.27 13.65 L 4.89 14.41 L 4.67 15.22 L 4.63 16.06 L 4.76 16.89 L 5.06 17.68 L 5.52 18.39 L 6.11 18.98 L 6.82 19.44 L 7.61 19.74 L 8.44 19.87 L 9.28 19.83 L 10.09 19.61 L 10.85 19.23 L 11.5 18.7 L 12.5 17.7 M 3 3 L 21 21']

export function FrameIcon() {
  return <Drawn spec={FRAME} seed={66} />
}

export function MatIcon() {
  return <Drawn spec={MAT} seed={40} />
}

export function GlassIcon() {
  return <Drawn spec={GLASS} seed={66} />
}

export function WallIcon() {
  return <Drawn spec={WALL} seed={53} />
}

export function ArtIcon() {
  return <Drawn spec={ART} seed={40} />
}

export function RotateIcon() {
  return <Drawn spec={ROTATE} seed={79} />
}

export function RulerIcon() {
  return <Drawn spec={RULER} seed={66} />
}

export function LinkIcon() {
  return <Drawn spec={LINK} seed={53} />
}

export function UnlinkIcon() {
  return <Drawn spec={UNLINK} seed={79} />
}

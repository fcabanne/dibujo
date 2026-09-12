import type {
  FrameFinish,
  FrameMaterial,
  FrameProfile,
  GlassType,
  WallPattern,
} from '../types'

export interface FramePreset {
  id: string
  label: string
  color: string
}

/**
 * Colores de moldura, de claro a oscuro. Son solo color: la veta y el acabado se
 * eligen aparte, en MOLDING_TYPES, para no mezclar dos decisiones en un swatch.
 */
export const FRAME_PRESETS: FramePreset[] = [
  { id: 'blanco', label: 'Blanco', color: '#f2efe9' },
  { id: 'crudo', label: 'Crudo', color: '#d9cdb8' },
  { id: 'pino', label: 'Pino', color: '#c99a5f' },
  { id: 'dorado', label: 'Dorado', color: '#c9a233' },
  { id: 'roble', label: 'Roble', color: '#a97c47' },
  { id: 'plata', label: 'Plata', color: '#b9bcc0' },
  { id: 'caoba', label: 'Caoba', color: '#7a3320' },
  { id: 'nogal', label: 'Nogal', color: '#6b4326' },
  { id: 'verde', label: 'Verde inglés', color: '#2f4438' },
  { id: 'negro', label: 'Negro', color: '#191919' },
]


/**
 * Acabados: la veta y el brillo van juntos porque son una sola decisión de taller.
 * Elegir "cepillado" es elegir metal satinado, no dos cosas.
 */
export interface MoldingType {
  id: string
  label: string
  material: FrameMaterial
  finish: FrameFinish
}

export const MOLDING_TYPES: MoldingType[] = [
  { id: 'veteado', label: 'Veteado', material: 'wood', finish: 'grained' },
  { id: 'madera-lisa', label: 'Madera lisa', material: 'wood', finish: 'satin' },
  { id: 'mate', label: 'Mate', material: 'painted', finish: 'matte' },
  { id: 'satinado', label: 'Satinado', material: 'painted', finish: 'satin' },
  { id: 'laca', label: 'Laca', material: 'painted', finish: 'gloss' },
  { id: 'cepillado', label: 'Cepillado', material: 'metal', finish: 'satin' },
  { id: 'pulido', label: 'Pulido', material: 'metal', finish: 'gloss' },
]

export interface MatPreset {
  id: string
  label: string
  color: string
}

/** Los passe-partout viven en los crudos; de claro a oscuro. */
export const MAT_PRESETS: MatPreset[] = [
  { id: 'blanco', label: 'Blanco puro', color: '#f6f4ef' },
  { id: 'hueso', label: 'Hueso', color: '#ece5d6' },
  { id: 'crudo', label: 'Crudo', color: '#ded3bd' },
  { id: 'gris-claro', label: 'Gris claro', color: '#d4d2cd' },
  { id: 'arena', label: 'Arena', color: '#cbbb9c' },
  { id: 'topo', label: 'Topo', color: '#9c948a' },
  { id: 'oliva', label: 'Oliva', color: '#7b7d5f' },
  { id: 'borgona', label: 'Borgoña', color: '#6d3a3f' },
  { id: 'carbon', label: 'Carbón', color: '#3a3a3c' },
  { id: 'negro', label: 'Negro', color: '#1c1c1e' },
]

export interface WallPreset {
  id: string
  label: string
  color: string
}

/** Colores de pared, de claro a oscuro. */
export const WALL_PRESETS: WallPreset[] = [
  { id: 'blanco-roto', label: 'Blanco roto', color: '#eae6de' },
  { id: 'arena', label: 'Arena', color: '#d8c8ad' },
  { id: 'perla', label: 'Gris perla', color: '#cfcdc8' },
  { id: 'salvia', label: 'Verde salvia', color: '#9fa98f' },
  { id: 'humo', label: 'Azul humo', color: '#8d9aa6' },
  { id: 'terracota', label: 'Terracota', color: '#b4735a' },
  { id: 'topo', label: 'Topo', color: '#8d8377' },
  { id: 'tinta', label: 'Azul tinta', color: '#2f3a4a' },
  { id: 'carbon', label: 'Carbón', color: '#3d3f42' },
]

export const WALL_PATTERNS: { id: WallPattern; label: string }[] = [
  { id: 'plain', label: 'Liso' },
  { id: 'plaster', label: 'Yeso' },
  { id: 'stucco', label: 'Gotelé' },
  { id: 'linen', label: 'Lino' },
]

export const GLASS_TYPES: { id: GlassType; label: string; hint: string }[] = [
  { id: 'none', label: 'Sin vidrio', hint: 'obra al aire' },
  { id: 'clear', label: 'Cristal', hint: 'refleja' },
  { id: 'antireflective', label: 'Antirreflejo', hint: 'sin brillo' },
  { id: 'matte', label: 'Mate', hint: 'difumina' },
]

export interface ProfilePreset {
  id: FrameProfile
  label: string
}

/** Las secciones de moldura más habituales en una casa de cuadros. */
export const FRAME_PROFILES: ProfilePreset[] = [
  { id: 'flat', label: 'Plana' },
  { id: 'bevel', label: 'Biselada' },
  { id: 'scoop', label: 'Caveta' },
  { id: 'round', label: 'Bombé' },
  { id: 'step', label: 'Escalonada' },
]

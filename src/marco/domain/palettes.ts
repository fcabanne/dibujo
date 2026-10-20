import { copy } from '../../shared/copy'
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
  { id: 'blanco', label: copy.marco.options.frameColors.blanco, color: '#f2efe9' },
  { id: 'crudo', label: copy.marco.options.frameColors.crudo, color: '#d9cdb8' },
  { id: 'pino', label: copy.marco.options.frameColors.pino, color: '#c99a5f' },
  { id: 'dorado', label: copy.marco.options.frameColors.dorado, color: '#c9a233' },
  { id: 'roble', label: copy.marco.options.frameColors.roble, color: '#a97c47' },
  { id: 'plata', label: copy.marco.options.frameColors.plata, color: '#b9bcc0' },
  { id: 'caoba', label: copy.marco.options.frameColors.caoba, color: '#7a3320' },
  { id: 'nogal', label: copy.marco.options.frameColors.nogal, color: '#6b4326' },
  { id: 'verde', label: copy.marco.options.frameColors.verde, color: '#2f4438' },
  { id: 'negro', label: copy.marco.options.frameColors.negro, color: '#191919' },
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
  { id: 'veteado', label: copy.marco.options.moldingTypes.veteado, material: 'wood', finish: 'grained' },
  { id: 'madera-lisa', label: copy.marco.options.moldingTypes['madera-lisa'], material: 'wood', finish: 'satin' },
  { id: 'mate', label: copy.marco.options.moldingTypes.mate, material: 'painted', finish: 'matte' },
  { id: 'satinado', label: copy.marco.options.moldingTypes.satinado, material: 'painted', finish: 'satin' },
  { id: 'laca', label: copy.marco.options.moldingTypes.laca, material: 'painted', finish: 'gloss' },
  { id: 'cepillado', label: copy.marco.options.moldingTypes.cepillado, material: 'metal', finish: 'satin' },
  { id: 'pulido', label: copy.marco.options.moldingTypes.pulido, material: 'metal', finish: 'gloss' },
]

/**
 * Las tres familias que se piden de verdad en una casa de cuadros: madera, pintada y
 * metal. Las siete de arriba se distinguen mirando de cerca —veteado o lisa, mate o
 * satinado—, pero en el cuadro terminado la diferencia casi no se ve, y elegir entre
 * siete para ver lo mismo es trabajo de más. Las usa el celular; el escritorio sigue
 * con la lista entera.
 *
 * Se elige la familia por el material: un marco que venga con otro acabado de la
 * misma familia —"Laca", armado en escritorio— se reconoce como "Pintado".
 */
export const MOLDING_FAMILIES: MoldingType[] = [
  { id: 'madera', label: copy.marco.options.moldingFamilies.madera, material: 'wood', finish: 'grained' },
  { id: 'pintado', label: copy.marco.options.moldingFamilies.pintado, material: 'painted', finish: 'satin' },
  { id: 'metal', label: copy.marco.options.moldingFamilies.metal, material: 'metal', finish: 'satin' },
]

export interface MatPreset {
  id: string
  label: string
  color: string
}

/** Los passe-partout viven en los crudos; de claro a oscuro. */
export const MAT_PRESETS: MatPreset[] = [
  { id: 'blanco', label: copy.marco.options.matColors.blanco, color: '#f6f4ef' },
  { id: 'hueso', label: copy.marco.options.matColors.hueso, color: '#ece5d6' },
  { id: 'crudo', label: copy.marco.options.matColors.crudo, color: '#ded3bd' },
  { id: 'gris-claro', label: copy.marco.options.matColors['gris-claro'], color: '#d4d2cd' },
  { id: 'arena', label: copy.marco.options.matColors.arena, color: '#cbbb9c' },
  { id: 'topo', label: copy.marco.options.matColors.topo, color: '#9c948a' },
  { id: 'oliva', label: copy.marco.options.matColors.oliva, color: '#7b7d5f' },
  { id: 'borgona', label: copy.marco.options.matColors.borgona, color: '#6d3a3f' },
  { id: 'carbon', label: copy.marco.options.matColors.carbon, color: '#3a3a3c' },
  { id: 'negro', label: copy.marco.options.matColors.negro, color: '#1c1c1e' },
]

export interface WallPreset {
  id: string
  label: string
  color: string
}

/** Colores de pared, de claro a oscuro. */
export const WALL_PRESETS: WallPreset[] = [
  { id: 'blanco-roto', label: copy.marco.options.wallColors['blanco-roto'], color: '#eae6de' },
  { id: 'arena', label: copy.marco.options.wallColors.arena, color: '#d8c8ad' },
  { id: 'perla', label: copy.marco.options.wallColors.perla, color: '#cfcdc8' },
  { id: 'salvia', label: copy.marco.options.wallColors.salvia, color: '#9fa98f' },
  { id: 'humo', label: copy.marco.options.wallColors.humo, color: '#8d9aa6' },
  { id: 'terracota', label: copy.marco.options.wallColors.terracota, color: '#b4735a' },
  { id: 'topo', label: copy.marco.options.wallColors.topo, color: '#8d8377' },
  { id: 'tinta', label: copy.marco.options.wallColors.tinta, color: '#2f3a4a' },
  { id: 'carbon', label: copy.marco.options.wallColors.carbon, color: '#3d3f42' },
]

export const WALL_PATTERNS: { id: WallPattern; label: string }[] = [
  { id: 'plain', label: copy.marco.options.wallPatterns.plain },
  { id: 'plaster', label: copy.marco.options.wallPatterns.plaster },
  { id: 'stucco', label: copy.marco.options.wallPatterns.stucco },
  { id: 'linen', label: copy.marco.options.wallPatterns.linen },
]

export const GLASS_TYPES: { id: GlassType; label: string; hint: string }[] = [
  { id: 'none', label: copy.marco.options.glass.none.label, hint: copy.marco.options.glass.none.hint },
  { id: 'clear', label: copy.marco.options.glass.clear.label, hint: copy.marco.options.glass.clear.hint },
  { id: 'antireflective', label: copy.marco.options.glass.antireflective.label, hint: copy.marco.options.glass.antireflective.hint },
  { id: 'matte', label: copy.marco.options.glass.matte.label, hint: copy.marco.options.glass.matte.hint },
]

export interface ProfilePreset {
  id: FrameProfile
  label: string
}

/** Las secciones de moldura más habituales en una casa de cuadros. */
export const FRAME_PROFILES: ProfilePreset[] = [
  { id: 'flat', label: copy.marco.options.profiles.flat },
  { id: 'bevel', label: copy.marco.options.profiles.bevel },
  { id: 'scoop', label: copy.marco.options.profiles.scoop },
  { id: 'round', label: copy.marco.options.profiles.round },
  { id: 'step', label: copy.marco.options.profiles.step },
]

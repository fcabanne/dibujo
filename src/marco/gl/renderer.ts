import { MAT_OVERLAP, type SceneRects } from '../domain/geometry'
import { REST_LIGHT, hexToRgb, shadowTint, spotPosition } from '../render/light'
import { nailOf, type Pose } from '../render/pose'
import { grainTile } from '../render/noise'
import { speciesOf, woodContrast, woodTile } from '../render/wood'
import type { AppState, Rect } from '../types'
import { artMesh, depthsFor, frameMesh, matMeshes, planeMesh, type Mesh } from './meshes'
import { ENV_H, ENV_W, studioEnvironment } from './environment'
import { FRAGMENT, VERTEX } from './shaders'

/**
 * El cuadro en 3D, dibujado con WebGL2 en un lienzo encima del de siempre.
 *
 * La pared y la sombra siguen en el lienzo 2D, debajo; acá va solo el objeto. Lo
 * mueve el mismo cuerpo que al 2D —la misma pose, las mismas medidas—, y en reposo su
 * frente cae exactamente donde caía el dibujo plano, así que las burbujas, la cartela y
 * lo que se agarra con el mouse no se enteran de cuál de los dos está dibujando.
 *
 * Es un prototipo: se prende con `?gl` en la dirección, para compararlo con el 2D.
 */

export interface ObjectFrame {
  state: AppState
  rects: SceneRects
  pose: Pose
  pxPerCm: number
  dpr: number
  width: number
  height: number
  /** El ojo, en cm respecto del centro del cuadro (ver `eyeOf`). */
  eye: { x: number; y: number; z: number }
  image: HTMLImageElement | null
  hasFrame: boolean
  hasMat: boolean
  /** El espesor del cuadro, en cm: cuánto se separa de la pared el canto que apoya. */
  depthCm: number
  /** Dónde está la pared detrás del frente del cuadro, en cm (lo mismo que usa `wallShift`). */
  wallCm: number
  /** La cuña de arriba en reposo, en cm (`standoff`). */
  standoffCm: number
  /** Si se dibuja solo una parte de la pantalla, en px: la mitad 3D de la comparación. */
  scissor?: Rect
}

export interface ObjectRenderer {
  render(frame: ObjectFrame): void
  dispose(): void
}

interface Uniforms {
  [name: string]: WebGLUniformLocation | null
}

const UNIFORMS = [
  'uModel', 'uEye', 'uView', 'uLightPos', 'uLightColor', 'uAmbientTop', 'uAmbientBottom', 'uExposure',
  'uMode', 'uAlbedo', 'uRough', 'uContrast', 'uWoodMean', 'uWoodScale', 'uWoodOffset', 'uTex', 'uGrain',
  'uBlur', 'uF0', 'uHaze', 'uFalloff', 'uWall', 'uRebate', 'uRebateDepth', 'uLip', 'uLipDepth',
  'uEnv', 'uPxPerCm', 'uPeel', 'uCoat', 'uPores',
  'uHull', 'uSpan', 'uGap', 'uPen', 'uStrength', 'uOutline', 'uContact', 'uTint',
]

/** El brillo del foco. Se calibra contra el 2D: un color plano tiene que verse igual en los dos. */
const LIGHT = [1.0, 0.985, 0.965]
const EXPOSURE = 1.32

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('No se pudo crear el shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader inválido')
  }
  return shader
}

const rgb = (hex: string): [number, number, number] => {
  const { r, g, b } = hexToRgb(hex)
  return [r / 255, g / 255, b / 255]
}

/** El rugoso de cada acabado: una laca brilla chico y fuerte, un mate casi no brilla. */
function roughOf(finish: string): number {
  if (finish === 'gloss') return 0.22
  if (finish === 'satin') return 0.38
  if (finish === 'grained') return 0.55
  return 0.7
}

/** Cuánta laca lleva encima un acabado: la brillante entera, el satinado a medias. */
function coatOf(finish: string): number {
  if (finish === 'gloss') return 1
  if (finish === 'satin') return 0.45
  return 0
}

/**
 * Los vidrios. El común refleja claro el cuarto. El antirreflejo refleja poco y
 * borroso, y tiene una piel de puntitos que se ve donde le pega el reflejo: no es
 * invisible, es más discreto. El mate tiene la misma piel más marcada, y una bruma.
 */
const GLASS = {
  none: { f0: 0, rough: 0, haze: 0, peel: 0 },
  clear: { f0: 0.05, rough: 0.03, haze: 0, peel: 0 },
  antireflective: { f0: 0.02, rough: 0.32, haze: 0.012, peel: 0.35 },
  matte: { f0: 0.035, rough: 0.55, haze: 0.06, peel: 0.9 },
}

/** Una matriz 4×4 en columnas, como la quiere WebGL. */
type Mat4 = Float32Array

function identity(): Mat4 {
  const m = new Float32Array(16)
  m[0] = m[5] = m[10] = m[15] = 1
  return m
}

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
      out[c * 4 + r] = s
    }
  }
  return out
}

function translate(x: number, y: number, z: number): Mat4 {
  const m = identity()
  m[12] = x
  m[13] = y
  m[14] = z
  return m
}

function rotateZ(a: number): Mat4 {
  const m = identity()
  const c = Math.cos(a)
  const s = Math.sin(a)
  m[0] = c
  m[1] = s
  m[4] = -s
  m[5] = c
  return m
}

function rotateX(a: number): Mat4 {
  const m = identity()
  const c = Math.cos(a)
  const s = Math.sin(a)
  m[5] = c
  m[6] = s
  m[9] = -s
  m[10] = c
  return m
}

/**
 * La pose del cuadro como transformación 3D. Lo mismo que hace el 2D —asiento,
 * balanceo sobre el clavo, giro—, pero despegarse de la pared ahora es acercarse al
 * ojo de verdad, y apretarlo contra la pared lo inclina: el canto de arriba se va
 * para atrás sobre el de abajo, que apoya.
 */
function modelOf(pose: Pose, rects: SceneRects, pxPerCm: number): Mat4 {
  const { center, outer } = rects
  const nail = nailOf(rects)
  const standoff = Math.min(2, Math.max(0.6, (outer.h / pxPerCm) * 0.03)) * pxPerCm
  const pitch = Math.atan2((1 - pose.lean) * standoff, outer.h)
  const bottom = outer.h / 2
  let m = translate(0, pose.drop * pxPerCm, 0)
  m = multiply(m, translate(nail.x, nail.y, 0))
  m = multiply(m, rotateZ(pose.roll))
  m = multiply(m, translate(center.x - nail.x, center.y - nail.y, 0))
  m = multiply(m, rotateZ(pose.turn))
  m = multiply(m, translate(0, 0, pose.lift * pxPerCm))
  m = multiply(m, translate(0, bottom, 0))
  m = multiply(m, rotateX(pitch))
  m = multiply(m, translate(0, -bottom, 0))
  m = multiply(m, translate(-center.x, -center.y, 0))
  return m
}

type V2 = [number, number]

/** Un punto del cuadro en reposo llevado a donde está ahora, con la pose. */
function apply(m: Mat4, x: number, y: number, z: number): [number, number, number] {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]
}

/** La envolvente convexa, en orden: la sombra es lo que barre el cuadro entre la cara de adelante y la de atrás. */
function hull(points: V2[]): V2[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: V2, a: V2, b: V2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: V2[] = []
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper: V2[] = []
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop()
    upper.push(q)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

/**
 * La sombra del cuadro sobre la pared, proyectada desde el foco. Cada esquina del
 * cuadro —ya con su pose: balanceado, despegado, apretado— se separa de la pared lo
 * que se separa ese canto: el de abajo apoya, el de arriba se despega con la cuña. El
 * foco la tira sobre el plano de la pared, y la sombra es lo que barre el cuadro entre
 * su cara de atrás y la de adelante.
 */
function shadowOf(f: ObjectFrame, model: Mat4, light: [number, number, number]) {
  const { outer } = f.rects
  const px = f.pxPerCm
  const wallZ = -f.wallCm * px
  const lift = Math.max(0, f.pose.lift) * px
  const depth = f.depthCm * px
  const lean = f.standoffCm * Math.max(0, f.pose.lean) * px
  const corners: V2[] = [
    [outer.x, outer.y],
    [outer.x + outer.w, outer.y],
    [outer.x + outer.w, outer.y + outer.h],
    [outer.x, outer.y + outer.h],
  ]
  // Cuánto se separa de la pared el fondo de cada esquina: arriba la cuña, abajo nada.
  const backGap = [lean + lift, lean + lift, lift, lift]
  const project = (x: number, y: number, gap: number): V2 => {
    const z = wallZ + gap
    const t = (light[2] - wallZ) / Math.max(1, light[2] - z)
    // Proyectada tal cual desde un foco tan alto caía a más del doble de la
    // separación; se aplana el ángulo y se conserva la dirección.
    return [x + (light[0] + (x - light[0]) * t - x) * SHADOW_RAKE, y + (light[1] + (y - light[1]) * t - y) * SHADOW_RAKE]
  }
  const posed = corners.map(([x, y]) => apply(model, x, y, 0))
  const front = posed.map((p, i) => project(p[0], p[1], backGap[i] + depth))
  const back = posed.map((p, i) => project(p[0], p[1], backGap[i]))
  const shape = hull([...front, ...back])
  while (shape.length < 8) shape.push(shape[shape.length - 1])
  return {
    hull: shape.slice(0, 8),
    span: [(front[0][0] + front[1][0]) / 2, (front[0][1] + front[1][1]) / 2, (front[2][0] + front[3][0]) / 2, (front[2][1] + front[3][1]) / 2],
    gap: [backGap[0] + depth, backGap[2] + depth],
    outline: posed.map((p) => [p[0], p[1]] as V2),
    wallZ,
    lift,
  }
}

/** Cuánto se abre la penumbra por cada px que el cuadro se separa de la pared: un foco grande y cerca. */
const PENUMBRA = 1.1
/**
 * Cuánto del corrimiento de la sombra se respeta. El foco de la escena es muy
 * empinado —está pensado para el brillo de la moldura— y su sombra caía lejos del
 * cuadro; con esto queda a poco menos de una vez la separación de la pared.
 */
const SHADOW_RAKE = 0.4
/** Lo oscura que es la sombra pegada a la pared: lo que queda es la luz del cuarto. */
const SHADOW_STRENGTH = 0.72

export function createObjectRenderer(canvas: HTMLCanvasElement): ObjectRenderer | null {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: true, alpha: true })
  if (!gl) return null

  let program: WebGLProgram
  try {
    program = gl.createProgram() as WebGLProgram
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? '')
  } catch (e) {
    console.warn('El cuadro en 3D no compiló; queda el 2D.', e)
    return null
  }

  const u: Uniforms = {}
  for (const name of UNIFORMS) u[name] = gl.getUniformLocation(program, name)
  const attrib = {
    pos: gl.getAttribLocation(program, 'aPos'),
    normal: gl.getAttribLocation(program, 'aNormal'),
    uv: gl.getAttribLocation(program, 'aUV'),
  }

  const vao = gl.createVertexArray()
  const buffers = { pos: gl.createBuffer(), normal: gl.createBuffer(), uv: gl.createBuffer(), index: gl.createBuffer() }

  const texture = (source: TexImageSource, mipmaps: boolean, repeat: boolean) => {
    const t = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
    return t
  }

  const grain = texture(grainTile(256, 60, 7), true, true)
  // El estudio que se refleja: una sola vez, con mipmaps para los reflejos borrosos.
  const env = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, env)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ENV_W, ENV_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, studioEnvironment())
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const woods = new Map<HTMLCanvasElement, WebGLTexture | null>()
  let art: { image: HTMLImageElement; tex: WebGLTexture | null } | null = null

  const draw = (m: Mesh) => {
    if (m.indices.length === 0) return
    gl.bindVertexArray(vao)
    const bind = (buffer: WebGLBuffer | null, data: number[], loc: number, size: number) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW)
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
    }
    bind(buffers.pos, m.positions, attrib.pos, 3)
    bind(buffers.normal, m.normals, attrib.normal, 3)
    bind(buffers.uv, m.uvs, attrib.uv, 2)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(m.indices), gl.DYNAMIC_DRAW)
    gl.drawElements(gl.TRIANGLES, m.indices.length, gl.UNSIGNED_SHORT, 0)
  }

  const material = (mode: number, albedo: [number, number, number], rough: number, f0 = 0.04) => {
    gl.uniform1i(u.uMode, mode)
    gl.uniform1f(u.uCoat, 0)
    gl.uniform1f(u.uPeel, 0)
    gl.uniform3fv(u.uAlbedo, albedo)
    gl.uniform1f(u.uRough, rough)
    gl.uniform1f(u.uF0, f0)
  }

  return {
    render(f: ObjectFrame) {
      const w = Math.round(f.width * f.dpr)
      const h = Math.round(f.height * f.dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)
      gl.disable(gl.SCISSOR_TEST)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      if (f.scissor) {
        gl.enable(gl.SCISSOR_TEST)
        const s = f.scissor
        gl.scissor(Math.round(s.x * f.dpr), Math.round(h - (s.y + s.h) * f.dpr), Math.round(s.w * f.dpr), Math.round(s.h * f.dpr))
      }

      gl.useProgram(program)
      gl.enable(gl.DEPTH_TEST)
      gl.depthFunc(gl.LEQUAL)
      gl.disable(gl.CULL_FACE)
      gl.disable(gl.BLEND)

      const { rects, pxPerCm, state } = f
      const c = rects.center
      const spot = spotPosition(REST_LIGHT, rects.outer.w, rects.outer.h, pxPerCm)
      const model = modelOf(f.pose, rects, pxPerCm)
      const lightPos: [number, number, number] = [c.x + spot.x, c.y + spot.y, spot.z]
      gl.uniform3f(u.uEye, c.x + f.eye.x * pxPerCm, c.y + f.eye.y * pxPerCm, f.eye.z * pxPerCm)
      gl.uniform2f(u.uView, f.width, f.height)
      gl.uniform3fv(u.uLightPos, lightPos)
      gl.uniform1f(u.uPxPerCm, pxPerCm)
      gl.uniform3fv(u.uLightColor, LIGHT)
      // La luz que rebota en el cuarto: de la pared, y un poco más oscura desde abajo.
      const wall = rgb(shadowTint(state.wall.color)).map((v) => Math.pow(v, 2.2))
      gl.uniform3f(u.uAmbientTop, wall[0] * 0.3, wall[1] * 0.3, wall[2] * 0.3)
      gl.uniform3f(u.uAmbientBottom, wall[0] * 0.16, wall[1] * 0.16, wall[2] * 0.16)
      gl.uniform1f(u.uExposure, EXPOSURE)
      gl.uniform3fv(u.uWall, rgb(state.wall.color).map((v) => Math.pow(v, 2.2)))
      const o = rects.outer
      gl.uniform3f(
        u.uFalloff,
        o.x + o.w / 2 + REST_LIGHT.x * o.w * 0.16,
        o.y + o.h * 0.42 + REST_LIGHT.y * o.h * 0.12,
        Math.max(o.w, o.h) * 1.5,
      )
      gl.uniform1i(u.uTex, 0)
      gl.uniform1i(u.uGrain, 1)
      gl.uniform1i(u.uEnv, 2)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, grain)
      gl.activeTexture(gl.TEXTURE2)
      gl.bindTexture(gl.TEXTURE_2D, env)

      // La sombra sobre la pared, antes que nada y sin profundidad: es de la pared, y
      // el cuadro se dibuja encima. La pared no se mueve con el cuadro.
      {
        const sh = shadowOf(f, model, lightPos)
        gl.uniformMatrix4fv(u.uModel, false, identity())
        gl.uniform1i(u.uMode, 7)
        gl.uniform2fv(u.uHull, sh.hull.flat())
        gl.uniform4fv(u.uSpan, sh.span)
        gl.uniform2fv(u.uGap, sh.gap)
        gl.uniform1f(u.uPen, PENUMBRA)
        gl.uniform1f(u.uStrength, SHADOW_STRENGTH)
        gl.uniform2fv(u.uOutline, sh.outline.flat())
        gl.uniform1f(u.uContact, Math.exp(-sh.lift / (0.3 * pxPerCm)))
        gl.uniform3fv(u.uTint, rgb(shadowTint(state.wall.color)))
        const pad = Math.max(o.w, o.h) * 0.6
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        gl.disable(gl.DEPTH_TEST)
        draw(planeMesh({ x: o.x - pad, y: o.y - pad, w: o.w + 2 * pad, h: o.h + 2 * pad }, sh.wallZ))
        gl.enable(gl.DEPTH_TEST)
        gl.disable(gl.BLEND)
      }
      gl.uniformMatrix4fv(u.uModel, false, model)

      const d = depthsFor(pxPerCm, f.hasFrame)
      const rebate = f.hasFrame ? rects.glass : { x: 0, y: 0, w: 0, h: 0 }
      gl.uniform4f(u.uRebate, rebate.x, rebate.y, rebate.w, rebate.h)
      gl.uniform1f(u.uRebateDepth, f.hasFrame ? Math.max(3, 1.1 * pxPerCm) : 0)
      const lip = f.hasMat ? rects.sight : { x: 0, y: 0, w: 0, h: 0 }
      gl.uniform4f(u.uLip, lip.x, lip.y, lip.w, lip.h)
      gl.uniform1f(u.uLipDepth, f.hasMat ? 0.45 * pxPerCm : 0)

      // La obra. El mate se ve borroso de verdad: se lee la imagen en una escala más baja.
      if (f.image && f.image.complete && f.image.naturalWidth > 0) {
        if (!art || art.image !== f.image) {
          if (art?.tex) gl.deleteTexture(art.tex)
          gl.activeTexture(gl.TEXTURE0)
          art = { image: f.image, tex: texture(f.image, true, false) }
        }
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, art.tex)
        const overlap = f.hasMat ? MAT_OVERLAP * pxPerCm : 0
        const s = rects.sight
        const artRect = { x: s.x - overlap, y: s.y - overlap, w: s.w + 2 * overlap, h: s.h + 2 * overlap }
        gl.uniform1f(u.uBlur, state.glass === 'matte' ? 1.2 : 0)
        material(5, [1, 1, 1], 0.85)
        draw(artMesh(rects, artRect, state.artwork, f.image.naturalWidth / f.image.naturalHeight, d))
      }

      if (f.hasMat) {
        const { face, core } = matMeshes(rects, pxPerCm, d)
        material(3, rgb(state.mats[0].color), 0.9)
        draw(face)
        material(4, [0.95, 0.94, 0.91], 0.9)
        draw(core)
      }

      // Sin rebaje, el cartón y la obra no reciben su sombra.
      gl.uniform1f(u.uRebateDepth, 0)
      gl.uniform1f(u.uLipDepth, 0)

      if (f.hasFrame) {
        const frame = state.frame
        const color = rgb(frame.color)
        if (frame.material === 'wood') {
          const tile = woodTile(frame.color)
          let tex = woods.get(tile.canvas)
          if (tex === undefined) {
            gl.activeTexture(gl.TEXTURE0)
            tex = texture(tile.canvas, true, true)
            woods.set(tile.canvas, tex)
          }
          gl.activeTexture(gl.TEXTURE0)
          gl.bindTexture(gl.TEXTURE_2D, tex)
          gl.uniform1f(u.uContrast, woodContrast(frame.color, frame.finish === 'grained'))
          gl.uniform3fv(u.uWoodMean, tile.mean)
          gl.uniform2f(u.uWoodScale, 1 / tile.lengthCm, 1 / tile.widthCm)
          gl.uniform2f(u.uWoodOffset, 0, 0)
          gl.uniform1f(u.uPores, speciesOf(frame.color) === 'oak' ? 1 : speciesOf(frame.color) === 'walnut' ? 0.5 : 0.15)
          material(0, color, frame.finish === 'gloss' || frame.finish === 'satin' ? 0.55 : roughOf(frame.finish))
          gl.uniform1f(u.uCoat, coatOf(frame.finish))
        } else if (frame.material === 'metal') {
          material(2, color, frame.finish === 'gloss' ? 0.2 : 0.38)
        } else {
          material(1, color, roughOf(frame.finish))
          gl.uniform1f(u.uCoat, coatOf(frame.finish))
        }
        draw(frameMesh(rects, frame.profile, pxPerCm, d))
      }

      // El vidrio, encima de todo y transparente: lo que se ve es lo que refleja.
      if (state.glass !== 'none') {
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        gl.depthMask(false)
        const g = GLASS[state.glass]
        gl.uniform1f(u.uHaze, g.haze)
        material(6, [1, 1, 1], g.rough, g.f0)
        gl.uniform1f(u.uPeel, g.peel)
        draw(planeMesh(rects.glass, d.glass))
        gl.depthMask(true)
        gl.disable(gl.BLEND)
      }
    },
    dispose() {
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}

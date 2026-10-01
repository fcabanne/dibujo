import { MAT_OVERLAP, type SceneRects } from '../domain/geometry'
import { REST_LIGHT, hexToRgb, shadowTint, spotPosition } from '../render/light'
import { nailOf, type Pose } from '../render/pose'
import { grainTile } from '../render/noise'
import { woodContrast, woodTile } from '../render/wood'
import type { AppState, Rect } from '../types'
import { artMesh, depthsFor, frameMesh, matMeshes, planeMesh, type Mesh } from './meshes'
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
      gl.uniformMatrix4fv(u.uModel, false, modelOf(f.pose, rects, pxPerCm))
      gl.uniform3f(u.uEye, c.x + f.eye.x * pxPerCm, c.y + f.eye.y * pxPerCm, f.eye.z * pxPerCm)
      gl.uniform2f(u.uView, f.width, f.height)
      gl.uniform3f(u.uLightPos, c.x + spot.x, c.y + spot.y, spot.z)
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
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, grain)

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
        gl.uniform1f(u.uBlur, state.glass === 'matte' ? 3 : 0)
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
          material(0, color, roughOf(frame.finish))
        } else if (frame.material === 'metal') {
          material(2, color, frame.finish === 'gloss' ? 0.2 : 0.38)
        } else {
          material(1, color, roughOf(frame.finish))
        }
        draw(frameMesh(rects, frame.profile, pxPerCm, d))
      }

      // El vidrio, encima de todo y transparente: lo que se ve es lo que refleja.
      if (state.glass !== 'none') {
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        gl.depthMask(false)
        gl.uniform1f(u.uHaze, state.glass === 'matte' ? 0.11 : state.glass === 'antireflective' ? 0.02 : 0)
        material(6, [1, 1, 1], 0.02, state.glass === 'clear' ? 0.04 : state.glass === 'antireflective' ? 0.004 : 0.03)
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

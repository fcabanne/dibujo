import type { Effects } from '../types'

/**
 * Los efectos corren en la placa de video, y no por capricho de velocidad.
 *
 * Un realce de bordes es leer nueve píxeles por cada píxel de la foto. En
 * JavaScript, sobre una imagen de dos mil píxeles de ancho, eso son décimas de
 * segundo por cuadro: el slider deja de responder y encontrar el punto justo —que
 * es todo el ejercicio— se vuelve adivinar. En un shader es instantáneo a cualquier
 * tamaño.
 *
 * El mismo shader se usa para la pantalla y para el export. Es lo que garantiza que
 * lo que encontraste jugando sea exactamente lo que sale impreso.
 */

export function isNeutral(fx: Effects): boolean {
  return !fx.bw && fx.light === 0 && fx.contrast === 0 && fx.edges === 0 && fx.tones === 0
}

export type Source = HTMLCanvasElement | HTMLImageElement

export interface EffectsRenderer {
  /** Devuelve la foto procesada. Si no hay nada que aplicar, devuelve la original. */
  apply(source: Source, width: number, height: number, fx: Effects): CanvasImageSource
  dispose(): void
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  // La v va al revés que la y del clip: arriba de la pantalla es la primera fila de
  // la textura, que es donde queda una imagen subida sin dar vuelta.
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uStep;
uniform float uLight;
uniform float uContrast;
uniform float uEdges;
uniform float uTones;
uniform float uBw;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float lumaAt(vec2 uv) { return luma(texture2D(uTex, clamp(uv, 0.0, 1.0)).rgb); }

void main() {
  vec4 src = texture2D(uTex, vUv);
  vec3 c = src.rgb;

  // Luz por gamma y no por suma: mueve los medios tonos y deja los negros negros y
  // los blancos blancos, que es lo que uno espera al aclarar una foto.
  c = pow(max(c, 0.0), vec3(1.0 / (1.0 + uLight * 0.8)));

  // Contraste: la foto se abre o se cierra alrededor del gris medio.
  float k = uContrast >= 0.0 ? 1.0 + uContrast * 1.6 : 1.0 + uContrast * 0.9;
  c = clamp((c - 0.5) * k + 0.5, 0.0, 1.0);

  if (uBw > 0.5) c = vec3(luma(c));

  // Tonos: aplasta la foto a unos pocos escalones. Es lo que deja ver las manchas
  // de valor, que es lo que en realidad se copia al papel.
  if (uTones > 1.5) {
    c = floor(clamp(c, 0.0, 0.9999) * uTones) / (uTones - 1.0);
  }

  // Bordes: sobel sobre la luminancia de la foto original —no de la ya tocada— para
  // que subir el contraste no arrastre también el grosor de las líneas.
  if (uEdges > 0.001) {
    float tl = lumaAt(vUv + vec2(-uStep.x, -uStep.y));
    float tc = lumaAt(vUv + vec2(     0.0, -uStep.y));
    float tr = lumaAt(vUv + vec2( uStep.x, -uStep.y));
    float ml = lumaAt(vUv + vec2(-uStep.x,      0.0));
    float mr = lumaAt(vUv + vec2( uStep.x,      0.0));
    float bl = lumaAt(vUv + vec2(-uStep.x,  uStep.y));
    float bc = lumaAt(vUv + vec2(     0.0,  uStep.y));
    float br = lumaAt(vUv + vec2( uStep.x,  uStep.y));
    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);
    float g = length(vec2(gx, gy));
    float e = clamp(g * (0.8 + uEdges * 7.0) - 0.05, 0.0, 1.0);
    c = mix(c, vec3(0.04), e * min(1.0, uEdges * 1.8));
  }

  gl_FragColor = vec4(c, src.a);
}`

/**
 * El paso del sobel se mide contra el ancho de la foto y no en píxeles sueltos: con
 * un píxel fijo el mismo borde saldría fino en la pantalla y grueso en el export.
 * Medido en fracciones del ancho, se ve igual en los dos.
 */
const EDGE_REFERENCE_WIDTH = 1400

export function createEffects(): EffectsRenderer | null {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: false,
    // Sin esto, al querer copiar el resultado a otro lienzo ya está borrado.
    preserveDrawingBuffer: true,
    antialias: false,
  })
  if (!gl) return null

  const program = link(gl, VERT, FRAG)
  if (!program) return null

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  // La foto casi nunca mide una potencia de dos: ni mipmaps ni repetición.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  const u = {
    step: gl.getUniformLocation(program, 'uStep'),
    light: gl.getUniformLocation(program, 'uLight'),
    contrast: gl.getUniformLocation(program, 'uContrast'),
    edges: gl.getUniformLocation(program, 'uEdges'),
    tones: gl.getUniformLocation(program, 'uTones'),
    bw: gl.getUniformLocation(program, 'uBw'),
  }

  gl.useProgram(program)
  gl.uniform1i(gl.getUniformLocation(program, 'uTex'), 0)

  // Subir la foto es lo caro. Mientras sea la misma, se reusa: mover un slider no
  // tiene por qué volver a mandar treinta megas a la placa.
  let uploaded: Source | null = null

  return {
    apply(source, width, height, fx) {
      if (isNeutral(fx)) return source

      // Tope de la placa. En cualquier máquina de escritorio es 16384, muy por
      // encima de una foto de cámara; en un equipo viejo el export saldría algo más
      // blando, pero saldría.
      const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
      const scale = Math.min(1, max / Math.max(width, height))
      const w = Math.max(1, Math.round(width * scale))
      const h = Math.max(1, Math.round(height * scale))

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)

      if (uploaded !== source) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
        uploaded = source
      }

      const stepPx = Math.max(1, width / EDGE_REFERENCE_WIDTH)
      gl.uniform2f(u.step, stepPx / width, stepPx / height)
      gl.uniform1f(u.light, fx.light / 100)
      gl.uniform1f(u.contrast, fx.contrast / 100)
      gl.uniform1f(u.edges, fx.edges / 100)
      gl.uniform1f(u.tones, fx.tones)
      gl.uniform1f(u.bw, fx.bw ? 1 : 0)

      gl.drawArrays(gl.TRIANGLES, 0, 3)
      return canvas
    },

    dispose() {
      uploaded = null
      gl.deleteTexture(texture)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}

function link(gl: WebGLRenderingContext, vert: string, frag: string): WebGLProgram | null {
  const v = compile(gl, gl.VERTEX_SHADER, vert)
  const f = compile(gl, gl.FRAGMENT_SHADER, frag)
  if (!v || !f) return null
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, v)
  gl.attachShader(program, f)
  gl.linkProgram(program)
  gl.deleteShader(v)
  gl.deleteShader(f)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('No se pudo armar el shader:', gl.getProgramInfoLog(program))
    return null
  }
  return program
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('No compiló el shader:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

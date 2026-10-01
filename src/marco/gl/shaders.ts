/**
 * Los shaders del cuadro en 3D. Viven como texto para que la herramienta siga siendo
 * un único .html.
 *
 * Un solo programa para todas las piezas: cambia el material por uniforms. Todo se
 * ilumina en el espacio de la pantalla —px, con y hacia abajo y z saliendo hacia el
 * ojo—, el mismo en que viven los rectángulos del 2D, así que en reposo el frente del
 * cuadro cae exactamente donde caía el dibujo plano.
 */

export const VERTEX = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPos;
in vec3 aNormal;
in vec2 aUV;

uniform mat4 uModel;
uniform vec3 uEye;
uniform vec2 uView;

out vec3 vWorld;
out vec3 vNormal;
out vec2 vUV;
out vec3 vLocal;

void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(uModel) * aNormal);
  vUV = aUV;
  vLocal = aPos;

  // Proyección de ventana: el plano z = 0 cae exactamente sobre la pantalla, y lo que
  // sale hacia el ojo se agranda y se corre como se corre visto desde \`uEye\`.
  float k = uEye.z / (uEye.z - world.z);
  vec2 s = uEye.xy + (world.xy - uEye.xy) * k;
  vec2 ndc = vec2(s.x / uView.x * 2.0 - 1.0, 1.0 - s.y / uView.y * 2.0);
  float w = 1.0 / k;
  float depth = clamp(-world.z / 4000.0, -1.0, 1.0);
  gl_Position = vec4(ndc * w, depth * w, w);
}
`

export const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

in vec3 vWorld;
in vec3 vNormal;
in vec2 vUV;
in vec3 vLocal;

uniform vec3 uEye;
uniform vec3 uLightPos;
uniform vec3 uLightColor;
uniform vec3 uAmbientTop;
uniform vec3 uAmbientBottom;
uniform float uExposure;

// 0 madera, 1 pintado, 2 metal, 3 cartón, 4 núcleo del cartón, 5 obra, 6 vidrio
uniform int uMode;
uniform vec3 uAlbedo;
uniform float uRough;
uniform float uContrast;
uniform vec3 uWoodMean;
uniform vec2 uWoodScale;
uniform vec2 uWoodOffset;
uniform sampler2D uTex;
uniform sampler2D uGrain;
uniform float uBlur;
uniform float uF0;
uniform float uHaze;
// El pozo del foco sobre el cuadro, como en el 2D (drawObjectFalloff): centro y alcance, en px.
uniform vec3 uFalloff;
// El color de la pared, lineal: es casi todo lo que hay en el cuarto para reflejarse.
uniform vec3 uWall;

// Lo que tapa el borde de adentro: el rebaje de la moldura sobre el cartón, el labio
// del cartón sobre la obra. En px del cuadro en reposo.
uniform vec4 uRebate;
uniform float uRebateDepth;
uniform vec4 uLip;
uniform float uLipDepth;

out vec4 outColor;

const float PI = 3.14159265;

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }

/**
 * El cuarto, visto en un espejo: la pared alrededor —su color, más clara arriba
 * donde le da el foco—, el piso más oscuro abajo, y la banda clara de la ventana.
 */
vec3 environment(vec3 r) {
  float up = -r.y;
  vec3 room = uWall * mix(0.25, 0.85, smoothstep(-0.7, 0.5, up));
  float band = smoothstep(0.3, 0.06, abs(r.x * 0.8 + r.y * 0.6 + 0.15));
  return room + vec3(1.0, 0.98, 0.95) * band * 1.1;
}

/** La sombra que tira un borde de adentro hacia la ventana, del lado opuesto al foco. */
float edgeShadow(vec2 p, vec4 r, float depth, vec3 toLight) {
  if (depth <= 0.0 || r.z <= 0.0) return 1.0;
  float top = p.y - r.y;
  float left = p.x - r.x;
  float bottom = r.y + r.w - p.y;
  float right = r.x + r.z - p.x;
  // La luz viene de arriba a la izquierda: esos bordes tiran sombra hacia adentro.
  float fromTop = max(0.0, -toLight.y);
  float fromLeft = max(0.0, -toLight.x);
  float fromBottom = max(0.0, toLight.y);
  float fromRight = max(0.0, toLight.x);
  float s = 0.0;
  s += fromTop * exp(-max(top, 0.0) / depth);
  s += fromLeft * exp(-max(left, 0.0) / depth);
  s += fromBottom * 0.4 * exp(-max(bottom, 0.0) / depth);
  s += fromRight * 0.4 * exp(-max(right, 0.0) / depth);
  // Un poco de oclusión en todo el borde, sin importar de dónde viene la luz.
  float ao = exp(-min(min(top, left), min(bottom, right)) / (depth * 0.6));
  return clamp(1.0 - 0.62 * s - 0.18 * ao, 0.0, 1.0);
}

float ggx(float nh, float a) {
  float a2 = a * a;
  float d = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d);
}

float smith(float nv, float nl, float a) {
  float k = (a + 1.0) * (a + 1.0) / 8.0;
  return (nv / (nv * (1.0 - k) + k)) * (nl / (nl * (1.0 - k) + k));
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uEye - vWorld);
  // La proyección da vuelta la pantalla, y con ella qué cara es "de adelante": se
  // decide mirando hacia dónde está el ojo.
  if (dot(N, V) < 0.0) N = -N;
  vec3 Lvec = uLightPos - vWorld;
  vec3 L = normalize(Lvec);
  vec3 H = normalize(L + V);
  float nl = max(dot(N, L), 0.0);
  float nv = max(dot(N, V), 1e-3);
  float nh = max(dot(N, H), 0.0);
  float vh = max(dot(V, H), 0.0);

  vec3 albedo = toLinear(uAlbedo);
  float metal = 0.0;
  float rough = uRough;
  float f0 = uF0;
  float wrap = 0.0;
  float alpha = 1.0;
  float occlusion = 1.0;

  if (uMode == 0) {
    // Madera: la tabla horneada, multiplicada como en el 2D, sobre el color levantado.
    vec3 tex = texture(uTex, vUV * uWoodScale + uWoodOffset).rgb;
    vec3 lifted = uAlbedo / (1.0 - uContrast * (1.0 - uWoodMean));
    albedo = toLinear(clamp(lifted * mix(vec3(1.0), tex, uContrast), 0.0, 1.0));
  } else if (uMode == 2) {
    metal = 1.0;
    // Metal cepillado: un pelo de raya fina a lo largo.
    float brush = texture(uGrain, vec2(vUV.x * 0.05, vUV.y * 3.0)).r;
    albedo *= 0.92 + 0.16 * brush;
  } else if (uMode == 3 || uMode == 4) {
    // Cartón: fibra fina y la luz que se mete un poco en el papel.
    float g = texture(uGrain, vUV * 0.35).r;
    albedo *= 0.94 + 0.12 * g;
    wrap = 0.35;
    occlusion = edgeShadow(vLocal.xy, uRebate, uRebateDepth, L);
  } else if (uMode == 5) {
    // La obra, con el diente del papel apenas: no puede cambiar lo que se juzga.
    vec3 tex;
    if (uBlur > 0.0) {
      // Detrás de un vidrio mate: la obra se difumina. Unas cuantas lecturas
      // alrededor, una escala más abajo, dan un desenfoque parejo y no escalonado.
      vec2 px = fwidth(vUV) * uBlur;
      tex = vec3(0.0);
      for (int i = 0; i < 12; i++) {
        float a = float(i) * 2.39996;
        float r = sqrt((float(i) + 0.5) / 12.0);
        tex += texture(uTex, vUV + vec2(cos(a), sin(a)) * r * px, 1.0).rgb;
      }
      tex /= 12.0;
    } else {
      tex = texture(uTex, vUV).rgb;
    }
    float g = texture(uGrain, vLocal.xy * 0.01).r;
    albedo = toLinear(tex) * (0.985 + 0.03 * g);
    wrap = 0.25;
    occlusion = edgeShadow(vLocal.xy, uLip, uLipDepth, L) * edgeShadow(vLocal.xy, uRebate, uRebateDepth, L);
  }

  vec3 F0 = mix(vec3(f0), albedo, metal);
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - vh, 5.0);

  // El foco: una luz con lugar. Lo que cambia de un punto a otro es de dónde llega.
  vec3 radiance = uLightColor;

  float diffuseTerm = max((dot(N, L) + wrap) / (1.0 + wrap), 0.0);
  vec3 diffuse = (1.0 - metal) * albedo * diffuseTerm;
  float a = max(rough * rough, 0.002);
  vec3 spec = ggx(nh, a) * smith(nv, nl, a) * F / max(4.0 * nv * max(nl, 1e-3), 1e-3) * nl;
  // Una laca brilla donde le toca el foco; un satinado, apenas: si no, el negro se agrisa.
  spec *= mix(1.0, 0.45, (1.0 - metal) * smoothstep(0.25, 0.6, rough));

  vec3 ambient = mix(uAmbientBottom, uAmbientTop, clamp(0.5 - N.y * 0.5, 0.0, 1.0));
  vec3 color = (diffuse * radiance + spec * radiance) * occlusion + ambient * albedo * (1.0 - metal) * occlusion;

  // Lo que refleja del cuarto: mucho en el metal, poco en una laca, nada en el cartón.
  vec3 R = reflect(-V, N);
  vec3 Fv = F0 + (1.0 - F0) * pow(1.0 - nv, 5.0);
  float gloss = 1.0 - smoothstep(0.15, 0.7, rough);
  color += environment(R) * Fv * gloss * (metal > 0.5 ? 1.0 : 0.35);

  if (uMode == 6) {
    // Vidrio: solo lo que refleja, más en los bordes (Fresnel), y la bruma del mate.
    vec3 refl = environment(R) * Fv * 0.9;
    float glare = pow(nh, 400.0) * 2.0;
    color = refl + vec3(glare) + vec3(0.92, 0.94, 0.95) * uHaze;
    alpha = clamp(max(max(color.r, color.g), color.b) * 0.9 + uHaze, 0.0, 0.85);
    color = color / max(alpha, 1e-3);
  }

  color *= uExposure;
  vec3 srgb = toSrgb(color);
  if (uMode != 6 && uFalloff.z > 0.0) {
    // Lejos del centro del foco el cuadro cae unos puntos, como la pared.
    float u = clamp((length(vWorld.xy - uFalloff.xy) - 0.1 * uFalloff.z) / (0.52 * uFalloff.z), 0.0, 1.0);
    float a = u < 0.55 ? u / 0.55 * 0.035 : 0.035 + (u - 0.55) / 0.45 * 0.085;
    srgb = mix(srgb, vec3(10.0, 8.0, 6.0) / 255.0, a);
  }
  outColor = vec4(srgb * alpha, alpha);
}
`

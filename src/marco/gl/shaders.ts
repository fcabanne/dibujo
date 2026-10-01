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
uniform float uPxPerCm;

// 0 madera, 1 pintado, 2 metal, 3 cartón, 4 núcleo del cartón, 5 obra, 6 vidrio,
// 7 la sombra sobre la pared
uniform int uMode;
uniform vec3 uAlbedo;
uniform float uRough;
uniform float uContrast;
uniform vec3 uWoodMean;
uniform vec2 uWoodScale;
uniform vec2 uWoodOffset;
// Una laca encima de la madera o del pintado: 1 brillante, 0 sin.
uniform float uCoat;
// Cuánto poro se siente al tacto: el roble sí, el pino casi nada.
uniform float uPores;
uniform sampler2D uTex;
uniform sampler2D uGrain;
uniform sampler2D uEnv;
uniform float uBlur;
uniform float uF0;
uniform float uHaze;
// La piel del vidrio: 0 liso, más es la cáscara de naranja del antirreflejo y del mate.
uniform float uPeel;
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

// La sombra sobre la pared (ver shadowOf en renderer.ts). Todo en px de la pared.
uniform vec2 uHull[8];
uniform vec4 uSpan;
uniform vec2 uGap;
uniform float uPen;
uniform float uStrength;
uniform vec2 uOutline[4];
uniform float uContact;
uniform vec3 uTint;

out vec4 outColor;

const float PI = 3.14159265;
const float EMIT_MAX = 8.0;

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }

/** Dónde cae una dirección en la imagen del cuarto (ver environment.ts). */
vec2 envUV(vec3 r) {
  float phi = atan(r.x, r.z);
  float th = asin(clamp(-r.y, -1.0, 1.0));
  return vec2(0.5 + phi / (2.0 * PI), 0.5 - th / PI);
}

/**
 * El cuarto, visto en un espejo de rugosidad \`rough\`: la pared del color elegido y lo
 * que emite luz —la ventana, la caja, los focos—. Cuanto más rugoso, más abajo en los
 * mipmaps: un reflejo borroso es el mismo cuarto promediado.
 */
vec3 environment(vec3 r, float rough) {
  vec4 t = textureLod(uEnv, envUV(r), clamp(rough * 9.0, 0.0, 8.0));
  return uWall * t.a * 0.95 + t.rgb * t.rgb * EMIT_MAX;
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

float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }

/** Ruido de valor en una dimensión: lo que cambia despacio a lo largo de un listón. */
float noise1(float x) {
  float i = floor(x);
  float f = fract(x);
  return mix(hash1(i), hash1(i + 1.0), f * f * (3.0 - 2.0 * f));
}

/** Distancia con signo a un polígono convexo de 8 vértices (los repetidos no molestan). */
float sdPolygon(vec2 p) {
  float d = dot(p - uHull[0], p - uHull[0]);
  float s = 1.0;
  for (int i = 0; i < 8; i++) {
    vec2 vi = uHull[i];
    vec2 vj = uHull[(i + 7) % 8];
    vec2 e = vj - vi;
    vec2 w = p - vi;
    vec2 b = w - e * clamp(dot(w, e) / max(dot(e, e), 1e-6), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= vi.y, p.y < vj.y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s *= -1.0;
  }
  return s * sqrt(d);
}

float sdQuad(vec2 p, vec2 q0, vec2 q1, vec2 q2, vec2 q3) {
  vec2 v[4] = vec2[4](q0, q1, q2, q3);
  float d = dot(p - v[0], p - v[0]);
  float s = 1.0;
  for (int i = 0; i < 4; i++) {
    vec2 vi = v[i];
    vec2 vj = v[(i + 3) % 4];
    vec2 e = vj - vi;
    vec2 w = p - vi;
    vec2 b = w - e * clamp(dot(w, e) / max(dot(e, e), 1e-6), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= vi.y, p.y < vj.y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s *= -1.0;
  }
  return s * sqrt(d);
}

/**
 * La sombra del cuadro sobre la pared. La forma es la del cuadro proyectado desde el
 * foco —la cara de adelante y la de atrás, y lo que barren entre las dos—, así que del
 * lado del foco no hay nada. La penumbra crece con lo que el cuadro se separa de la
 * pared en ese lugar: nítida abajo, donde apoya, abierta arriba. Y una oclusión de
 * contacto, chica, solo en el canto que toca la pared.
 */
vec4 wallShadow(vec2 p) {
  float sd = sdPolygon(p);
  vec2 ax = uSpan.zw - uSpan.xy;
  float v = clamp(dot(p - uSpan.xy, ax) / max(dot(ax, ax), 1e-3), 0.0, 1.0);
  float gap = mix(uGap.x, uGap.y, v);
  float pen = max(0.8, gap * uPen);
  // El borde cae con una curva suave de los dos lados, sin escalón: la penumbra de
  // un foco grande no es una rampa.
  float direct = 1.0 / (1.0 + exp(sd * 2.2 / pen));
  // Densa pegada al cuadro y más tenue lejos: lo que está cerca tapa más del foco
  // y deja entrar menos luz del cuarto.
  float rimDist = max(sdQuad(p, uOutline[0], uOutline[1], uOutline[2], uOutline[3]), 0.0);
  direct *= uStrength * (0.45 + 0.55 * exp(-rimDist / (0.7 * uPxPerCm)));
  direct /= 1.0 + gap / (12.0 * uPxPerCm);

  // El contacto: donde el canto de abajo apoya, una línea que se abre poco.
  vec2 b0 = uOutline[3];
  vec2 b1 = uOutline[2];
  vec2 e = b1 - b0;
  vec2 w = p - b0;
  float along = clamp(dot(w, e) / max(dot(e, e), 1e-6), 0.0, 1.0);
  float dist = length(w - e * along);
  float below = step(0.0, e.x * w.y - e.y * w.x);
  float contact = uContact * 0.32 * exp(-dist / (0.25 * uPxPerCm)) * below;

  // Lo que el cuadro le saca al cuarto alrededor: muy poco y muy abierto.
  float rim = sdQuad(p, uOutline[0], uOutline[1], uOutline[2], uOutline[3]);
  float ambient = 0.05 * exp(-max(rim, 0.0) / (1.2 * uPxPerCm));

  float s = 1.0 - (1.0 - direct) * (1.0 - contact) * (1.0 - ambient);

  // Lo que se pinta encima de la pared para que quede como la pared con menos luz:
  // más oscura y del color de su propio rebote (ver shadowTint), como el 2D.
  vec3 W = max(toSrgb(uWall), vec3(0.02));
  vec3 R = W * (1.0 - 0.86 * s) * mix(vec3(1.0), uTint, 0.9 * s);
  vec3 need = 1.0 - R / W;
  float a = clamp(max(max(need.r, need.g), need.b), 0.0, 1.0);
  if (a < 1e-4) return vec4(0.0);
  vec3 C = (R - W * (1.0 - a)) / a;
  return vec4(max(C, 0.0) * a, a);
}

/** La normal movida por un relieve leído del grano: la piel del vidrio, el poro de la madera. */
vec3 bumped(vec3 N, vec2 cm, float scale, float strength) {
  vec2 uv = cm * scale;
  float e = 1.0 / 256.0;
  float h = textureLod(uGrain, uv, 0.0).r;
  float hx = textureLod(uGrain, uv + vec2(e, 0.0), 0.0).r;
  float hy = textureLod(uGrain, uv + vec2(0.0, e), 0.0).r;
  return normalize(N + vec3(h - hx, h - hy, 0.0) * strength);
}

void main() {
  if (uMode == 7) {
    outColor = wallShadow(vWorld.xy);
    return;
  }

  vec3 N = normalize(vNormal);
  vec3 V = normalize(uEye - vWorld);
  // La proyección da vuelta la pantalla, y con ella qué cara es "de adelante": se
  // decide mirando hacia dónde está el ojo.
  if (dot(N, V) < 0.0) N = -N;
  vec3 Lvec = uLightPos - vWorld;
  vec3 L = normalize(Lvec);

  vec3 albedo = toLinear(uAlbedo);
  float metal = 0.0;
  float rough = uRough;
  float f0 = uF0;
  float wrap = 0.0;
  float alpha = 1.0;
  float occlusion = 1.0;
  float sheen = 0.0;
  vec3 T = vec3(0.0);

  if (uMode == 0) {
    // Madera: la baldosa dice dónde cae el anillo; el color lo pone el shader. La
    // temprana es más clara y amarilla, la tardía más oscura y roja, y el promedio
    // sigue siendo el color elegido: la muestra y el cuadro tienen que coincidir.
    vec2 wuv = vUV * uWoodScale + uWoodOffset;
    vec3 tex = texture(uTex, wuv).rgb;
    float ring = clamp((1.0 - tex.g) / 0.6, 0.0, 1.0) * uContrast;
    float meanRing = clamp((1.0 - uWoodMean.g) / 0.6, 0.0, 1.0) * uContrast;
    vec3 early = vec3(1.12, 1.05, 0.9);
    vec3 late = vec3(0.56, 0.42, 0.33);
    vec3 tone = mix(early, late, ring) / mix(early, late, meanRing);

    // Cada listón es otra tabla, y a lo largo de una misma tabla el tono va y viene.
    float piece = floor(vUV.y / 20.0);
    float drift = noise1(vUV.x / 14.0 + piece * 13.0) - 0.5;
    float pieceTone = (hash1(piece + 3.0) - 0.5) * 0.09;
    vec3 shift = vec3(1.0 + pieceTone + drift * 0.08, 1.0 + pieceTone * 0.8 + drift * 0.05, 1.0 + pieceTone * 0.6);
    albedo = toLinear(clamp(uAlbedo * tone * shift, 0.0, 1.0));

    // La tardía es más dura y queda más lisa: brilla un poco más.
    rough = uRough * mix(1.0, 0.78, ring);

    // El poro: un relieve chiquito, leído en la misma baldosa.
    float h = tex.g;
    N = normalize(N - vec3(dFdx(h), dFdy(h), 0.0) * (0.12 + 0.45 * uPores) * uContrast);

    // La dirección de la veta, sacada de cómo corre la coordenada de la madera: el
    // brillo de la fibra se estira a lo largo de ella y viaja con el ojo.
    vec3 dp1 = dFdx(vWorld);
    vec3 dp2 = dFdy(vWorld);
    vec2 du1 = dFdx(vUV);
    vec2 du2 = dFdy(vUV);
    T = dp1 * du2.y - dp2 * du1.y;
    T = length(T) > 1e-6 ? normalize(T - N * dot(N, T)) : vec3(0.0);
    sheen = (0.5 + 0.9 * (1.0 - ring)) * (1.0 - uCoat * 0.5);
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
      // alrededor dan un desenfoque parejo y no escalonado.
      vec2 px = fwidth(vUV) * uBlur;
      tex = vec3(0.0);
      for (int i = 0; i < 12; i++) {
        float a = float(i) * 2.39996;
        float r = sqrt((float(i) + 0.5) / 12.0);
        tex += texture(uTex, vUV + vec2(cos(a), sin(a)) * r * px).rgb;
      }
      tex /= 12.0;
    } else {
      tex = texture(uTex, vUV).rgb;
    }
    float g = texture(uGrain, vLocal.xy * 0.01).r;
    // Calibrada contra el 2D: el papel de la obra tiene que verse del mismo blanco.
    albedo = toLinear(tex) * 1.13 * (0.985 + 0.03 * g);
    wrap = 0.25;
    occlusion = edgeShadow(vLocal.xy, uLip, uLipDepth, L) * edgeShadow(vLocal.xy, uRebate, uRebateDepth, L);
  } else if (uMode == 6) {
    // La piel del vidrio: el antirreflejo y el mate no son lisos, tienen una cáscara
    // de naranja finísima que rompe el reflejo en puntitos.
    if (uPeel > 0.0) N = bumped(N, vLocal.xy / uPxPerCm, 0.08, uPeel);
  }

  vec3 H = normalize(L + V);
  float nl = max(dot(N, L), 0.0);
  float nv = max(dot(N, V), 1e-3);
  float nh = max(dot(N, H), 0.0);
  float vh = max(dot(V, H), 0.0);
  vec3 R = reflect(-V, N);

  if (uMode == 6) {
    // Vidrio: lo que refleja del cuarto, más en los bordes (Fresnel), y el foco. Se
    // suma a lo que hay detrás, que pierde lo que se refleja.
    float Fg = uF0 + (1.0 - uF0) * pow(1.0 - nv, 5.0);
    float a = max(rough * rough, 0.002);
    vec3 refl = environment(R, rough) * Fg;
    float glare = ggx(nh, a) * smith(nv, nl, a) * Fg / max(4.0 * nv, 1e-3);
    vec3 light = (refl + uLightColor * glare) * uExposure;
    // Los puntitos: donde la piel mira para un lado el reflejo se aviva, y para el
    // otro se apaga.
    if (uPeel > 0.0) {
      float g = textureLod(uGrain, vLocal.xy / uPxPerCm * 0.08, 0.0).r;
      light *= 1.0 + (g - 0.5) * 3.0 * min(1.0, uPeel * 2.0);
    }
    vec3 haze = vec3(0.93, 0.94, 0.95) * uHaze;
    float cover = clamp(Fg + uHaze, 0.0, 1.0);
    outColor = vec4(light + haze, cover);
    return;
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

  // La fibra de la madera: un brillo estirado a lo largo de la veta, que se corre con
  // el ojo. Es lo que hace que una tabla lustrada parezca moverse.
  if (sheen > 0.0 && dot(T, T) > 0.0) {
    float th = dot(T, H);
    float sinTH = sqrt(max(0.0, 1.0 - th * th));
    spec += albedo * pow(sinTH, 60.0) * 0.35 * sheen * nl;
  }

  vec3 ambient = mix(uAmbientBottom, uAmbientTop, clamp(0.5 - N.y * 0.5, 0.0, 1.0));
  vec3 color = (diffuse * radiance + spec * radiance) * occlusion + ambient * albedo * (1.0 - metal) * occlusion;

  // Lo que refleja del cuarto: todo en el metal, de a poco en una superficie lustrada.
  vec3 Fv = F0 + (1.0 - F0) * pow(1.0 - nv, 5.0);
  float gloss = 1.0 - smoothstep(0.2, 0.75, rough);
  color += environment(R, rough) * Fv * gloss * (metal > 0.5 ? 1.0 : 0.5) * occlusion;

  // La laca: una capa transparente y lisa encima, con su propio brillo y su reflejo.
  if (uCoat > 0.0 && metal < 0.5) {
    float ca = mix(0.18, 0.08, uCoat);
    float cf = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
    float coatSpec = ggx(nh, ca * ca) * smith(nv, nl, ca * ca) * 0.04 / max(4.0 * nv, 1e-3);
    color = color * (1.0 - cf * uCoat) + (radiance * coatSpec * nl + environment(R, ca) * cf) * uCoat * occlusion;
  }

  color *= uExposure;
  vec3 srgb = toSrgb(color);
  if (uFalloff.z > 0.0) {
    // Lejos del centro del foco el cuadro cae unos puntos, como la pared.
    float u = clamp((length(vWorld.xy - uFalloff.xy) - 0.1 * uFalloff.z) / (0.52 * uFalloff.z), 0.0, 1.0);
    float k = u < 0.55 ? u / 0.55 * 0.035 : 0.035 + (u - 0.55) / 0.45 * 0.085;
    srgb = mix(srgb, vec3(10.0, 8.0, 6.0) / 255.0, k);
  }
  outColor = vec4(srgb * alpha, alpha);
}
`

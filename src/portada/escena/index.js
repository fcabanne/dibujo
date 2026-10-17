// ─────────────────────────────────────────────────────────────
//  La escena de lápices de la portada: la foto de referencia en 3D.
//  Viene de la página `herramientas` de generalito. Sólo el lápiz rojo
//  y el portaminas se mueven (inclinando o sacudiendo el celular).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { crearEscenario, TECHO } from './escenario.js';
import { Mundo } from './fisica.js';
import { Entrada } from './entrada.js';
import { Sonido } from './sonido.js';
import * as lapiz from './objetos/lapiz.js';
import * as portaminas from './objetos/portaminas.js';
import * as lapizColor from './objetos/lapiz-color.js';
import { COMPOSICION, ALTO_VISIBLE, BORDE_DERECHO, BORDE_ABAJO, LUZ, PAPEL, AMBIENTE } from './composicion.js';


const OBJETOS = { lapiz, portaminas, 'lapiz-color': lapizColor };

export async function iniciarEscena(canvas, contenedor, opciones = {}) {
  const movil = matchMedia('(pointer: coarse)').matches;
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const esc = crearEscenario(canvas, { ...AMBIENTE, calidad: movil ? 1 : 2, luz: LUZ });
  const mundo = new Mundo();
  const sonido = new Sonido();
  const items = []; // { c: cuerpo de la física, malla, def, cuerpo (el de la física) }

  // ── caja y composición ──
  let caja = null;
  let corto = ALTO_VISIBLE;
  let dz = 0; // lo mismo con el borde de abajo, donde está la pila
  let dx = 0; // corrimiento de la composición: alinea el borde derecho con el de la foto

  function armarCaja() {
    const W = contenedor.clientWidth || 390, H = contenedor.clientHeight || 844;
    const aspecto = W / H;
    // el alto de la pantalla muestra lo mismo que el alto de la foto
    corto = aspecto < 1 ? ALTO_VISIBLE * aspecto : ALTO_VISIBLE;
    caja = esc.encuadrar(corto, W, H);
    dx = BORDE_DERECHO - caja.x1;
    dz = BORDE_ABAJO - caja.z1;
    mundo.planos = [
      { n: [0, 1, 0], d: 0, tipo: 'piso' },
      ...caja.paredes.map((p) => ({ ...p, tipo: 'pared', material: 'vidrio' })),
      { n: [0, -1, 0], d: -TECHO, tipo: 'pared' },
    ];
    esc.piso.ponerPapel({
      x1: PAPEL.x1 - dx, z0: PAPEL.z0 - dz, r: PAPEL.r, color: PAPEL.color,
      pliegue: [PAPEL.pliegue[0] - dx, PAPEL.pliegue[1] - dz, PAPEL.pliegue[2]],
    });
  }

  const _q = new THREE.Quaternion();
  const EJE_Y = new THREE.Vector3(0, 1, 0);

  // Pose de reposo de cada objeto en la composición, para el encuadre actual.
  function objetivos() {
    return items.map(({ def, cuerpo }) => {
      _q.setFromAxisAngle(EJE_Y, THREE.MathUtils.degToRad(def.giro));
      return { x: def.x - dx, y: cuerpo.medias[1] + cuerpo.radio, z: def.z - dz, q: _q.clone() };
    });
  }

  async function cargar() {
    const modulos = OBJETOS;
    for (const def of COMPOSICION) {
      const mod = modulos[def.objeto];
      if (!mod) continue;
      const variante = mod.variantes.includes(def.variante) ? def.variante : mod.variantes[0];
      const creado = mod.crear(variante);
      const malla = creado.malla;
      let cuerpo = creado.cuerpo;
      // para que ruede parejo, el lápiz hexagonal choca como uno redondo
      // (desde arriba la diferencia es de un par de décimas de milímetro)
      if (def.rueda) {
        const medio = cuerpo.medias[0] + cuerpo.radio;
        cuerpo = { ...cuerpo, medias: [medio - def.rueda, 0, 0], radio: def.rueda };
      }
      esc.escena.add(malla);
      const c = mundo.agregar({ ...cuerpo, x: def.x - dx, y: cuerpo.medias[1] + cuerpo.radio, z: def.z - dz, qx: 0, qy: 0, qz: 0, qw: 1 });
      // los que no se mueven quedan cinemáticos: sólo son obstáculos
      c.cinematico = !def.movil;
      items.push({ c, malla, def: { ...def, variante }, cuerpo });
    }
  }

  // Cada objeto en su lugar de la foto; los móviles apenas arriba, así se
  // asientan solos.
  function presentar() {
    const T = objetivos();
    items.forEach((it, i) => {
      const t = T[i], c = it.c;
      c.x = t.x; c.z = t.z;
      c.y = t.y + (it.def.movil && !reducido ? 0.15 : 0);
      c.qx = t.q.x; c.qy = t.q.y; c.qz = t.q.z; c.qw = t.q.w;
      c.vx = c.vy = c.vz = 0; c.wx = c.wy = c.wz = 0;
    });
    mundo.despertarTodos();
  }

  // Los fijos siguen a la composición si cambia el encuadre.
  function reubicarFijos() {
    const T = objetivos();
    items.forEach((it, i) => {
      if (it.def.movil) return;
      const t = T[i], c = it.c;
      c.x = t.x; c.y = t.y; c.z = t.z;
      c.qx = t.q.x; c.qy = t.q.y; c.qz = t.q.z; c.qw = t.q.w;
    });
  }

  // ── ordenar: cada objeto vuela a su lugar (cinemático) y se suelta ──
  const animaciones = new Map();
  const suave = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

  function ordenar() {
    const T = objetivos();
    // sólo los que se mueven; primero los que están más lejos de su lugar
    const orden = items.map((it, i) => i).filter((i) => items[i].def.movil).sort((a, b) => {
      const da = Math.hypot(items[a].c.x - T[a].x, items[a].c.z - T[a].z);
      const db = Math.hypot(items[b].c.x - T[b].x, items[b].c.z - T[b].z);
      return db - da;
    });
    orden.forEach((i, k) => {
      const c = items[i].c;
      c.cinematico = true;
      animaciones.set(c, {
        t: -k * 0.04,
        dur: 0.75,
        x0: c.x, y0: c.y, z0: c.z,
        q0: new THREE.Quaternion(c.qx, c.qy, c.qz, c.qw),
        ...T[i],
      });
    });
    sucio = 3;
  }

  const _qa = new THREE.Quaternion();
  function animar(dt) {
    for (const [c, a] of animaciones) {
      a.t += dt;
      if (a.t < 0) continue;
      const k = Math.min(1, a.t / a.dur);
      const e = suave(k);
      const px = c.x, py = c.y, pz = c.z;
      c.x = a.x0 + (a.x - a.x0) * e;
      c.z = a.z0 + (a.z - a.z0) * e;
      c.y = a.y0 + (a.y - a.y0) * e + Math.sin(Math.PI * e) * 3.2;
      _qa.slerpQuaternions(a.q0, a.q, e);
      c.qx = _qa.x; c.qy = _qa.y; c.qz = _qa.z; c.qw = _qa.w;
      // velocidad para que los contactos con los que están quietos sean creíbles
      c.vx = (c.x - px) / Math.max(dt, 1e-3); c.vy = (c.y - py) / Math.max(dt, 1e-3); c.vz = (c.z - pz) / Math.max(dt, 1e-3);
      c.wx = c.wy = c.wz = 0;
      if (k >= 1) {
        c.vx = c.vy = c.vz = 0;
        c.cinematico = false;
        animaciones.delete(c);
      }
    }
  }

  // ── frame ──
  let ultimo = performance.now();
  let sucio = 3;
  let activo = false;
  let previo = new Float32Array(0);
  let pausado = false;
  let ultimaVibracion = 0;

  function simular(dt) {
    entrada.actualizar(dt);
    animar(dt);
    mundo.paso(dt);
    const ancho = caja ? caja.x1 : 12;
    for (const { c } of items) {
      if (c.golpe > 0) {
        sonido.golpe(c.id, c.golpe, c.material, c.golpeContra, c.x / ancho);
        if (c.golpe > 120 && navigator.vibrate && entrada.intensidad > 4) {
          const t = performance.now();
          if (t - ultimaVibracion > 90) { ultimaVibracion = t; navigator.vibrate(Math.min(12, 3 + c.golpe * 0.02)); }
        }
      }
    }
  }

  function dibujar() {
    if (previo.length !== items.length * 7) { previo = new Float32Array(items.length * 7); sucio = 3; }
    let mov = 0;
    items.forEach(({ c, malla }, i) => {
      const k = i * 7;
      mov += Math.abs(previo[k] - c.x) + Math.abs(previo[k + 1] - c.y) + Math.abs(previo[k + 2] - c.z)
        + Math.abs(previo[k + 3] - c.qx) + Math.abs(previo[k + 4] - c.qy) + Math.abs(previo[k + 5] - c.qz) + Math.abs(previo[k + 6] - c.qw);
      previo[k] = c.x; previo[k + 1] = c.y; previo[k + 2] = c.z;
      previo[k + 3] = c.qx; previo[k + 4] = c.qy; previo[k + 5] = c.qz; previo[k + 6] = c.qw;
      malla.position.set(c.x, c.y, c.z);
      malla.quaternion.set(c.qx, c.qy, c.qz, c.qw);
    });
    if (mov > 1e-5) sucio = 2;
    if (sucio > 0) {
      sucio--;
      esc.dibujar();
      medir();
    }
  }

  // si el teléfono no llega a ~45 fps, bajar la resolución de a poco
  const medicion = { t: performance.now(), n: 0 };
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  function medir() {
    medicion.n++;
    if (medicion.n < 90) return;
    const prom = (performance.now() - medicion.t) / medicion.n / 1000;
    medicion.t = performance.now(); medicion.n = 0;
    if (prom > 1 / 45 && pixelRatio > 1.01) {
      pixelRatio = Math.max(1, pixelRatio - 0.25);
      esc.renderer.setPixelRatio(pixelRatio);
      esc.encuadrar(corto, contenedor.clientWidth, contenedor.clientHeight);
    }
  }

  let cuadro = 0;
  function frame(ahora) {
    cuadro = 0;
    if (!activo) return;
    const dt = Math.min((ahora - ultimo) / 1000, 1 / 30);
    ultimo = ahora;
    if (!pausado) simular(dt);
    dibujar();
    cuadro = requestAnimationFrame(frame);
  }

  // ── interfaz ──
  const entrada = new Entrada({ canvas, camara: esc.camara, mundo, sonido, onPrimera: () => opciones.onPrimera?.() });

  if (entrada.necesitaPermiso()) {
    // iOS: el sensor necesita un permiso que se pide con un toque
  } else {
    entrada.escucharSensor();
  }

  // teclado (escritorio): flechas inclinan, espacio sacude
  function alTeclaAbajo(e) {
    if (!activo) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      entrada.simularInclinacion(e.key === 'ArrowRight' ? 12 : -12);
    } else if (e.code === 'Space') { e.preventDefault(); sonido.desbloquear(); entrada.simularSacudida(); }
  }
  function alTeclaArriba(e) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') entrada.simularInclinacion(null);
  }
  window.addEventListener('keydown', alTeclaAbajo);
  window.addEventListener('keyup', alTeclaArriba);

  function alCambiarTamano() {
    const antes = dx, antesZ = dz;
    armarCaja();
    reubicarFijos();
    if (Math.abs(antes - dx) > 0.01 || Math.abs(antesZ - dz) > 0.01) ordenar();
    sucio = 3;
    if (activo) dibujar();
  }
  const observador = new ResizeObserver(() => alCambiarTamano());
  observador.observe(contenedor);

  armarCaja();
  await cargar();
  presentar();
  sucio = 3;
  dibujar();

  return {
    entrada, sonido, mundo, esc, items,
    ordenar,
    sacudir() { sonido.desbloquear(); entrada.simularSacudida(); },
    necesitaPermiso: () => entrada.necesitaPermiso() && !entrada.sensor,
    async pedirPermiso() { sonido.desbloquear(); return entrada.pedirPermiso(); },
    // dibuja sólo mientras la portada se ve
    activar(si) {
      if (si === activo) return;
      activo = si;
      if (si) { ultimo = performance.now(); sucio = 3; if (!cuadro) cuadro = requestAnimationFrame(frame); }
      else if (cuadro) { cancelAnimationFrame(cuadro); cuadro = 0; }
    },
    avanzar(seg, dt = 1 / 60) { for (let t = 0; t < seg; t += dt) simular(dt); sucio = 2; dibujar(); },
    redibujar() { sucio = 2; dibujar(); },
    destruir() {
      this.activar(false);
      observador.disconnect();
      window.removeEventListener('keydown', alTeclaAbajo);
      window.removeEventListener('keyup', alTeclaArriba);
      esc.renderer.dispose();
    },
  };
  }

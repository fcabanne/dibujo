// ─────────────────────────────────────────────────────────────
//  La escena de lápices del hero: dos lápices en 3D que viven sobre la foto
//  de la portada. Ruedan con la inclinación del celular y se mueven al
//  sacudirlo; chocan contra los útiles de la foto (cajas invisibles).
//  Viene de la página `herramientas` de generalito.
//
//  El canvas es transparente: sólo se dibujan los lápices y su sombra, y la
//  foto queda abajo. La cámara y los colisionadores usan el mismo encuadre
//  que la foto (encuadre.js), así que coinciden en cualquier pantalla.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { crearEscenario, TECHO } from './escenario.js';
import { Mundo } from './fisica.js';
import { Entrada } from './entrada.js';
import { Sonido } from './sonido.js';
import * as lapiz from './objetos/lapiz.js';
import * as portaminas from './objetos/portaminas.js';
import { COMPOSICION, COLISIONES, LIMITES, LUZ, AMBIENTE, SOMBRA_SOBRE_FOTO } from './composicion.js';
import { encuadreHero, PPCM } from './encuadre.js';

const OBJETOS = { lapiz, portaminas };
const px = (v) => v / PPCM; // px de la foto → cm

export async function iniciarEscena(canvas, contenedor) {
  const movil = matchMedia('(pointer: coarse)').matches;
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const esc = crearEscenario(canvas, {
    ...AMBIENTE,
    calidad: movil ? 1 : 2,
    luz: LUZ,
    transparente: true,
    soloSombra: SOMBRA_SOBRE_FOTO,
  });
  const mundo = new Mundo();
  const sonido = new Sonido();
  const items = []; // { c: cuerpo de la física, malla, def }

  // ── encuadre y mundo ──
  function armar() {
    const W = contenedor.clientWidth || 390, H = contenedor.clientHeight || 844;
    const e = encuadreHero(W, H);
    // centro de la pantalla en la foto, en cm
    const cx = px((W / 2 - e.tx) / e.s), cz = px((H / 2 - e.ty) / e.s);
    esc.encuadrar(0, W, H, cx, cz, W / (e.s * PPCM));
    mundo.planos = [
      { n: [0, 1, 0], d: 0, tipo: 'piso' },
      { n: [0, -1, 0], d: -TECHO, tipo: 'pared' },
      // el carril: el material 'vidrio' es liso y elástico, así rebotan
      // a la izquierda, el borde de la pantalla: los lápices pueden llegar hasta ahí
      { n: [1, 0, 0], d: px(-e.tx / e.s), tipo: 'pared', material: 'vidrio' },
      { n: [-1, 0, 0], d: -px(LIMITES.derecha), tipo: 'pared', material: 'vidrio' },
      { n: [0, 0, 1], d: px(LIMITES.arriba), tipo: 'pared', material: 'vidrio' },
      { n: [0, 0, -1], d: -px(LIMITES.abajo), tipo: 'pared', material: 'vidrio' },
    ];
  }

  function cargarColisiones() {
    const r = 0.25;
    for (const b of COLISIONES) {
      const hx = px(b.x1 - b.x0) / 2, hz = px(b.z1 - b.z0) / 2, hy = b.alto / 2;
      const c = mundo.agregar({
        medias: [hx - r, hy - r, hz - r], radio: r, masa: 500, material: 'madera',
        x: px((b.x0 + b.x1) / 2), y: hy, z: px((b.z0 + b.z1) / 2),
      });
      c.cinematico = true;
    }
  }

  function cargarLapices() {
    for (const def of COMPOSICION) {
      const mod = OBJETOS[def.objeto];
      const variante = mod.variantes.includes(def.variante) ? def.variante : mod.variantes[0];
      const creado = mod.crear(variante);
      let cuerpo = creado.cuerpo;
      // para que ruede parejo, el lápiz hexagonal choca como uno redondo
      if (def.rueda) {
        const medio = cuerpo.medias[0] + cuerpo.radio;
        cuerpo = { ...cuerpo, medias: [medio - def.rueda, 0, 0], radio: def.rueda };
      }
      esc.escena.add(creado.malla);
      const mitad = cuerpo.medias[0] + cuerpo.radio; // medio largo, cm
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(def.giro));
      // un poco arriba: se asientan solos
      const c = mundo.agregar({
        ...cuerpo,
        x: px(def.x), y: cuerpo.medias[1] + cuerpo.radio + (reducido ? 0 : 0.15), z: px(def.punta) + mitad,
        qx: q.x, qy: q.y, qz: q.z, qw: q.w,
      });
      items.push({ c, malla: creado.malla, def: { ...def, variante }, cuerpo });
    }
  }

  // ── frame ──
  let ultimo = performance.now();
  let sucio = 3;
  let activo = false;
  let previo = new Float32Array(0);
  let cuadro = 0;
  let ultimaVibracion = 0;

  const entrada = new Entrada({ canvas, camara: esc.camara, mundo, sonido });
  entrada.escucharSensor(); // inclinación y sacudida, prendidas desde el principio

  function simular(dt) {
    entrada.actualizar(dt);
    mundo.paso(dt);
    for (const { c } of items) {
      if (c.golpe > 0) {
        sonido.golpe(c.id, c.golpe, c.material, c.golpeContra, 0);
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
    }
  }

  function frame(ahora) {
    cuadro = 0;
    if (!activo) return;
    const dt = Math.min((ahora - ultimo) / 1000, 1 / 30);
    ultimo = ahora;
    simular(dt);
    dibujar();
    cuadro = requestAnimationFrame(frame);
  }

  // teclado (escritorio): flechas inclinan, espacio sacude
  function alTeclaAbajo(e) {
    if (!activo) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      entrada.simularInclinacion(e.key === 'ArrowRight' ? 12 : -12);
    } else if (e.code === 'Space') { e.preventDefault(); entrada.simularSacudida(); }
  }
  function alTeclaArriba(e) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') entrada.simularInclinacion(null);
  }
  // el audio nace con el primer toque
  function alPrimerToque() { sonido.desbloquear(); }
  window.addEventListener('keydown', alTeclaAbajo);
  window.addEventListener('keyup', alTeclaArriba);
  window.addEventListener('pointerdown', alPrimerToque, { once: true });

  const observador = new ResizeObserver(() => { armar(); sucio = 3; if (activo) dibujar(); });
  observador.observe(contenedor);

  armar();
  cargarColisiones();
  cargarLapices();
  sucio = 3;
  dibujar();

  return {
    entrada, sonido, mundo, esc, items,
    sacudir() { sonido.desbloquear(); entrada.simularSacudida(); },
    // dibuja sólo mientras el hero se ve
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
      window.removeEventListener('pointerdown', alPrimerToque);
      esc.renderer.dispose();
    },
  };
}

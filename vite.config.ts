import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import basicSsl from '@vitejs/plugin-basic-ssl'

/**
 * Un sitio con varias páginas: la portada y una herramienta por carpeta.
 *
 * Cada página compila a un único .html con el JavaScript y el CSS adentro, así que
 * cualquiera se puede abrir con doble clic o mandar por mail. No hay backend: el
 * servidor de desarrollo existe solo para desarrollar.
 *
 * El modo `celu` (`npm run dev:celu`) levanta el server en https y abierto a la red
 * local. Es para la mesa de luz: los navegadores no prestan la cámara fuera de un
 * contexto seguro, y `http://192.168.x.x` no lo es. El certificado es inventado, así
 * que el celular pide confirmar una vez antes de entrar.
 */
export default defineConfig(({ mode }) => ({
  plugins: [react(), viteSingleFile(), ...(mode === 'celu' ? [basicSsl()] : [])],
  server: { port: 5173 },
  // Rutas relativas: GitHub Pages sirve el sitio desde un subdirectorio
  // (usuario.github.io/dibujo), y con rutas absolutas no encontraría nada.
  base: './',
  build: {
    // Sin límite: cualquier asset se incrusta en vez de quedar como archivo suelto.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 4000,
  },
}))

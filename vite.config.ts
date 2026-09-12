import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * Un sitio con varias páginas: la portada y una herramienta por carpeta.
 *
 * Cada página compila a un único .html con el JavaScript y el CSS adentro, así que
 * cualquiera se puede abrir con doble clic o mandar por mail. No hay backend: el
 * servidor de desarrollo existe solo para desarrollar.
 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
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
})

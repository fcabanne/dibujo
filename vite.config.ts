import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * El build sale como un único .html con el JavaScript y el CSS adentro.
 *
 * La app no tiene backend ni pide nada por red: el servidor existe solo para
 * desarrollar. Empaquetada así se abre con doble clic, se lleva en un pendrive a la
 * casa de cuadros, y se publica en cualquier hosting estático sin configurar nada.
 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: { port: 5173 },
  // Rutas relativas: GitHub Pages sirve el sitio desde un subdirectorio
  // (usuario.github.io/cuadros), y con rutas absolutas no encontraría nada.
  base: './',
  build: {
    // Sin límite: cualquier asset se incrusta en vez de quedar como archivo suelto.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 4000,
  },
})

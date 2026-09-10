import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Publica `dist/` en la rama gh-pages.
 *
 * Se arma el commit con las herramientas de bajo nivel de git en lugar de copiar
 * archivos a una rama: así lo que se publica es exactamente la lista de abajo y
 * nada más. La alternativa habitual (el paquete gh-pages) creaba la rama a partir
 * de main y su limpieza dejaba pasar los archivos que empiezan con punto, con lo
 * que terminaban publicados el .gitignore y la config del editor.
 *
 * Cada publicación es un commit sin padre, así que la rama no acumula historia:
 * el sitio es siempre una foto del build actual.
 */

const DIST = 'dist'
const BRANCH = 'gh-pages'

const git = (args, input) =>
  execFileSync('git', args, { input, encoding: 'utf8' }).trim()

const entries = readdirSync(DIST, { withFileTypes: true })

const nested = entries.filter((e) => e.isDirectory())
if (nested.length > 0) {
  // El build de archivo único siempre es plano. Si algún día deja de serlo, este
  // script necesita armar árboles anidados y es mejor enterarse acá que publicar
  // un sitio incompleto.
  console.error(
    `El build dejó subcarpetas en ${DIST}/ (${nested.map((d) => d.name).join(', ')}).\n` +
      'Este script solo publica archivos sueltos: hay que actualizarlo.',
  )
  process.exit(1)
}

const files = entries.filter((e) => e.isFile()).map((e) => e.name)
if (files.length === 0) {
  console.error(`No hay nada en ${DIST}/. ¿Corriste el build?`)
  process.exit(1)
}

const tree = files
  .map((name) => {
    const blob = git(['hash-object', '-w', join(DIST, name)])
    return `100644 blob ${blob}\t${name}`
  })
  .join('\n')

const treeHash = git(['mktree'], tree + '\n')
const commit = git(['commit-tree', treeHash, '-m', 'Publicar app'])

git(['push', '-f', 'origin', `${commit}:refs/heads/${BRANCH}`])

console.log(`Publicado en ${BRANCH}: ${files.join(', ')}`)

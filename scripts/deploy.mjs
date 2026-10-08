import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Publica `dist/` en la rama gh-pages.
 *
 * Se arma el commit con las herramientas de bajo nivel de git en lugar de copiar
 * archivos a una rama: así lo que se publica es exactamente el contenido de dist y
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
  execFileSync('git', args, { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()

/** Arma el árbol de un directorio y devuelve su hash, bajando a las subcarpetas. */
function buildTree(dir) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )

  const lines = entries.map((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return `040000 tree ${buildTree(path)}\t${entry.name}`
    }
    return `100644 blob ${git(['hash-object', '-w', path])}\t${entry.name}`
  })

  return git(['mktree'], lines.join('\n') + '\n')
}

/** Lista lo que se va a publicar, solo para dejarlo por escrito en la salida. */
function listFiles(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listFiles(join(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  )
}

/**
 * Lo que se publica tiene que incluir todo lo de `main`.
 *
 * El sitio es uno solo y se publica entero desde la rama en la que se esté. Si esa
 * rama quedó atrás de `main`, publicarla vuelve a poner versiones viejas de las
 * otras herramientas, sin aviso: pasó una vez, y Enmarcado y Referencia estuvieron
 * un rato publicados sin el diseño nuevo. Antes de publicar se trae `main` y se
 * mira que esté adentro; si no, hay que traerlo a la rama primero.
 */
git(['fetch', '--quiet', 'origin', 'main'])
try {
  git(['merge-base', '--is-ancestor', 'origin/main', 'HEAD'])
} catch {
  console.error(
    'Esta rama no tiene todo lo de main: publicarla volvería atrás otras herramientas.\n' +
      'Traé main primero (git merge origin/main) y volvé a publicar.',
  )
  process.exit(1)
}

const files = listFiles(DIST)
if (files.length === 0) {
  console.error(`No hay nada en ${DIST}/. ¿Corriste el build?`)
  process.exit(1)
}

const commit = git(['commit-tree', buildTree(DIST), '-m', 'Publicar sitio'])
git(['push', '-f', 'origin', `${commit}:refs/heads/${BRANCH}`])

console.log(`Publicado en ${BRANCH}:`)
for (const file of files) console.log(`  ${file}`)

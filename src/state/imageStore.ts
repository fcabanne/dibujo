/**
 * Guarda la obra cargada en IndexedDB, aparte de la configuración.
 *
 * Antes iba todo junto en localStorage, en una sola escritura. Una foto de cámara
 * pesa megas y revienta la cuota, y como la escritura es una sola, al fallar no se
 * perdía solo la imagen: se perdía la sesión entera. Quedaba en el navegador el
 * último guardado bueno —la configuración de antes de cargar la foto— y desde ahí
 * nada más se guardaba, en silencio.
 *
 * IndexedDB está hecho para archivos y tiene cupo de sobra, así que la imagen vive
 * acá y la configuración queda liviana y a salvo en localStorage.
 */

const DB_NAME = 'cuadros'
const STORE = 'artwork'
const KEY = 'current'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Lo último que se escribió, para no reescribir megas en cada cambio de marco. */
let lastWritten: string | null = null

export async function saveArtwork(src: string): Promise<void> {
  if (src === lastWritten) return
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(src, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    lastWritten = src
    db.close()
  } catch {
    // Sin IndexedDB (modo privado, file://) la app anda igual: lo único que se
    // pierde es que recuerde la obra, no la configuración.
  }
}

export async function loadArtwork(): Promise<string | null> {
  try {
    const db = await openDb()
    const src = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(KEY)
      request.onsuccess = () => resolve((request.result as string) ?? null)
      request.onerror = () => reject(request.error)
    })
    db.close()
    if (src) lastWritten = src
    return src
  } catch {
    return null
  }
}

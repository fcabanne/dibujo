/**
 * Guarda la imagen que cargó el usuario, aparte de la configuración.
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

const DB_NAME = 'dibujo'
const STORE = 'imagenes'

/** Cada herramienta guarda bajo su propia clave: comparten base de datos, no imagen. */
export type ToolId = 'marco' | 'referencia' | 'mesa'

/**
 * Cómo se llamaba antes una herramienta. Existe para que renombrarla no le borre en
 * silencio la foto a quien ya la venía usando: la primera lectura la encuentra con
 * el nombre viejo y la reescribe con el nuevo.
 *
 * Se puede borrar esta tabla cuando ya no queden navegadores con datos viejos.
 */
const RENAMED: Partial<Record<ToolId, string>> = { referencia: 'grilla' }

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

/** Lo último escrito por herramienta, para no reescribir megas en cada cambio. */
const lastWritten = new Map<ToolId, string>()

export async function saveArtwork(tool: ToolId, src: string): Promise<void> {
  if (lastWritten.get(tool) === src) return
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(src, tool)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    lastWritten.set(tool, src)
    db.close()
  } catch {
    // Sin IndexedDB (modo privado, file://) la app anda igual: lo único que se
    // pierde es que recuerde la imagen, no la configuración.
  }
}

export async function loadArtwork(tool: ToolId): Promise<string | null> {
  try {
    const db = await openDb()
    const src = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(tool)
      request.onsuccess = () => resolve((request.result as string) ?? null)
      request.onerror = () => reject(request.error)
    })
    db.close()
    if (src) lastWritten.set(tool, src)
    return src
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------
   Originales sin tocar
   ------------------------------------------------------------------ */

/**
 * Algunas herramientas no guardan una vista previa: guardan el archivo entero, tal
 * como lo eligió el usuario. La referencia es una — lo que exporta es la foto original
 * con las líneas encima, así que si perdiera el original no podría cumplir.
 *
 * Va como Blob, no como data URI: IndexedDB los guarda nativos y así no se paga el
 * tercio de más que cuesta el base64.
 */
interface StoredOriginal {
  blob: Blob
  name: string
}

const lastOriginal = new Map<ToolId, Blob>()

export async function saveOriginal(tool: ToolId, blob: Blob, name: string): Promise<void> {
  if (lastOriginal.get(tool) === blob) return
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ blob, name } satisfies StoredOriginal, tool + ':original')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    lastOriginal.set(tool, blob)
    db.close()
  } catch {
    // Igual que arriba: sin IndexedDB la herramienta anda, solo que no recuerda la foto.
  }
}

export async function loadOriginal(tool: ToolId): Promise<StoredOriginal | null> {
  try {
    const db = await openDb()
    const read = (key: string) =>
      new Promise<StoredOriginal | null>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const request = tx.objectStore(STORE).get(key + ':original')
        request.onsuccess = () => resolve((request.result as StoredOriginal) ?? null)
        request.onerror = () => reject(request.error)
      })

    let stored = await read(tool)
    const old = RENAMED[tool]
    let migrated = false
    if (!stored?.blob && old) {
      stored = await read(old)
      migrated = Boolean(stored?.blob)
    }
    db.close()
    if (!stored?.blob) return null

    if (migrated) {
      // Reescribirla con el nombre nuevo. Ojo con el orden: `saveOriginal` se saltea
      // la escritura si ya anotó este mismo blob, así que no hay que anotarlo antes.
      void saveOriginal(tool, stored.blob, stored.name)
    } else {
      lastOriginal.set(tool, stored.blob)
    }
    return stored
  } catch {
    return null
  }
}

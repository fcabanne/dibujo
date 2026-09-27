import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { copy, fill, formatNumber } from '../../shared/copy'
import type { Reference } from '../../shared/referenceImage'
import { openInstagram } from '../../shared/suggestions'
import {
  BackIcon,
  Button,
  ChoiceGroup,
  CloseIcon,
  ContrastIcon,
  DownloadIcon,
  Dropdown,
  EdgesIcon,
  FacetsIcon,
  FileIcon,
  GridIcon,
  IconButton,
  OptionPicker,
  PaintIcon,
  PhotoIcon,
  ProportionalIcon,
  Slider,
  SquareIcon,
  Stepper,
  UploadIcon,
  type PickerOption,
} from '../../shared/ui'
import { GRID_LIMITS } from '../domain/grid'
import { PAPER_PRESETS, sheetName } from '../domain/paper'
import { CustomColorOption, Hint, NAMED_COLORS, Row, Section } from './controls'
import type { Action } from '../state/reducer'
import type { AppState, EffectsMode, GridMode, PaperId } from '../types'

interface Props {
  state: AppState
  dispatch: (action: Action) => void
  reference: Reference | null
  onPickFile: () => void
  onRemove: () => void
  onDownload: () => void
  effectsSupported: boolean
  /** Pantalla angosta: los controles van abajo en pestañas en vez de al costado. */
  compact: boolean
}

/**
 * El tamaño del dibujo está escondido: se usa en otro momento.
 *
 * Escondido y no borrado. El estado, el dominio y los textos siguen enteros —es
 * lo que hace que las cotas en centímetros puedan volver sin rearmar nada— y lo
 * único que falta es esta sección en la lista. Prenderla es cambiar este `false`.
 */
const SHOW_PAPER: boolean = false

/**
 * El alto natural de la vista que se está mostrando, medido y no fijado: cada
 * pestaña y cada picker mide lo que necesita su contenido, no el de la vista
 * más alta de todas. Un `ResizeObserver` sobre el nodo pasado (`.panel-view`,
 * no `.tab-panel`, que ya tiene un alto impuesto) sigue el contenido real —el
 * de un slider que aparece o desaparece, por ejemplo— aunque no haya cambiado
 * de vista. `.controls` ya no empuja el lienzo (ver su CSS): por eso este
 * número puede cambiar libremente sin que la foto se reencuadre.
 */
function useDrawerHeight() {
  const [height, setHeight] = useState<number | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  const ref = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect()
    if (!node) return
    const measure = () => setHeight(node.scrollHeight)
    measure()
    observer.current = new ResizeObserver(measure)
    observer.current.observe(node)
  }, [])
  useEffect(() => () => observer.current?.disconnect(), [])
  return { height, ref }
}

/** Cómo se llama el modo elegido, para la fila cerrada del Dropdown de Ajustes. */
const ADJUST_NAMES: Record<EffectsMode, string> = {
  original: copy.adjust.original,
  bw: copy.adjust.blackAndWhite,
  edges: copy.adjust.edges,
  facets: copy.adjust.facets,
}

/**
 * Las cuatro maneras de mirar la referencia. Sin frame en Figma todavía —ver
 * el punto 8 del LEEME del sistema de diseño—, así que 2 columnas es una
 * decisión del código y no algo medido de un archivo.
 */
const ADJUST_OPTIONS: PickerOption<EffectsMode>[] = [
  { value: 'original', label: copy.adjust.original, icon: <PhotoIcon /> },
  { value: 'bw', label: copy.adjust.blackAndWhite, icon: <ContrastIcon /> },
  { value: 'edges', label: copy.adjust.edges, icon: <EdgesIcon /> },
  { value: 'facets', label: copy.adjust.facets, icon: <FacetsIcon /> },
]

/** Cómo se llama el modo elegido, para la fila cerrada del Dropdown. */
const TYPE_NAMES: Record<GridMode, string> = {
  proportional: copy.grid.proportional,
  square: copy.grid.square,
  none: copy.grid.none,
}

/** Las tres tarjetas del picker de Tipo. Figma 26:279. "Ninguna" ocupa la fila entera. */
const TYPE_OPTIONS: PickerOption<GridMode>[] = [
  { value: 'proportional', label: copy.grid.proportional, icon: <ProportionalIcon /> },
  { value: 'square', label: copy.grid.square, icon: <SquareIcon /> },
  { value: 'none', label: copy.grid.none, icon: <CloseIcon />, wide: true },
]

/** Las cinco tarjetas con nombre del picker de Color. Figma 26:425. La sexta —"Otro"— va como `trailing`. */
const COLOR_OPTIONS: PickerOption<string>[] = NAMED_COLORS.map((color) => ({
  value: color.value,
  label: color.name,
  icon: <span className="ds-option-swatch" style={{ background: color.value }} />,
}))

interface PanelSection {
  id: string
  /** Nombre largo, para el título de la columna en escritorio. */
  title: string
  /** Nombre corto, para la pestaña de abajo en pantalla angosta. */
  label: string
  icon: ReactNode
  content: ReactNode
}

/**
 * Los controles, definidos una sola vez y servidos de tres formas: la columna
 * de escritorio, la barra de pestañas de celular, y la versión sin foto —donde
 * no hay nada que configurar y solo queda la barra de arriba.
 *
 * Lo que **no** cambia entre las tres es el contenido. Un solo lugar donde está
 * escrito qué controles hay.
 */
export function Panel({
  state,
  dispatch,
  reference,
  onPickFile,
  onRemove,
  onDownload,
  effectsSupported,
  compact,
}: Props) {
  const [thumb, setThumb] = useState<string | null>(null)
  const [openTab, setOpenTab] = useState<string | null>('grilla')
  const drawerHeight = useDrawerHeight()
  /**
   * Cuál picker está abierto, si alguno — el de Tipo/Color de la grilla
   * (Figma 26:279/26:425) o el de Ajustes. Sobrevive a cambiar de pestaña a
   * propósito: si quedó en "Ninguna" o a mitad de elegir, volver a la
   * pestaña lo encuentra como se dejó, no reiniciado. Lo único que lo cierra
   * es una foto nueva (ver el `useEffect` de abajo).
   */
  const [picker, setPicker] = useState<'tipo' | 'color' | 'ajustes' | null>(null)
  const { grid, paper, effects } = state

  /**
   * Cerrar un picker después de elegir, pero no en el acto: se deja un
   * instante para que la tarjeta elegida se pinte y dé su salto (ver
   * `.ds-option.is-selected` en el CSS). Sin esa pausa el picker se iba
   * antes de que se viera qué se había tocado, y elegir se sentía como
   * errarle al botón. La foto cambia en el acto igual: lo que espera es
   * solo la vuelta a las filas.
   */
  const closeTimer = useRef(0)
  const closePickerSoon = useCallback(() => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setPicker(null), 180)
  }, [])
  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  /** La última pestaña abierta: la que se sigue viendo mientras el cajón se cierra. */
  const lastTab = useRef<string>('grilla')
  if (openTab) lastTab.current = openTab

  // La miniatura sale del archivo original, no del lienzo: es la foto como entró.
  // La URL se revoca al cambiar de foto, si no cada carga deja una colgada.
  useEffect(() => {
    if (!reference) {
      setThumb(null)
      return
    }
    const url = URL.createObjectURL(reference.blob)
    setThumb(url)
    return () => URL.revokeObjectURL(url)
  }, [reference])

  /**
   * Cada foto nueva abre la grilla, cerrando cualquier picker que hubiera
   * quedado abierto de la foto anterior.
   *
   * Es a lo que se viene: subir la foto y ponerle la grilla encima. Dejar la
   * pestaña de la foto abierta después de subirla sería mostrarle a alguien lo
   * que acaba de hacer en vez de lo que sigue.
   */
  useEffect(() => {
    if (reference) {
      window.clearTimeout(closeTimer.current)
      setOpenTab('grilla')
      setPicker(null)
    }
  }, [reference])

  const openSuggestions = (e: React.MouseEvent) => openInstagram(e, copy.welcome.suggestionsUrl)

  const photoSection: PanelSection = {
    id: 'foto',
    title: copy.photo.title,
    label: copy.photo.tab,
    icon: <PhotoIcon />,
    content: (
      <>
        <div className="thumb">
          {thumb && <img src={thumb} alt={reference?.name ?? copy.canvas.alt} />}
        </div>

        {reference && (
          <p className="photo-meta">
            <strong>{reference.name}</strong>
            <em>
              {fill(copy.photo.size, {
                width: formatNumber(reference.width),
                height: formatNumber(reference.height),
              })}
            </em>
          </p>
        )}

        {/* Cambiar y quitar van juntos y visibles. Antes el botón aparecía al
            pasar el puntero por encima de la miniatura, y donde no hay puntero
            —un celular— no había forma de llegar a él. */}
        <div className="photo-actions">
          <Button variant="quiet" icon={<UploadIcon />} onClick={onPickFile}>
            {copy.photo.change}
          </Button>
          <IconButton label={copy.photo.remove} onClick={onRemove}>
            <CloseIcon />
          </IconButton>
        </div>
      </>
    ),
  }

  const paperSection: PanelSection = {
    id: 'tamano',
    title: copy.paper.title,
    label: copy.paper.tab,
    icon: <FileIcon />,
    content: (
      <>
        <ChoiceGroup
          className="ds-choice-group--start"
          label={copy.paper.title}
          value={paper.id}
          onChange={(id) => {
            const preset = PAPER_PRESETS.find((sheet) => sheet.id === id)
            dispatch({
              type: 'paper/patch',
              patch: preset ? { id, w: preset.w, h: preset.h } : { id },
            })
          }}
          options={[
            { value: 'none' as PaperId, label: copy.paper.none },
            ...PAPER_PRESETS.map((preset) => ({
              value: preset.id as PaperId,
              label: sheetName(preset.id),
            })),
            { value: 'custom' as PaperId, label: copy.paper.custom },
          ]}
        />

        {paper.id === 'custom' && (
          <div className="numbers">
            <span className="unit">
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={300}
                step={0.1}
                value={paper.w}
                aria-label={copy.paper.width}
                onChange={(e) =>
                  dispatch({
                    type: 'paper/patch',
                    patch: { w: Math.max(1, Number(e.target.value) || 1) },
                  })
                }
              />
            </span>
            <span>×</span>
            <span className="unit">
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={300}
                step={0.1}
                value={paper.h}
                aria-label={copy.paper.height}
                onChange={(e) =>
                  dispatch({
                    type: 'paper/patch',
                    patch: { h: Math.max(1, Number(e.target.value) || 1) },
                  })
                }
              />
            </span>
          </div>
        )}
      </>
    ),
  }

  /**
   * Qué picker se ve en cada pestaña. No sale solo del estado `picker`: un
   * modo que no tiene nada que configurar —"Ninguna" en la grilla,
   * "Original" en Ajustes— deja su picker abierto siempre, porque la vista
   * cerrada sería una fila sola con un vacío abajo. Así es como la pestaña de
   * Ajustes abre directo en sus cuatro tarjetas, y como "Ninguna" sigue en
   * su picker aunque se haya cargado otra foto.
   */
  const gridPicker =
    picker === 'color' ? 'color' : picker === 'tipo' || grid.mode === 'none' ? 'tipo' : null
  const adjustPicker = picker === 'ajustes' || effects.mode === 'original'

  const isCustomColor = !NAMED_COLORS.some(
    (color) => color.value === grid.style.color.toLowerCase(),
  )

  const gridSection: PanelSection = {
    id: 'grilla',
    title: copy.grid.title,
    label: copy.grid.tab,
    icon: <GridIcon />,
    content:
      gridPicker === 'tipo' ? (
        <OptionPicker
          label={copy.grid.type}
          value={grid.mode}
          columns={2}
          options={TYPE_OPTIONS}
          onChange={(mode) => {
            dispatch({ type: 'grid/patch', patch: { mode } })
            // "Ninguna" no vuelve a las filas: sin grilla no hay nada que ver
            // ahí, y lo más probable después de sacarla es elegir otro tipo.
            if (mode !== 'none') {
              // Abierto a mano durante la pausa: si estaba abierto solo por
              // "Ninguna", al cambiar el modo se cerraría en el acto.
              setPicker('tipo')
              closePickerSoon()
            }
          }}
        />
      ) : gridPicker === 'color' ? (
        <OptionPicker
          label={copy.grid.color}
          value={isCustomColor ? '' : grid.style.color.toLowerCase()}
          columns={3}
          options={COLOR_OPTIONS}
          onChange={(color) => {
            dispatch({ type: 'grid/style', patch: { color } })
            closePickerSoon()
          }}
          trailing={
            <CustomColorOption
              value={grid.style.color}
              selected={isCustomColor}
              onChange={(color) => dispatch({ type: 'grid/style', patch: { color } })}
              onClose={() => setPicker(null)}
            />
          }
        />
      ) : (
        <>
          {/* Tipo y Color abren una pantalla propia (`OptionPicker`) en vez de un
              menú: no hay diseño de un menú flotante en el archivo. */}
          <Row label={copy.grid.type}>
            <Dropdown
              label={copy.grid.type}
              value={TYPE_NAMES[grid.mode]}
              onClick={() => setPicker('tipo')}
            />
          </Row>

          <Row label={copy.grid.color}>
            <Dropdown
              label={copy.grid.color}
              value={isCustomColor ? copy.grid.customColor : NAMED_COLORS.find(
                (color) => color.value === grid.style.color.toLowerCase(),
              )!.name}
              swatch={grid.style.color}
              onClick={() => setPicker('color')}
            />
          </Row>

          {/* El mismo número para los dos modos: cambiar de uno a otro muestra en
              qué se diferencian, sin que además salte el tamaño. Y de a uno con el
              stepper, no arrastrando: seis divisiones es una decisión, no un punto
              que se busca. */}
          <Row label={copy.grid.divisions}>
            <Stepper
              label={copy.grid.divisions}
              value={grid.count}
              min={GRID_LIMITS.min}
              max={GRID_LIMITS.max}
              onChange={(count) => dispatch({ type: 'grid/patch', patch: { count } })}
              decrementLabel={copy.grid.fewer}
              incrementLabel={copy.grid.more}
            />
          </Row>

          <Row label={copy.grid.weight}>
            <Slider
              label={copy.grid.weight}
              value={grid.style.weight}
              min={1}
              max={6}
              step={1}
              onChange={(weight) => dispatch({ type: 'grid/style', patch: { weight } })}
            />
          </Row>

          <Row label={copy.grid.opacity}>
            <Slider
              label={copy.grid.opacity}
              value={Math.round(grid.style.opacity * 100)}
              min={0}
              max={100}
              step={5}
              onChange={(v) => dispatch({ type: 'grid/style', patch: { opacity: v / 100 } })}
              format={(v) => fill(copy.grid.opacityValue, { n: v })}
            />
          </Row>
        </>
      ),
  }

  const adjustSection: PanelSection = {
    id: 'ajustes',
    title: copy.adjust.title,
    label: copy.adjust.tab,
    icon: <PaintIcon />,
    content: !effectsSupported ? (
      <Hint>{copy.adjust.unsupported}</Hint>
    ) : adjustPicker ? (
      <OptionPicker
        label={copy.adjust.title}
        value={effects.mode}
        columns={2}
        options={ADJUST_OPTIONS}
        onChange={(mode) => {
          dispatch({ type: 'effects/mode', mode })
          // "Original" se queda en las tarjetas, igual que "Ninguna": no hay
          // nada que ajustar abajo.
          if (mode !== 'original') {
            setPicker('ajustes')
            closePickerSoon()
          }
        }}
      />
    ) : (
      <>
        {/* Igual que Tipo/Color de la grilla: la fila cerrada lleva a una
            pantalla propia en vez de abrir un menú acá mismo. */}
        <Row label={copy.adjust.title}>
          <Dropdown
            label={copy.adjust.title}
            value={ADJUST_NAMES[effects.mode]}
            onClick={() => setPicker('ajustes')}
          />
        </Row>

        {/* Cada modo muestra solo la perilla que le importa. El resto de los
            valores los fija él, y esconderlos es el punto: son los que hay que
            entender para usar esto, y no hay por qué entenderlos. Original no
            muestra ninguna. */}
        {effects.mode === 'bw' && (
          <Row label={copy.adjust.contrast}>
            <Slider
              label={copy.adjust.contrast}
              value={effects.contrast}
              min={-100}
              max={100}
              step={1}
              onChange={(contrast) => dispatch({ type: 'effects/patch', patch: { contrast } })}
              format={signed}
            />
          </Row>
        )}

        {effects.mode === 'edges' && (
          <Row label={copy.adjust.contrast}>
            <Slider
              label={copy.adjust.contrast}
              value={effects.edges}
              min={0}
              max={100}
              step={1}
              onChange={(edges) => dispatch({ type: 'effects/patch', patch: { edges } })}
            />
          </Row>
        )}

        {effects.mode === 'facets' && (
          <>
            <Row label={copy.adjust.amount}>
              <Stepper
                label={copy.adjust.amount}
                value={effects.tones}
                min={2}
                max={4}
                onChange={(tones) => dispatch({ type: 'effects/patch', patch: { tones } })}
                decrementLabel={copy.grid.fewer}
                incrementLabel={copy.grid.more}
              />
            </Row>
            <Row label={copy.adjust.light}>
              <Slider
                label={copy.adjust.light}
                value={effects.light}
                min={-100}
                max={100}
                step={1}
                onChange={(light) => dispatch({ type: 'effects/patch', patch: { light } })}
                format={signed}
              />
            </Row>
            <Row label={copy.adjust.contrast}>
              <Slider
                label={copy.adjust.contrast}
                value={effects.contrast}
                min={-100}
                max={100}
                step={1}
                onChange={(contrast) => dispatch({ type: 'effects/patch', patch: { contrast } })}
                format={signed}
              />
            </Row>
          </>
        )}
      </>
    ),
  }

  const sections: PanelSection[] = [
    photoSection,
    ...(SHOW_PAPER ? [paperSection] : []),
    gridSection,
    adjustSection,
  ]

  // La píldora oscura de la pestaña abierta es un elemento propio que viaja
  // de una pestaña a otra, y no el fondo de cada botón prendiéndose y
  // apagándose: así se ve de dónde a dónde se fue. Con todo cerrado se
  // achica en el lugar de la última pestaña, en vez de volver al principio.
  const thumbIndex = Math.max(
    0,
    sections.findIndex((section) => section.id === (openTab ?? lastTab.current)),
  )
  const tabBar = (
    <nav className="tabbar tabbar--tabs">
      <span
        className={'tabbar-thumb' + (openTab ? '' : ' is-hidden')}
        style={{ '--i': thumbIndex } as CSSProperties}
        aria-hidden="true"
      />
      {sections.map((section) => (
        <IconButton
          key={section.id}
          label={section.label}
          selected={section.id === openTab}
          onClick={() => setOpenTab(section.id === openTab ? null : section.id)}
        >
          {section.icon}
        </IconButton>
      ))}
    </nav>
  )

  /**
   * Qué vista se ve en el cajón y cómo entra. Cada combinación de pestaña y
   * picker es una vista; cuando cambia, la nueva entra desde donde tiene
   * sentido: de costado si se cambió de pestaña (del lado de la pestaña
   * nueva), "hacia adentro" si se abrió un picker, "hacia afuera" si se
   * volvió a las filas, y de abajo si el cajón estaba cerrado. Se decide acá
   * y no en cada vista porque es la única parte que sabe de dónde se viene.
   */
  const shown = sections.find((section) => section.id === (openTab ?? lastTab.current)) ?? null
  const pickerPart = (id: string) =>
    id === 'grilla' && gridPicker ? gridPicker : id === 'ajustes' && adjustPicker ? 'picker' : 'filas'
  const viewKey = shown ? `${shown.id}:${pickerPart(shown.id)}` : ''
  const previousView = useRef({ key: viewKey, open: openTab !== null })
  const viewMotion = useRef('is-rise')
  if (viewKey !== previousView.current.key || (openTab !== null) !== previousView.current.open) {
    const [fromId, fromPart] = previousView.current.key.split(':')
    const toId = shown?.id ?? ''
    if (!previousView.current.open) viewMotion.current = 'is-rise'
    else if (fromId !== toId) {
      const from = sections.findIndex((section) => section.id === fromId)
      const to = sections.findIndex((section) => section.id === toId)
      viewMotion.current = to > from ? 'is-from-right' : 'is-from-left'
    } else viewMotion.current = fromPart === 'filas' ? 'is-deeper' : 'is-back'
    previousView.current = { key: viewKey, open: openTab !== null }
  }

  // --- sin foto: volver y sugerencias, abajo y juntos ------------------------
  // El diseño de la pantalla de inicio (18:76) no lleva pestañas: no hay nada
  // que configurar todavía. Volver comparte fila con "Dejame sugerencias" en
  // vez de flotar arriba solo: es la misma barra de abajo que el resto de la
  // herramienta, no una tercera forma de acomodar la navegación.
  if (!reference) {
    return (
      <div className="welcome-bottombar">
        <nav className="tabbar">
          <IconButton label={copy.app.back} onClick={() => (window.location.href = '../')}>
            <BackIcon />
          </IconButton>
        </nav>
        <h1 className="ds-sr">{copy.app.name}</h1>
        <a className="ds-link" href={copy.welcome.suggestionsUrl} onClick={openSuggestions}>
          {copy.welcome.suggestions}
        </a>
      </div>
    )
  }

  // --- pantalla angosta: todo abajo --------------------------------------
  // Con foto puesta, el diseño saca la barra flotante de arriba: volver y
  // descargar bajan a la misma fila que las pestañas (26:279, 22:45),
  // flanqueándolas — no una barra aparte. Eso también le deja el alto entero
  // a la foto, que es lo que la agranda contra la versión anterior.
  if (compact) {
    // El cajón está siempre, y se abre y se cierra cambiando de alto. Al
    // cerrarse sigue mostrando la última pestaña mientras baja, en vez de
    // vaciarse de golpe y bajar vacío. Cerrado del todo queda `visibility:
    // hidden` (ver el CSS), que es lo que lo saca del orden del teclado y del
    // lector de pantalla.
    return (
      <div
        className="controls"
        style={
          drawerHeight.height
            ? ({ '--content-height': `${drawerHeight.height}px` } as CSSProperties)
            : undefined
        }
      >
        <div
          className={'tab-drawer' + (openTab ? ' is-open' : '')}
          aria-hidden={openTab ? undefined : true}
        >
          {shown && (
            <div className="tab-panel">
              <div className={'panel-view ' + viewMotion.current} key={viewKey} ref={drawerHeight.ref}>
                {shown.content}
              </div>
            </div>
          )}
        </div>
        <div className="bottombar">
          <nav className="tabbar">
            <IconButton label={copy.app.back} onClick={() => (window.location.href = '../')}>
              <BackIcon />
            </IconButton>
          </nav>
          {tabBar}
          <nav className="tabbar">
            <IconButton label={copy.download.action} onClick={onDownload}>
              <DownloadIcon />
            </IconButton>
          </nav>
        </div>
      </div>
    )
  }

  // --- escritorio: columna al costado ---------------------------------------
  return (
    <aside className="panel">
      <header>
        <IconButton label={copy.app.back} onClick={() => (window.location.href = '../')}>
          <BackIcon />
        </IconButton>
        <h1>{copy.app.name}</h1>
      </header>

      <div className="scroll">
        {sections.map((section) => (
          <Section key={section.id} title={section.title}>
            {section.content}
          </Section>
        ))}
      </div>

      {/* Fuera del scroll: es la acción que cierra el trabajo, y tener que buscarla
          al pie de una columna larga la esconde justo cuando se la necesita. */}
      <div className="footer">
        <Button variant="loud" icon={<DownloadIcon />} onClick={onDownload}>
          {copy.download.action}
        </Button>
      </div>
    </aside>
  )
}

const signed = (v: number) => (v > 0 ? `+${v}` : String(v))

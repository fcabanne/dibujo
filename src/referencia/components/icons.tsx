/**
 * Los íconos salen tal cual del diseño en Figma: los `path` son los que
 * exportó el archivo, sin redibujar. Lo único que cambia es el color, que pasa
 * a `currentColor` para que cada estado lo resuelva el CSS — en el diseño el
 * ícono de la pestaña abierta va blanco sobre el violeta, y los demás violeta
 * sobre el fondo claro.
 *
 * Son dos familias con métrica distinta y por eso no comparten `viewBox`: los
 * de la barra de arriba vienen en 21 con trazo de 1,4, y los de las pestañas en
 * 24 con trazo de 2. Unificarlos a ojo los deformaría.
 */

const barra = {
  viewBox: '0 0 21 21',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const pestana = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** Cargar la foto: la flecha que entra a la bandeja. */
export function PhotoIcon() {
  return (
    <svg {...pestana}>
      <path d="M4 17V19C4 19.5304 4.21071 20.0391 4.58579 20.4142C4.96086 20.7893 5.46957 21 6 21H18C18.5304 21 19.0391 20.7893 19.4142 20.4142C19.7893 20.0391 20 19.5304 20 19V17M17 9L12 4L7 9M12 4V16" />
    </svg>
  )
}

/** La hoja: el tamaño del dibujo. */
export function SizeIcon() {
  return (
    <svg {...pestana}>
      <path d="M14 3V7C14 7.26522 14.1054 7.51957 14.2929 7.70711C14.4804 7.89464 14.7348 8 15 8H19M19 8L14 3H7C6.46957 3 5.96086 3.21071 5.58579 3.58579C5.21071 3.96086 5 4.46957 5 5V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V8Z" />
    </svg>
  )
}

/** La grilla. */
export function GridIcon() {
  return (
    <svg {...pestana}>
      <path d="M3 6H21M3 12H21M3 18H21M6 3V21M12 3V21M18 3V21" />
    </svg>
  )
}

/** El pincel: los ajustes de la foto. */
export function TuneIcon() {
  return (
    <svg {...pestana}>
      <path d="M8.2 13.2C9.2177 10.505 10.9441 8.13474 13.1971 6.33944C15.45 4.54414 18.1458 3.3904 21 3C20.6096 5.85418 19.4559 8.55002 17.6606 10.8029C15.8653 13.0559 13.495 14.7823 10.8 15.8M10.6 9C12.5432 9.89687 14.1031 11.4568 15 13.4M3 21V17C3 16.2089 3.2346 15.4355 3.67412 14.7777C4.11365 14.1199 4.73836 13.6072 5.46927 13.3045C6.20017 13.0017 7.00444 12.9225 7.78036 13.0769C8.55629 13.2312 9.26902 13.6122 9.82843 14.1716C10.3878 14.731 10.7688 15.4437 10.9231 16.2196C11.0775 16.9956 10.9983 17.7998 10.6955 18.5307C10.3928 19.2616 9.88008 19.8864 9.22228 20.3259C8.56448 20.7654 7.79113 21 7 21H3Z" />
    </svg>
  )
}

/** Bajar el archivo. */
export function DownloadIcon() {
  return (
    <svg {...barra}>
      <path d="M10.5 3.0625V12.6875M7 9.1875L10.5 12.6875L14 9.1875M3.9375 14V16.1875C3.9375 16.6516 4.12187 17.0967 4.45006 17.4249C4.77825 17.7531 5.22337 17.9375 5.6875 17.9375H15.3125C15.7766 17.9375 16.2217 17.7531 16.5499 17.4249C16.8781 17.0967 17.0625 16.6516 17.0625 16.1875V14" />
    </svg>
  )
}

/** Volver a las herramientas. */
export function BackIcon() {
  return (
    <svg {...barra}>
      <path d="M13.125 4.375L7 10.5L13.125 16.625" />
    </svg>
  )
}

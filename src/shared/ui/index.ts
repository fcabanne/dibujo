/**
 * La puerta del sistema de diseño.
 *
 * Un solo import trae componentes, íconos **y estilos**:
 *
 *     import { Button, UploadIcon } from '../shared/ui'
 *
 * Los dos CSS se importan acá y no en la hoja de cada herramienta a
 * propósito: así no existe la forma de usar un componente y olvidarse de
 * sus estilos. Vite los junta en el mismo archivo compilado.
 */

import './tokens.css'
import './components.css'

export { Button, type ButtonProps, type ButtonVariant } from './Button'
export { IconButton, type IconButtonProps } from './IconButton'
export { Checkbox, type CheckboxProps } from './Checkbox'

export {
  UploadIcon,
  FileIcon,
  GridIcon,
  PaintIcon,
  DownloadIcon,
  BackIcon,
  CloseIcon,
  type IconProps,
} from './icons'

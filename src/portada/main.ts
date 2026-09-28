import { openInstagram } from '../shared/suggestions'

/**
 * Lo único que la portada necesita de JavaScript: que "Dejame sugerencias"
 * abra la app de Instagram en el celular, como en las herramientas. Sin
 * JavaScript el link sigue funcionando y abre la web.
 */
const link = document.querySelector<HTMLAnchorElement>('.portada-link')
link?.addEventListener('click', (e) => openInstagram(e, link.href))

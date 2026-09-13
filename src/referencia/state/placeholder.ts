import { openReference, type Reference } from '../../shared/referenceImage'

/**
 * La foto de ejemplo con la que abre la herramienta.
 *
 * Va como SVG con degradados y no como un JPEG incrustado por dos motivos. Uno, que
 * un JPEG en base64 sumaría cientos de KB al archivo autocontenido. Dos, y más
 * importante, que lo que los efectos necesitan para poder mostrarse es una imagen
 * con rango tonal —luces, medios tonos, sombras y contornos claros—, y eso se puede
 * dibujar: una naturaleza muerta con luz lateral tiene exactamente lo que hace falta
 * para que subir el contraste, aplastar los tonos o marcar los bordes se note.
 */
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
  <defs>
    <linearGradient id="pared" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="#7d766b"/>
      <stop offset="0.45" stop-color="#4e483f"/>
      <stop offset="1" stop-color="#22201d"/>
    </linearGradient>
    <radialGradient id="foco" cx="0.26" cy="0.14" r="0.78">
      <stop offset="0" stop-color="#fff3dc" stop-opacity="0.55"/>
      <stop offset="0.55" stop-color="#fff3dc" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#fff3dc" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="tabla" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0" stop-color="#a08a6c"/>
      <stop offset="0.35" stop-color="#6e5c46"/>
      <stop offset="1" stop-color="#332b22"/>
    </linearGradient>
    <radialGradient id="ceramica" cx="0.3" cy="0.2" r="0.95">
      <stop offset="0" stop-color="#f6efe0"/>
      <stop offset="0.35" stop-color="#d5c9b2"/>
      <stop offset="0.68" stop-color="#8d8271"/>
      <stop offset="0.9" stop-color="#4b453b"/>
      <stop offset="1" stop-color="#332f29"/>
    </radialGradient>
    <radialGradient id="pera" cx="0.33" cy="0.28" r="0.85">
      <stop offset="0" stop-color="#efe0a4"/>
      <stop offset="0.42" stop-color="#c3ab63"/>
      <stop offset="0.78" stop-color="#6f6134"/>
      <stop offset="1" stop-color="#38301a"/>
    </radialGradient>
    <radialGradient id="manzana" cx="0.34" cy="0.26" r="0.85">
      <stop offset="0" stop-color="#e6a189"/>
      <stop offset="0.4" stop-color="#a9503c"/>
      <stop offset="0.8" stop-color="#53211a"/>
      <stop offset="1" stop-color="#2a110e"/>
    </radialGradient>
    <radialGradient id="sombra" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#14110e" stop-opacity="0.72"/>
      <stop offset="0.6" stop-color="#14110e" stop-opacity="0.3"/>
      <stop offset="1" stop-color="#14110e" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="tela" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#cfc6b4"/>
      <stop offset="0.5" stop-color="#8e8676"/>
      <stop offset="1" stop-color="#403b33"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="1500" fill="url(#pared)"/>
  <rect width="1200" height="1500" fill="url(#foco)"/>

  <path d="M0 1046 L1200 998 L1200 1500 L0 1500 Z" fill="url(#tabla)"/>
  <path d="M0 1046 L1200 998 L1200 1016 L0 1066 Z" fill="#c2a884" opacity="0.5"/>

  <path d="M690 1002 C820 990 980 1010 1080 1064 C1140 1098 1160 1160 1108 1208 C1040 1270 880 1276 800 1230 C742 1196 700 1120 690 1002 Z" fill="url(#tela)" opacity="0.85"/>

  <ellipse cx="470" cy="1178" rx="330" ry="72" fill="url(#sombra)"/>
  <ellipse cx="792" cy="1246" rx="176" ry="46" fill="url(#sombra)"/>
  <ellipse cx="286" cy="1274" rx="150" ry="40" fill="url(#sombra)"/>

  <path d="M452 356 C446 402 438 428 414 452 C372 494 346 566 340 664 C332 794 356 936 400 1052 C424 1116 476 1152 552 1156 C640 1160 704 1124 730 1052 C772 936 786 794 774 668 C764 566 738 496 698 454 C676 430 668 402 664 356 C662 326 646 310 612 302 C574 294 530 294 500 304 C466 316 454 330 452 356 Z" fill="url(#ceramica)"/>
  <path d="M470 340 C470 322 500 312 558 312 C616 312 646 322 646 340 C646 358 616 368 558 368 C500 368 470 358 470 340 Z" fill="#2f2b25" opacity="0.55"/>
  <path d="M486 338 C486 328 518 322 558 322 C598 322 630 328 630 338 C630 348 598 354 558 354 C518 354 486 348 486 338 Z" fill="#171512"/>
  <path d="M418 520 C392 600 384 726 396 848 C404 934 420 1000 444 1046" fill="none" stroke="#fff6e6" stroke-opacity="0.3" stroke-width="26" stroke-linecap="round"/>
  <path d="M742 560 C762 648 766 786 752 896 C744 962 728 1014 706 1050" fill="none" stroke="#0d0b09" stroke-opacity="0.4" stroke-width="40" stroke-linecap="round"/>
  <path d="M774 660 C830 656 866 700 862 762 C858 826 812 868 762 866" fill="none" stroke="#6d6354" stroke-width="34" stroke-linecap="round"/>
  <path d="M776 674 C818 672 846 706 842 758 C838 810 806 842 766 842" fill="none" stroke="#c9bda7" stroke-opacity="0.55" stroke-width="12" stroke-linecap="round"/>

  <path d="M792 1072 C838 1066 866 1096 872 1140 C880 1196 846 1244 792 1246 C738 1248 704 1200 712 1142 C718 1098 748 1078 792 1072 Z" fill="url(#manzana)"/>
  <path d="M790 1074 C788 1056 786 1044 780 1032" fill="none" stroke="#3a2a18" stroke-width="9" stroke-linecap="round"/>
  <ellipse cx="762" cy="1114" rx="26" ry="18" fill="#ffd9c2" opacity="0.45" transform="rotate(-24 762 1114)"/>

  <path d="M286 1112 C286 1080 300 1058 318 1046 C330 1038 334 1024 332 1004 C346 1016 352 1028 350 1042 C376 1050 396 1076 400 1112 C406 1164 372 1204 322 1206 C272 1208 240 1172 246 1126 C250 1092 266 1072 286 1058 Z" fill="url(#pera)"/>
  <ellipse cx="300" cy="1104" rx="24" ry="32" fill="#fff4c4" opacity="0.4" transform="rotate(-18 300 1104)"/>

  <g stroke="#0e0c0a" stroke-opacity="0.25" stroke-width="2" fill="none">
    <path d="M0 1046 L1200 998"/>
  </g>
</svg>`

export async function placeholderReference(): Promise<Reference> {
  const blob = new Blob([PLACEHOLDER_SVG], { type: 'image/svg+xml' })
  return openReference(blob, 'ejemplo.svg')
}

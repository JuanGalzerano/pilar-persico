# Portfolio — Pilar Pérsico

Sitio de una sola página, estático. No hay build ni backend: son archivos que se
suben tal cual a cualquier hosting estático (Netlify, Vercel, GitHub Pages).

## Cómo verlo

**No se abre con doble click.** Con `file://` el runtime de diseño hace un
`fetch` del propio HTML para parsear el bloque `<x-dc>` y CORS lo bloquea: se ve
el fondo animado pero ningún contenido. Hay que servirlo por HTTP:

```bash
python -m http.server 8931
```

Y abrir <http://127.0.0.1:8931/index.html>.

## Estructura

```
pili/
├── index.html                  ← la página entera (markup + estilos + estado)
├── support.js                  ← runtime del editor de diseño (no tocar)
├── image-slot.js               ← componente de las fotos arrastrables (no tocar)
├── _ds/                        ← tokens del design system (no tocar)
├── assets/
│   ├── js/pp-motion.js         ← fondo animado, ruleta de fuentes, menú, videos
│   ├── video/                  ← los mp4 de Trabajos y sus posters
│   └── fonts/                  ← tipografías propias (Tropika.woff2 si aparece)
├── uploads/                    ← fotos soltadas en los image-slot (lo escribe la herramienta)
├── tools/fonts.html            ← probador de tipografías, no es parte del sitio
├── archivo/                    ← versiones viejas del diseño
└── README.md
```

Los tres archivos "no tocar" y `_ds/` los genera y sobrescribe el editor de
diseño. Todo lo propio vive en `assets/`.

## Contacto — falta el número real

Los tres botones de WhatsApp (hero, menú y sección de contacto) apuntan
todavía al número de ejemplo `5491155555555`. Para poner el de Pilar,
reemplazar esa cadena en `index.html`: aparece tres veces y va en formato
internacional sin `+` ni espacios (Argentina: `54` + `9` + característica sin
el 0 + número sin el 15).

El link ya lleva el mensaje escrito de antemano, así que a Pilar le llega
"Hola Pili, vi tu portfolio y quiero consultar por tus servicios de …" con el
cursor listo para completar.

Mail: `pilipersico1@gmail.com`.

## Videos de la sección Trabajos

Cada card espera dos archivos en `assets/video/`:

| Card | Video | Poster (opcional) |
| --- | --- | --- |
| Pilchera | `pilchera.mp4` | `pilchera-poster.jpg` |
| Mercado Libre | `mercado-libre.mp4` | `mercado-libre-poster.jpg` |

Si el mp4 no está, la card muestra un cartel diciendo cuál falta. Cuando está,
se reproduce mudo y en loop **sólo mientras se ve en pantalla**, y el archivo
recién se descarga cuando la card se acerca al viewport. El botón de abajo a la
derecha activa el sonido, uno por vez.

Comprimir antes de subir:

```bash
ffmpeg -i original.mp4 -vf "scale=-2:1080" -c:v libx264 -crf 24 -preset slow -c:a aac -b:a 128k -movflags +faststart assets/video/pilchera.mp4
```

## Qué hace `assets/js/pp-motion.js`

Se cuelga del `<body>`, fuera del árbol que renderiza el editor, así un
re-render no pisa el estado de la animación.

| Módulo | Qué hace |
| --- | --- |
| `background()` | manchas de color difuminadas + trama halftone + asteriscos, estrellas y fichas que hacen parallax con el mouse y el scroll, y se corren cuando pasa el puntero |
| `typeCycle()` | el H1 gira como ruleta 3 s desacelerando y frena 10 s en Caprasimo (`REST_FONT`) |
| `menu()` | bloquea el scroll con el menú abierto, cierra con Escape o click afuera, y navega a mano a la sección |
| `videos()` | carga diferida, play/pause por visibilidad, sonido de a uno |
| `chrome()` | sombra del header al scrollear y aparición de las secciones |

Todo respeta `prefers-reduced-motion` y se pausa con la pestaña oculta.

## Cambiar la tipografía del título

En `assets/js/pp-motion.js`:

- `FONT_CYCLE` — las que pasan durante el giro. Cada una lleva su **peso real**
  (`w`): la mayoría de las display existen sólo en 400 y si se les pide 800 el
  navegador fabrica un bold falso que las deforma.
- `REST_FONT` — en cuál frena.

Para elegir, abrir `tools/fonts.html` por HTTP: muestra el nombre en 26
tipografías con su peso correcto y simula la ruleta.

# Almanaque

Colección de juegos de palabras: la portada común de los juegos diarios en español
(Calendas, Periplo, Mentidero, Trampantojo, Atlas, Gentilicio, Paremia, Relicario, Toponimia, Otrora, Chirimbolo, Gazapo). Es una PWA instalable hecha con HTML, CSS y
JavaScript, sin dependencias ni compilación.

## Archivos

| Archivo | Para qué sirve |
| --- | --- |
| `games.json` | **La lista de juegos.** La portada se genera a partir de aquí. |
| `icons/` | Iconos de los juegos (SVG o PNG) y de la app. |
| `index.html`, `styles.css`, `app.js` | La portada. No hay que tocarlos para añadir juegos. |
| `manifest.json`, `sw.js` | PWA: instalación y funcionamiento sin conexión. |
| `reiniciar/index.html` | Página para borrar el progreso de todos los juegos (para pruebas). |
| `herramientas/` | Scripts para regenerar la imagen para compartir y las capturas del manifiesto. |

## Añadir un juego

El reto de cada juego cambia a medianoche en la hora local del jugador, no en la de
Madrid: la portada cuenta los días igual (hojas hechas, resultados y racha común), y con
otro criterio se descuadran fuera de España. Saca la fecha con `getFullYear()`,
`getMonth()` y `getDate()`, sin `timeZone`.

1. Guarda su icono en `icons/` (por ejemplo `icons/mijuego.svg`). Funciona mejor si es
   cuadrado, de 128 × 128 o más, y tiene su propio fondo.
2. Añade una entrada al final de `games.json` (no olvides la coma tras la entrada anterior):

   ```json
   {
     "id": "mijuego",
     "nombre": "Mi juego",
     "subtitulo": "Frase corta en cursiva",
     "descripcion": "Una o dos líneas que expliquen de qué va.",
     "url": "https://joseleking.github.io/MiJuego/",
     "color": "#2f6b3a",
     "icono": "icons/mijuego.svg",
     "estado": "nuevo"
   }
   ```

   - `id`: único, en minúsculas y sin espacios. Se usa para recordar si se ha jugado hoy.
   - `color`: color de acento del juego en la portada (filete y nombre de la hoja, su
     línea en «Hechos hoy», su marca en la línea de progreso) y del confeti de almanaque
     completo. En modo oscuro se aclara solo. Como tinta de imprenta, distinto de los
     demás y oscuro: al menos 4,5:1 sobre el papel `#f3ead7`.
   - `estado` es opcional: `"nuevo"` añade una etiqueta en la esquina superior izquierda; `"proximamente"` muestra la hoja
     sin enlace (también se puede dejar `url` vacío). Bórralo cuando ya no haga falta.
   - El orden de las hojas es el del archivo.
3. En el **repositorio del juego**, añade la mano ☜ para volver a Almanaque: copia
   `para-los-juegos/volver-almanaque.js` junto al `index.html` del juego (en un proyecto
   con Vite, en `public/`) y añade en su `index.html`:

   ```html
   <script src="volver-almanaque.js" defer></script>
   ```

   El juego muestra siempre una franja «☜ Regresar al Almanaque» arriba, se llegue desde
   Almanaque o se entre directamente. Almanaque abre cada juego con
   `?desde=almanaque&juego=<id>` para pasarle su id; si no, se toma de la ruta. Si el
   juego guarda archivos para jugar sin conexión, añade también `volver-almanaque.js` a
   esa lista. Si el juego pone
   versión a sus archivos (`app.js?v=3`), pónsela también a este
   (`volver-almanaque.js?v=2`) y súbela cada vez que lo actualices: si no, el navegador
   puede seguir usando la copia antigua.
4. Para que la hoja salga como «Hecho», el juego debe avisar cuando la partida de hoy esté
   terminada (y también al abrirlo si ya lo estaba):

   ```js
   window.almanaqueHecho && window.almanaqueHecho();
   ```

   Al volver con la mano ☜, Almanaque recibe `?hecho=<id>` y marca la hoja. Abrir un juego
   sin jugarlo no la marca.

   Si además le pasa el resultado de hoy, Almanaque lo muestra en la línea del juego en
   «Hechos hoy» con tres casillas, rellenas según los aciertos («● ● ○»):

   ```js
   window.almanaqueHecho && window.almanaqueHecho({ aciertos: 2, total: 3 });
   window.almanaqueHecho && window.almanaqueHecho({ aciertos: 3, total: 3, racha: 8 });
   ```

   Todos los campos son opcionales. Todos los juegos tienen tres retos al día y la portada
   pinta siempre tres casillas: si `total` es otro, los aciertos se llevan a tres (7 de 10
   rellena dos). Sin `aciertos` y `total`, las tres casillas salen punteadas: el juego
   está hecho, pero no se sabe cómo fue. La portada no muestra `racha` ni `texto` (texto
   libre y corto, hasta 40 caracteres): la racha de cada juego se ve dentro del juego, y
   la racha común, arriba. El resultado se guarda en el `localStorage` que comparten todos los
   juegos de `joseleking.github.io`, así que llega y marca la hoja aunque el jugador no
   vuelva con la mano ☜. Se borra solo al cambiar de día.

   Cada llamada a `almanaqueHecho` apunta además el día en `almanaque:dias` (lista de
   fechas `AAAA-MM-DD`). De ahí sale la racha común que la portada muestra junto al botón
   de tema: días seguidos en que se ha terminado una partida de cualquier juego. Si hoy
   aún no se ha jugado, la llama sale apagada y la racha de ayer sigue contando. Mientras
   la racha sea 0 el botón no se muestra (el de tema no se mueve) y aparece en cuanto se
   juega, también al volver de un juego sin recargar. Si el juego no está en
   `joseleking.github.io/<Nombre>/`, el id se toma de la ruta en minúsculas: debe coincidir
   con el de `games.json`.

   En la pantalla final, junto a «Compartir resultado», el juego puede poner un botón de
   volver con el estilo que quiera:

   ```html
   <a class="boton" data-almanaque-volver hidden href="https://joseleking.github.io/Almanaque/">☜ Regresar al Almanaque</a>
   ```

   `volver-almanaque.js` lo muestra siempre y lo lleva al mismo sitio que la mano ☜.

   **Siguiente juego.** La franja ofrece siempre a la derecha «Periplo ☞»
   (en pantallas estrechas, «Regresar al Almanaque» se acorta a «☜ Almanaque»). Con la
   partida de hoy terminada, el script pone además un botón «Siguiente juego: Periplo ☞»
   justo encima de cada botón de volver, con sus mismas clases, así que toma el estilo del
   juego sin tocar su HTML. Los dos llevan al primer juego que sigue en el orden de
   `games.json` y que aún no está hecho hoy (con vuelta al principio, y sin los de
   «próximamente»); sin conexión no salen. La lista se lee de
   `games.json` de Almanaque, así que un juego nuevo aparece solo. Para saber qué está
   hecho, `almanaqueHecho` apunta también la hoja en `almanaque:hechos`, la lista de la
   portada, que así la marca aunque no se vuelva con la mano ☜.

   **Almanaque completo.** Cuando ya no queda ninguna hoja por hacer hoy (contando la de
   este juego, que debe estar hecha), la franja muestra a la derecha «✓ Almanaque
   completo» (en pantallas muy estrechas, «✓ Completo») en vez del siguiente juego, sin
   mano ☞, y lleva a la portada con `?hecho=<id>`, como la mano ☜. En la pantalla final
   no sale botón de siguiente: queda solo el de volver.
   En el juego que termina el almanaque, al llamar a `almanaqueHecho`, se abre por
   encima de la partida una pantalla de almanaque completo (`#almanaque-completo`, un
   `<dialog>` modal): una hoja con los colores del juego donde se estampa el sello
   grande, que lleva a la portada, mientras cae confeti con los colores de los juegos de
   `games.json`. Si el juego abre su pantalla final después (Gazapo, a los 1,1 s), la
   pantalla vuelve a subir encima sin repetir la entrada. «Ver la partida», tocar fuera
   de la hoja o Escape la cierran y dejan ver las soluciones. Sale una vez al día (se
   apunta en `almanaque:confeti`); con movimiento reducido, sin confeti y con el sello
   quieto.
   Sin conexión (sin `games.json`) no sale nada.

   Si el juego coloca algo encima de la franja (como el botón de ayuda de Otrora), la
   franja entera es `#almanaque-franja`; dentro van `#almanaque-volver` y
   `#almanaque-siguiente`.

   En `localhost`, la franja y los botones llevan al mismo servidor local en vez de a
   `joseleking.github.io`: sirviendo todos los repos desde un mismo puerto (por ejemplo
   una carpeta con enlaces a cada uno) se puede ir de un juego a otro en local.
5. Modo claro u oscuro: todos los juegos siguen al que se elija en Almanaque (la clave
   `almanaque:tema` del `localStorage` compartido vale `light` o `dark`). Sin elección,
   modo luminoso: nada depende de `prefers-color-scheme`. En el juego, los colores oscuros
   van bajo `:root[data-theme="dark"]` y, en su `<head>`, tras la etiqueta `theme-color`:

   ```html
   <script>
     try {
       if (localStorage.getItem('almanaque:tema') === 'dark') {
         document.documentElement.dataset.theme = 'dark';
         document.querySelector('meta[name="theme-color"]').content = '#16202c';
       }
     } catch (e) {}
   </script>
   ```

   Si el juego tiene su propio botón de tema, debe leer y guardar esa misma clave, con
   `light` o `dark`, para que el cambio valga también en la portada y en los demás juegos.
6. Sube los cambios a GitHub. Si quieres que quien tenga la app instalada vea el cambio
   también sin conexión, actualiza la versión de la caché (siguiente apartado).

## La portada a lo largo del día

Lo pendiente va siempre arriba. Las hojas de los juegos que faltan por hacer hoy salen
en el orden de `games.json`, cada una con su número de siempre (Atlas es «Nº V» aunque
sea la primera que queda), y las de «próximamente» al final. Debajo, la sección «Hechos
hoy» recoge los juegos ya hechos en una línea compacta cada uno: icono, nombre, resultado
de hoy en tres casillas y ☞, que lleva al juego como la hoja. Sin ningún juego hecho, la sección no sale y
la portada se ve como siempre; con todos hechos, no quedan hojas y la lista sigue al sello.

Bajo la fecha, la línea de progreso pone una marca por juego (sin los de «próximamente»),
rellena con su color si está hecho y solo con el borde si no, y a la derecha «4 de 12».
Cada marca es un botón que lleva a la hoja o a la línea de ese juego y la resalta un
instante. Con el almanaque completo la fila se oculta: ya lo dice el sello.

Al entrar en un juego, la portada apunta qué hoja era y a qué altura estaba
(`almanaque:altura`, en `sessionStorage`). Si al volver el juego sigue pendiente, la hoja
queda a la misma altura; si se acaba de hacer, la portada se queda arriba del todo, con la
siguiente hoja pendiente a la vista, y su línea entra en «Hechos hoy» con un fundido breve
(sin él con movimiento reducido).

Todo se repinta al volver a la página (botón atrás, cambiar de app), al cambiar de día a
medianoche y al cambiar el tema.

## Almanaque completo

Cuando todas las hojas jugables de hoy (las de `games.json` con `url` y sin
`"proximamente"`) están hechas —por `almanaque:hechos` o por tener resultado de hoy en
`almanaque:resultados`—, la portada estampa bajo la fecha un sello rojo «Almanaque
completo» con la fecha en números romanos («10 · X · MMXXVI») y, debajo, la cuenta atrás
hasta los juegos nuevos de medianoche («Juegos nuevos en 8 h 12 min»), que corre cada minuto
mientras la página está a la vista. Al pasar la medianoche, la portada se repinta: sin
sello y con las hojas sin hacer.

El sello cae con el golpe de la A de la portada solo la primera vez que se ve completo
cada día; ese día se apunta en `almanaque:completo` (`AAAA-MM-DD`) y las demás veces sale
quieto (también siempre con movimiento reducido). Si se añade un juego a `games.json`
durante el día, el sello desaparece hasta que se haga esa hoja.

## Instalar la app

Bajo los juegos sale el botón «Instalar Almanaque», salvo si ya se está usando la app
instalada. Lo que hace depende del navegador (ver `pasosParaInstalar` en `app.js`):

- **Chrome, Edge y demás Chromium**: abre el diálogo de instalación del navegador.
- **Navegadores internos de las redes** (Instagram, Facebook, TikTok, LINE, Snapchat,
  LinkedIn): no se puede instalar desde ahí, así que la nota pide abrir la página en el
  navegador. Se detectan por el `userAgent`; para añadir otra app, añade su marca a la
  lista `NAVEGADORES_INTERNOS`.
- **iPhone y iPad** (Safari, Chrome y otros): pasos para «Añadir a pantalla de inicio».
- **Resto** (Safari en Mac, Firefox, Android sin aviso…): los pasos de cada uno.

En iOS y iPadOS la app instalada tiene su propio almacenamiento, separado del del
navegador: empieza con la racha a cero y sin partidas. Por eso, en esos dispositivos, la
nota añade un aviso bajo los pasos. En Android y en el ordenador no ocurre.

## Vista previa al compartir y capturas

- `icons/almanaque-compartir.png` (1200 × 630) es la imagen de la vista previa del enlace
  (etiquetas Open Graph y de Twitter en `index.html`).
- `icons/captura-movil.png` (1080 × 1920) y `icons/captura-escritorio.png` (1920 × 1080)
  son las capturas de `screenshots` en `manifest.json`: con ellas y la descripción, Chrome
  muestra un diálogo de instalación más rico.

Ninguna va en `ARCHIVOS` de `sw.js`: no hacen falta sin conexión. Para regenerarlas
(por ejemplo, tras cambiar la portada o añadir un juego), con Node y Google Chrome
instalados y conexión para las tipografías:

```sh
cd herramientas
npm install
npm run compartir   # icons/almanaque-compartir.png
npm run capturas    # icons/captura-movil.png e icons/captura-escritorio.png
```

Las capturas se hacen en modo claro, con una racha de cinco días y dos hojas hechas con
resultado. Los scripts comprimen las imágenes y avisan si la de compartir pasa de 300 KB
o alguna captura de 400 KB.

## Actualizar la versión de la caché

El service worker guarda una copia de la portada para abrirla sin conexión. Con conexión
siempre se descarga la versión más reciente, pero conviene cambiar la versión en cada
publicación para que la copia guardada se renueve entera y se borre la antigua:

1. Abre `sw.js`.
2. Cambia la constante del principio, por ejemplo de `'v1'` a `'v2'`:

   ```js
   const CACHE_VERSION = 'v2';
   ```
3. Sube los cambios. Al abrir la app, el navegador detecta que `sw.js` ha cambiado,
   instala el nuevo y elimina la caché vieja.

Si añades un archivo nuevo a la portada (no un juego), inclúyelo también en la lista
`ARCHIVOS` de `sw.js`. Los iconos de los juegos no hace falta: se leen de `games.json`.

## Probar en local

El service worker y `games.json` necesitan un servidor (no funciona abriendo el archivo
con doble clic). Desde la carpeta del proyecto:

```sh
python3 -m http.server 8000
```

y abre <http://localhost:8000>. Para probar el modo sin conexión: DevTools → Application →
Service Workers (o Network → Offline) y recarga.

### Reiniciar todos los juegos

Visita `/reiniciar/` (por ejemplo <https://joseleking.github.io/Almanaque/reiniciar/>) y
pulsa «Borrar todo». Borra las partidas, rachas y estadísticas de todos los juegos y las
hojas hechas, los resultados de hoy y la racha común de la portada, en ese navegador:
todo lo que esté guardado bajo `<id>:…` (con los `id` de `games.json`) y las claves
`almanaque:hechos`, `almanaque:resultados`, `almanaque:dias`, `almanaque:completo` y `almanaque:confeti`. El modo claro u oscuro de cada juego se conserva (las claves que
acaban en `:tema`). Funciona porque todos los juegos comparten origen
(`joseleking.github.io`); en local solo alcanza a los juegos servidos desde el mismo
`localhost:puerto`. Un juego nuevo queda incluido solo si guarda bajo `<id>:`.

## Publicar en GitHub Pages

1. Sube el repositorio a GitHub (rama `main`).
2. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a
   branch**, rama `main`, carpeta `/ (root)`. Guarda.
3. En un par de minutos estará en `https://<usuario>.github.io/Almanaque/`.

Todas las rutas son relativas, así que funciona igual en una subcarpeta o en un dominio
propio.

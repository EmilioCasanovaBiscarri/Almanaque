/* Almanaque — genera la portada a partir de games.json.
   No hace falta tocar este archivo para añadir juegos. */
(function () {
  'use strict';

  var CLAVE_HECHOS = 'almanaque:hechos';
  var CLAVE_ANTIGUA = 'almanaque:abiertos';
  var CLAVE_TEMA = 'almanaque:tema';
  var CLAVE_RESULTADOS = 'almanaque:resultados';
  var CLAVE_ALTURA = 'almanaque:altura';
  var CLAVE_DIAS = 'almanaque:dias';
  var CLAVE_COMPLETO = 'almanaque:completo';
  var VIGENCIA_ALTURA_MS = 6 * 60 * 60 * 1000;

  var hojasEl = document.getElementById('hojas');
  var avisoEl = document.getElementById('aviso');
  var juegos = [];
  var diaPintado = null;

  /* --- Almacenamiento (siempre tolerante a fallos) ----------------------- */

  function leer(clave) {
    try {
      return window.localStorage.getItem(clave);
    } catch (e) {
      return null;
    }
  }

  function guardar(clave, valor) {
    try {
      window.localStorage.setItem(clave, valor);
    } catch (e) {
      /* Sin almacenamiento: la app sigue funcionando, solo sin memoria. */
    }
  }

  /* --- Fechas ------------------------------------------------------------ */

  function claveDeHoy() {
    return claveDeFecha(new Date());
  }

  function claveDeFecha(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function fechaDeAlmanaque(d) {
    var texto;
    try {
      texto = new Intl.DateTimeFormat('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }).format(d);
    } catch (e) {
      var dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      var meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
        'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      texto = dias[d.getDay()] + ', ' + d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear();
    }
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  function diaDelAnio(d) {
    var inicio = new Date(d.getFullYear(), 0, 1);
    return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - inicio) / 86400000) + 1;
  }

  // Fase lunar aproximada a partir de una luna nueva conocida (6 ene 2000).
  function faseLunar(d) {
    var mesSinodico = 29.530588853;
    var lunaNueva = Date.UTC(2000, 0, 6, 18, 14);
    var edad = ((d.getTime() - lunaNueva) / 86400000) % mesSinodico;
    if (edad < 0) edad += mesSinodico;
    var fases = [
      'luna nueva', 'luna creciente', 'cuarto creciente', 'luna gibosa creciente',
      'luna llena', 'luna gibosa menguante', 'cuarto menguante', 'luna menguante'
    ];
    return fases[Math.floor((edad / mesSinodico) * 8 + 0.5) % 8];
  }

  function romano(n) {
    var tabla = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
      [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    var s = '';
    tabla.forEach(function (par) {
      while (n >= par[0]) { s += par[1]; n -= par[0]; }
    });
    return s;
  }

  function pintarCabecera() {
    var hoy = new Date();
    document.getElementById('fecha').textContent = fechaDeAlmanaque(hoy);
    document.getElementById('efemerides').textContent =
      'Día ' + diaDelAnio(hoy) + ' del año · ' + faseLunar(hoy).replace(/^./, function (c) { return c.toUpperCase(); });
    document.getElementById('anio-romano').textContent = romano(hoy.getFullYear());
  }

  /* --- Juegos hechos hoy ------------------------------------------------- */

  function hechosHoy() {
    try {
      var datos = JSON.parse(leer(CLAVE_HECHOS) || 'null');
      if (datos && datos.fecha === claveDeHoy() && Array.isArray(datos.ids)) return datos.ids;
    } catch (e) { /* datos corruptos: se ignoran */ }
    return [];
  }

  function marcarHecho(id) {
    var ids = hechosHoy();
    if (ids.indexOf(id) === -1) ids.push(id);
    guardar(CLAVE_HECHOS, JSON.stringify({ fecha: claveDeHoy(), ids: ids }));
  }

  // Un juego terminado vuelve con ?hecho=<id> (ver para-los-juegos/volver-almanaque.js).
  // Abrir un juego no basta para marcarlo: solo cuenta haberlo jugado.
  function recogerHecho() {
    try {
      window.localStorage.removeItem(CLAVE_ANTIGUA);
    } catch (e) { /* sin almacenamiento */ }
    try {
      var url = new URL(window.location.href);
      var id = url.searchParams.get('hecho');
      if (!id) return;
      marcarHecho(id);
      url.searchParams.delete('hecho');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    } catch (e) { /* navegador antiguo: se ignora */ }
  }

  /* --- Resultados de hoy ------------------------------------------------ */

  // Los guarda cada juego al terminar (ver para-los-juegos/volver-almanaque.js).
  function resultadosHoy() {
    try {
      var datos = JSON.parse(leer(CLAVE_RESULTADOS) || 'null');
      if (datos && datos.fecha === claveDeHoy() && datos.juegos && typeof datos.juegos === 'object') return datos.juegos;
    } catch (e) { /* datos corruptos: se ignoran */ }
    return {};
  }

  // Todos los juegos tienen tres retos al día: la línea de «Hechos hoy» lleva siempre tres
  // casillas, rellenas según los aciertos («● ● ○»). Si un juego manda otra cuenta, se
  // lleva a tres; sin cuenta (un día de prueba o una copia antigua de volver-almanaque.js),
  // las tres salen punteadas: hecho, pero sin saber cómo fue. Lo que dice para los lectores
  // de pantalla queda en su aria-label («2 de 3»). La racha de cada juego no sale aquí:
  // repetida en cada línea sobraba; se ve dentro del juego y, la común, arriba.
  var CASILLAS = 3;

  function crearResultado(r) {
    var tieneCuenta = !!r && typeof r.aciertos === 'number' && typeof r.total === 'number' && r.total > 0;
    var aciertos = tieneCuenta ? Math.min(Math.max(0, r.aciertos), r.total) : 0;
    var llenas = tieneCuenta ? Math.round(aciertos / r.total * CASILLAS) : 0;

    var linea = el('span', 'hecho__resultado');
    for (var i = 0; i < CASILLAS; i++) {
      linea.appendChild(el('span', !tieneCuenta ? 'punto punto--sin-dato' : i < llenas ? 'punto punto--acierto' : 'punto'));
    }
    linea.setAttribute('aria-hidden', 'true');
    linea.dataset.dicho = tieneCuenta ? aciertos + ' de ' + r.total : '';
    return linea;
  }

  /* --- Racha común ------------------------------------------------------- */

  // Días (AAAA-MM-DD) en que se ha terminado alguna partida. Los apunta cada juego al
  // llamar a almanaqueHecho (ver para-los-juegos/volver-almanaque.js) y, por si un juego
  // aún tiene la copia antigua del script, también la portada con lo que ve de hoy.
  function diasJugados() {
    try {
      var dias = JSON.parse(leer(CLAVE_DIAS) || '[]');
      if (Array.isArray(dias)) {
        return dias.filter(function (d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d); });
      }
    } catch (e) { /* datos corruptos: se empieza de nuevo */ }
    return [];
  }

  // Fechas que dejan las hojas hechas y los resultados guardados, aunque sean de otro día.
  function diasALaVista() {
    var vistos = [];
    try {
      var hechos = JSON.parse(leer(CLAVE_HECHOS) || 'null');
      if (hechos && typeof hechos.fecha === 'string' && Array.isArray(hechos.ids) && hechos.ids.length) vistos.push(hechos.fecha);
    } catch (e) { /* datos corruptos */ }
    try {
      var resultados = JSON.parse(leer(CLAVE_RESULTADOS) || 'null');
      if (resultados && typeof resultados.fecha === 'string' && resultados.juegos && Object.keys(resultados.juegos).length) vistos.push(resultados.fecha);
    } catch (e) { /* datos corruptos */ }
    return vistos;
  }

  function apuntarDias() {
    var dias = diasJugados();
    var nuevos = diasALaVista().filter(function (d) {
      return /^\d{4}-\d{2}-\d{2}$/.test(d) && dias.indexOf(d) === -1;
    });
    if (!nuevos.length) return dias;
    dias = dias.concat(nuevos).sort();
    guardar(CLAVE_DIAS, JSON.stringify(dias));
    return dias;
  }

  // Días seguidos hasta hoy. Si hoy aún no se ha jugado, la racha de ayer sigue viva.
  function calcularRacha(dias) {
    var d = new Date();
    var jugadoHoy = dias.indexOf(claveDeFecha(d)) !== -1;
    if (!jugadoHoy) d.setDate(d.getDate() - 1);
    var racha = 0;
    while (dias.indexOf(claveDeFecha(d)) !== -1) {
      racha++;
      d.setDate(d.getDate() - 1);
    }
    return { dias: racha, hoy: jugadoHoy };
  }

  function pintarRacha() {
    var racha = calcularRacha(apuntarDias());
    var caja = document.getElementById('racha');
    // Sin racha no hay nada que contar: el botón no sale hasta el primer día jugado.
    caja.hidden = !racha.dias;
    if (!racha.dias) mostrarNotaRacha(false);
    document.getElementById('racha-cifra').textContent = racha.dias;
    caja.classList.toggle('racha--hoy', racha.hoy);
    var dias = racha.dias + (racha.dias === 1 ? ' día seguido' : ' días seguidos');
    caja.setAttribute('aria-label', 'Racha: ' + dias + '. Más información');
    document.getElementById('racha-titulo').textContent = 'Racha de ' + dias;
    var hoy;
    if (racha.hoy) hoy = 'Hoy ya has jugado: la llama está encendida y la racha, a salvo.';
    else if (racha.dias) hoy = 'Hoy aún no has jugado: juega antes de medianoche para no perderla.';
    else hoy = 'Juega hoy a cualquier juego para empezarla.';
    document.getElementById('racha-hoy').textContent = hoy;
  }

  // Al tocar la racha se abre o cierra la nota que la explica.
  var botonRacha = document.getElementById('racha');
  var notaRacha = document.getElementById('racha-nota');

  function mostrarNotaRacha(abrir) {
    notaRacha.hidden = !abrir;
    botonRacha.setAttribute('aria-expanded', String(abrir));
  }

  botonRacha.addEventListener('click', function () {
    mostrarNotaRacha(notaRacha.hidden);
  });
  // Se cierra al tocar fuera o con Escape.
  document.addEventListener('click', function (e) {
    if (!notaRacha.hidden && !notaRacha.contains(e.target) && !botonRacha.contains(e.target)) mostrarNotaRacha(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !notaRacha.hidden) {
      mostrarNotaRacha(false);
      botonRacha.focus();
    }
  });

  /* --- Volver a la misma altura ------------------------------------------ */

  // Al entrar en un juego se apunta qué hoja era, a qué altura de la pantalla estaba y
  // si estaba pendiente. Al volver, la portada se carga de nuevo y empezaría arriba del
  // todo: si el juego sigue pendiente, se pone su hoja a la misma altura (por la hoja y
  // no por los píxeles desplazados, porque las de encima pueden haber cambiado). Si se
  // acaba de hacer, su hoja ha bajado a «Hechos hoy»: la portada se queda arriba, con la
  // siguiente pendiente a la vista.
  function apuntarAltura(id, nodo, pendiente) {
    try {
      window.sessionStorage.setItem(CLAVE_ALTURA, JSON.stringify({
        id: id,
        arriba: nodo.getBoundingClientRect().top,
        pendiente: pendiente,
        cuando: Date.now()
      }));
    } catch (e) { /* sin almacenamiento: se vuelve arriba, como antes */ }
  }

  function tomarAltura() {
    var datos = null;
    try {
      datos = JSON.parse(window.sessionStorage.getItem(CLAVE_ALTURA) || 'null');
      window.sessionStorage.removeItem(CLAVE_ALTURA);
    } catch (e) { /* datos corruptos o sin almacenamiento */ }
    if (!datos || typeof datos.id !== 'string' || typeof datos.arriba !== 'number') return null;
    if (!(Date.now() - datos.cuando < VIGENCIA_ALTURA_MS)) return null;
    return datos;
  }

  // Se entró en el juego estando pendiente y ya está hecho.
  function recienHecho(datos) {
    if (!datos || !datos.pendiente) return false;
    var juego = juegoPorId(datos.id);
    return !!juego && estaHecho(juego, hechosHoy(), resultadosHoy());
  }

  // La hoja pendiente o la línea de «Hechos hoy» de ese juego.
  function nodoDelJuego(id) {
    var nodos = document.querySelectorAll('main [data-juego]');
    for (var i = 0; i < nodos.length; i++) {
      if (nodos[i].dataset.juego === id) return nodos[i];
    }
    return null;
  }

  function colocarHoja(datos) {
    var nodo = nodoDelJuego(datos.id);
    if (nodo) window.scrollTo(0, window.scrollY + nodo.getBoundingClientRect().top - datos.arriba);
  }

  function volverALaAltura(datos, recien) {
    if (!datos) return;
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    if (recien) {
      window.scrollTo(0, 0);
      return;
    }
    colocarHoja(datos);
    // Las fuentes pueden llegar después y cambiar la altura de las hojas: se recoloca.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { colocarHoja(datos); });
    }
  }

  /* --- Render ------------------------------------------------------------ */

  function el(etiqueta, clase, texto) {
    var nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto != null) nodo.textContent = texto;
    return nodo;
  }

  function normalizarEstado(estado) {
    var e = String(estado || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return e === 'nuevo' || e === 'proximamente' ? e : '';
  }

  // Marca el enlace para que el juego muestre la mano ☜ de vuelta a Almanaque
  // (ver para-los-juegos/volver-almanaque.js).
  function enlaceDesdeAlmanaque(direccion, id) {
    try {
      var url = new URL(direccion, window.location.href);
      url.searchParams.set('desde', 'almanaque');
      url.searchParams.set('juego', id);
      return url.href;
    } catch (e) {
      return direccion;
    }
  }

  // Los de «próximamente» (o sin url) no cuentan: ni para el progreso ni para los hechos.
  function esJugable(juego) {
    return !!juego.url && normalizarEstado(juego.estado) !== 'proximamente';
  }

  // Hecho hoy: vuelto con ☜ o con resultado de hoy aunque no se volviera con ☜.
  function estaHecho(juego, hechos, resultados) {
    return esJugable(juego) && (hechos.indexOf(juego.id) !== -1 || !!resultados[juego.id]);
  }

  function juegoPorId(id) {
    for (var i = 0; i < juegos.length; i++) {
      if (juegos[i].id === id) return juegos[i];
    }
    return null;
  }

  // Abierto en otra pestaña (Cmd, Ctrl, Mayús o botón central), aquí no se vuelve.
  function alEntrar(enlace, id, nodo, pendiente) {
    enlace.addEventListener('click', function (e) {
      if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) apuntarAltura(id, nodo, pendiente);
    });
  }

  // Hoja de un juego pendiente (o de «próximamente»). El número es el del juego en
  // games.json, no el de su puesto entre las pendientes.
  function crearHoja(juego, indice) {
    var estado = normalizarEstado(juego.estado);
    var proximamente = !esJugable(juego);

    var li = el('li', 'hoja');
    li.dataset.juego = juego.id;
    if (juego.color) li.style.setProperty('--acento', juego.color);
    if (proximamente) li.classList.add('hoja--proximamente');

    var cuerpo;
    if (proximamente) {
      cuerpo = el('div', 'hoja__cuerpo');
    } else {
      cuerpo = el('a', 'hoja__cuerpo');
      cuerpo.href = enlaceDesdeAlmanaque(juego.url, juego.id);
      alEntrar(cuerpo, juego.id, li, true);
    }

    var icono = el('img', 'hoja__icono');
    icono.src = juego.icono || 'icons/almanaque.svg';
    icono.alt = '';
    icono.width = 72;
    icono.height = 72;
    icono.decoding = 'async';
    cuerpo.appendChild(icono);

    var texto = el('span', 'hoja__texto');
    texto.appendChild(el('span', 'hoja__numero', 'Nº ' + romano(indice + 1)));
    texto.appendChild(el('span', 'hoja__nombre', juego.nombre));
    if (juego.subtitulo) texto.appendChild(el('span', 'hoja__subtitulo', juego.subtitulo));
    if (juego.descripcion) texto.appendChild(el('span', 'hoja__descripcion', juego.descripcion));
    cuerpo.appendChild(texto);

    var mano = el('span', 'hoja__mano', '☞');
    mano.setAttribute('aria-hidden', 'true');
    cuerpo.appendChild(mano);

    // «Nuevo» va solo en la esquina de arriba a la izquierda; «Próximamente», a la derecha.
    if (estado === 'nuevo' && !proximamente) {
      var nuevo = el('span', 'hoja__marcas hoja__marcas--izquierda');
      nuevo.appendChild(el('span', 'marca marca--nuevo', 'Nuevo'));
      cuerpo.appendChild(nuevo);
    }
    if (proximamente) {
      var marcas = el('span', 'hoja__marcas');
      marcas.appendChild(el('span', 'marca marca--proximamente', 'Próximamente'));
      li.classList.add('hoja--con-marcas');
      cuerpo.appendChild(marcas);
    }

    li.appendChild(cuerpo);
    return li;
  }

  // Línea compacta de un juego hecho hoy: icono, nombre, tres casillas y ☞.
  function crearLineaHecho(juego, resultado, recien) {
    var li = el('li', 'hecho');
    li.dataset.juego = juego.id;
    if (juego.color) li.style.setProperty('--acento', juego.color);
    if (recien) li.classList.add('hecho--recien');

    var enlace = el('a', 'hecho__enlace');
    enlace.href = enlaceDesdeAlmanaque(juego.url, juego.id);
    alEntrar(enlace, juego.id, li, false);

    var icono = el('img', 'hecho__icono');
    icono.src = juego.icono || 'icons/almanaque.svg';
    icono.alt = '';
    icono.width = 28;
    icono.height = 28;
    icono.decoding = 'async';
    enlace.appendChild(icono);

    enlace.appendChild(el('span', 'hecho__nombre', juego.nombre));

    var lineaResultado = crearResultado(resultado);
    enlace.appendChild(lineaResultado);
    var dicho = lineaResultado.dataset.dicho;
    enlace.setAttribute('aria-label', juego.nombre + ', hecho hoy' + (dicho ? ': ' + dicho : ''));

    var mano = el('span', 'hecho__mano', '☞');
    mano.setAttribute('aria-hidden', 'true');
    enlace.appendChild(mano);

    li.appendChild(enlace);
    return li;
  }

  // Lleva la página hasta la hoja (o la línea de «Hechos hoy») del juego y la resalta.
  var resaltadoId = null;

  function irAlJuego(id) {
    var nodo = nodoDelJuego(id);
    if (!nodo) return;
    try {
      nodo.scrollIntoView({ behavior: sinMovimiento() ? 'auto' : 'smooth', block: 'center' });
    } catch (e) {
      nodo.scrollIntoView();
    }
    var anterior = document.querySelector('.resaltada');
    if (anterior) anterior.classList.remove('resaltada');
    window.clearTimeout(resaltadoId);
    void nodo.offsetWidth; // para que la animación vuelva a empezar
    nodo.classList.add('resaltada');
    resaltadoId = window.setTimeout(function () { nodo.classList.remove('resaltada'); }, 1600);
    // El foco va al enlace, para seguir con el teclado desde ahí.
    var enlace = nodo.querySelector('a');
    if (enlace) {
      try {
        enlace.focus({ preventScroll: true });
      } catch (e) { /* navegador antiguo */ }
    }
  }

  // Una marca por juego jugable, en el orden de games.json, y «4 de 12» a la derecha.
  function pintarProgreso(jugables, hechos, resultados, completo) {
    var caja = document.getElementById('progreso');
    var marcas = document.createDocumentFragment();
    var cuenta = 0;
    jugables.forEach(function (juego) {
      var hecho = estaHecho(juego, hechos, resultados);
      if (hecho) cuenta++;
      var boton = el('button', 'progreso__marca' + (hecho ? ' progreso__marca--hecha' : ''));
      boton.type = 'button';
      if (juego.color) boton.style.setProperty('--acento', juego.color);
      boton.setAttribute('aria-label', juego.nombre + (hecho ? ', hecho' : ', pendiente'));
      boton.title = juego.nombre;
      boton.addEventListener('click', function () { irAlJuego(juego.id); });
      marcas.appendChild(boton);
    });
    // Sin ningún juego hecho todavía no hay progreso que mostrar; con el
    // almanaque completo, el sello ya lo dice.
    caja.hidden = completo || !cuenta;
    document.getElementById('progreso-marcas').replaceChildren(marcas);
    var texto = document.getElementById('progreso-cuenta');
    texto.textContent = cuenta + ' de ' + jugables.length;
    texto.setAttribute('aria-label', cuenta + ' de ' + jugables.length + ' juegos hechos hoy');
  }

  // Los juegos que se acaban de hacer entran en «Hechos hoy» con un fundido breve:
  // el de la vuelta (ver volverALaAltura) y los que no estaban en la pintura anterior.
  var recienHechos = [];
  var hechosPintados = null;
  var firmaPintada = null;

  function pintarHojas() {
    var hechos = hechosHoy();
    var resultados = resultadosHoy();
    var jugables = juegos.filter(esJugable);
    var completo = estaCompleto(hechos, resultados);
    diaPintado = claveDeHoy();

    // Al volver a la página sin cambios no se rehace nada (ni se corta un fundido).
    var firma = JSON.stringify([diaPintado, juegos, hechos, resultados]);
    if (firma !== firmaPintada) {
      firmaPintada = firma;
      var pendientes = document.createDocumentFragment();
      var proximos = document.createDocumentFragment();
      var lista = document.createDocumentFragment();
      var ahora = [];
      juegos.forEach(function (juego, i) {
        if (!esJugable(juego)) {
          proximos.appendChild(crearHoja(juego, i));
        } else if (!estaHecho(juego, hechos, resultados)) {
          pendientes.appendChild(crearHoja(juego, i));
        } else {
          var recien = recienHechos.indexOf(juego.id) !== -1 ||
            (hechosPintados !== null && hechosPintados.indexOf(juego.id) === -1);
          lista.appendChild(crearLineaHecho(juego, resultados[juego.id], recien));
          ahora.push(juego.id);
        }
      });
      pendientes.appendChild(proximos);
      hojasEl.replaceChildren(pendientes);
      hojasEl.hidden = !hojasEl.childNodes.length;
      document.getElementById('hechos-lista').replaceChildren(lista);
      document.getElementById('hechos').hidden = !ahora.length;
      hechosPintados = ahora;
      recienHechos = [];
      pintarProgreso(jugables, hechos, resultados, completo);
    }
    pintarCompleto(completo);
  }

  /* --- Almanaque completo ------------------------------------------------ */

  // Todas las hojas jugables de hoy hechas. Si se añade un juego a games.json durante
  // el día, deja de estar completo hasta hacer esa hoja.
  function estaCompleto(hechos, resultados) {
    var jugables = juegos.filter(esJugable);
    return jugables.length > 0 && jugables.every(function (j) {
      return estaHecho(j, hechos, resultados);
    });
  }

  var completoEl = document.getElementById('completo');
  var selloEl = document.getElementById('sello');
  var cuentaEl = document.getElementById('cuenta-atras');

  function sinMovimiento() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // El sello se estampa la primera vez que se ve completo cada día (se apunta en
  // almanaque:completo); después, y con movimiento reducido, sale quieto.
  function pintarCompleto(completo) {
    var estabaOculto = completoEl.hidden;
    completoEl.hidden = !completo;
    if (!completo) {
      selloEl.classList.remove('sello--estampar');
      return;
    }
    var hoy = new Date();
    document.getElementById('sello-fecha').textContent =
      hoy.getDate() + ' · ' + romano(hoy.getMonth() + 1) + ' · ' + romano(hoy.getFullYear());
    pintarCuentaAtras();
    if (leer(CLAVE_COMPLETO) === claveDeHoy()) return;
    guardar(CLAVE_COMPLETO, claveDeHoy());
    if (!estabaOculto || sinMovimiento()) return;
    // Si la portada fugaz aún tapa la página, el golpe espera a que se vaya.
    var portada = document.getElementById('portada');
    var tapada = portada && !document.documentElement.classList.contains('sin-portada');
    selloEl.style.animationDelay = tapada ? '1.7s' : '';
    selloEl.classList.add('sello--estampar');
  }

  /* --- Cuenta atrás hasta los juegos nuevos ----------------------------- */

  // Hasta la próxima medianoche local, con fechas de calendario: así los días de cambio
  // de hora duran lo que duran.
  function textoCuentaAtras(ahora) {
    var medianoche = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
    var minutos = Math.max(1, Math.ceil((medianoche - ahora) / 60000));
    var horas = Math.floor(minutos / 60);
    var resto = minutos % 60;
    if (!horas) return 'Juegos nuevos en ' + resto + ' min';
    return 'Juegos nuevos en ' + horas + ' h' + (resto ? ' ' + resto + ' min' : '');
  }

  function pintarCuentaAtras() {
    var texto = textoCuentaAtras(new Date());
    if (cuentaEl.textContent !== texto) cuentaEl.textContent = texto;
  }

  // Cada minuto, en punto y solo con la página a la vista: pasa la cuenta atrás y, al
  // cambiar de día, repinta la portada (las hojas vuelven a salir sin hacer).
  var latidoId = null;

  function latir() {
    window.clearTimeout(latidoId);
    latidoId = null;
    if (document.visibilityState === 'hidden') return;
    var ahora = new Date();
    latidoId = window.setTimeout(function () {
      if (diaPintado && diaPintado !== claveDeHoy()) refrescar();
      else if (!completoEl.hidden) pintarCuentaAtras();
      latir();
    }, 60000 - ahora.getSeconds() * 1000 - ahora.getMilliseconds() + 50);
  }

  function mostrarAviso(texto) {
    avisoEl.textContent = texto;
    avisoEl.hidden = false;
  }

  function cargarJuegos() {
    fetch('games.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (datos) {
        juegos = (Array.isArray(datos) ? datos : []).filter(function (j) {
          return j && j.id && j.nombre;
        });
        if (!juegos.length) mostrarAviso('Todavía no hay juegos en el almanaque.');
        var datos = tomarAltura();
        var recien = recienHecho(datos);
        if (recien) recienHechos = [datos.id];
        pintarHojas();
        volverALaAltura(datos, recien);
      })
      .catch(function (err) {
        console.error('No se pudo cargar games.json', err);
        mostrarAviso('No se ha podido cargar la lista de juegos. Inténtalo de nuevo con conexión.');
      });
  }

  // Al volver a la portada (botón atrás, cambiar de app, pasar la medianoche)
  // se refrescan el tema (puede haberse cambiado en un juego), la fecha, la línea de
  // progreso, las hojas pendientes y los hechos con sus resultados.
  function refrescar() {
    aplicarTema(temaGuardado());
    pintarCabecera();
    pintarRacha();
    if (juegos.length) pintarHojas();
  }

  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    // Volviendo con «atrás», el navegador ya deja la página donde estaba; pero si el
    // juego se acaba de hacer, su hoja ha bajado a «Hechos hoy» y se vuelve arriba.
    var recien = recienHecho(tomarAltura());
    refrescar();
    if (recien) window.scrollTo(0, 0);
    latir();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') refrescar();
    latir();
  });

  /* --- Tema claro / oscuro ----------------------------------------------- */

  // La elección se guarda en almanaque:tema y la leen también todos los juegos
  // (comparten origen). Sin elección, modo luminoso.
  function temaGuardado() {
    return leer(CLAVE_TEMA) === 'dark' ? 'dark' : 'light';
  }

  function aplicarTema(tema) {
    document.documentElement.dataset.theme = tema;
    document.getElementById('color-tema').content = tema === 'dark' ? '#1c1813' : '#f3ead7';
  }

  document.getElementById('boton-tema').addEventListener('click', function () {
    var nuevo = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    aplicarTema(nuevo);
    guardar(CLAVE_TEMA, nuevo);
  });

  /* --- Portada fugaz ----------------------------------------------------- */

  // La animación es solo CSS; aquí se retira del DOM al acabar y un toque la salta.
  var portadaEl = document.getElementById('portada');
  if (portadaEl) {
    portadaEl.addEventListener('animationend', function (e) {
      if (e.target === portadaEl) portadaEl.remove();
    });
    portadaEl.addEventListener('click', function () {
      portadaEl.remove();
    });
  }

  /* --- Instalar la app --------------------------------------------------- */

  // Chrome, Edge, Samsung Internet y demás Chromium (Android y ordenador) avisan con
  // beforeinstallprompt y dejan abrir su cuadro de instalación desde el botón.
  // Safari y Firefox no lo permiten: el botón muestra los pasos a mano.
  var instalarEl = document.getElementById('instalar');
  var botonInstalar = document.getElementById('boton-instalar');
  var notaInstalar = document.getElementById('instalar-nota');
  var avisoInstalacion = null;

  function yaInstalada() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.navigator.standalone === true;
  }

  // Navegadores internos de las apps (Instagram, Facebook, TikTok…), que no instalan.
  // Basta con añadir aquí la marca que deja cada app en el userAgent.
  var NAVEGADORES_INTERNOS = ['Instagram', 'FBAN', 'FBAV', 'FB_IAB', 'musical_ly',
    'BytedanceWebview', 'Line/', 'Snapchat', 'LinkedInApp'];

  function esNavegadorInterno(ua) {
    return NAVEGADORES_INTERNOS.some(function (marca) { return ua.indexOf(marca) !== -1; });
  }

  // El iPad se presenta como un Mac, pero tiene pantalla táctil.
  function esIOS(ua) {
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }

  function pasosParaInstalar() {
    var ua = navigator.userAgent;
    var ios = esIOS(ua);
    var android = /Android/.test(ua);
    var firefox = /Firefox|FxiOS/.test(ua);
    var safariMac = /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua);

    if (esNavegadorInterno(ua)) {
      return 'Desde aquí no se puede instalar. Abre esta página en tu navegador (en el menú {puntos} de la app suele aparecer «Abrir en el navegador») y pulsa de nuevo «Instalar Almanaque».';
    }
    // En Safari del iPhone, «Compartir» está dentro del menú ···, y «Añadir a pantalla de inicio», en «Más».
    if (ios && !/CriOS|FxiOS|EdgiOS/.test(ua) && /iPhone|iPod/.test(ua)) {
      return 'Toca el menú {puntos}, luego Compartir {compartir}, después «Más» {puntos} y, por último, «Añadir a pantalla de inicio».';
    }
    // En Safari del iPad, «Compartir» suele estar en la barra.
    if (ios && !/CriOS|FxiOS|EdgiOS/.test(ua)) {
      return 'Toca Compartir {compartir} (en la barra o dentro del menú {puntos}) y luego «Añadir a pantalla de inicio».';
    }
    // En Chrome del iPhone, «Compartir» está en la barra de direcciones.
    if (ios && /CriOS/.test(ua)) {
      return 'Toca Compartir {compartir} en la barra de direcciones, luego «Más» {puntos} y, por último, «Añadir a pantalla de inicio».';
    }
    if (ios) {
      return 'Toca Compartir {compartir} (en Safari puede estar dentro del menú {puntos}) y luego «Añadir a pantalla de inicio».';
    }
    if (safariMac) {
      return 'En la barra de menús, abre «Archivo» y elige «Añadir al Dock».';
    }
    if (firefox && android) {
      return 'Abre el menú de Firefox (⋮) y elige «Añadir a la pantalla de inicio» o «Instalar».';
    }
    if (firefox) {
      return 'Firefox para ordenador no instala aplicaciones web. Abre esta página en Chrome, Edge o Safari y pulsa de nuevo «Instalar Almanaque».';
    }
    if (android) {
      return 'Abre el menú del navegador (⋮) y elige «Instalar aplicación» o «Añadir a pantalla de inicio».';
    }
    return 'Busca el icono de instalar a la derecha de la barra de direcciones, o abre el menú del navegador (⋮) y elige «Instalar Almanaque».';
  }

  // Dibujos de los botones que se nombran en los pasos, como {puntos} o {compartir}.
  var ICONOS = {
    puntos: {
      nombre: 'el botón de los tres puntos',
      dibujo: '<circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
        '<circle cx="7" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="17" cy="12" r="1.6"/>'
    },
    compartir: {
      nombre: 'el botón Compartir',
      caja: '5 0 14 24',
      dibujo: '<path d="M8.5 9H6.5v12h11V9h-2M12 2.5v12M8.5 6 12 2.5 15.5 6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
    }
  };

  // Escribe los pasos y cambia cada {nombre} por el dibujo de su botón.
  function pintarPasos(destino, texto) {
    destino.textContent = '';
    texto.split(/\{(\w+)\}/).forEach(function (trozo, i) {
      if (i % 2 === 0) {
        destino.appendChild(document.createTextNode(trozo));
        return;
      }
      var icono = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icono.setAttribute('class', 'instalar__icono');
      icono.setAttribute('viewBox', ICONOS[trozo].caja || '0 0 24 24');
      icono.setAttribute('role', 'img');
      icono.setAttribute('aria-label', ICONOS[trozo].nombre);
      icono.innerHTML = ICONOS[trozo].dibujo;
      destino.appendChild(icono);
    });
  }

  function mostrarNotaInstalar(abrir) {
    notaInstalar.hidden = !abrir;
    botonInstalar.setAttribute('aria-expanded', String(abrir));
  }

  function ocultarInstalar() {
    instalarEl.hidden = true;
    mostrarNotaInstalar(false);
  }

  if (!yaInstalada()) instalarEl.hidden = false;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    avisoInstalacion = e;
  });

  window.addEventListener('appinstalled', function () {
    avisoInstalacion = null;
    ocultarInstalar();
  });

  botonInstalar.addEventListener('click', function () {
    if (avisoInstalacion) {
      var aviso = avisoInstalacion;
      // El aviso solo sirve una vez; si se rechaza, el navegador manda otro más adelante.
      avisoInstalacion = null;
      aviso.prompt();
      aviso.userChoice.then(function (eleccion) {
        if (eleccion.outcome === 'accepted') ocultarInstalar();
      });
      return;
    }
    pintarPasos(document.getElementById('instalar-pasos'), pasosParaInstalar());
    // En iOS la app instalada guarda sus datos aparte de los del navegador.
    document.getElementById('instalar-ios').hidden = !esIOS(navigator.userAgent);
    mostrarNotaInstalar(notaInstalar.hidden);
  });

  /* --- Arranque ---------------------------------------------------------- */

  recogerHecho();
  pintarCabecera();
  pintarRacha();
  cargarJuegos();
  latir();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('No se pudo registrar el service worker', err);
      });
    });
  }
})();

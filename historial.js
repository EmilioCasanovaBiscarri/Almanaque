/* Almanaque — historial diario y cuentas del calendario de rachas.
   Solo cálculo, sin tocar la página ni el almacenamiento: lo usa app.js y lo prueban
   las pruebas de tests/ con Node. volver-almanaque.js lleva su propia copia de la fusión
   (vive en el repositorio de cada juego). */
(function (raiz, fabrica) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.AlmanaqueHistorial = fabrica();
})(this, function () {
  'use strict';

  // Días que se guardan como mucho en almanaque:historial.
  var LIMITE = 400;
  var CAMPOS = ['hechos', 'total', 'aciertos', 'posibles'];
  var FORMA_FECHA = /^\d{4}-\d{2}-\d{2}$/;

  /* --- Fechas de calendario --------------------------------------------- */

  function claveDeFecha(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // «2026-10-14» → fecha local a mediodía (así ningún cambio de hora la mueve de día).
  function fechaDeClave(clave) {
    var p = clave.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2], 12);
  }

  // El día siguiente, contado en el calendario y no en milisegundos.
  function diaSiguiente(clave) {
    var d = fechaDeClave(clave);
    return claveDeFecha(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12));
  }

  function diaAnterior(clave) {
    var d = fechaDeClave(clave);
    return claveDeFecha(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12));
  }

  function fechasValidas(dias) {
    return (Array.isArray(dias) ? dias : []).filter(function (d) {
      return typeof d === 'string' && FORMA_FECHA.test(d);
    });
  }

  /* --- Rachas ------------------------------------------------------------- */

  // Días seguidos hasta hoy. Si hoy aún no se ha jugado, la racha de ayer sigue viva.
  function racha(dias, hoy) {
    var lista = fechasValidas(dias);
    var jugadoHoy = lista.indexOf(hoy) !== -1;
    var d = jugadoHoy ? hoy : diaAnterior(hoy);
    var cuenta = 0;
    while (lista.indexOf(d) !== -1) {
      cuenta++;
      d = diaAnterior(d);
    }
    return { dias: cuenta, hoy: jugadoHoy };
  }

  // La tanda más larga de días seguidos, en cualquier momento.
  function mejorRacha(dias) {
    var unicos = fechasValidas(dias).slice().sort().filter(function (d, i, lista) {
      return i === 0 || lista[i - 1] !== d;
    });
    var mejor = 0;
    var actual = 0;
    for (var i = 0; i < unicos.length; i++) {
      actual = i > 0 && diaSiguiente(unicos[i - 1]) === unicos[i] ? actual + 1 : 1;
      if (actual > mejor) mejor = actual;
    }
    return mejor;
  }

  /* --- Historial ---------------------------------------------------------- */

  function cifra(n) {
    return typeof n === 'number' && isFinite(n) && n >= 0 ? Math.floor(n) : null;
  }

  // Une lo guardado de un día con lo que se ve ahora: de cada campo, el mayor valor
  // visto. Así un día nunca pierde cifras (por ejemplo, si se borran las hojas de hoy).
  function fusionarDia(guardado, nuevo) {
    var dia = {};
    CAMPOS.forEach(function (campo) {
      var a = guardado ? cifra(guardado[campo]) : null;
      var b = nuevo ? cifra(nuevo[campo]) : null;
      var valor = a === null ? b : b === null ? a : Math.max(a, b);
      if (valor !== null) dia[campo] = valor;
    });
    return dia;
  }

  // Copia limpia del historial (solo fechas válidas y campos conocidos).
  function limpiarHistorial(historial) {
    var limpio = {};
    if (!historial || typeof historial !== 'object' || Array.isArray(historial)) return limpio;
    Object.keys(historial).forEach(function (fecha) {
      if (!FORMA_FECHA.test(fecha) || !historial[fecha] || typeof historial[fecha] !== 'object') return;
      var dia = fusionarDia(historial[fecha], null);
      if (Object.keys(dia).length) limpio[fecha] = dia;
    });
    return limpio;
  }

  // Apunta un día en el historial y deja solo los últimos LIMITE días.
  function fusionarHistorial(historial, fecha, datos, limite) {
    var limpio = limpiarHistorial(historial);
    if (FORMA_FECHA.test(fecha)) limpio[fecha] = fusionarDia(limpio[fecha], datos);
    var fechas = Object.keys(limpio).sort();
    var sobran = fechas.length - (limite || LIMITE);
    for (var i = 0; i < sobran; i++) delete limpio[fechas[i]];
    return limpio;
  }

  /* --- El calendario ------------------------------------------------------ */

  function esCompleto(dia) {
    return !!dia && dia.total > 0 && dia.hechos >= dia.total;
  }

  // Cómo se pinta un día: 'sin-jugar', 'jugado-1', 'jugado-2', 'jugado-3' (poca, media o
  // mucha tinta según la parte del almanaque hecha) o 'completo'. Los días anteriores al
  // historial (solo en almanaque:dias) y los que no saben cuántos juegos había, con la
  // tinta media.
  function nivelDelDia(dia, jugado) {
    if (esCompleto(dia)) return 'completo';
    var conDetalle = !!dia && dia.hechos > 0;
    if (!conDetalle && !jugado) return 'sin-jugar';
    if (!conDetalle || !(dia.total > 0)) return 'jugado-2';
    var parte = dia.hechos / dia.total;
    if (parte <= 1 / 3) return 'jugado-1';
    if (parte <= 2 / 3) return 'jugado-2';
    return 'jugado-3';
  }

  // Días del mes completos, con el mes contado desde 0, como en Date.
  function completosDelMes(historial, anio, mes) {
    var prefijo = anio + '-' + String(mes + 1).padStart(2, '0') + '-';
    return Object.keys(historial || {}).filter(function (fecha) {
      return fecha.indexOf(prefijo) === 0 && esCompleto(historial[fecha]);
    }).length;
  }

  // Semanas del mes, de lunes a domingo: filas de 7 con la fecha de cada día o null.
  function semanasDelMes(anio, mes) {
    var hueco = (new Date(anio, mes, 1, 12).getDay() + 6) % 7;
    var largo = new Date(anio, mes + 1, 0, 12).getDate();
    var celdas = [];
    for (var i = 0; i < hueco; i++) celdas.push(null);
    for (var d = 1; d <= largo; d++) celdas.push(claveDeFecha(new Date(anio, mes, d, 12)));
    while (celdas.length % 7) celdas.push(null);
    var semanas = [];
    for (var s = 0; s < celdas.length; s += 7) semanas.push(celdas.slice(s, s + 7));
    return semanas;
  }

  /* --- Textos del calendario ---------------------------------------------- */

  function diasEnLetra(n) {
    return n + (n === 1 ? ' día' : ' días');
  }

  // Hasta la próxima medianoche local, con fechas de calendario: así los días de cambio
  // de hora duran lo que duran. La misma cuenta para la portada y el calendario.
  function textoCuentaAtras(ahora) {
    var medianoche = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
    var minutos = Math.max(1, Math.ceil((medianoche - ahora) / 60000));
    var horas = Math.floor(minutos / 60);
    var resto = minutos % 60;
    if (!horas) return 'Juegos nuevos en ' + resto + ' min';
    return 'Juegos nuevos en ' + horas + ' h' + (resto ? ' ' + resto + ' min' : '');
  }

  // La línea de hoy bajo la cuadrícula. estado: { hechos, total (0 si no se sabe),
  // jugado (si hoy ya cuenta para la racha), racha (días seguidos; sin jugar hoy, los
  // de ayer), ahora (Date, para la cuenta atrás) }. Devuelve { tipo, texto }, con tipo
  // 'aviso' (sin jugar y con racha que perder), 'sin-jugar', 'a-medias' o 'completo'.
  function lineaDeHoy(estado) {
    var hechos = cifra(estado.hechos) || 0;
    var total = cifra(estado.total) || 0;
    if (total > 0 && hechos >= total) {
      return { tipo: 'completo', texto: '¡Almanaque completo hoy! ' + textoCuentaAtras(estado.ahora) + '.' };
    }
    if (!hechos && !estado.jugado) {
      if (estado.racha > 0) {
        return {
          tipo: 'aviso',
          texto: 'Hoy aún no has jugado: juega antes de medianoche para no perder tu racha de ' +
            diasEnLetra(estado.racha) + '.'
        };
      }
      return { tipo: 'sin-jugar', texto: 'Hoy aún no has jugado. Cualquier juego empieza una racha nueva.' };
    }
    // Jugado, pero sin saber cuántos (un juego con la copia antigua del script) o cuántos había.
    if (!hechos) return { tipo: 'a-medias', texto: 'Hoy ya has jugado.' };
    if (!total) return { tipo: 'a-medias', texto: 'Hoy llevas ' + hechos + (hechos === 1 ? ' juego.' : ' juegos.') };
    var faltan = total - hechos;
    return {
      tipo: 'a-medias',
      texto: 'Hoy llevas ' + hechos + ' de ' + total + ' juegos. ' +
        (faltan === 1 ? 'Te falta 1' : 'Te faltan ' + faltan) + ' para el sello.'
    };
  }

  // Lo que se dice bajo la cifra de la racha, solo con 3 días o más: 'nueva' si hoy se ha
  // jugado y la racha pasa de la mejor contada sin hoy, 'igual' si es la mejor, 'manana'
  // si hoy ya se ha jugado y le falta un día para igualarla; si no, null.
  function mensajeRacha(dias, hoy) {
    var actual = racha(dias, hoy);
    if (actual.dias < 3) return null;
    var mejor = mejorRacha(dias);
    var sinHoy = mejorRacha(fechasValidas(dias).filter(function (d) { return d !== hoy; }));
    if (actual.hoy && actual.dias > sinHoy) return { tipo: 'nueva', texto: '¡nueva mejor racha!' };
    if (actual.dias >= mejor) return { tipo: 'igual', texto: 'tu mejor racha' };
    if (actual.hoy && mejor - actual.dias === 1) return { tipo: 'manana', texto: 'mañana igualas tu mejor racha' };
    return null;
  }

  return {
    LIMITE: LIMITE,
    diasEnLetra: diasEnLetra,
    textoCuentaAtras: textoCuentaAtras,
    lineaDeHoy: lineaDeHoy,
    mensajeRacha: mensajeRacha,
    claveDeFecha: claveDeFecha,
    fechaDeClave: fechaDeClave,
    diaSiguiente: diaSiguiente,
    diaAnterior: diaAnterior,
    racha: racha,
    mejorRacha: mejorRacha,
    fusionarDia: fusionarDia,
    limpiarHistorial: limpiarHistorial,
    fusionarHistorial: fusionarHistorial,
    esCompleto: esCompleto,
    nivelDelDia: nivelDelDia,
    completosDelMes: completosDelMes,
    semanasDelMes: semanasDelMes
  };
});

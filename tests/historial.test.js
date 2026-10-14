// Pruebas del historial y del calendario de rachas: node --test tests/
// Sin dependencias. Se fija la zona de Madrid para que los cambios de hora caigan
// en fechas conocidas (29 de marzo y 25 de octubre de 2026).
process.env.TZ = 'Europe/Madrid';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const H = require('../historial.js');

/* --- Mejor racha ------------------------------------------------------- */

test('mejor racha: vacía, un día y días sueltos', () => {
  assert.equal(H.mejorRacha([]), 0);
  assert.equal(H.mejorRacha(['2026-10-01']), 1);
  assert.equal(H.mejorRacha(['2026-10-01', '2026-10-03', '2026-10-05']), 1);
});

test('mejor racha: la tanda más larga, sin importar el orden ni los repetidos', () => {
  const dias = ['2026-10-09', '2026-10-01', '2026-10-02', '2026-10-02', '2026-10-03',
    '2026-10-07', '2026-10-08', '2026-10-10', '2026-10-11'];
  assert.equal(H.mejorRacha(dias), 5);
});

test('mejor racha: cruza el cambio de mes, también en febrero y en año bisiesto', () => {
  assert.equal(H.mejorRacha(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']), 4);
  assert.equal(H.mejorRacha(['2026-02-27', '2026-02-28', '2026-03-01']), 3);
  assert.equal(H.mejorRacha(['2028-02-28', '2028-02-29', '2028-03-01']), 3);
  // 2026 no es bisiesto: del 28 de febrero al 2 de marzo falta el 1.
  assert.equal(H.mejorRacha(['2026-02-28', '2026-03-02']), 1);
});

test('mejor racha: cruza el cambio de año', () => {
  assert.equal(H.mejorRacha(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']), 4);
});

test('mejor racha: cruza los cambios de hora (días de 23 y de 25 horas)', () => {
  assert.equal(H.mejorRacha(['2026-03-28', '2026-03-29', '2026-03-30']), 3);
  assert.equal(H.mejorRacha(['2026-10-24', '2026-10-25', '2026-10-26']), 3);
});

test('mejor racha: ignora valores que no son fechas', () => {
  assert.equal(H.mejorRacha(['2026-10-01', null, 7, 'ayer', '2026-10-02']), 2);
  assert.equal(H.mejorRacha(null), 0);
});

test('racha actual: viva desde ayer si hoy aún no se ha jugado', () => {
  const dias = ['2026-10-12', '2026-10-13'];
  assert.deepEqual(H.racha(dias, '2026-10-14'), { dias: 2, hoy: false });
  assert.deepEqual(H.racha(dias.concat('2026-10-14'), '2026-10-14'), { dias: 3, hoy: true });
  assert.deepEqual(H.racha(['2026-10-11'], '2026-10-14'), { dias: 0, hoy: false });
  assert.deepEqual(H.racha(['2026-10-24', '2026-10-25'], '2026-10-26'), { dias: 2, hoy: false });
});

/* --- Nivel de cada día --------------------------------------------------- */

test('nivel: sin jugar', () => {
  assert.equal(H.nivelDelDia(undefined, false), 'sin-jugar');
  assert.equal(H.nivelDelDia({ hechos: 0, total: 12 }, false), 'sin-jugar');
});

test('nivel: jugado con tres intensidades según la parte hecha', () => {
  assert.equal(H.nivelDelDia({ hechos: 1, total: 12 }, true), 'jugado-1');
  assert.equal(H.nivelDelDia({ hechos: 4, total: 12 }, true), 'jugado-1'); // un tercio justo
  assert.equal(H.nivelDelDia({ hechos: 5, total: 12 }, true), 'jugado-2');
  assert.equal(H.nivelDelDia({ hechos: 8, total: 12 }, true), 'jugado-2'); // dos tercios justos
  assert.equal(H.nivelDelDia({ hechos: 9, total: 12 }, true), 'jugado-3');
  assert.equal(H.nivelDelDia({ hechos: 11, total: 12 }, true), 'jugado-3');
});

test('nivel: completo con todos los juegos hechos', () => {
  assert.equal(H.nivelDelDia({ hechos: 12, total: 12 }, true), 'completo');
  assert.equal(H.nivelDelDia({ hechos: 13, total: 12 }, true), 'completo');
  // Aunque almanaque:dias no lo tenga, el historial manda.
  assert.equal(H.nivelDelDia({ hechos: 12, total: 12 }, false), 'completo');
});

test('nivel: días antiguos sin detalle y días sin total, con la tinta media', () => {
  assert.equal(H.nivelDelDia(undefined, true), 'jugado-2');
  assert.equal(H.nivelDelDia({ hechos: 3 }, true), 'jugado-2');
  assert.equal(H.nivelDelDia({ hechos: 3, total: 0 }, false), 'jugado-2');
});

test('completos del mes', () => {
  const historial = {
    '2026-09-30': { hechos: 12, total: 12 },
    '2026-10-01': { hechos: 12, total: 12 },
    '2026-10-02': { hechos: 11, total: 12 },
    '2026-10-03': { hechos: 12, total: 12 },
    '2026-10-04': { hechos: 5 }
  };
  assert.equal(H.completosDelMes(historial, 2026, 9), 2);
  assert.equal(H.completosDelMes(historial, 2026, 8), 1);
  assert.equal(H.completosDelMes(historial, 2026, 10), 0);
});

test('semanas del mes, de lunes a domingo', () => {
  const octubre = H.semanasDelMes(2026, 9); // empieza en jueves
  assert.deepEqual(octubre[0], [null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  assert.deepEqual(octubre[octubre.length - 1], ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null]);
  assert.equal(H.semanasDelMes(2027, 1).length, 4); // febrero de 2027 empieza en lunes
  assert.equal(H.semanasDelMes(2026, 2).length, 6); // marzo de 2026 empieza en domingo
});

/* --- La línea de hoy ----------------------------------------------------- */

// 20:48 del 14 de octubre de 2026: faltan 3 h 12 min para medianoche.
const AHORA = new Date(2026, 9, 14, 20, 48);

test('línea de hoy: sin jugar, con racha viva', () => {
  const linea = H.lineaDeHoy({ hechos: 0, total: 12, jugado: false, racha: 16, ahora: AHORA });
  assert.equal(linea.tipo, 'aviso');
  assert.equal(linea.texto, 'Hoy aún no has jugado: juega antes de medianoche para no perder tu racha de 16 días.');
  assert.equal(H.lineaDeHoy({ hechos: 0, total: 12, jugado: false, racha: 1, ahora: AHORA }).texto,
    'Hoy aún no has jugado: juega antes de medianoche para no perder tu racha de 1 día.');
});

test('línea de hoy: sin jugar y sin racha', () => {
  const linea = H.lineaDeHoy({ hechos: 0, total: 12, jugado: false, racha: 0, ahora: AHORA });
  assert.equal(linea.tipo, 'sin-jugar');
  assert.equal(linea.texto, 'Hoy aún no has jugado. Cualquier juego empieza una racha nueva.');
});

test('línea de hoy: a medias, con varios pendientes y con uno', () => {
  assert.equal(H.lineaDeHoy({ hechos: 5, total: 12, jugado: true, racha: 17, ahora: AHORA }).texto,
    'Hoy llevas 5 de 12 juegos. Te faltan 7 para el sello.');
  const linea = H.lineaDeHoy({ hechos: 11, total: 12, jugado: true, racha: 17, ahora: AHORA });
  assert.equal(linea.tipo, 'a-medias');
  assert.equal(linea.texto, 'Hoy llevas 11 de 12 juegos. Te falta 1 para el sello.');
});

test('línea de hoy: jugado sin saber cuántos juegos había', () => {
  assert.equal(H.lineaDeHoy({ hechos: 1, total: 0, jugado: true, racha: 3, ahora: AHORA }).texto, 'Hoy llevas 1 juego.');
  assert.equal(H.lineaDeHoy({ hechos: 0, total: 12, jugado: true, racha: 3, ahora: AHORA }).texto, 'Hoy ya has jugado.');
});

test('línea de hoy: completo, con la cuenta atrás de la portada', () => {
  const linea = H.lineaDeHoy({ hechos: 12, total: 12, jugado: true, racha: 17, ahora: AHORA });
  assert.equal(linea.tipo, 'completo');
  assert.equal(linea.texto, '¡Almanaque completo hoy! Juegos nuevos en 3 h 12 min.');
  assert.equal(H.lineaDeHoy({ hechos: 12, total: 12, jugado: true, racha: 1, ahora: new Date(2026, 9, 14, 23, 15) }).texto,
    '¡Almanaque completo hoy! Juegos nuevos en 45 min.');
});

test('cuenta atrás: en punto, y el día de 25 horas del cambio de hora', () => {
  assert.equal(H.textoCuentaAtras(new Date(2026, 9, 14, 21, 0)), 'Juegos nuevos en 3 h');
  // 25 de octubre de 2026 en Madrid: de 00:00 a 24:00 van 25 horas.
  assert.equal(H.textoCuentaAtras(new Date(2026, 9, 25, 0, 0)), 'Juegos nuevos en 25 h');
});

/* --- La mejor racha, celebrada ------------------------------------------- */

// Los n días que acaban en «hasta» (incluido).
function tanda(hasta, n) {
  const dias = [];
  let d = hasta;
  for (let i = 0; i < n; i++) {
    dias.unshift(d);
    d = H.diaAnterior(d);
  }
  return dias;
}

const HOY = '2026-10-14';

test('mejor racha celebrada: la racha actual es la mejor', () => {
  // Una tanda de 5 en septiembre y la de ahora, de 5 hasta ayer (hoy sin jugar).
  const dias = tanda('2026-09-10', 5).concat(tanda('2026-10-13', 5));
  assert.deepEqual(H.mensajeRacha(dias, HOY), { tipo: 'igual', texto: 'tu mejor racha' });
  // Con hoy jugado e igualando, sin pasarla: también «tu mejor racha».
  const igualada = tanda('2026-09-10', 6).concat(tanda(HOY, 6));
  assert.equal(H.mensajeRacha(igualada, HOY).tipo, 'igual');
});

test('mejor racha celebrada: hoy se supera la mejor anterior', () => {
  const dias = tanda('2026-09-10', 5).concat(tanda(HOY, 6));
  assert.deepEqual(H.mensajeRacha(dias, HOY), { tipo: 'nueva', texto: '¡nueva mejor racha!' });
  // La primera racha de 3: también es nueva.
  assert.equal(H.mensajeRacha(tanda(HOY, 3), HOY).tipo, 'nueva');
});

test('mejor racha celebrada: mañana se iguala', () => {
  const dias = tanda('2026-09-10', 8).concat(tanda(HOY, 7));
  assert.deepEqual(H.mensajeRacha(dias, HOY), { tipo: 'manana', texto: 'mañana igualas tu mejor racha' });
  // Si hoy aún no se ha jugado, no se promete nada para mañana.
  assert.equal(H.mensajeRacha(tanda('2026-09-10', 8).concat(tanda('2026-10-13', 7)), HOY), null);
  // A dos días de la mejor, tampoco.
  assert.equal(H.mensajeRacha(tanda('2026-09-10', 9).concat(tanda(HOY, 7)), HOY), null);
});

test('mejor racha celebrada: con racha de menos de 3 días, nada', () => {
  assert.equal(H.mensajeRacha([], HOY), null);
  assert.equal(H.mensajeRacha(tanda(HOY, 2), HOY), null);
  assert.equal(H.mensajeRacha(tanda('2026-09-10', 2).concat(tanda(HOY, 2)), HOY), null);
  assert.equal(H.mensajeRacha(tanda('2026-09-10', 3).concat(tanda(HOY, 2)), HOY), null);
});

/* --- Fusión del historial ------------------------------------------------ */

test('fusión: de cada campo se queda el mayor; nunca rebaja', () => {
  const guardado = { hechos: 9, total: 12, aciertos: 22, posibles: 27 };
  assert.deepEqual(H.fusionarDia(guardado, { hechos: 2, total: 12, aciertos: 5, posibles: 6 }), guardado);
  assert.deepEqual(H.fusionarDia(guardado, { hechos: 10, total: 12, aciertos: 24, posibles: 30 }),
    { hechos: 10, total: 12, aciertos: 24, posibles: 30 });
  assert.deepEqual(H.fusionarDia(guardado, { hechos: 0, aciertos: 0, posibles: 0 }), guardado);
});

test('fusión: un campo que falta no borra el guardado, y se completa al llegar', () => {
  assert.deepEqual(H.fusionarDia({ hechos: 3, total: 12 }, { hechos: 4 }), { hechos: 4, total: 12 });
  assert.deepEqual(H.fusionarDia({ hechos: 4 }, { hechos: 4, total: 12 }), { hechos: 4, total: 12 });
  assert.deepEqual(H.fusionarDia(undefined, { hechos: 1, total: 12 }), { hechos: 1, total: 12 });
});

test('fusión: descarta valores raros', () => {
  assert.deepEqual(H.fusionarDia({ hechos: 'mucho', total: -3 }, { hechos: 2.7, aciertos: NaN }), { hechos: 2 });
});

test('fusión del historial: apunta el día, limpia lo corrupto y guarda los últimos 400', () => {
  const h = H.fusionarHistorial({ 'basura': 1, '2026-10-13': { hechos: 5 }, '2026-10-12': 'x' },
    '2026-10-14', { hechos: 1, total: 12 });
  assert.deepEqual(h, { '2026-10-13': { hechos: 5 }, '2026-10-14': { hechos: 1, total: 12 } });
  assert.deepEqual(H.fusionarHistorial(null, '2026-10-14', { hechos: 1 }), { '2026-10-14': { hechos: 1 } });

  let largo = {};
  let fecha = '2025-01-01';
  for (let i = 0; i < 405; i++) {
    largo[fecha] = { hechos: 1 };
    fecha = H.diaSiguiente(fecha);
  }
  largo = H.fusionarHistorial(largo, fecha, { hechos: 2 });
  const fechas = Object.keys(largo).sort();
  assert.equal(fechas.length, H.LIMITE);
  assert.equal(fechas[fechas.length - 1], fecha);
  assert.ok(!('2025-01-01' in largo));
});

/* --- La copia de volver-almanaque.js -------------------------------------- */

// Un nodo de mentira que acepta cualquier cosa: la franja y el pie se «pintan» en él.
function nodoFalso() {
  const nodo = function () { return nodoFalso(); };
  return new Proxy(nodo, {
    get: (blanco, clave) => (clave in blanco ? blanco[clave] : nodoFalso()),
    set: () => true
  });
}

// Carga el script de los juegos con un navegador de mentira y devuelve su localStorage
// y almanaqueHecho.
function cargarVolver(almacen, fetchJuegos) {
  const datos = Object.assign({}, almacen);
  const localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(datos, k) ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v); },
    removeItem: (k) => { delete datos[k]; }
  };
  const nada = () => null;
  const document = {
    body: nodoFalso(),
    head: nodoFalso(),
    createElement: () => nodoFalso(),
    createTextNode: () => nodoFalso(),
    getElementById: nada,
    querySelectorAll: () => [],
    addEventListener: nada
  };
  const window = {
    location: { href: 'https://emiliocasanovabiscarri.github.io/Periplo/', hostname: 'emiliocasanovabiscarri.github.io', pathname: '/Periplo/' },
    history: { replaceState: nada, state: null },
    localStorage,
    sessionStorage: { getItem: nada, setItem: nada },
    fetch: fetchJuegos
  };
  const codigo = fs.readFileSync(path.join(__dirname, '..', 'para-los-juegos', 'volver-almanaque.js'), 'utf8');
  vm.runInNewContext(codigo, { window, document, URL, JSON, Math, Date, String, Object, Array });
  return { datos, window };
}

function hoy() {
  return H.claveDeFecha(new Date());
}

test('volver-almanaque.js: apunta el día sin games.json y no rebaja lo guardado', () => {
  const guardado = { [hoy()]: { hechos: 9, total: 12, aciertos: 22, posibles: 27 } };
  const { datos, window } = cargarVolver({
    'almanaque:historial': JSON.stringify(guardado),
    'almanaque:hechos': JSON.stringify({ fecha: hoy(), ids: [] })
  }, undefined);
  window.almanaqueHecho({ aciertos: 2, total: 3 });
  const historial = JSON.parse(datos['almanaque:historial']);
  assert.deepEqual(historial[hoy()], { hechos: 9, total: 12, aciertos: 22, posibles: 27 });
  assert.deepEqual(JSON.parse(datos['almanaque:dias']), [hoy()]);
});

test('volver-almanaque.js: cuenta hechos, aciertos y, al llegar games.json, el total', async () => {
  const juegos = [
    { id: 'calendas', nombre: 'Calendas', url: 'https://x/Calendas/' },
    { id: 'periplo', nombre: 'Periplo', url: 'https://x/Periplo/' },
    { id: 'mentidero', nombre: 'Mentidero', url: 'https://x/Mentidero/' },
    { id: 'gazapo', nombre: 'Gazapo', url: '', estado: 'próximamente' }
  ];
  let soltar;
  const llegada = new Promise((r) => { soltar = r; });
  const fetchJuegos = () => llegada.then(() => ({ ok: true, json: () => juegos }));
  const { datos, window } = cargarVolver({
    'almanaque:hechos': JSON.stringify({ fecha: hoy(), ids: ['calendas'] }),
    'almanaque:resultados': JSON.stringify({ fecha: hoy(), juegos: { calendas: { aciertos: 1, total: 3 } } })
  }, fetchJuegos);

  window.almanaqueHecho({ aciertos: 3, total: 3 });
  assert.deepEqual(JSON.parse(datos['almanaque:historial'])[hoy()], { hechos: 2, aciertos: 4, posibles: 6 });

  soltar();
  await llegada;
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(JSON.parse(datos['almanaque:historial'])[hoy()], { hechos: 2, total: 3, aciertos: 4, posibles: 6 });
});

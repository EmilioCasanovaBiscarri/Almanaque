/* Genera las capturas de "screenshots" en manifest.json, con las que Chrome muestra
   un diálogo de instalación más rico:
     icons/captura-movil.png       1080 × 1920 (narrow)
     icons/captura-escritorio.png  1920 × 1080 (wide)
   Uso, desde esta carpeta:
     npm install
     npm run capturas
   Sirve la portada en un servidor local propio, usa el Chrome instalado en el ordenador
   y necesita conexión para las tipografías. */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');
const sharp = require('sharp');

const RAIZ = path.join(__dirname, '..');
const MAX_BYTES = 400 * 1024;

// Tamaño en CSS × escala = tamaño de la captura.
const CAPTURAS = [
  { archivo: 'captura-movil.png', ancho: 360, alto: 640, escala: 3, movil: true },
  { archivo: 'captura-escritorio.png', ancho: 1280, alto: 720, escala: 1.5, movil: false }
];

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png'
};

function servir() {
  const servidor = http.createServer((pet, res) => {
    let ruta = decodeURIComponent(new URL(pet.url, 'http://x').pathname);
    if (ruta.endsWith('/')) ruta += 'index.html';
    const archivo = path.join(RAIZ, ruta);
    if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
    fs.createReadStream(archivo).pipe(res);
  });
  return new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(servidor)));
}

function fecha(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Una racha de cinco días y dos hojas hechas hoy, con su resultado.
function datosDeUso() {
  const dias = [];
  for (let i = 4; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dias.push(fecha(d));
  }
  const hoy = fecha(new Date());
  return {
    'almanaque:dias': JSON.stringify(dias),
    'almanaque:hechos': JSON.stringify({ fecha: hoy, ids: ['calendas', 'trampantojo'] }),
    'almanaque:resultados': JSON.stringify({
      fecha: hoy,
      juegos: {
        calendas: { aciertos: 9, total: 10, racha: 12 },
        trampantojo: { aciertos: 2, total: 3 }
      }
    })
  };
}

(async () => {
  const servidor = await servir();
  const url = `http://127.0.0.1:${servidor.address().port}/`;
  const navegador = await chromium.launch({ channel: 'chrome' });

  try {
    for (const c of CAPTURAS) {
      const contexto = await navegador.newContext({
        viewport: { width: c.ancho, height: c.alto },
        deviceScaleFactor: c.escala,
        isMobile: c.movil,
        hasTouch: c.movil,
        locale: 'es-ES',
        colorScheme: 'light',
        serviceWorkers: 'block'
      });
      await contexto.addInitScript((datos) => {
        sessionStorage.setItem('almanaque:portada', '1'); // sin la portada fugaz
        Object.keys(datos).forEach((k) => localStorage.setItem(k, datos[k]));
      }, datosDeUso());

      const pagina = await contexto.newPage();
      await pagina.goto(url, { waitUntil: 'networkidle' });
      await pagina.waitForSelector('.hoja');
      await pagina.evaluate(() => {
        document.getElementById('instalar').hidden = true;
        return document.fonts.ready;
      });
      await pagina.waitForTimeout(300);
      const png = await pagina.screenshot({ type: 'png' });
      await contexto.close();

      const comprimida = await sharp(png).png({ palette: true, quality: 80, effort: 10 }).toBuffer();
      const salida = path.join(RAIZ, 'icons', c.archivo);
      fs.writeFileSync(salida, comprimida);
      const tam = await sharp(comprimida).metadata();
      console.log(`icons/${c.archivo}: ${tam.width} × ${tam.height}, ${Math.round(comprimida.length / 1024)} KB`);
      if (comprimida.length > MAX_BYTES) {
        console.error(`  Pesa más de ${MAX_BYTES / 1024} KB.`);
        process.exitCode = 1;
      }
    }
  } finally {
    await navegador.close();
    servidor.close();
  }
})();

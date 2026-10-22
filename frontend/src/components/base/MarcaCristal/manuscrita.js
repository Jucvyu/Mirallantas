import { CatmullRomCurve3, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Letra manuscrita "de tubo": toma una fuente SVG de trazo único (EMS Allure,
 * con la línea central de cada letra en vez del contorno) y pasa un tubo
 * redondo por cada trazo. Las letras que se tocan se unen en un solo tubo.
 */

/** Lee la fuente SVG: unidades por em, avance por defecto y glifos { avance, d }. */
export function leerFuenteSVG(texto) {
  const doc = new DOMParser().parseFromString(texto, 'image/svg+xml');
  const fuente = doc.querySelector('font');
  const cara = doc.querySelector('font-face');
  const avanceBase = Number(fuente?.getAttribute('horiz-adv-x')) || 400;
  const glifos = new Map();
  doc.querySelectorAll('glyph').forEach((g) => {
    const unicode = g.getAttribute('unicode');
    if (!unicode) return;
    glifos.set(unicode, {
      avance: Number(g.getAttribute('horiz-adv-x')) || avanceBase,
      d: g.getAttribute('d') || '',
    });
  });
  return { em: Number(cara?.getAttribute('units-per-em')) || 1000, avanceBase, glifos };
}

/** Convierte un `d` con M, L y C absolutos en trazos (listas de [x, y]). */
function trazosDe(d, dx) {
  const partes = d.match(/[MLC]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const trazos = [];
  let actual = null;
  let comando = 'M';
  for (let i = 0; i < partes.length; ) {
    if (/[MLC]/i.test(partes[i])) comando = partes[i++].toUpperCase();
    if (comando === 'C') {
      const [x1, y1, x2, y2, x, y] = partes.slice(i, i + 6).map(Number);
      i += 6;
      const [x0, y0] = actual.at(-1);
      // Bézier cúbica muestreada en 6 tramos
      for (let k = 1; k <= 6; k++) {
        const t = k / 6;
        const u = 1 - t;
        actual.push([
          u * u * u * x0 + 3 * u * u * t * (x1 + dx) + 3 * u * t * t * (x2 + dx) + t * t * t * (x + dx),
          u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
        ]);
      }
    } else {
      const punto = [Number(partes[i]) + dx, Number(partes[i + 1])];
      i += 2;
      if (comando === 'M') {
        actual = [punto];
        trazos.push(actual);
        comando = 'L'; // los pares que siguen a un M son líneas
      } else {
        actual.push(punto);
      }
    }
  }
  return trazos.filter((t) => t.length > 0);
}

const cerca = (a, b, tolerancia) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerancia;

/** Une trazos consecutivos cuyos extremos se tocan (así una palabra ligada es un solo tubo). */
function unirTrazos(trazos, tolerancia) {
  const unidos = [];
  trazos.forEach((trazo) => {
    const previo = unidos.at(-1);
    if (previo && cerca(previo.at(-1), trazo[0], tolerancia)) previo.push(...trazo.slice(1));
    else if (previo && cerca(previo.at(-1), trazo.at(-1), tolerancia)) previo.push(...trazo.slice(0, -1).reverse());
    else unidos.push([...trazo]);
  });
  return unidos;
}

/**
 * Geometría de `texto` en tubos. Devuelve una sola BufferGeometry centrada
 * en el origen (1 unidad = 1 em) para usar un único material de vidrio.
 */
export function geometriaManuscrita(fuente, texto, { radio = 0.032, radial = 12, densidad = 90 } = {}) {
  const trazos = [];
  let x = 0;
  for (const letra of texto) {
    const glifo = fuente.glifos.get(letra);
    if (glifo?.d) trazos.push(...trazosDe(glifo.d, x));
    x += glifo?.avance ?? fuente.avanceBase;
  }

  const piezas = [];
  const tapa = new SphereGeometry(radio, radial, Math.max(6, radial / 2));
  unirTrazos(trazos, fuente.em * 0.006).forEach((trazo) => {
    const puntos = trazo.map(([px, py]) => new Vector3(px / fuente.em, py / fuente.em, 0));
    const largo = puntos.reduce((s, p, i) => (i ? s + p.distanceTo(puntos[i - 1]) : 0), 0);
    // Extremos redondeados (y puntos de la "i") con esferas del mismo radio
    piezas.push(tapa.clone().translate(puntos[0].x, puntos[0].y, 0));
    if (puntos.length < 2 || largo < radio) return;
    piezas.push(tapa.clone().translate(puntos.at(-1).x, puntos.at(-1).y, 0));
    const curva = new CatmullRomCurve3(puntos, false, 'centripetal');
    piezas.push(new TubeGeometry(curva, Math.max(8, Math.ceil(largo * densidad)), radio, radial, false));
  });
  tapa.dispose();

  const geometria = mergeGeometries(piezas);
  piezas.forEach((p) => p.dispose());
  geometria.center();
  geometria.computeBoundingBox();
  return geometria;
}

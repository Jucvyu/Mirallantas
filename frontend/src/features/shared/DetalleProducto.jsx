import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Download, FileText, PackageX } from 'lucide-react';
import AvisoError from '../../components/base/AvisoError';
import Skeleton from '../../components/base/Skeleton';
import TireThumb from '../../components/base/TireThumb';
import { abrirPdf } from '../../utils/imagenes';
import { COLUMNAS_MEDIDAS, datosFicha, descargarFichaTecnica, filaMedida, tituloDe } from '../../utils/fichaTecnicaPdf';

/** Las medidas sin posición cargada se agrupan aquí. */
const SIN_POSICION = 'Sin especificar';
const posicionDe = (r) => r.posicion || SIN_POSICION;

/** Orden fijo de las posiciones en el selector. */
const ORDEN_POSICION = ['Tracción', 'Direccional', 'Cualquier posición', SIN_POSICION];

/** Botón de opción (posición o medida), como los de color de una tienda. */
function Opcion({ activa, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={`rounded-lg border px-3.5 py-2 text-sm font-semibold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        activa
          ? 'border-amber-400 bg-amber-400 text-slate-900'
          : 'border-slate-200 text-slate-700 hover:border-amber-400 dark:border-white/15 dark:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

/** Pares etiqueta / valor en rejilla. */
function Datos({ filas, columnas = 'sm:grid-cols-3' }) {
  return (
    <dl className={`grid grid-cols-2 gap-x-6 gap-y-3 ${columnas}`}>
      {filas.map(([etiqueta, valor]) => (
        <div key={etiqueta} className="min-w-0">
          <dt className="text-xs text-slate-500 dark:text-slate-400">{etiqueta}</dt>
          <dd className="mt-0.5 break-words text-sm font-semibold text-slate-900 dark:text-white">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

const numero = (v, unidad) => (v === null || v === undefined || v === '' ? '—' : `${Number(v).toLocaleString('es-CO')} ${unidad}`);

/**
 * Página de detalle de un producto (modelo de llanta), como en una tienda:
 * la foto grande a la izquierda y, a la derecha, la posición y la medida
 * que se eligen (cada combinación es una referencia con su código) y el
 * botón para cotizarla. Abajo, la ficha técnica con todas las medidas, el
 * PDF del fabricante (si se subió) y la ficha en PDF armada con los datos.
 *
 * La llanta reencauchada usa la misma página: es una sola unidad con precio
 * fijo, así que no hay posición ni medida que elegir.
 *
 *   referencias  medidas a la venta del producto (forma plana de la API)
 *   volver       { a: '/catalogo', texto: 'Catálogo' } para la miga de pan
 *   accion(r)    pie de la compra para la medida elegida (carro, iniciar sesión…)
 */
export default function DetalleProducto({ referencias, cargando, error, volver, accion }) {
  const [posicion, setPosicion] = useState(null);
  const [elegidaId, setElegidaId] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [errorPdf, setErrorPdf] = useState('');

  const posiciones = useMemo(
    () =>
      [...new Set(referencias.map(posicionDe))].sort((a, b) => ORDEN_POSICION.indexOf(a) - ORDEN_POSICION.indexOf(b)),
    [referencias],
  );
  const posicionActual = posicion && posiciones.includes(posicion) ? posicion : posiciones[0];
  const deLaPosicion = referencias.filter((r) => posicionDe(r) === posicionActual);
  const elegida = deLaPosicion.find((r) => r.id === elegidaId) ?? deLaPosicion[0];
  const producto = referencias[0];
  // La llanta reencauchada: una unidad con precio fijo
  const unica = Boolean(producto?.reencauchada);
  // Sin posiciones cargadas no se muestra ese selector
  const sinPosiciones = posiciones.length === 1 && posiciones[0] === SIN_POSICION;

  if (cargando && !producto) {
    return (
      <div aria-hidden="true" className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (!producto) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <AvisoError mensaje={error} />
        <PackageX size={40} strokeWidth={1.5} className="mx-auto text-slate-400" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">Este producto no está disponible</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Puede que ya no se venda o que el enlace esté mal.</p>
        <Link to={volver.a} className="mt-6 inline-block text-sm font-bold text-amber-700 hover:underline dark:text-amber-400">
          Volver al {volver.texto.toLowerCase()}
        </Link>
      </div>
    );
  }

  const elegir = (r) => setElegidaId(r.id);
  const cambiarPosicion = (pos) => {
    setPosicion(pos);
    setElegidaId(null);
  };

  const descargar = async () => {
    setErrorPdf('');
    setGenerando(true);
    try {
      await descargarFichaTecnica(producto, referencias);
    } catch {
      setErrorPdf('No se pudo generar la ficha. Intenta de nuevo.');
    } finally {
      setGenerando(false);
    }
  };

  const ficha = datosFicha(producto);
  // Columnas de la tabla con algún dato (la medida y el código siempre van):
  // así una llanta de moto no muestra "Lonas" vacía
  const filasTabla = referencias.map(filaMedida);
  const columnasVisibles = COLUMNAS_MEDIDAS.map((_, i) => i).filter(
    (i) => i === 0 || i === COLUMNAS_MEDIDAS.length - 1 || filasTabla.some((fila) => fila[i] !== '—'),
  );

  return (
    <div>
      {/* Miga de pan */}
      <nav aria-label="Ruta" className="mb-6 flex flex-wrap items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
        <Link to={volver.a} className="hover:text-amber-700 dark:hover:text-amber-400">
          {volver.texto}
        </Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span className="font-semibold text-slate-800 dark:text-slate-200">{tituloDe(producto)}</span>
      </nav>

      <AvisoError mensaje={error} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
        {/* Foto grande */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
            <TireThumb
              brand={producto.marca}
              foto={producto.foto}
              badge={producto.categoria}
              badgeColor={producto.colorCategoria ?? undefined}
              className="aspect-square w-full"
            />
          </div>
        </div>

        {/* Elección y compra */}
        <div>
          <p className="text-sm font-bold tracking-wide text-amber-700 dark:text-amber-400">
            {unica ? 'LLANTA REENCAUCHADA' : producto.marca.toUpperCase()}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold leading-tight text-slate-900 dark:text-white sm:text-4xl">
            {unica ? producto.descripcion || producto.nombre : producto.nombre}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {unica ? 'Única unidad, revisada y lista para rodar' : producto.categoria}
            {producto.tipoVehiculo && producto.tipoVehiculo !== producto.categoria ? ` · ${producto.tipoVehiculo}` : ''}
          </p>
          {/* Precio fijo de la reencauchada (las demás se cotizan) */}
          {unica && elegida.precioVentaValor > 0 && (
            <p className="mt-5 text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white">
              $ {Number(elegida.precioVentaValor).toLocaleString('es-CO')}
              <span className="ml-2 align-middle text-sm font-semibold text-slate-500 dark:text-slate-400">precio fijo</span>
            </p>
          )}
          {producto.descripcion && !unica && (
            <p className="mt-4 max-w-prose text-base leading-relaxed text-slate-600 dark:text-slate-300">{producto.descripcion}</p>
          )}

          <div className="mt-7 space-y-6 border-t border-slate-200 pt-6 dark:border-white/10">
            {!sinPosiciones && (
            <fieldset>
              <legend className="text-sm font-bold text-slate-900 dark:text-white">
                Posición {posiciones.length === 1 && <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">· {posicionActual}</span>}
              </legend>
              {posiciones.length > 1 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {posiciones.map((pos) => (
                    <Opcion key={pos} activa={pos === posicionActual} onClick={() => cambiarPosicion(pos)}>
                      {pos}
                    </Opcion>
                  ))}
                </div>
              )}
            </fieldset>
            )}

            <fieldset>
              <legend className="text-sm font-bold text-slate-900 dark:text-white">
                Medida <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">· {elegida.medidas}</span>
              </legend>
              {deLaPosicion.length > 1 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {deLaPosicion.map((r) => (
                  <Opcion key={r.id} activa={r.id === elegida.id} onClick={() => elegir(r)}>
                    {r.medidas}
                    {r.indiceCarga && deLaPosicion.filter((x) => x.medidas === r.medidas).length > 1 ? ` · ${r.indiceCarga}` : ''}
                  </Opcion>
                ))}
              </div>
              )}
            </fieldset>

            <div className="rounded-xl bg-slate-50 p-4 dark:bg-white/[0.04]">
              <Datos
                filas={unica ? [
                  ['Código', elegida.codigo],
                  ['Medida', elegida.medidas],
                  ['Rin', elegida.rin ? `${Number(elegida.rin).toLocaleString('es-CO')}"` : '—'],
                  ['Tipo de vehículo', elegida.tipoVehiculo || 'Uso general'],
                ] : [
                  ['Código', elegida.codigo],
                  ['Índice de carga', elegida.indiceCarga || '—'],
                  ['Lonas', elegida.lonas ? `${elegida.lonas} PR` : '—'],
                  ['Labrado', numero(elegida.profundidadLabrado, 'mm')],
                  ['Peso', numero(elegida.pesoKg, 'kg')],
                  ['Rin', elegida.rin ? `${Number(elegida.rin).toLocaleString('es-CO')}"` : '—'],
                ]}
              />
            </div>

            <div>{accion(elegida)}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {unica ? 'Es una sola unidad: queda apartada para quien la pida primero.' : 'El precio se confirma en la cotización.'}
            </p>
          </div>
        </div>
      </div>

      {/* Ficha técnica */}
      <section aria-labelledby="ficha-titulo" className="mt-14 border-t border-slate-200 pt-10 dark:border-white/10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="ficha-titulo" className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Ficha técnica
          </h2>
          <div className="flex flex-wrap gap-2">
            {producto.fichaPdf && (
              <button
                type="button"
                onClick={() => abrirPdf(producto.fichaPdf)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-amber-400 dark:border-white/15 dark:text-slate-200"
              >
                <FileText size={15} aria-hidden="true" /> Ficha del fabricante (PDF)
              </button>
            )}
            <button
              type="button"
              onClick={descargar}
              disabled={generando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-60"
            >
              <Download size={15} aria-hidden="true" /> {generando ? 'Generando…' : 'Descargar ficha en PDF'}
            </button>
          </div>
        </div>
        <AvisoError mensaje={errorPdf} className="mt-4" />

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Características</h3>
            <Datos filas={ficha} columnas="sm:grid-cols-2" />
          </div>
          <div className="min-w-0">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Medidas disponibles</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
                  <tr>
                    {columnasVisibles.map((i) => (
                      <th key={COLUMNAS_MEDIDAS[i]} scope="col" className="px-3 py-2.5 font-semibold">
                        {COLUMNAS_MEDIDAS[i]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                  {referencias.map((r, fila) => {
                    const actual = r.id === elegida.id;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => {
                          setPosicion(posicionDe(r));
                          elegir(r);
                        }}
                        aria-selected={actual}
                        className={`cursor-pointer tabular-nums transition-colors ${
                          actual ? 'bg-amber-400/15' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                        }`}
                      >
                        {columnasVisibles.map((i) => (
                          <td key={COLUMNAS_MEDIDAS[i]} className={`px-3 py-2.5 ${i === 0 ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                            {filasTabla[fila][i]}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { ArrowUpRight, Boxes, Cloud, Code2, Scale } from 'lucide-react';
import { CASOS, GRUPOS, INTERNAS, LICENCIAS, SERVICIOS, TECNOLOGIAS } from './licencias';

/** '#A31F34' → 'rgba(163, 31, 52, a)': fondos y bordes tenues con el color de cada licencia. */
function tinte(hex, alfa) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

/** Marcas negras (Express, Vercel…): en modo oscuro se pintan blancas para que se vean. */
const esOscuro = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const luz = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return luz < 40;
};

/** Icono de marca dentro de un cuadro con su color. */
function Logo({ icono: Icono, color, tamano = 'h-11 w-11', iconoTamano = 22 }) {
  const oscuro = esOscuro(color);
  return (
    <span
      className={`flex ${tamano} shrink-0 items-center justify-center rounded-xl ${oscuro ? 'bg-slate-900/[0.07] text-slate-900 dark:bg-white/10 dark:text-white' : ''}`}
      style={oscuro ? undefined : { backgroundColor: tinte(color, 0.15), color }}
      aria-hidden="true"
    >
      {/* En modo oscuro se aclara el color para que se distinga sobre el fondo */}
      <Icono size={iconoTamano} className="dark:brightness-150" />
    </span>
  );
}

/** Etiqueta de una licencia con su color. */
function ChipLicencia({ clave }) {
  const l = LICENCIAS[clave];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold dark:brightness-150"
      style={{ backgroundColor: tinte(l.color, 0.14), color: l.color }}
    >
      <l.icono size={11} aria-hidden="true" />
      {l.corto}
    </span>
  );
}

/** Enlace externo pequeño, abre en otra pestaña. */
function Enlace({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-500 underline-offset-2 hover:text-amber-600 hover:underline dark:text-slate-400 dark:hover:text-amber-400"
    >
      {children}
      <ArrowUpRight size={11} aria-hidden="true" />
    </a>
  );
}

function TituloSeccion({ icono: Icono, titulo, children }) {
  return (
    <div className="mb-4 mt-12 first:mt-0">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
        <Icono size={18} className="text-amber-500" aria-hidden="true" /> {titulo}
      </h2>
      {children && <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{children}</p>}
    </div>
  );
}

/**
 * Licencias del software de MiraLlantas: qué licencia tiene cada tecnología,
 * qué permite y los enlaces originales (sitio, repositorio, npm y el texto
 * oficial de la licencia). Lo usan la página pública /licencias y la del
 * panel /admin/licencias.
 */
export default function LicenciasContenido() {
  // Filtro por licencia: al pulsar una tarjeta solo se ven sus tecnologías
  const [filtro, setFiltro] = useState(null);
  const conteo = useMemo(
    () => Object.fromEntries(Object.keys(LICENCIAS).map((k) => [k, TECNOLOGIAS.filter((t) => t.licencia === k).length])),
    [],
  );
  const visibles = filtro ? TECNOLOGIAS.filter((t) => t.licencia === filtro) : TECNOLOGIAS;
  const paquetes = INTERNAS.reduce((s, i) => s + i.total, 0);

  return (
    <div>
      {/* ---- Encabezado ---- */}
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">Software libre</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Licencias</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          MiraLlantas está construido con tecnologías de código abierto. Todas tienen licencias libres que permiten su uso
          académico y comercial; aquí está cada una, con lo que permite y los enlaces a su fuente original.
        </p>
      </div>
      <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
        {[
          [TECNOLOGIAS.length, 'tecnologías directas'],
          [Object.keys(LICENCIAS).length, 'licencias distintas'],
          [paquetes, 'paquetes instalados en total'],
        ].map(([n, etiqueta]) => (
          <div key={etiqueta}>
            <dt className="sr-only">{etiqueta}</dt>
            <dd className="text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">{n}</dd>
            <p className="text-xs text-slate-500 dark:text-slate-400">{etiqueta}</p>
          </div>
        ))}
      </dl>

      {/* ---- Las licencias ---- */}
      <TituloSeccion icono={Scale} titulo="Las licencias">
        Pulsa una para ver solo las tecnologías que la usan.
      </TituloSeccion>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(LICENCIAS).map(([clave, l]) => {
          const activa = filtro === clave;
          return (
            <article
              key={clave}
              className="relative flex flex-col overflow-hidden rounded-2xl border bg-white p-5 transition-shadow dark:bg-brand-navy-800"
              style={{ borderColor: activa ? l.color : tinte(l.color, 0.28), boxShadow: activa ? `0 0 0 1px ${l.color}` : undefined }}
            >
              {/* Franja con el color de la licencia */}
              <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: l.color }} aria-hidden="true" />
              <button
                type="button"
                onClick={() => setFiltro(activa ? null : clave)}
                aria-pressed={activa}
                // Sin tecnologías directas no hay nada que filtrar
                disabled={!conteo[clave]}
                className="flex items-start gap-3 text-left disabled:cursor-default"
              >
                <Logo icono={l.icono} color={l.color} />
                <span className="min-w-0">
                  <span className="block font-bold text-slate-900 dark:text-white">{l.nombre}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {conteo[clave]
                      ? `${conteo[clave]} ${conteo[clave] === 1 ? 'tecnología' : 'tecnologías'}`
                      : 'Solo en dependencias internas'}
                    {activa ? ' · filtrando' : ''}
                  </span>
                </span>
              </button>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{l.resumen}</p>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold dark:brightness-150" style={{ color: l.color }}>
                  Condición:
                </span>{' '}
                {l.condicion}
              </p>
              <div className="mt-auto flex gap-4 pt-4">
                <Enlace href={l.texto}>Texto oficial</Enlace>
                <Enlace href={l.spdx}>Ficha SPDX</Enlace>
              </div>
            </article>
          );
        })}
      </div>

      {/* ---- Tecnologías ---- */}
      <TituloSeccion icono={Code2} titulo="Tecnologías del proyecto">
        Versiones instaladas en el proyecto. Las de "Desarrollo" solo se usan para construir la aplicación y no llegan
        al navegador del usuario.
      </TituloSeccion>
      {filtro && (
        <button
          type="button"
          onClick={() => setFiltro(null)}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
        >
          Mostrando solo <ChipLicencia clave={filtro} /> · ver todas
        </button>
      )}
      <div className="space-y-8">
        {GRUPOS.map((grupo) => {
          const del = visibles.filter((t) => t.grupo === grupo);
          if (del.length === 0) return null;
          return (
            <section key={grupo}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{grupo}</h3>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-white/5 dark:border-white/10 dark:bg-brand-navy-800">
                {del.map((t) => (
                  <li key={t.nombre} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:flex-nowrap">
                    <Logo icono={t.icono} color={t.color} tamano="h-10 w-10" iconoTamano={20} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">{t.nombre}</span>
                        <span className="font-mono text-[11px] text-slate-400">{t.version}</span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t.uso}</p>
                    </div>
                    <ChipLicencia clave={t.licencia} />
                    <div className="flex shrink-0 gap-3">
                      <Enlace href={t.sitio}>Sitio</Enlace>
                      <Enlace href={t.repo}>Código</Enlace>
                      {t.npm && <Enlace href={t.npm}>npm</Enlace>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {/* ---- Dependencias internas ---- */}
      <TituloSeccion icono={Boxes} titulo="Lo que se instala por debajo">
        Cada librería trae sus propias dependencias. Casi todas usan MIT, ISC, BSD o Apache; estos son los casos que
        conviene conocer.
      </TituloSeccion>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ul className="space-y-2">
          {INTERNAS.map((i) => (
            <li key={i.carpeta} className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-brand-navy-800">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {i.carpeta} <span className="font-normal text-slate-400">· {i.total} paquetes</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{i.detalle}</p>
            </li>
          ))}
        </ul>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-white/5 dark:border-white/10 dark:bg-brand-navy-800">
          {CASOS.map((c) => (
            <li key={c.nombre} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
              <span className="text-sm">
                <a
                  href={c.enlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono font-semibold text-slate-800 hover:text-amber-600 dark:text-slate-100 dark:hover:text-amber-400"
                >
                  {c.nombre}
                </a>{' '}
                <span className="text-xs text-slate-500 dark:text-slate-400">· {c.nota}</span>
              </span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{c.licencia}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ---- Servicios ---- */}
      <TituloSeccion icono={Cloud} titulo="Servicios externos">
        No son software con licencia: se usan bajo los términos de servicio de cada proveedor.
      </TituloSeccion>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SERVICIOS.map((s) => (
          <div key={s.nombre} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-brand-navy-800">
            <Logo icono={s.icono} color={s.color} tamano="h-9 w-9" iconoTamano={18} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{s.nombre}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                {s.uso} <Enlace href={s.terminos}>Términos</Enlace>
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
        Los nombres y logotipos de cada tecnología pertenecen a sus respectivos dueños y se muestran solo como
        referencia. El código de MiraLlantas (proyecto ADSO SENA) no declara una licencia propia.
      </p>
    </div>
  );
}

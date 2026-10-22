import { FileText, LayoutDashboard, Package, Wrench } from 'lucide-react';
import LiquidGlass from '../LiquidGlass';

/**
 * Puntos clave del proyecto. Salen del README y de los módulos que ya
 * existen en la app (catálogo, reencauche, cotizaciones/cartera, panel).
 */
const PUNTOS = [
  {
    icon: Package,
    title: 'Llantas y productos',
    text: 'Catálogo de llantas y productos con su información comercial, consultable por el equipo y por los clientes.',
  },
  {
    icon: Wrench,
    title: 'Servicio de reencauche',
    text: 'Solicitud y seguimiento de los reencauches de cada cliente dentro del mismo sistema.',
  },
  {
    icon: FileText,
    title: 'Cotizaciones y cartera',
    text: 'Cotizaciones, ventas, compras, créditos y abonos conectados entre sí.',
  },
  {
    icon: LayoutDashboard,
    title: 'Panel administrativo',
    text: 'Dashboard con indicadores, gestión de contactos y control de usuarios por roles y permisos.',
  },
];

const RESUMEN =
  'Mirallantas es una comercializadora de llantas que además ofrece el servicio de reencauche. ' +
  'Esta aplicación reúne en un solo lugar la operación del negocio: un panel administrativo para el ' +
  'equipo y un portal para que los clientes consulten el catálogo, sus cotizaciones y su cartera.';

/**
 * Sección "Sobre el proyecto".
 *
 * Se usa en la landing pública y en el inicio del panel admin.
 * - Landing: texto a la izquierda y los puntos clave en tarjetas de vidrio pastel.
 * - `compacto` (admin): una tarjeta de vidrio industrial como las del
 *   dashboard, con los puntos en una sola fila y sin descripciones.
 * - `id`, `resumen` y `puntos` permiten a la landing usar su propio texto
 *   comercial; sin ellos se ven los del panel.
 */
export default function SobreProyecto({ compacto = false, id = 'sobre-el-proyecto', resumen = RESUMEN, puntos = PUNTOS }) {
  if (compacto) {
    return (
      <LiquidGlass
        as="section"
        variante="industrial"
        inclinacion={3}
        aria-labelledby="sobre-proyecto-titulo"
        className="h-full p-5"
      >
        <h3 id="sobre-proyecto-titulo" className="text-sm font-bold text-slate-900 dark:text-white">
          Sobre Mirallantas
        </h3>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">{resumen}</p>
        <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {puntos.map(({ icon: Icon, title }) => (
            <li key={title} className="flex items-center gap-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Icon size={16} strokeWidth={2.25} className="shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              {title}
            </li>
          ))}
        </ul>
      </LiquidGlass>
    );
  }

  // El border-t es el mismo separador que usan Features y Modules en la landing (taste-skill-ignore)
  return (
    <section
      id={id}
      aria-labelledby="sobre-proyecto-titulo"
      className="scroll-mt-24 border-t border-white/70 py-20 dark:border-white/10"
    >
      <div className="mx-auto grid max-w-6xl gap-12 px-6 sm:px-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <h2 id="sobre-proyecto-titulo" className="text-3xl font-extrabold text-brand-blue dark:text-white sm:text-4xl">
            Sobre Mirallantas
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-700 dark:text-slate-300 sm:text-lg">{resumen}</p>
          {/* TODO: completar — historia de la empresa, ubicación, años de experiencia, etc. */}
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {puntos.map(({ icon: Icon, title, text }, i) => (
            <LiquidGlass key={title} as="li" variante="pastel" inclinacion={4} indice={i} className="p-5">
              <p className="flex items-center gap-2.5 text-base font-bold text-brand-blue dark:text-white">
                <span data-capa className="inline-flex">
                  <Icon size={18} strokeWidth={2.25} className="shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                </span>
                {title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{text}</p>
            </LiquidGlass>
          ))}
        </ul>
      </div>
    </section>
  );
}

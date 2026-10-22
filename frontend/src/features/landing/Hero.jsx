import { useState } from 'react';
import { CircleDot, Headset, RefreshCw, Truck } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { enlaceWhatsapp } from './contenido';
import IlustracionCamion from './IlustracionCamion';

/**
 * Fotografía del hero. Si existe /public/landing/hero-camion.jpg se usa esa
 * foto; si no (o si falla al cargar), queda la ilustración en SVG.
 */
const FOTO_HERO = '/landing/hero-camion.jpg';

const BENEFICIOS = [
  { icon: CircleDot, titulo: 'Llantas nuevas', texto: 'Para cada tipo de vehículo' },
  { icon: RefreshCw, titulo: 'Reencauche industrial', texto: 'Más vida útil para tu llanta' },
  { icon: Headset, titulo: 'Asesoría especializada', texto: 'Te ayudamos a elegir' },
  { icon: Truck, titulo: 'Entregas seguras', texto: 'Seguimiento de cada pedido' },
];

/**
 * Portada del landing: camión, overlay y barra de beneficios.
 * Modo oscuro: atardecer con overlay azul marino y texto blanco.
 * Modo claro: escena de día con overlay claro y texto azul marino.
 */
export default function Hero() {
  const { theme } = useTheme();
  const claro = theme !== 'dark';
  const [fotoLista, setFotoLista] = useState(false);
  const [sinFoto, setSinFoto] = useState(false);

  return (
    <section
      id="inicio"
      aria-labelledby="hero-titulo"
      className="relative -mt-[76px] scroll-mt-24 overflow-hidden bg-[#E6F1FD] pt-[76px] dark:bg-[#0B1B33]"
    >
      {/* Fondo: ilustración y, encima, la foto si existe */}
      <div className="absolute inset-0" aria-hidden="true">
        <IlustracionCamion claro={claro} className="h-full w-full" />
        {!sinFoto && (
          <img
            src={FOTO_HERO}
            alt=""
            onLoad={() => setFotoLista(true)}
            onError={() => setSinFoto(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${fotoLista ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {/* Overlay: denso a la izquierda (texto) y suave a la derecha (camión) */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#EEF6FF] via-[#EEF6FF]/80 to-[#EEF6FF]/0 dark:from-[#0B1B33] dark:via-[#0B1B33]/80 dark:to-[#0B1B33]/10" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#EEF6FF] to-transparent dark:from-[#0B1B33]" />
      </div>

      <div className="relative mx-auto flex min-h-[640px] max-w-7xl flex-col justify-between px-6 pb-8 pt-16 sm:px-10 lg:min-h-[720px] lg:pt-24">
        <div className="max-w-xl">
          <p className="ml-aparece inline-flex items-center gap-2 rounded-full border border-amber-500/50 bg-white/60 px-4 py-1.5 text-xs font-bold tracking-[0.16em] text-amber-800 backdrop-blur dark:border-amber-400/40 dark:bg-white/5 dark:text-amber-300">
            LLANTAS NUEVAS <span aria-hidden="true">•</span> REENCAUCHE INDUSTRIAL
          </p>
          <h1
            id="hero-titulo"
            className="ml-aparece mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-brand-blue dark:text-white sm:text-5xl lg:text-6xl"
            style={{ animationDelay: '60ms' }}
          >
            La fuerza que mueve{' '}
            <span className="rounded-lg bg-amber-400 px-2 text-slate-900 [box-decoration-break:clone] dark:bg-transparent dark:px-0 dark:text-amber-400">
              tu negocio
            </span>
          </h1>
          <p
            className="ml-aparece mt-5 max-w-lg text-base leading-relaxed text-slate-700 dark:text-slate-200 sm:text-lg"
            style={{ animationDelay: '120ms' }}
          >
            En Mirallantas comercializamos llantas y ofrecemos el servicio de reencauche industrial en Medellín y el
            Valle de Aburrá, con el respaldo que tu operación necesita.
          </p>
          <div className="ml-aparece mt-8 flex flex-wrap gap-3" style={{ animationDelay: '180ms' }}>
            <a
              href="#productos"
              className="ml-pulsable inline-flex items-center rounded-full bg-amber-400 px-7 py-3 text-sm font-bold text-slate-900 hover:bg-amber-300"
            >
              Ver catálogo
            </a>
            <a
              href={enlaceWhatsapp()}
              target="_blank"
              rel="noreferrer"
              className="ml-pulsable inline-flex items-center rounded-full border border-brand-blue/30 bg-white/60 px-7 py-3 text-sm font-bold text-brand-blue backdrop-blur hover:border-brand-blue/60 hover:bg-white/80 dark:border-white/40 dark:bg-white/5 dark:text-white dark:hover:border-white/70 dark:hover:bg-white/10"
            >
              Solicitar cotización
            </a>
          </div>
        </div>

        {/* Barra de beneficios */}
        <ul className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/80 bg-white/40 shadow-[0_8px_32px_rgba(40,100,180,0.15)] backdrop-blur-xl dark:border-white/15 dark:bg-white/10 dark:shadow-[0_8px_32px_rgba(0,0,0,0.25)] lg:grid-cols-4">
          {BENEFICIOS.map(({ icon: Icon, titulo, texto }) => (
            <li key={titulo} className="flex items-center gap-3 bg-white/55 px-4 py-4 dark:bg-[#0B1B33]/40 sm:px-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-blue/15 bg-white/80 text-amber-700 dark:border-white/20 dark:bg-white/10 dark:text-amber-400">
                <Icon size={20} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-brand-blue dark:text-white">{titulo}</span>
                <span className="block text-xs text-slate-600 dark:text-slate-300">{texto}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

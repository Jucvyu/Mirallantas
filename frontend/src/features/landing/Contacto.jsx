import { Mail, MapPin, Phone } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import LiquidGlass from '../../components/base/LiquidGlass';
import { CORREO_EMPRESA, DIRECCION_EMPRESA, TELEFONO_EMPRESA } from '../../config';
import { enlaceWhatsapp } from './contenido';
import Revelar from './Revelar';

const MEDIOS = [
  { icon: Phone, titulo: 'Teléfono', valor: TELEFONO_EMPRESA, href: `tel:${TELEFONO_EMPRESA.replace(/\s/g, '')}` },
  { icon: Mail, titulo: 'Correo', valor: CORREO_EMPRESA, href: `mailto:${CORREO_EMPRESA}` },
  { icon: MapPin, titulo: 'Dirección', valor: DIRECCION_EMPRESA },
];

/**
 * #contacto · WhatsApp y los datos de contacto de la empresa.
 * Claro: vidrio pastel sobre el fondo de la página. Oscuro: franja azul marino.
 * Los datos van en filas (icono · etiqueta · valor) para que el correo quepa entero.
 */
export default function Contacto() {
  return (
    <section
      id="contacto"
      aria-labelledby="contacto-titulo"
      className="scroll-mt-24 border-t border-white/70 py-20 dark:border-white/10 dark:bg-[#0B1B33]"
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-6 sm:px-10 lg:grid-cols-2 lg:items-center">
        <Revelar>
          <h2 id="contacto-titulo" className="text-3xl font-extrabold text-brand-blue dark:text-white sm:text-4xl">
            Hablemos de tus <span className="text-amber-600 dark:text-amber-400">llantas</span>
          </h2>
          <p className="mt-3 max-w-md text-base text-slate-600 dark:text-slate-300">
            Escríbenos por WhatsApp con la medida o el servicio que necesitas y te respondemos con tu cotización.
          </p>
          <a
            href={enlaceWhatsapp()}
            target="_blank"
            rel="noreferrer"
            className="ml-pulsable mt-7 inline-flex items-center gap-2 rounded-full bg-amber-400 px-7 py-3 text-sm font-bold text-slate-900 hover:bg-amber-300"
          >
            <FaWhatsapp size={18} aria-hidden="true" /> Solicitar cotización
          </a>
        </Revelar>

        <Revelar retraso={80}>
          <LiquidGlass as="ul" variante="pastel" inclinacion={3} className="divide-y divide-brand-blue/10 p-2 dark:divide-white/10">
            {MEDIOS.map(({ icon: Icon, titulo, valor, href }) => (
              <li key={titulo} className="flex items-center gap-4 px-4 py-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-700 dark:text-amber-400">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold tracking-wide text-slate-600 dark:text-slate-400">{titulo}</span>
                  {href ? (
                    <a href={href} className="block text-base font-semibold text-brand-blue hover:text-amber-700 dark:text-white dark:hover:text-amber-300">
                      {valor}
                    </a>
                  ) : (
                    <span className="block text-base font-semibold text-brand-blue dark:text-white">{valor}</span>
                  )}
                </span>
              </li>
            ))}
          </LiquidGlass>
        </Revelar>
      </div>
    </section>
  );
}

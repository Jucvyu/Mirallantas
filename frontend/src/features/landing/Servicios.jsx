import { CircleDot, Headset, RefreshCw } from 'lucide-react';
import LiquidGlass from '../../components/base/LiquidGlass';
import { enlaceWhatsapp } from './contenido';
import Revelar from './Revelar';
import BotonSolicitarCotizacion from './BotonSolicitarCotizacion';

/** Las dos formas del reencauche, con el lenguaje que usa la app (carcasa, reencauchadora). */
const OPCIONES_REENCAUCHE = [
  {
    titulo: 'Con tu llanta',
    texto: 'Recibimos la carcasa de tu llanta, la llevamos a la reencauchadora y sigues cada etapa desde el portal de clientes.',
  },
  {
    titulo: 'Llanta reencauchada',
    texto: 'Te entregamos una llanta ya reencauchada, lista para montar, sin que tengas que aportar la carcasa.',
  },
];

const OTROS = [
  {
    icon: CircleDot,
    titulo: 'Llantas nuevas',
    texto: 'Llantas para tu vehículo con su ficha comercial: medida, marca y tipo de uso. Consulta el catálogo y pide tu cotización.',
    mensaje: 'Hola, quiero cotizar llantas nuevas.',
  },
  {
    icon: Headset,
    titulo: 'Asesoría',
    texto: 'Te ayudamos a elegir la medida y el tipo de llanta adecuados para tu operación antes de comprar.',
    mensaje: 'Hola, quiero asesoría para elegir llantas.',
  },
];

/** #servicios · reencauche (dos modalidades), llantas nuevas y asesoría. */
export default function Servicios() {
  return (
    <section id="servicios" aria-labelledby="servicios-titulo" className="scroll-mt-24 border-t border-white/70 py-20 dark:border-white/10">
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <Revelar className="max-w-2xl">
          <h2 id="servicios-titulo" className="text-3xl font-extrabold text-brand-blue dark:text-white sm:text-4xl">
            Servicios
          </h2>
          <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
            Reencauche, llantas nuevas y acompañamiento para que tu flota no se detenga.
          </p>
        </Revelar>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          {/* Reencauche: la tarjeta grande */}
          <Revelar>
            <LiquidGlass variante="pastel" inclinacion={4} className="h-full p-7 sm:p-8">
              <span data-capa className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-slate-900">
                <RefreshCw size={22} strokeWidth={2.25} aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-2xl font-extrabold text-brand-blue dark:text-white">Reencauche industrial</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Más kilómetros para tu llanta con el servicio de reencauche, en la modalidad que mejor te sirva.
              </p>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {OPCIONES_REENCAUCHE.map((o) => (
                  <li key={o.titulo} className="rounded-2xl bg-white/60 p-4 dark:bg-white/5">
                    <p className="text-sm font-bold text-brand-blue dark:text-white">{o.titulo}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{o.texto}</p>
                  </li>
                ))}
              </ul>
              {/* Con la verificación de seguridad (Cloudflare) antes de abrir WhatsApp */}
              <BotonSolicitarCotizacion
                mensaje="Hola, quiero información sobre el servicio de reencauche."
                className="ml-pulsable mt-6 inline-flex rounded-full bg-amber-400 px-6 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300"
              >
                Cotizar reencauche
              </BotonSolicitarCotizacion>
            </LiquidGlass>
          </Revelar>

          <div className="grid gap-5">
            {OTROS.map(({ icon: Icon, titulo, texto, mensaje }, i) => (
              <Revelar key={titulo} retraso={80 * (i + 1)}>
                <LiquidGlass variante="pastel" inclinacion={5} className="h-full p-6">
                  <span data-capa className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-700 dark:text-amber-400">
                    <Icon size={20} strokeWidth={2.25} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-brand-blue dark:text-white">{titulo}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{texto}</p>
                  <a
                    href={enlaceWhatsapp(mensaje)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex text-sm font-bold text-amber-700 underline-offset-4 hover:underline dark:text-amber-400"
                  >
                    Escríbenos
                  </a>
                </LiquidGlass>
              </Revelar>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

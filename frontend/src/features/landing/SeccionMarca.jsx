import LiquidGlass from '../../components/base/LiquidGlass';
import MarcaCristal from '../../components/base/MarcaCristal';
import Revelar from './Revelar';

/**
 * Texto 3D "Mirallantas" en su propia sección, a dos columnas: la palabra de
 * vidrio (carga diferida dentro de MarcaCristal, con respaldo estático) y un
 * texto breve de la empresa.
 */
export default function SeccionMarca() {
  return (
    <section aria-labelledby="marca-titulo" className="border-t border-white/70 py-20 dark:border-white/10">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 sm:px-10 lg:grid-cols-2">
        <Revelar>
          <LiquidGlass variante="pastel" inclinacion={0} className="overflow-hidden">
            <MarcaCristal compacto />
          </LiquidGlass>
        </Revelar>
        <Revelar retraso={80}>
          <h2 id="marca-titulo" className="text-3xl font-extrabold text-brand-blue dark:text-white sm:text-4xl">
            Llantas y reencauche en Medellín
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-700 dark:text-slate-300 sm:text-lg">
            Somos una microempresa especializada en la venta y el reencauche de llantas en Medellín y el Valle de
            Aburrá. Cotizas, te confirmamos el precio y sigues tu pedido hasta la entrega.
          </p>
        </Revelar>
      </div>
    </section>
  );
}

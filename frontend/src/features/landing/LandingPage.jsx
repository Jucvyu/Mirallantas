import { useEffect } from 'react';
import { FileText, Package, RefreshCw, Truck } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import Footer from '../../components/base/Footer';
import SobreProyecto from '../../components/base/SobreProyecto';
import Contacto from './Contacto';
import Hero from './Hero';
import LandingNavbar from './LandingNavbar';
import Productos from './Productos';
import SeccionMarca from './SeccionMarca';
import Servicios from './Servicios';

/** "Nosotros": el texto de "Sobre Mirallantas" en versión comercial. */
const NOSOTROS_RESUMEN =
  'Mirallantas es una comercializadora de llantas que además ofrece el servicio de reencauche. ' +
  'Atendemos en Medellín y el Valle de Aburrá: te asesoramos, te cotizamos y acompañamos tu pedido hasta la entrega.';

const NOSOTROS_PUNTOS = [
  { icon: Package, title: 'Llantas y productos', text: 'Catálogo de llantas con su medida, marca y tipo de vehículo.' },
  { icon: RefreshCw, title: 'Servicio de reencauche', text: 'Con tu carcasa o con una llanta ya reencauchada.' },
  { icon: FileText, title: 'Cotizaciones', text: 'Pides tu cotización y te confirmamos el precio antes de comprar.' },
  { icon: Truck, title: 'Entregas', text: 'Sigues el estado de tu pedido: pendiente, en camino y entregado.' },
];

/**
 * Landing comercial de Mirallantas (llantas y reencauche), en un solo scroll:
 * Inicio · Productos · Servicios · marca 3D · Nosotros · Contacto · pie.
 */
export default function LandingPage() {
  // Si se llega desde otra página con "/#productos", baja a esa sección
  // cuando ya está dibujada (el navegador lo intenta antes y no la encuentra).
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="ml-fondo-pastel min-h-screen">
      <LandingNavbar />
      <main>
        <Hero />
        <Productos />
        <Servicios />
        <SeccionMarca />
        <SobreProyecto id="nosotros" resumen={NOSOTROS_RESUMEN} puntos={NOSOTROS_PUNTOS} />
        <Contacto />
      </main>
      <Footer />
    </div>
  );
}

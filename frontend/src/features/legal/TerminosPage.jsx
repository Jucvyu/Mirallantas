import { ScrollText } from 'lucide-react';
import Footer from '../../components/base/Footer';
import PublicNavbar from '../../components/layout/PublicNavbar';

/** Fecha de la versión vigente de los términos. */
const VIGENTES_DESDE = '2026-11-26';

const SECCIONES = [
  {
    titulo: '1. Quiénes somos y qué aceptas',
    parrafos: [
      'MiraLlantas vende llantas nuevas y presta el servicio de reencauche. Al crear tu cuenta en el portal de clientes aceptas estos términos y condiciones, que aplican a todo lo que haces en él: pedir cotizaciones, aceptarlas, pagar, solicitar crédito y solicitar reencauches.',
      'Si no estás de acuerdo con alguno de los puntos, no crees la cuenta. Puedes escribirnos o visitarnos para resolver cualquier duda antes de registrarte.',
    ],
  },
  {
    titulo: '2. Tu cuenta',
    parrafos: [
      'Los datos que registras (documento, nombre, teléfono, correo y dirección) deben ser verdaderos y tuyos. Una cuenta es personal: no la compartas ni prestes tu contraseña.',
      'Eres responsable de lo que se haga con tu sesión. Si crees que alguien más entró a tu cuenta, cambia la contraseña y avísanos. Podemos suspender una cuenta que se use para suplantar a otra persona o para fines distintos a comprar o pedir servicios.',
    ],
  },
  {
    titulo: '3. Cotizaciones y precios',
    parrafos: [
      'Una solicitud de cotización no es una compra. El asesor confirma la disponibilidad y el precio con el proveedor y emite la cotización formal, que tiene una vigencia indicada en el mismo documento. Pasada la vigencia, los precios se deben confirmar de nuevo.',
      'Los precios están en pesos colombianos. La compra se cierra cuando aceptas la cotización y el pago queda aprobado.',
    ],
  },
  {
    titulo: '4. Pagos y crédito',
    parrafos: [
      'Los pagos por transferencia se verifican con el comprobante que adjuntas; hasta que se confirman, el pedido queda pendiente.',
      'El crédito está sujeto a estudio. Si se aprueba, las condiciones (cuotas, interés y cuota inicial) son las del crédito aprobado, y los abonos cuentan cuando el personal los confirma.',
    ],
  },
  {
    titulo: '5. Servicio de reencauche',
    parrafos: [
      'Antes de reencauchar, cada llanta se revisa. Una carcasa que no es apta no se reencaucha y no se cobra. El valor de cada llanta apta (banda más mano de obra) se informa antes de que aceptes el servicio.',
      'El reencauche se paga al recibir la llanta. Si una llanta lista no se paga ni se reclama dentro del plazo informado, deja de estar apartada para ti y MiraLlantas puede disponer de ella, por ejemplo ofreciéndola en el catálogo.',
      'La garantía aplica según la banda y las condiciones informadas en la revisión. No cubre daños por mal uso, mala presión de inflado, desalineación o accidentes.',
    ],
  },
  {
    titulo: '6. Entregas',
    parrafos: [
      'Puedes recoger tu pedido en el local o pedir despacho a la dirección que registres. Los tiempos de entrega son estimados y pueden variar por la disponibilidad del proveedor o del transporte.',
    ],
  },
  {
    titulo: '7. Tratamiento de datos personales',
    parrafos: [
      'Tus datos se tratan conforme a la Ley 1581 de 2012 y sus decretos. Los usamos para atender tus pedidos, cotizaciones, créditos y reencauches, para avisarte del estado de cada uno y para cumplir obligaciones legales y contables.',
      'No vendemos tus datos. Puedes conocer, actualizar y rectificar tus datos desde tu perfil, y pedir que se eliminen cuando no exista una obligación legal o contractual de conservarlos.',
    ],
  },
  {
    titulo: '8. Cambios a estos términos',
    parrafos: [
      'Podemos actualizar estos términos. La versión vigente es la publicada en esta página, con su fecha. Si un cambio afecta un pedido o crédito en curso, se respetan las condiciones con las que lo aceptaste.',
    ],
  },
];

/**
 * Términos y condiciones (/terminos), públicos. Se enlazan desde el registro
 * (hay que aceptarlos para crear la cuenta) y desde el pie de página.
 */
export default function TerminosPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-brand-navy-950">
      <PublicNavbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <header className="mb-8 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-600 dark:text-amber-400">
            <ScrollText size={20} />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Términos y condiciones</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Vigentes desde {VIGENTES_DESDE}</p>
          </div>
        </header>
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-brand-navy-900 sm:p-8">
          {SECCIONES.map((s) => (
            <section key={s.titulo}>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{s.titulo}</h2>
              {s.parrafos.map((p) => (
                <p key={p.slice(0, 30)} className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

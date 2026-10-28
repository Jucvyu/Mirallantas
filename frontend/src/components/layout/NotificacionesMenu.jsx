import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle2, Info, Trash2, TriangleAlert, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../base/ConfirmDialog';
import { notificacionesService } from '../../services';
import { fechaISO } from '../../utils/formato';
import { useAlCambiar } from '../../hooks/useAlCambiar';

/** Cada cuánto se revisa si llegaron avisos nuevos. */
const CADA_MS = 60_000;

const ICONOS = {
  exito: <CheckCircle2 size={15} className="text-emerald-500" />,
  alerta: <TriangleAlert size={15} className="text-amber-500" />,
  info: <Info size={15} className="text-blue-500" />,
};

/** "hace 5 min", "hace 2 h", "el 14/10/2026" */
function cuandoFue(fecha) {
  const minutos = Math.round((Date.now() - new Date(fecha)) / 60000);
  if (minutos < 1) return 'ahora';
  if (minutos < 60) return `hace ${minutos} min`;
  if (minutos < 24 * 60) return `hace ${Math.round(minutos / 60)} h`;
  return `el ${fechaISO(fecha)}`;
}

/**
 * Campana de notificaciones.
 *
 *   <NotificacionesMenu onNuevas={recargar} />                 portal del cliente
 *   <NotificacionesMenu servicio={avisosPersonalService} />    panel del personal
 *
 * En el portal avisa lo que hizo el asesor (valor de un servicio, pagos y
 * abonos aprobados o rechazados, créditos); en el panel, lo que llega a
 * Pedidos-Cotización (cotizaciones nuevas, pagos por revisar). Revisa cada
 * minuto; si llega algo nuevo llama a `onNuevas` (p. ej. para recargar los
 * datos de la pantalla). Al abrirla, los avisos quedan como leídos.
 *
 * Se puede borrar un aviso o todos (con confirmación). En el panel, como los
 * avisos son compartidos, solo dejan de verse para quien los borra. Los de
 * más de 7 días se borran solos.
 */
export default function NotificacionesMenu({ servicio = notificacionesService, onNuevas }) {
  const [abierto, setAbierto] = useState(false);
  // Borrado pendiente de confirmar: { notificacion } (una) o { todas: true }
  const [porBorrar, setPorBorrar] = useState(null);
  const [datos, setDatos] = useState({ notificaciones: [], sinLeer: 0 });
  // Sube cuando la API avisa un cambio (tiempo real): se revisa enseguida
  const [aviso, setAviso] = useState(0);
  useAlCambiar(() => setAviso((n) => n + 1));
  const contenedor = useRef(null);
  // Avisos sin leer en la revisión anterior (null = todavía no se ha revisado)
  const sinLeerAntes = useRef(null);
  const navigate = useNavigate();
  // En una ref para que cambiar la función no reinicie la revisión
  const alLlegarNuevas = useRef(onNuevas);
  useEffect(() => {
    alLlegarNuevas.current = onNuevas;
  }, [onNuevas]);

  // Revisa al abrir la pantalla y luego cada minuto. `vigente` evita guardar
  // una respuesta tardía si el usuario ya salió.
  useEffect(() => {
    let vigente = true;
    const revisar = () =>
      servicio
        .listar()
        .then((nuevos) => {
          if (!vigente) return;
          // Llegó algo nuevo desde la última revisión: los datos cambiaron
          if (sinLeerAntes.current !== null && nuevos.sinLeer > sinLeerAntes.current) alLlegarNuevas.current?.();
          sinLeerAntes.current = nuevos.sinLeer;
          setDatos(nuevos);
        })
        .catch(() => {}); // Sin conexión: se vuelve a intentar en el siguiente minuto
    revisar();
    const id = setInterval(revisar, CADA_MS);
    return () => {
      vigente = false;
      clearInterval(id);
    };
  }, [servicio, aviso]);

  // Se cierra al hacer click fuera o con Escape
  useEffect(() => {
    if (!abierto) return undefined;
    const alClickFuera = (e) => !contenedor.current?.contains(e.target) && setAbierto(false);
    const alTeclear = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('pointerdown', alClickFuera);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('pointerdown', alClickFuera);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  const alternar = () => {
    const abrir = !abierto;
    setAbierto(abrir);
    if (abrir && datos.sinLeer > 0) {
      servicio.marcarLeidas().catch(() => {});
      sinLeerAntes.current = 0;
      // Se ven resaltadas mientras el menú está abierto; el contador baja ya
      setDatos((d) => ({ ...d, sinLeer: 0 }));
    }
  };

  /** Borra lo confirmado y lo quita de la lista sin esperar a la próxima revisión. */
  const borrar = async () => {
    if (porBorrar.todas) {
      await servicio.borrarTodas();
      setDatos({ notificaciones: [], sinLeer: 0 });
    } else {
      const { id, leida } = porBorrar.notificacion;
      await servicio.borrar(id);
      setDatos((d) => ({
        notificaciones: d.notificaciones.filter((n) => n.id !== id),
        sinLeer: leida ? d.sinLeer : Math.max(0, d.sinLeer - 1),
      }));
    }
  };

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierto}
        aria-label={datos.sinLeer ? `Notificaciones: ${datos.sinLeer} sin leer` : 'Notificaciones'}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-amber-500 dark:border-white/10 dark:text-slate-300"
      >
        <Bell size={15} />
        {datos.sinLeer > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {datos.sinLeer > 9 ? '9+' : datos.sinLeer}
          </span>
        )}
      </button>

      {abierto && (
        <div className="ml-aparece absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl ml-glass-panel border">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-white/10">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Notificaciones</p>
            {datos.notificaciones.length > 0 && (
              <button
                type="button"
                onClick={() => setPorBorrar({ todas: true })}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 hover:bg-red-500/10 hover:text-red-500 dark:text-slate-400"
              >
                <Trash2 size={12} /> Borrar todas
              </button>
            )}
          </div>
          {datos.notificaciones.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-slate-400">No tienes notificaciones.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-white/5">
              {datos.notificaciones.map((n) => (
                <li key={n.id} className="group relative">
                  {/* Borrar este aviso (aparece al pasar el mouse o con el teclado) */}
                  <button
                    type="button"
                    onClick={() => setPorBorrar({ notificacion: n })}
                    aria-label={`Borrar la notificación ${n.titulo}`}
                    className="absolute right-2 top-2 z-10 rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-500 focus:opacity-100 group-hover:opacity-100"
                  >
                    <X size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAbierto(false);
                      if (n.enlace) navigate(n.enlace);
                    }}
                    className={`flex w-full gap-3 px-4 py-3 pr-9 text-left hover:bg-slate-50 dark:hover:bg-white/5 ${
                      n.leida ? '' : 'bg-amber-400/5'
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">{ICONOS[n.tipo] ?? ICONOS.info}</span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">{n.titulo}</span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {n.mensaje}
                      </span>
                      <span className="mt-1 block text-[10px] text-slate-400">{cuandoFue(n.fecha)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-slate-100 px-4 py-2 text-center text-[10px] text-slate-400 dark:border-white/10">
            Las notificaciones se borran solas después de 7 días.
          </p>
        </div>
      )}

      {porBorrar && (
        <ConfirmDialog
          title={porBorrar.todas ? '¿Borrar todas las notificaciones?' : '¿Borrar esta notificación?'}
          message={
            porBorrar.todas
              ? `Se borrarán ${datos.notificaciones.length} notificaciones. No se puede deshacer.`
              : 'La notificación se borrará. No se puede deshacer.'
          }
          confirmLabel={porBorrar.todas ? 'Borrar todas' : 'Borrar'}
          record={porBorrar.notificacion ? { title: porBorrar.notificacion.titulo, subtitle: porBorrar.notificacion.mensaje } : undefined}
          onConfirm={borrar}
          onClose={() => setPorBorrar(null)}
        />
      )}
    </div>
  );
}

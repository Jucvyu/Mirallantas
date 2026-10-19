import { Link } from 'react-router-dom';
import StatCard from '../../components/base/StatCard';
import Badge from '../../components/base/Badge';
import { useAuth } from '../../context/AuthContext';
import { useCredito } from '../../context/CreditoContext';
import { usePortal } from '../../context/PortalContext';
import { formatCOP } from '../../utils/formato';

/**
 * Indicadores del inicio, armados con los datos reales del cliente que
 * calcula la API (GET /api/portal/resumen → estadisticas).
 */
function indicadores(estadisticas) {
  const e = estadisticas ?? { totalCotizaciones: 0, pendientes: 0, proximaEntrega: null, saldoCredito: 0, totalComprado: 0 };
  return [
    {
      id: 'pedidos',
      label: 'MIS PEDIDOS-COTIZACIÓN',
      value: String(e.totalCotizaciones),
      sub: e.pendientes === 1 ? '1 cotización pendiente' : `${e.pendientes} cotizaciones pendientes`,
      icon: 'FileText',
      accent: 'amber',
    },
    {
      id: 'entrega',
      label: 'PRÓXIMA ENTREGA',
      value: e.proximaEntrega ? e.proximaEntrega.numero : '—',
      sub: e.proximaEntrega ? 'En camino' : 'Ninguna entrega en camino',
      icon: 'Truck',
      accent: 'blue',
    },
    {
      id: 'credito',
      label: 'MI CRÉDITO',
      value: formatCOP(e.saldoCredito),
      sub: e.saldoCredito > 0 ? 'Saldo pendiente de tu crédito' : 'Sin créditos abiertos',
      icon: 'CreditCard',
      accent: 'emerald',
    },
    {
      id: 'total',
      label: 'TOTAL COMPRADO',
      value: formatCOP(e.totalComprado),
      sub: 'Este año',
      icon: 'DollarSign',
      accent: 'violet',
    },
  ];
}

export default function ClientHomePage() {
  const { usuario: profile } = useAuth();
  const { saldoUsableTexto, cupoTotal, tieneCredito } = useCredito();
  const { cotizaciones, estadisticas, esCliente, cargando } = usePortal();

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
        Hola, {profile.nombre.split(' ')[0]}
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">Portal de cliente · MiraLlantas</p>

      {/* El personal puede mirar el portal, pero no tiene pedidos propios */}
      {!cargando && !esCliente && (
        <p className="mt-4 rounded-xl border border-blue-400/40 bg-blue-500/5 px-4 py-3 text-xs font-medium text-blue-700 dark:text-blue-300">
          Estás viendo el portal con una cuenta del personal: el catálogo funciona, pero los pedidos y la
          cartera son de cada cliente. Inicia sesión con una cuenta de cliente para verlos.
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {indicadores(estadisticas).map((stat) => (
          <StatCard key={stat.id} {...stat} />
        ))}
        {/* Cupo de cartera que le queda disponible al cliente */}
        <StatCard
          label="SALDO USABLE"
          value={saldoUsableTexto}
          sub={
            tieneCredito
              ? 'En negativo por tu crédito abierto'
              : `de un cupo de $ ${cupoTotal.toLocaleString('es-CO')}`
          }
          icon="Wallet"
          accent={tieneCredito ? 'red' : 'emerald'}
        />
      </div>

      <div className="mt-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-brand-navy-800">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Mis Pedidos-Cotización Recientes
            </h3>
            <Link to="/portal/pedidos" className="text-xs font-semibold text-amber-500 dark:text-amber-400">
              Ver todas
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
            {cotizaciones.slice(0, 4).map((cot) => (
              <li key={cot.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{cot.id}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{cot.fecha}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-slate-700 dark:text-slate-200">{cot.total}</span>
                  <Badge>{cot.estado}</Badge>
                </div>
              </li>
            ))}
          </ul>
          <p className="pt-3 text-center text-xs text-slate-400 dark:text-slate-600">
            {cargando
              ? 'Cargando…'
              : `Mostrando ${Math.min(4, cotizaciones.length)} de ${cotizaciones.length}`}
          </p>
        </div>
      </div>
    </div>
  );
}

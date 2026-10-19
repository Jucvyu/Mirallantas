import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AvisoError from '../../../components/base/AvisoError';
import StatCard from '../../../components/base/StatCard';
import Badge from '../../../components/base/Badge';
import { dashboardService } from '../../../services';
import { formatCOP } from '../../../utils/formato';

/** Colores de las marcas en la dona, en orden de participación. */
const COLORES_MARCA = ['#FBBF24', '#3B82F6', '#22C55E', '#A78BFA', '#EF4444', '#06B6D4'];

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** "2026-10" → "Oct" */
const nombreMes = (aaaaMm) => MESES[Number(aaaaMm.slice(5, 7)) - 1];

/** Texto de la variación frente al mes anterior. */
function textoVariacion(variacion) {
  if (variacion === null || variacion === undefined) return 'Sin datos del mes anterior';
  return `${variacion > 0 ? '+' : ''}${variacion}% vs mes anterior`;
}

/**
 * Dashboard del administrador.
 *
 * Solo lectura: dos indicadores del mes, los reencauches procesados, la
 * participación por marca y los últimos pedidos-cotización. Todo lo
 * calcula la API con los datos reales; aquí se pide al servicio del tablero.
 */
export default function DashboardPage() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  // Primera carga. `vigente` evita guardar una respuesta tardía si el
  // usuario ya se fue a otra pantalla.
  useEffect(() => {
    let vigente = true;
    dashboardService
      .obtener()
      .then((indicadores) => vigente && setDatos(indicadores))
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, []);

  /** Botón "Actualizar": vuelve a pedir los indicadores. */
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await dashboardService.obtener());
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  const hoy = new Date();
  const mesActual = `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`;

  // Tarjetas de indicadores (mismo formato que antes, ahora con datos reales)
  const indicadores = datos
    ? [
        {
          id: 'ventas',
          label: 'VENTAS DEL MES',
          value: formatCOP(datos.ventasMes.total),
          sub: `${datos.ventasMes.transacciones} transacciones`,
          trend: textoVariacion(datos.ventasMes.variacion),
          trendUp: (datos.ventasMes.variacion ?? 0) >= 0,
          icon: 'DollarSign',
          accent: 'amber',
        },
        {
          id: 'pedidos',
          label: 'PEDIDOS ACTIVOS',
          value: String(datos.pedidos.activos),
          sub: `${datos.pedidos.enProceso} en proceso`,
          trend: textoVariacion(datos.pedidos.variacion),
          trendUp: (datos.pedidos.variacion ?? 0) >= 0,
          icon: 'FileText',
          accent: 'blue',
        },
      ]
    : [];

  const reencauches = (datos?.reencauchesPorMes ?? []).map((m) => ({ month: nombreMes(m.mes), reencauches: m.reencauches }));
  const marcas = (datos?.ventasPorMarca ?? []).map((m, i) => ({
    name: m.marca,
    value: m.porcentaje,
    color: COLORES_MARCA[i % COLORES_MARCA.length],
  }));
  const maximoReencauches = Math.max(4, ...reencauches.map((m) => m.reencauches));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Dashboard General</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {mesActual} · {cargando ? 'Actualizando…' : 'Datos al día'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700">
            <Download size={15} /> Reporte
          </button>
          <button
            onClick={cargar}
            disabled={cargando}
            className="ml-pulsable inline-flex items-center gap-2 rounded-lg bg-amber-400 px-3.5 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-60"
          >
            <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      <AvisoError mensaje={error} className="mt-4" />

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {indicadores.map((stat) => (
          <StatCard key={stat.id} {...stat} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        {/* ---- Reencauches procesados por mes ---- */}
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-brand-navy-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Reencauches por mes</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Últimos 7 meses · llantas procesadas</p>
            </div>
            <span className="rounded-md bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              Mensual
            </span>
          </div>
          <div className="mt-4 h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reencauches} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, maximoReencauches]}
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(251, 191, 36, 0.08)' }}
                  formatter={(v) => [`${v} llantas`, 'Reencauches']}
                  contentStyle={{ borderRadius: 8, border: 'none', fontSize: 12 }}
                />
                <Bar dataKey="reencauches" fill="#FBBF24" radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ---- Participación por marca ---- */}
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-brand-navy-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ventas por Marca</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Participación en los últimos 12 meses</p>
          {marcas.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">Aún no hay ventas de productos en este periodo.</p>
          ) : (
            <>
              <div className="mx-auto mt-2 flex justify-center" style={{ width: 176, height: 176 }}>
                <PieChart width={176} height={176}>
                  <Pie
                    data={marcas}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={76}
                    paddingAngle={2}
                    startAngle={90}
                    endAngle={-270}
                    isAnimationActive={false}
                  >
                    {marcas.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </div>
              <ul className="mt-3 space-y-2">
                {marcas.map((b) => (
                  <li key={b.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                      {b.name}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{b.value}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* ---- Últimos pedidos-cotización ---- */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-brand-navy-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Últimos Pedidos</h3>
          <a href="/admin/pedidos-cotizacion" className="text-xs font-semibold text-amber-500 dark:text-amber-400">
            Ver todos
          </a>
        </div>
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
          {(datos?.ultimosPedidos ?? []).map((pedido) => (
            <li key={pedido.numero} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{pedido.numero}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{pedido.cliente}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-slate-700 dark:text-slate-200">{formatCOP(pedido.total)}</span>
                <Badge>{pedido.estado}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

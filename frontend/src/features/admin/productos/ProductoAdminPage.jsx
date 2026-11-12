import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, ExternalLink, ImageOff, Ruler, ScrollText } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import PageHeader from '../../../components/base/PageHeader';
import Skeleton from '../../../components/base/Skeleton';
import StatusSwitch from '../../../components/base/StatusSwitch';
import Field from '../../../components/base/FormModal/Field';
import { useAlCambiar } from '../../../hooks/useAlCambiar';
import { useEnvio } from '../../../hooks/useEnvio';
import { useRecurso } from '../../../hooks/useRecurso';
import { categoriasService, marcasService, modelosService, productosService, tiposVehiculoService } from '../../../services';
import { errorDeCampo } from '../../../utils/validaciones';
import { avanceFicha, camposFicha, camposGeneral, ocultosDe } from './camposProducto';
import TablaMedidas from './TablaMedidas';

const PESTANAS = [
  { clave: 'general', titulo: 'General' },
  { clave: 'medidas', titulo: 'Medidas' },
  { clave: 'ficha', titulo: 'Ficha técnica' },
];

/** Campos del modelo que se comparan para saber si hay cambios sin guardar. */
const CLAVES_MODELO = [
  'nombre', 'marca', 'categoria', 'tipoVehiculo', 'descripcion', 'foto',
  'uso', 'labrado', 'construccion', 'sinCamara', 'recauchable', 'garantiaMeses', 'paisOrigen', 'fuenteFicha', 'fichaPdf',
];
const firma = (v) => JSON.stringify(CLAVES_MODELO.map((k) => v?.[k] ?? ''));

/** Indicador del encabezado: cuánto le falta al producto. */
function Indicador({ icono: Icono, listo, children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${
        listo ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-amber-400/15 text-amber-700 dark:text-amber-300'
      }`}
    >
      <Icono size={13} aria-hidden="true" /> {children}
    </span>
  );
}

/** Campos del esquema en dos columnas, como en los formularios del panel. */
function Campos({ campos, valores, errores, onCambiar, onTocar }) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
      {campos.map((field) => (
        <Field key={field.key} field={field} value={valores[field.key]} error={errores[field.key]} onChange={onCambiar} onBlur={onTocar} />
      ))}
    </div>
  );
}

/**
 * Página de un producto (modelo de llanta) en el panel. Todo en un solo
 * lugar, en pestañas:
 *
 *   General        nombre, marca, categoría, vehículo, descripción y foto
 *   Medidas        las variantes que se venden (posición + medida), en una
 *                  tabla que se edita como hoja de cálculo
 *   Ficha técnica  los datos del fabricante y su PDF
 *
 * General y Ficha técnica se guardan juntas con la barra de cambios; las
 * medidas, con la suya. Los datos que no aplican a la categoría (p. ej. las
 * lonas en una moto) no se muestran.
 */
export default function ProductoAdminPage() {
  const { id } = useParams();
  const [busqueda, setBusqueda] = useSearchParams();
  const pestana = PESTANAS.some((p) => p.clave === busqueda.get('pestana')) ? busqueda.get('pestana') : 'general';

  const categorias = useRecurso(categoriasService);
  const marcas = useRecurso(marcasService);
  const tipos = useRecurso(tiposVehiculoService);
  const contexto = { categorias: categorias.filas, marcas: marcas.filas, tipos: tipos.filas };

  const [modelo, setModelo] = useState(null);
  const [valores, setValores] = useState(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [tocados, setTocados] = useState(() => new Set());
  const [intento, setIntento] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [medidasExistentes, setMedidasExistentes] = useState([]);
  const { enviando, errorEnvio, enviar } = useEnvio();
  const estado = useEnvio();

  const sucio = Boolean(modelo && valores && firma(modelo) !== firma(valores));

  const recibir = useCallback((m) => {
    setModelo(m);
    setValores(m);
    setTocados(new Set());
    setIntento(false);
  }, []);

  const cargar = useCallback(async () => {
    try {
      recibir(await modelosService.obtener(id));
      setErrorCarga('');
    } catch (e) {
      setErrorCarga(e.message);
    }
  }, [id, recibir]);

  useEffect(() => {
    let vigente = true;
    modelosService
      .obtener(id)
      .then((m) => vigente && recibir(m))
      .catch((e) => vigente && setErrorCarga(e.message));
    productosService
      .medidas()
      .then((lista) => vigente && setMedidasExistentes(lista))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [id, recibir]);

  // Si otro usuario cambia el producto, se ve aquí, salvo que haya cambios sin guardar
  useAlCambiar(() => {
    if (!sucio) cargar();
  });

  const ocultos = useMemo(() => ocultosDe(categorias.filas, valores?.categoria), [categorias.filas, valores?.categoria]);
  const campos = useMemo(
    () => ({ general: camposGeneral(contexto), ficha: camposFicha(ocultos) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categorias.filas, marcas.filas, tipos.filas, ocultos],
  );

  const volver = (
    <Link
      to="/admin/productos"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
    >
      <ArrowLeft size={15} aria-hidden="true" /> Productos
    </Link>
  );

  if (!modelo || !valores) {
    return (
      <div>
        <PageHeader crumbs={['Inicio', 'Productos', 'Producto']} />
        {volver}
        <AvisoError mensaje={errorCarga} />
        {!errorCarga && (
          <div className="space-y-3">
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-10 w-96" />
            <Skeleton className="h-72 w-full" />
          </div>
        )}
      </div>
    );
  }

  // ---- Validación de General + Ficha ---------------------------------------
  const todosLosCampos = [...campos.general, ...campos.ficha];
  const errores = {};
  for (const campo of todosLosCampos) {
    const mensaje = errorDeCampo(campo, valores[campo.key], valores);
    if (mensaje && (intento || tocados.has(campo.key))) errores[campo.key] = mensaje;
  }
  const erroresPorPestana = {
    general: campos.general.some((c) => errores[c.key]),
    ficha: campos.ficha.some((c) => errores[c.key]),
  };

  const cambiar = (key, valor) => {
    setValores((v) => ({ ...v, [key]: valor }));
    setTocados((t) => new Set(t).add(key));
    setGuardado(false);
  };
  const tocar = (key) => setTocados((t) => new Set(t).add(key));

  const guardar = () => {
    setIntento(true);
    const pendientes = todosLosCampos.filter((c) => errorDeCampo(c, valores[c.key], valores));
    if (pendientes.length) {
      // Lleva a la pestaña donde está el primer error
      const enGeneral = pendientes.some((c) => campos.general.includes(c));
      setBusqueda({ pestana: enGeneral ? 'general' : 'ficha' }, { replace: true });
      return;
    }
    enviar(async () => {
      await modelosService.editar(modelo, valores, contexto);
      await cargar();
      setGuardado(true);
    });
  };

  const cambiarEstado = (nuevo) =>
    estado.enviar(async () => {
      await modelosService.cambiarEstado(modelo, nuevo);
      await cargar();
    });

  const guardarMedidas = async (filas) => recibir(await modelosService.guardarReferencias(modelo, filas));

  const activas = modelo.referencias.filter((r) => r.activo).length;
  const ficha = avanceFicha(modelo, ocultosDe(categorias.filas, modelo.categoria));

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Productos', `${modelo.marca} ${modelo.nombre}`]} />
      {volver}

      {/* Encabezado: qué producto es, su estado y cuánto le falta */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-wide text-amber-700 dark:text-amber-400">{modelo.marca.toUpperCase()}</p>
          <h1 className="mt-0.5 text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">{modelo.nombre}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Indicador icono={Ruler} listo={activas > 0}>
              {modelo.referencias.length === 0
                ? 'Sin medidas: no sale en el catálogo'
                : `${modelo.referencias.length} ${modelo.referencias.length === 1 ? 'medida' : 'medidas'} · ${activas} a la venta`}
            </Indicador>
            <Indicador icono={ScrollText} listo={ficha.llenos === ficha.total}>
              Ficha {ficha.llenos} de {ficha.total}
            </Indicador>
            <Indicador icono={modelo.foto ? Check : ImageOff} listo={Boolean(modelo.foto)}>
              {modelo.foto ? 'Con foto' : 'Sin foto'}
            </Indicador>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <StatusSwitch value={modelo.estado} onChange={cambiarEstado} label="Estado del producto" />
          {activas > 0 && modelo.activo && (
            <a
              href={`/catalogo/${modelo.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:underline dark:text-amber-400"
            >
              <ExternalLink size={14} aria-hidden="true" /> Ver en el catálogo
            </a>
          )}
        </div>
      </div>
      <AvisoError mensaje={estado.errorEnvio} className="mt-3" />

      {/* Pestañas */}
      <div role="tablist" aria-label="Secciones del producto" className="mt-6 flex gap-1 border-b border-slate-200 dark:border-white/10">
        {PESTANAS.map((p) => {
          const activa = p.clave === pestana;
          const conError = erroresPorPestana[p.clave];
          return (
            <button
              key={p.clave}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setBusqueda({ pestana: p.clave }, { replace: true })}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                activa
                  ? 'border-amber-400 text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {p.titulo}
              {p.clave === 'medidas' && (
                <span className="ml-1.5 rounded-md bg-slate-500/10 px-1.5 py-0.5 text-[11px] tabular-nums">{modelo.referencias.length}</span>
              )}
              {conError && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-red-500" aria-label="con errores" />}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="mt-6">
        {pestana === 'general' && (
          <div className="max-w-3xl">
            <Campos campos={campos.general} valores={valores} errores={errores} onCambiar={cambiar} onTocar={tocar} />
          </div>
        )}
        {pestana === 'ficha' && (
          <div className="max-w-3xl">
            <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
              Todo es opcional: llénalo a medida que tengas la información del fabricante. El cliente ve estos datos en el detalle del producto.
              {ocultos.size > 0 && ' Los datos que no aplican a esta categoría no se piden.'}
            </p>
            <Campos campos={campos.ficha} valores={valores} errores={errores} onCambiar={cambiar} onTocar={tocar} />
          </div>
        )}
        {pestana === 'medidas' && (
          <>
            <p className="mb-4 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              Cada fila es una variante que se vende y se cotiza por separado (con su código ML-…). El cliente elige primero la posición y luego
              la medida. Solo la medida es obligatoria.
            </p>
            <TablaMedidas
              referencias={modelo.referencias}
              ocultos={ocultos}
              medidasExistentes={medidasExistentes}
              onGuardar={guardarMedidas}
            />
          </>
        )}
      </div>

      {/* Barra de cambios de General y Ficha técnica (se ve desde cualquier pestaña) */}
      {pestana !== 'medidas' && (sucio || errorEnvio || guardado) && (
        <div className="sticky bottom-4 z-10 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:bg-brand-navy-900/95">
          <div className="min-w-0">
            {sucio ? (
              <p className="text-sm text-slate-700 dark:text-slate-200">Cambios sin guardar en el producto</p>
            ) : (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <Check size={15} aria-hidden="true" /> Cambios guardados
              </p>
            )}
            <AvisoError mensaje={errorEnvio} className="mt-2" />
          </div>
          {sucio && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => recibir(modelo)}
                disabled={enviando}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={enviando}
                className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
              >
                {enviando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

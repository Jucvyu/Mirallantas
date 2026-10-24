import { useRef, useState } from 'react';
import { Camera, ChevronDown, ImagePlus, Info, Ruler, Trash2, Wrench } from 'lucide-react';
import Modal from '../../components/base/Modal';
import Tooltip from '../../components/base/Tooltip';
import { BORDER_ERR, BORDER_OK, INPUT, LABEL, soloDigitos } from '../../components/base/formStyles';
import { leerImagen, TIPOS_IMAGEN } from '../../utils/imagenes';
import { MINIMO_EXPLICACION } from '../../utils/validaciones';

/** Máximo de fotos por llanta. */
const MAXIMO_FOTOS = 3;

/** "275/80 R22.5" → { ancho: '275', perfil: '80', rin: '22.5' } (vacío si no se reconoce). */
function separarMedidas(texto = '') {
  const m = String(texto).match(/(\d{3})\s*\/\s*(\d{2})\s*R?\s*(\d{2}(?:[.,]\d)?)/i);
  return m ? { ancho: m[1], perfil: m[2], rin: m[3].replace(',', '.') } : { ancho: '', perfil: '', rin: '' };
}

/** Rin: solo números y un punto decimal ("22.5"). */
const soloRin = (texto) => texto.replace(',', '.').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 4);

/** Consejos para tomar las fotos de la llanta (desplegable). */
const CONSEJOS_FOTOS = [
  ['Costado completo', 'Toma la llanta de lado, entera, con la medida (ej. 275/80 R22.5) legible.'],
  ['Banda de rodamiento', 'De frente, para que se vea el labrado y el desgaste.'],
  ['Daños o interior', 'Cortes, abultamientos, parches o el interior de la llanta, si los hay.'],
];

/**
 * "Pedir reencauche" en el carro del portal.
 *
 * Las medidas van en tres campos (ancho, perfil y rin) para que todas queden
 * escritas igual: "275/80 R22.5". Se adjuntan de 1 a 3 fotos de la llanta,
 * con un desplegable que explica cómo tomarlas. Al guardar entrega
 * { cantidad, medidas, fotos, foto (la primera), descripcion }.
 */
export default function SolicitudReencaucheModal({ inicial, onGuardar, onClose }) {
  const editando = Boolean(inicial);
  const [cantidad, setCantidad] = useState(String(inicial?.cantidad ?? '1'));
  const [medidas, setMedidas] = useState(() => separarMedidas(inicial?.medidas));
  const [fotos, setFotos] = useState(() => inicial?.fotos ?? (inicial?.foto ? [inicial.foto] : []));
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '');
  const [verGuia, setVerGuia] = useState(false);
  const [errorFoto, setErrorFoto] = useState('');
  const [intento, setIntento] = useState(false);
  const archivo = useRef(null);

  const combinadas = medidas.ancho && medidas.perfil && medidas.rin ? `${medidas.ancho}/${medidas.perfil} R${medidas.rin}` : '';

  const errores = {};
  if (!(Number(cantidad) > 0)) errores.cantidad = 'Indica cuántas llantas';
  if (!/^\d{3}$/.test(medidas.ancho)) errores.ancho = 'Ancho de 3 dígitos (ej. 275)';
  if (!/^\d{2}$/.test(medidas.perfil)) errores.perfil = 'Perfil de 2 dígitos (ej. 80)';
  if (!/^\d{2}(\.\d)?$/.test(medidas.rin)) errores.rin = 'Rin (ej. 22.5)';
  if (fotos.length === 0) errores.fotos = 'Adjunta al menos una foto de la llanta';
  if (!descripcion.trim()) errores.descripcion = 'Describe la llanta';
  else if (descripcion.trim().length < MINIMO_EXPLICACION)
    errores.descripcion = `Describe la llanta con al menos ${MINIMO_EXPLICACION} caracteres`;
  const visibles = intento ? errores : {};
  const borde = (campo) => (visibles[campo] ? BORDER_ERR : BORDER_OK);

  const agregarFoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    leerImagen(file)
      .then((dataUrl) => {
        setErrorFoto('');
        setFotos((f) => [...f, dataUrl].slice(0, MAXIMO_FOTOS));
      })
      .catch((err) => setErrorFoto(err.message));
  };

  const guardar = (cerrar) => {
    setIntento(true);
    if (Object.keys(errores).length > 0) return;
    onGuardar({ cantidad: Number(cantidad), medidas: combinadas, fotos, foto: fotos[0], descripcion: descripcion.trim() });
    cerrar();
  };

  return (
    <Modal
      title={editando ? 'Editar servicio' : 'Pedir reencauche'}
      subtitle="Sube las fotos de la llanta para que el asesor evalúe si es apta. El valor lo define el asesor."
      icon={<Wrench size={17} />}
      size="lg"
      onClose={onClose}
      footer={(cerrar) => (
        <>
          <button
            type="button"
            onClick={cerrar}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => guardar(cerrar)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300"
          >
            {editando ? 'Guardar cambios' : 'Agregar al carro'}
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        {/* ---- Cantidad ---- */}
        <div className="max-w-[12rem]">
          <label htmlFor="rq-cantidad" className={LABEL}>
            Cantidad de llantas <span className="text-red-500">*</span>
          </label>
          <input
            id="rq-cantidad"
            inputMode="numeric"
            value={cantidad}
            onChange={(e) => setCantidad(soloDigitos(e.target.value).slice(0, 3))}
            placeholder="4"
            className={`${INPUT} ${borde('cantidad')}`}
          />
          {visibles.cantidad && <p className="mt-1 text-xs text-red-500">{visibles.cantidad}</p>}
        </div>

        {/* ---- Medidas en tres campos ---- */}
        <div>
          <span className={`${LABEL} flex items-center gap-1.5`}>
            <Tooltip texto="Escribe el ancho, el perfil y el rin por separado">
              <Ruler size={14} className="text-amber-500" aria-hidden="true" />
            </Tooltip>
            Medidas de la llanta <span className="text-red-500">*</span>
            <Tooltip texto="Están escritas en el costado de la llanta, por ejemplo 275/80 R22.5">
              <span tabIndex={0} className="cursor-help text-slate-400">
                <Info size={13} aria-label="Dónde encontrar las medidas" />
              </span>
            </Tooltip>
          </span>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <input
                aria-label="Ancho de sección"
                inputMode="numeric"
                value={medidas.ancho}
                onChange={(e) => setMedidas((m) => ({ ...m, ancho: soloDigitos(e.target.value).slice(0, 3) }))}
                placeholder="275"
                className={`${INPUT} ${borde('ancho')} text-center`}
              />
              <p className={`mt-1 text-center text-[11px] ${visibles.ancho ? 'text-red-500' : 'text-slate-400'}`}>
                {visibles.ancho ?? 'Ancho de sección'}
              </p>
            </div>
            <div>
              <input
                aria-label="Perfil o serie"
                inputMode="numeric"
                value={medidas.perfil}
                onChange={(e) => setMedidas((m) => ({ ...m, perfil: soloDigitos(e.target.value).slice(0, 2) }))}
                placeholder="80"
                className={`${INPUT} ${borde('perfil')} text-center`}
              />
              <p className={`mt-1 text-center text-[11px] ${visibles.perfil ? 'text-red-500' : 'text-slate-400'}`}>
                {visibles.perfil ?? 'Perfil o serie'}
              </p>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-[11px] text-sm font-semibold text-slate-400">R</span>
              <input
                aria-label="Rin (con la letra R)"
                inputMode="decimal"
                value={medidas.rin}
                onChange={(e) => setMedidas((m) => ({ ...m, rin: soloRin(e.target.value) }))}
                placeholder="22.5"
                className={`${INPUT} ${borde('rin')} pl-7 text-center`}
              />
              <p className={`mt-1 text-center text-[11px] ${visibles.rin ? 'text-red-500' : 'text-slate-400'}`}>
                {visibles.rin ?? 'Rin (con la letra R)'}
              </p>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {combinadas ? (
              <>
                Quedará así: <strong className="text-slate-700 dark:text-slate-200">{combinadas}</strong>
              </>
            ) : (
              <>Ejemplo del formato combinado: 275 / 80 R22.5</>
            )}
          </p>
        </div>

        {/* ---- Fotos (máximo 3) ---- */}
        <div>
          <span className={`${LABEL} flex items-center gap-1.5`}>
            <Tooltip texto="Adjunta de 1 a 3 fotos de la llanta que quieres reencauchar">
              <Camera size={14} className="text-amber-500" aria-hidden="true" />
            </Tooltip>
            Fotos de la llanta <span className="text-red-500">*</span>
            <span className="font-normal text-slate-400">
              ({fotos.length}/{MAXIMO_FOTOS})
            </span>
          </span>
          <div className="grid grid-cols-3 gap-2">
            {fotos.map((foto, i) => (
              <div key={i} className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                <img src={foto} alt={`Foto ${i + 1} de la llanta`} className="h-24 w-full object-cover" />
                <Tooltip texto="Quitar esta foto" className="absolute right-1 top-1">
                  <button
                    type="button"
                    onClick={() => setFotos((f) => f.filter((_, j) => j !== i))}
                    aria-label={`Quitar la foto ${i + 1}`}
                    className="rounded-md bg-white/90 p-1 text-red-500 shadow hover:bg-white dark:bg-brand-navy-900/90"
                  >
                    <Trash2 size={13} />
                  </button>
                </Tooltip>
              </div>
            ))}
            {fotos.length < MAXIMO_FOTOS && (
              <Tooltip texto="Agregar una foto de la llanta (JPG, PNG o WEBP, máximo 3 MB)" className="block">
              <button
                type="button"
                onClick={() => archivo.current?.click()}
                className={`flex h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs font-semibold text-slate-500 hover:border-amber-400 hover:text-amber-600 dark:text-slate-400 ${
                  visibles.fotos ? 'border-red-400' : 'border-slate-200 dark:border-white/10'
                }`}
              >
                <ImagePlus size={20} aria-hidden="true" />
                Agregar foto
              </button>
              </Tooltip>
            )}
          </div>
          <input ref={archivo} type="file" accept={TIPOS_IMAGEN} onChange={agregarFoto} className="hidden" />
          {(visibles.fotos || errorFoto) && <p className="mt-1 text-xs text-red-500">{errorFoto || visibles.fotos}</p>}

          {/* Guía para tomar las fotos */}
          <Tooltip texto={verGuia ? 'Ocultar la guía' : 'Ver cómo tomar las fotos de la llanta'} className="mt-2">
            <button
              type="button"
              onClick={() => setVerGuia((v) => !v)}
              aria-expanded={verGuia}
              className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:underline dark:text-amber-400"
            >
              ¿Cómo tomar las fotos?
              <ChevronDown size={13} className={`transition-transform ${verGuia ? 'rotate-180' : ''}`} />
            </button>
          </Tooltip>
          {verGuia && (
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <ol className="space-y-2">
                {CONSEJOS_FOTOS.map(([titulo, detalle], i) => (
                  <li key={titulo} className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-slate-900">
                      {i + 1}
                    </span>
                    <span>
                      <strong className="text-slate-800 dark:text-slate-100">{titulo}:</strong> {detalle}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Usa buena luz (de día, sin flash), con la llanta limpia y sin otras cosas alrededor.
              </p>
            </div>
          )}
        </div>

        {/* ---- Descripción ---- */}
        <div>
          <label htmlFor="rq-descripcion" className={LABEL}>
            Descripción de la llanta <span className="text-red-500">*</span>
          </label>
          <textarea
            id="rq-descripcion"
            rows={3}
            maxLength={500}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Marca, kilometraje aproximado, estado del labrado..."
            className={`${INPUT} ${borde('descripcion')} resize-none`}
          />
          {visibles.descripcion && <p className="mt-1 text-xs text-red-500">{visibles.descripcion}</p>}
        </div>
      </div>
    </Modal>
  );
}

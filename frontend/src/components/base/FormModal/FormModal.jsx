import { useMemo, useState } from 'react';
import { Check, Eye, Pencil, Plus } from 'lucide-react';
import AvisoError from '../AvisoError';
import Modal from '../Modal';
import { errorDeCampo } from '../../../utils/validaciones';
import Field from './Field';

/** Deja los importes con el mismo formato que usa el resto de las tablas. */
function formatMoney(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return `$ ${Number(digits).toLocaleString('es-CO')}`;
}

const MODE_META = {
  create: { icon: <Plus size={17} />, submit: 'Guardar cambios' },
  edit: { icon: <Pencil size={16} />, submit: 'Guardar cambios' },
  view: { icon: <Eye size={16} />, submit: null },
};

/**
 * Modal de formulario dirigido por esquema — cubre "Nuevo", "Editar" y
 * "Detalle" con la misma definición de campos.
 *
 * sections: [{ title, fields: [ ...ver Field.jsx ] }]
 * mode: 'create' | 'edit' | 'view'
 * validate: (values) => ({ campo: 'mensaje' }) para las reglas que miran
 *   varios campos a la vez, como la cuota inicial frente al total
 *
 * Validación en tiempo real: cada campo se revisa mientras se escribe
 * (obligatorio, formato de correo y teléfono, documento, contraseña,
 * largo máximo y la regla propia `validar` del campo). Los avisos de un
 * campo aparecen en cuanto el usuario lo toca o sale de él, no antes.
 * onSubmit: (values) => puede devolver una promesa (p. ej. guardar en la
 *   API). El modal espera a que termine: si falla, muestra el error y no se
 *   cierra; si sale bien, se cierra solo.
 */
export default function FormModal({
  title,
  subtitle,
  sections: rawSections = [],
  initialValues = {},
  mode = 'create',
  size = 'lg',
  submitLabel,
  validate,
  onSubmit,
  onClose,
}) {
  const [values, setValues] = useState(initialValues);
  // Campos que el usuario ya tocó: solo esos muestran sus avisos
  const [tocados, setTocados] = useState(() => new Set());
  // Errores por campo que devolvió la API al guardar
  const [erroresApi, setErroresApi] = useState({});
  // Mientras la API responde, el botón queda deshabilitado (evita guardar dos veces)
  const [guardando, setGuardando] = useState(false);
  // Mensaje general que devuelve la API cuando rechaza el formulario
  const [errorGeneral, setErrorGeneral] = useState('');
  const meta = MODE_META[mode] ?? MODE_META.create;

  // Un campo puede limitarse a uno o varios modos con `only` (p. ej. la
  // contraseña, que se pide al crear, o el motivo de cancelación, que solo
  // se ve al editar o al consultar el detalle).
  const aplicaEnModo = (campo) => {
    if (!campo.only) return true;
    return Array.isArray(campo.only) ? campo.only.includes(mode) : campo.only === mode;
  };

  const sections = useMemo(
    () =>
      rawSections
        .map((s) => ({ ...s, fields: s.fields.filter(aplicaEnModo) }))
        .filter((s) => s.fields.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawSections, mode],
  );

  // Un campo de solo lectura no se le pide al usuario, aunque sea obligatorio
  const camposEditables = useMemo(
    () => (mode === 'view' ? [] : sections.flatMap((s) => s.fields.filter((f) => !f.soloLectura))),
    [sections, mode],
  );

  /** Todos los errores del formulario con estos valores. */
  const erroresDe = (vals) => {
    const encontrados = {};
    for (const campo of camposEditables) {
      const mensaje = errorDeCampo(campo, vals[campo.key], vals);
      if (mensaje) encontrados[campo.key] = mensaje;
    }
    // Reglas que dependen de varios campos a la vez
    return { ...encontrados, ...(validate?.(vals) ?? {}) };
  };

  // Lo que se pinta: los errores de los campos tocados (recalculados con
  // cada tecla) más los que devolvió la API
  const todos = erroresDe(values);
  const errors = { ...erroresApi };
  for (const key of tocados) if (todos[key]) errors[key] = todos[key];

  /** Marca un campo como tocado (al escribir o al salir de él). */
  const tocar = (key) => setTocados((t) => (t.has(key) ? t : new Set(t).add(key)));

  const handleChange = (key, val) => {
    setValues((v) => ({ ...v, [key]: val }));
    tocar(key);
    // El error de la API de ese campo ya no aplica: el usuario lo corrigió
    setErroresApi((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const handleSubmit = async (e, close) => {
    e.preventDefault();
    if (guardando) return;
    // Al guardar se muestran todos los avisos, aunque no se hayan tocado
    const pendientes = erroresDe(values);
    setTocados(new Set([...camposEditables.map((c) => c.key), ...Object.keys(pendientes)]));
    if (Object.keys(pendientes).length > 0) return;

    const moneyKeys = sections.flatMap((s) => s.fields.filter((f) => f.type === 'money').map((f) => f.key));
    const payload = { ...values };
    moneyKeys.forEach((k) => {
      if (payload[k]) payload[k] = formatMoney(payload[k]);
    });

    setGuardando(true);
    setErrorGeneral('');
    try {
      await onSubmit?.(payload);
      close();
    } catch (error) {
      // Si la API señala campos concretos, se marcan en rojo
      const porCampo = {};
      for (const detalle of error.detalles ?? []) {
        if (detalle.campo) porCampo[detalle.campo] = detalle.mensaje;
      }
      setErroresApi(porCampo);
      setErrorGeneral(error.message);
    } finally {
      setGuardando(false);
    }
  };

  const footer =
    mode === 'view'
      ? (close) => (
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
          >
            Cerrar
          </button>
        )
      : (close) => (
          <>
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={(e) => handleSubmit(e, close)}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
            >
              <Check size={16} /> {guardando ? 'Guardando…' : (submitLabel ?? meta.submit)}
            </button>
          </>
        );

  return (
    <Modal
      title={title}
      subtitle={subtitle}
      icon={meta.icon}
      size={size}
      onClose={onClose}
      footer={footer}
    >
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        <AvisoError mensaje={errorGeneral} />
        {sections.map((section) => (
          <fieldset key={section.title ?? 'default'}>
            {section.title && (
              <legend className="mb-4 flex w-full items-center gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  {section.title}
                </span>
                <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
              </legend>
            )}
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              {section.fields.map((field) => (
                <Field
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  error={errors[field.key]}
                  onChange={handleChange}
                  onBlur={tocar}
                  mode={mode === 'view' ? 'view' : 'edit'}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </form>
    </Modal>
  );
}

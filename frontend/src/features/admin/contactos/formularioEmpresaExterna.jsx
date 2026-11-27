import { estadosActivo, tiposDocumento } from '../../../constantes';

/**
 * Formulario compartido de proveedores y terceros (reencauchadoras): los dos
 * registran igual a una persona natural o a una jurídica (migraciones 0044 y
 * 0046). Pregunta primero el tipo de persona y, según eso, pide:
 *   Natural   nombre completo, documento de persona (CC, CE, Pasaporte o NIT)
 *             y la persona de contacto como opcional.
 *   Jurídica  razón social, NIT y la persona de contacto (obligatoria).
 */
export const NATURAL = 'Natural';
export const JURIDICA = 'Jurídica';
export const tiposPersona = [NATURAL, JURIDICA];
const esJuridica = (v) => v.tipoPersona === JURIDICA;

export const formularioEmpresaExterna = [
  {
    title: 'Tipo de persona',
    fields: [
      {
        key: 'tipoPersona',
        label: '¿Es persona natural o jurídica?',
        type: 'select',
        required: true,
        span: 2,
        options: [NATURAL, JURIDICA],
        hint: 'Natural: una persona con su cédula. Jurídica: una empresa con NIT.',
      },
    ],
  },
  {
    title: 'Identificación',
    fields: [
      // Persona natural
      { key: 'nombreRazonSocial', label: 'Nombre completo', required: true, span: 2, soloSi: (v) => !esJuridica(v) },
      {
        key: 'tipoDocumento',
        label: 'Tipo de documento',
        type: 'select',
        required: true,
        options: tiposDocumento,
        soloSi: (v) => !esJuridica(v),
      },
      { key: 'numeroDocumento', label: 'Número de documento', type: 'documento', required: true, soloSi: (v) => !esJuridica(v) },
      // Persona jurídica: siempre con NIT
      { key: 'nombreRazonSocial', label: 'Razón social', required: true, span: 2, soloSi: esJuridica },
      {
        key: 'numeroDocumento',
        label: 'NIT',
        required: true,
        span: 2,
        placeholder: '900123456-7',
        soloSi: esJuridica,
        validar: (v) => (v && !/^\d{9,10}(-\d)?$/.test(String(v).trim()) ? 'El NIT tiene 9 o 10 dígitos (con guion y dígito de verificación opcional)' : ''),
      },
    ],
  },
  {
    title: 'Contacto',
    fields: [
      { key: 'contacto', label: 'Persona de contacto (opcional)', soloSi: (v) => !esJuridica(v) },
      { key: 'contacto', label: 'Persona de contacto en la empresa', required: true, soloSi: esJuridica },
      { key: 'telefono', label: 'Teléfono', type: 'tel', required: true },
      { key: 'correo', label: 'Correo electrónico', type: 'email', required: true },
      { key: 'direccion', label: 'Dirección', span: 2 },
      { key: 'estado', label: 'Estado', type: 'select', options: estadosActivo, only: ['edit', 'view'] },
    ],
  },
];

/** Valores con los que abre "Nuevo". */
export const valoresInicialesEmpresaExterna = { tipoPersona: NATURAL };

/** Columna del nombre con el tipo de persona debajo. */
export const columnaNombre = (label) => ({
  key: 'nombreRazonSocial',
  label,
  render: (p) => (
    <div>
      <p>{p.nombreRazonSocial}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500">Persona {p.tipoPersona === JURIDICA ? 'jurídica' : 'natural'}</p>
    </div>
  ),
});

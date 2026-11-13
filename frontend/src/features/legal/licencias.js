// =========================================================================
// Licencias del software que usa MiraLlantas.
//
// Una sola fuente para la página /licencias (pública) y /admin/licencias
// (panel). Las versiones son las instaladas (package.json y node_modules);
// si se actualiza una dependencia, se actualiza aquí y en el README.
// =========================================================================

import {
  SiApache,
  SiAutoprefixer,
  SiBrevo,
  SiCloudflare,
  SiCloudinary,
  SiExpress,
  SiGoogle,
  SiGooglefonts,
  SiJsonwebtokens,
  SiLucide,
  SiMozilla,
  SiNodedotjs,
  SiOpensourceinitiative,
  SiOxc,
  SiPostcss,
  SiPostgresql,
  SiReact,
  SiReactrouter,
  SiRender,
  SiSupabase,
  SiTailwindcss,
  SiThreedotjs,
  SiTypescript,
  SiVercel,
  SiVite,
  SiZod,
} from 'react-icons/si';
import { ChartColumn, FileText, Gauge, Hand, KeyRound, Package, QrCode, ScrollText, Shield, Type } from 'lucide-react';

/**
 * Cada licencia con su color, su icono y lo que permite. Los enlaces son los
 * oficiales: la Open Source Initiative (OSI) o el autor de la licencia, y su
 * ficha en SPDX (el catálogo estándar de licencias).
 */
export const LICENCIAS = {
  MIT: {
    nombre: 'Licencia MIT',
    corto: 'MIT',
    color: '#A31F34',
    icono: SiOpensourceinitiative,
    resumen: 'Permite usar, copiar, modificar, distribuir y vender el software, incluso con fines comerciales.',
    condicion: 'Conservar el aviso de copyright y el texto de la licencia.',
    texto: 'https://opensource.org/license/mit',
    spdx: 'https://spdx.org/licenses/MIT.html',
  },
  ISC: {
    nombre: 'Licencia ISC',
    corto: 'ISC',
    color: '#0E7490',
    icono: SiOpensourceinitiative,
    resumen: 'Equivalente a la MIT, con un texto más corto: uso, copia, modificación y distribución libres.',
    condicion: 'Conservar el aviso de copyright y el permiso.',
    texto: 'https://opensource.org/license/isc-license-txt',
    spdx: 'https://spdx.org/licenses/ISC.html',
  },
  'BSD-3-Clause': {
    nombre: 'Licencia BSD de 3 cláusulas',
    corto: 'BSD-3',
    color: '#AB2B28',
    icono: Shield,
    resumen: 'Uso, modificación y redistribución libres, en código fuente o compilado.',
    condicion: 'Conservar el copyright y no usar el nombre de los autores para promocionar el producto.',
    texto: 'https://opensource.org/license/bsd-3-clause',
    spdx: 'https://spdx.org/licenses/BSD-3-Clause.html',
  },
  'Apache-2.0': {
    nombre: 'Licencia Apache 2.0',
    corto: 'Apache 2.0',
    color: '#D22128',
    icono: SiApache,
    resumen: 'Uso libre, incluso comercial, con una concesión expresa de patentes.',
    condicion: 'Conservar avisos y la licencia, e indicar los archivos modificados.',
    texto: 'https://www.apache.org/licenses/LICENSE-2.0',
    spdx: 'https://spdx.org/licenses/Apache-2.0.html',
  },
  'MPL-2.0': {
    nombre: 'Mozilla Public License 2.0',
    corto: 'MPL 2.0',
    color: '#E66000',
    icono: SiMozilla,
    resumen: 'Copyleft por archivo: se puede combinar con código propio sin abrirlo.',
    condicion: 'Solo los cambios a los archivos de la librería se comparten con la misma licencia.',
    texto: 'https://www.mozilla.org/en-US/MPL/2.0/',
    spdx: 'https://spdx.org/licenses/MPL-2.0.html',
  },
  PostgreSQL: {
    nombre: 'Licencia PostgreSQL',
    corto: 'PostgreSQL',
    color: '#336791',
    icono: SiPostgresql,
    resumen: 'Licencia libre al estilo MIT/BSD: uso, copia, modificación y distribución para cualquier fin.',
    condicion: 'Conservar el aviso de copyright y el párrafo de la licencia.',
    texto: 'https://www.postgresql.org/about/licence/',
    spdx: 'https://spdx.org/licenses/PostgreSQL.html',
  },
  'OFL-1.1': {
    nombre: 'SIL Open Font License 1.1',
    corto: 'OFL 1.1',
    color: '#1A73E8',
    icono: Type,
    resumen: 'Fuentes tipográficas libres: se usan, incrustan y redistribuyen gratis en cualquier proyecto.',
    condicion: 'La fuente no se vende sola y sus versiones modificadas cambian de nombre.',
    texto: 'https://openfontlicense.org/open-font-license-official-text/',
    spdx: 'https://spdx.org/licenses/OFL-1.1.html',
  },
};

/** Enlaces de un paquete publicado en npm. */
const npm = (paquete) => `https://www.npmjs.com/package/${paquete}`;

/**
 * Tecnologías del proyecto: nombre, versión instalada, licencia, para qué se
 * usa, color de marca, icono y enlaces originales (sitio, repositorio, npm).
 */
export const TECNOLOGIAS = [
  // ---- Plataforma ----
  { grupo: 'Plataforma', nombre: 'Node.js', version: '22', licencia: 'MIT', uso: 'Entorno donde corre la API y las herramientas', color: '#5FA04E', icono: SiNodedotjs, sitio: 'https://nodejs.org', repo: 'https://github.com/nodejs/node' },
  { grupo: 'Plataforma', nombre: 'PostgreSQL', version: '18', licencia: 'PostgreSQL', uso: 'Base de datos (local, pruebas y producción)', color: '#336791', icono: SiPostgresql, sitio: 'https://www.postgresql.org', repo: 'https://git.postgresql.org/gitweb/?p=postgresql.git' },
  { grupo: 'Plataforma', nombre: 'Plus Jakarta Sans', version: 'Google Fonts', licencia: 'OFL-1.1', uso: 'Tipografía del texto', color: '#4285F4', icono: SiGooglefonts, sitio: 'https://fonts.google.com/specimen/Plus+Jakarta+Sans', repo: 'https://github.com/tokotype/PlusJakartaSans' },
  { grupo: 'Plataforma', nombre: 'Archivo', version: 'Google Fonts', licencia: 'OFL-1.1', uso: 'Tipografía de los títulos', color: '#4285F4', icono: SiGooglefonts, sitio: 'https://fonts.google.com/specimen/Archivo', repo: 'https://github.com/Omnibus-Type/Archivo' },

  // ---- Frontend ----
  { grupo: 'Frontend', nombre: 'React', paquete: 'react', version: '19.2.8', licencia: 'MIT', uso: 'Interfaz de la aplicación', color: '#61DAFB', icono: SiReact, sitio: 'https://react.dev', repo: 'https://github.com/facebook/react' },
  { grupo: 'Frontend', nombre: 'React DOM', paquete: 'react-dom', version: '19.2.8', licencia: 'MIT', uso: 'Dibuja React en el navegador', color: '#61DAFB', icono: SiReact, sitio: 'https://react.dev', repo: 'https://github.com/facebook/react' },
  { grupo: 'Frontend', nombre: 'React Router', paquete: 'react-router-dom', version: '7.18.3', licencia: 'MIT', uso: 'Navegación entre pantallas', color: '#CA4245', icono: SiReactrouter, sitio: 'https://reactrouter.com', repo: 'https://github.com/remix-run/react-router' },
  { grupo: 'Frontend', nombre: 'Recharts', paquete: 'recharts', version: '3.10.1', licencia: 'MIT', uso: 'Gráficas del tablero', color: '#22B5BF', icono: ChartColumn, sitio: 'https://recharts.org', repo: 'https://github.com/recharts/recharts' },
  { grupo: 'Frontend', nombre: 'Lucide', paquete: 'lucide-react', version: '1.39.0', licencia: 'ISC', uso: 'Iconos de la interfaz', color: '#F56565', icono: SiLucide, sitio: 'https://lucide.dev', repo: 'https://github.com/lucide-icons/lucide' },
  { grupo: 'Frontend', nombre: 'React Icons', paquete: 'react-icons', version: '5.7.0', licencia: 'MIT', uso: 'Logos de marcas (WhatsApp, redes, tecnologías)', color: '#E91E63', icono: SiReact, sitio: 'https://react-icons.github.io/react-icons', repo: 'https://github.com/react-icons/react-icons' },
  { grupo: 'Frontend', nombre: 'Three.js', paquete: 'three', version: '0.186.1', licencia: 'MIT', uso: 'Llanta 3D de la página de inicio', color: '#049EF4', icono: SiThreedotjs, sitio: 'https://threejs.org', repo: 'https://github.com/mrdoob/three.js' },
  { grupo: 'Frontend', nombre: 'React Three Fiber', paquete: '@react-three/fiber', version: '9.8.1', licencia: 'MIT', uso: 'Three.js dentro de React', color: '#049EF4', icono: SiThreedotjs, sitio: 'https://r3f.docs.pmnd.rs', repo: 'https://github.com/pmndrs/react-three-fiber' },
  { grupo: 'Frontend', nombre: 'Drei', paquete: '@react-three/drei', version: '10.7.9', licencia: 'MIT', uso: 'Ayudas para la escena 3D', color: '#049EF4', icono: SiThreedotjs, sitio: 'https://drei.docs.pmnd.rs', repo: 'https://github.com/pmndrs/drei' },
  { grupo: 'Frontend', nombre: 'dnd kit (core, sortable, utilities)', paquete: '@dnd-kit/core', version: '6.3.1 · 10.0.0 · 3.2.2', licencia: 'MIT', uso: 'Arrastrar y ordenar elementos', color: '#6366F1', icono: Hand, sitio: 'https://dndkit.com', repo: 'https://github.com/clauderic/dnd-kit' },
  { grupo: 'Frontend', nombre: 'jsPDF', paquete: 'jspdf', version: '4.2.1', licencia: 'MIT', uso: 'Documentos PDF en el navegador', color: '#E2231A', icono: FileText, sitio: 'https://parall.ax/products/jspdf', repo: 'https://github.com/parallax/jsPDF' },
  { grupo: 'Frontend', nombre: 'jsPDF-AutoTable', paquete: 'jspdf-autotable', version: '5.0.8', licencia: 'MIT', uso: 'Tablas dentro de los PDF', color: '#E2231A', icono: FileText, sitio: 'https://simonbengtsson.github.io/jsPDF-AutoTable', repo: 'https://github.com/simonbengtsson/jsPDF-AutoTable' },
  { grupo: 'Frontend', nombre: 'node-qrcode', paquete: 'qrcode', version: '1.5.4', licencia: 'MIT', uso: 'Códigos QR (verificación en dos pasos)', color: '#111827', icono: QrCode, sitio: 'https://github.com/soldair/node-qrcode', repo: 'https://github.com/soldair/node-qrcode' },
  { grupo: 'Frontend', nombre: 'fflate', paquete: 'fflate', version: '0.8.3', licencia: 'MIT', uso: 'Compresión de archivos exportados', color: '#F59E0B', icono: Package, sitio: 'https://101arrowz.github.io/fflate', repo: 'https://github.com/101arrowz/fflate' },

  // ---- Backend ----
  { grupo: 'Backend', nombre: 'Express', paquete: 'express', version: '5.3.0', licencia: 'MIT', uso: 'Servidor de la API', color: '#000000', icono: SiExpress, sitio: 'https://expressjs.com', repo: 'https://github.com/expressjs/express' },
  { grupo: 'Backend', nombre: 'node-postgres', paquete: 'pg', version: '8.23.1', licencia: 'MIT', uso: 'Conexión con PostgreSQL', color: '#336791', icono: SiPostgresql, sitio: 'https://node-postgres.com', repo: 'https://github.com/brianc/node-postgres' },
  { grupo: 'Backend', nombre: 'Zod', paquete: 'zod', version: '4.6.7', licencia: 'MIT', uso: 'Validación de los datos que llegan a la API', color: '#3E67B1', icono: SiZod, sitio: 'https://zod.dev', repo: 'https://github.com/colinhacks/zod' },
  { grupo: 'Backend', nombre: 'jsonwebtoken', paquete: 'jsonwebtoken', version: '9.0.3', licencia: 'MIT', uso: 'Sesiones con tokens JWT', color: '#D63AFF', icono: SiJsonwebtokens, sitio: 'https://jwt.io', repo: 'https://github.com/auth0/node-jsonwebtoken' },
  { grupo: 'Backend', nombre: 'bcrypt.js', paquete: 'bcryptjs', version: '3.0.3', licencia: 'BSD-3-Clause', uso: 'Cifrado de contraseñas (API y scripts)', color: '#AB2B28', icono: KeyRound, sitio: 'https://github.com/dcodeIO/bcrypt.js', repo: 'https://github.com/dcodeIO/bcrypt.js' },
  { grupo: 'Backend', nombre: 'Helmet', paquete: 'helmet', version: '8.3.0', licencia: 'MIT', uso: 'Cabeceras de seguridad HTTP', color: '#0F172A', icono: Shield, sitio: 'https://helmetjs.github.io', repo: 'https://github.com/helmetjs/helmet' },
  { grupo: 'Backend', nombre: 'CORS', paquete: 'cors', version: '2.8.6', licencia: 'MIT', uso: 'Orígenes autorizados a llamar la API', color: '#000000', icono: SiExpress, sitio: 'https://github.com/expressjs/cors', repo: 'https://github.com/expressjs/cors' },
  { grupo: 'Backend', nombre: 'compression', paquete: 'compression', version: '1.8.2', licencia: 'MIT', uso: 'Respuestas comprimidas', color: '#000000', icono: SiExpress, sitio: 'https://github.com/expressjs/compression', repo: 'https://github.com/expressjs/compression' },
  { grupo: 'Backend', nombre: 'express-rate-limit', paquete: 'express-rate-limit', version: '8.7.1', licencia: 'MIT', uso: 'Límite de peticiones por usuario', color: '#000000', icono: Gauge, sitio: 'https://express-rate-limit.mintlify.app', repo: 'https://github.com/express-rate-limit/express-rate-limit' },
  { grupo: 'Backend', nombre: 'PDFKit', paquete: 'pdfkit', version: '0.20.2', licencia: 'MIT', uso: 'Cotizaciones y comprobantes en PDF', color: '#1F6FEB', icono: ScrollText, sitio: 'https://pdfkit.org', repo: 'https://github.com/foliojs/pdfkit' },
  { grupo: 'Backend', nombre: 'Cloudinary SDK', paquete: 'cloudinary', version: '2.11.0', licencia: 'MIT', uso: 'Subida de imágenes', color: '#3448C5', icono: SiCloudinary, sitio: 'https://cloudinary.com', repo: 'https://github.com/cloudinary/cloudinary_npm' },

  // ---- Desarrollo (no viajan al usuario) ----
  { grupo: 'Desarrollo', nombre: 'Vite', paquete: 'vite', version: '8.2.2', licencia: 'MIT', uso: 'Servidor de desarrollo y compilación', color: '#646CFF', icono: SiVite, sitio: 'https://vite.dev', repo: 'https://github.com/vitejs/vite' },
  { grupo: 'Desarrollo', nombre: '@vitejs/plugin-react', paquete: '@vitejs/plugin-react', version: '6.1.1', licencia: 'MIT', uso: 'React dentro de Vite', color: '#646CFF', icono: SiVite, sitio: 'https://github.com/vitejs/vite-plugin-react', repo: 'https://github.com/vitejs/vite-plugin-react' },
  { grupo: 'Desarrollo', nombre: 'Tailwind CSS', paquete: 'tailwindcss', version: '3.4.19', licencia: 'MIT', uso: 'Estilos de la interfaz', color: '#06B6D4', icono: SiTailwindcss, sitio: 'https://tailwindcss.com', repo: 'https://github.com/tailwindlabs/tailwindcss' },
  { grupo: 'Desarrollo', nombre: 'PostCSS', paquete: 'postcss', version: '8.5.26', licencia: 'MIT', uso: 'Procesa el CSS', color: '#DD3A0A', icono: SiPostcss, sitio: 'https://postcss.org', repo: 'https://github.com/postcss/postcss' },
  { grupo: 'Desarrollo', nombre: 'Autoprefixer', paquete: 'autoprefixer', version: '10.5.4', licencia: 'MIT', uso: 'Compatibilidad del CSS entre navegadores', color: '#DD3735', icono: SiAutoprefixer, sitio: 'https://github.com/postcss/autoprefixer', repo: 'https://github.com/postcss/autoprefixer' },
  { grupo: 'Desarrollo', nombre: 'Oxlint', paquete: 'oxlint', version: '1.81.0', licencia: 'MIT', uso: 'Revisión del código', color: '#2D9CDB', icono: SiOxc, sitio: 'https://oxc.rs', repo: 'https://github.com/oxc-project/oxc' },
  { grupo: 'Desarrollo', nombre: 'Tipos de React', paquete: '@types/react', version: '19.2.18 · 19.2.5', licencia: 'MIT', uso: 'Ayudas del editor (@types/react y react-dom)', color: '#3178C6', icono: SiTypescript, sitio: 'https://github.com/DefinitelyTyped/DefinitelyTyped', repo: 'https://github.com/DefinitelyTyped/DefinitelyTyped' },
  { grupo: 'Desarrollo', nombre: 'embedded-postgres', paquete: 'embedded-postgres', version: '18.4.0-beta.17', licencia: 'MIT', uso: 'PostgreSQL local y para las pruebas', color: '#336791', icono: SiPostgresql, sitio: 'https://github.com/leinelissen/embedded-postgres', repo: 'https://github.com/leinelissen/embedded-postgres' },
].map((t) => ({ ...t, npm: t.paquete ? npm(t.paquete) : null }));

/** Grupos en el orden en que se muestran. */
export const GRUPOS = ['Plataforma', 'Frontend', 'Backend', 'Desarrollo'];

/**
 * Lo que se instala por debajo (dependencias de las dependencias), contado
 * desde los package-lock.json de cada carpeta.
 */
export const INTERNAS = [
  { carpeta: 'frontend', total: 305, detalle: 'MIT 245 · ISC 29 · MPL-2.0 12 · Apache-2.0 9 · BSD-3-Clause 3 · otras 7' },
  { carpeta: 'backend', total: 139, detalle: 'MIT 125 · ISC 7 · BSD-3-Clause 3 · Apache-2.0 2 · 0BSD 1 · sin dato 1' },
  { carpeta: 'database', total: 25, detalle: 'MIT 22 · ISC 2 · BSD-3-Clause 1' },
];

/** Casos que vale la pena explicar entre las dependencias internas. */
export const CASOS = [
  { nombre: 'lightningcss', licencia: 'MPL-2.0', nota: 'La usa Vite para procesar el CSS y solo corre al compilar.', enlace: npm('lightningcss') },
  { nombre: 'dompurify', licencia: 'MPL-2.0 o Apache-2.0', nota: 'Doble licencia, a elección.', enlace: npm('dompurify') },
  { nombre: 'pako', licencia: 'MIT y Zlib', nota: 'Compresión usada por jsPDF.', enlace: npm('pako') },
  { nombre: 'victory-vendor', licencia: 'MIT e ISC', nota: 'Dependencia de Recharts.', enlace: npm('victory-vendor') },
  { nombre: 'rgbcolor', licencia: 'MIT (con archivo propio)', nota: 'Dependencia de jsPDF.', enlace: npm('rgbcolor') },
  { nombre: 'webgl-constants', licencia: 'Sin dato en su ficha', nota: 'Revisar su repositorio si se necesita el dato exacto.', enlace: npm('webgl-constants') },
  { nombre: 'png-js', licencia: 'Sin dato en su ficha', nota: 'Dependencia de PDFKit; revisar su repositorio.', enlace: npm('png-js') },
];

/** Servicios externos: no son software licenciado, se rigen por sus términos. */
export const SERVICIOS = [
  { nombre: 'Cloudinary', uso: 'Imágenes', color: '#3448C5', icono: SiCloudinary, terminos: 'https://cloudinary.com/tos' },
  { nombre: 'Brevo', uso: 'Correo', color: '#0B996E', icono: SiBrevo, terminos: 'https://www.brevo.com/legal/termsofuse/' },
  { nombre: 'Cloudflare Turnstile', uso: 'Captcha', color: '#F38020', icono: SiCloudflare, terminos: 'https://www.cloudflare.com/website-terms/' },
  { nombre: 'Google Identity', uso: 'Inicio de sesión con Google', color: '#4285F4', icono: SiGoogle, terminos: 'https://developers.google.com/terms' },
  { nombre: 'Vercel', uso: 'Publica el frontend', color: '#000000', icono: SiVercel, terminos: 'https://vercel.com/legal/terms' },
  { nombre: 'Render', uso: 'Publica la API', color: '#46E3B7', icono: SiRender, terminos: 'https://render.com/terms' },
  { nombre: 'Supabase', uso: 'Base de datos en producción', color: '#3ECF8E', icono: SiSupabase, terminos: 'https://supabase.com/terms' },
];

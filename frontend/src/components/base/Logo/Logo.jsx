import logoOficial from '../../../assets/logo-mirallantas.png';

/**
 * Logo oficial de Mirallantas (imagen con fondo amarillo) más el nombre.
 *
 * La imagen se muestra completa, sin recortes ni cambios de color: solo se
 * escala y se enmarca con un borde fino para que conviva con el vidrio.
 *
 * `tono="oscuro"` se usa sobre superficies que son oscuras en ambos modos
 * (sidebar, panel de marca del login, pantalla de carga).
 */
const SIZES = {
  sm: { img: 'h-9 w-9 rounded-[10px]', text: 'text-[15px]' },
  md: { img: 'h-11 w-11 rounded-xl', text: 'text-lg' },
  lg: { img: 'h-16 w-16 rounded-2xl', text: 'text-2xl' },
};

export default function Logo({ size = 'md', suffix = '', tono = 'auto', className = '' }) {
  const s = SIZES[size] ?? SIZES.md;
  const nombre = tono === 'oscuro' ? 'text-white' : 'text-slate-900 dark:text-white';
  const sufijo = tono === 'oscuro' ? 'text-amber-400' : 'text-amber-600 dark:text-amber-400';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src={logoOficial}
        alt="Logo de Mirallantas"
        width="256"
        height="262"
        className={`ml-logo shrink-0 bg-[#F0AC25] object-contain ${s.img}`}
      />
      <span className={`font-display font-extrabold tracking-tight ${nombre} ${s.text}`}>
        MiraLlantas
        {suffix && <span className={`font-semibold ${sufijo}`}> {suffix}</span>}
      </span>
    </div>
  );
}

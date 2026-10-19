/**
 * Ilustración vectorial de una llanta de camión.
 *
 * Se dibuja con SVG en vez de usar una foto: el prototipo no tiene assets
 * reales y así la imagen escala, respeta la paleta de la marca y no
 * depende de ningún archivo externo.
 *
 * variant: 'front' (de frente, se ve el rin) | 'side' (de perfil, se ve la banda)
 */
export default function TruckTire({ variant = 'front', className = '', accent = '#FBBF24' }) {
  if (variant === 'side') {
    return (
      <svg viewBox="0 0 240 160" className={className} role="img" aria-label="Llanta de camión">
        <defs>
          <linearGradient id="tt-side-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3A4150" />
            <stop offset="55%" stopColor="#20252F" />
            <stop offset="100%" stopColor="#0E1116" />
          </linearGradient>
        </defs>

        {/* Cuerpo de la llanta vista de perfil */}
        <rect x="18" y="34" width="204" height="92" rx="26" fill="url(#tt-side-body)" />
        <rect x="18" y="34" width="204" height="92" rx="26" fill="none" stroke="#4A5364" strokeWidth="1.5" />

        {/* Bloques de la banda de rodamiento */}
        {Array.from({ length: 9 }, (_, i) => (
          <g key={i} opacity="0.55">
            <rect x={30 + i * 21} y="40" width="12" height="18" rx="3" fill="#5A6577" />
            <rect x={30 + i * 21} y="102" width="12" height="18" rx="3" fill="#5A6577" />
          </g>
        ))}

        {/* Canal central */}
        <rect x="24" y="74" width="192" height="12" rx="6" fill="#0B0E13" opacity="0.8" />
        <rect x="24" y="78" width="192" height="4" rx="2" fill={accent} opacity="0.55" />

        {/* Flanco con el nombre grabado */}
        <text
          x="120"
          y="70"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          letterSpacing="3"
          fill={accent}
          opacity="0.75"
        >
          MIRALLANTAS
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Llanta de camión">
      <defs>
        <radialGradient id="tt-rubber" cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#414A5A" />
          <stop offset="60%" stopColor="#1C212B" />
          <stop offset="100%" stopColor="#0B0E13" />
        </radialGradient>
        <linearGradient id="tt-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F1F5F9" />
          <stop offset="50%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
      </defs>

      {/* Caucho */}
      <circle cx="100" cy="100" r="94" fill="url(#tt-rubber)" />
      <circle cx="100" cy="100" r="94" fill="none" stroke="#4A5364" strokeWidth="1.5" opacity="0.6" />

      {/* Tacos de la banda de rodamiento */}
      {Array.from({ length: 28 }, (_, i) => (
        <rect
          key={i}
          x="97.5"
          y="6"
          width="5"
          height="15"
          rx="2"
          fill="#5A6577"
          opacity="0.5"
          transform={`rotate(${(360 / 28) * i} 100 100)`}
        />
      ))}

      {/* Flanco */}
      <circle cx="100" cy="100" r="74" fill="#141922" />
      <circle cx="100" cy="100" r="74" fill="none" stroke={accent} strokeWidth="1" opacity="0.28" />

      {/* Rin */}
      <circle cx="100" cy="100" r="56" fill="url(#tt-rim)" />
      <circle cx="100" cy="100" r="56" fill="none" stroke="#334155" strokeWidth="2" />

      {/* Agujeros de los pernos */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = ((360 / 8) * i * Math.PI) / 180;
        return (
          <circle
            key={i}
            cx={100 + Math.cos(angle) * 36}
            cy={100 + Math.sin(angle) * 36}
            r="7"
            fill="#1E293B"
          />
        );
      })}

      {/* Cubo central */}
      <circle cx="100" cy="100" r="20" fill="#0F172A" />
      <circle cx="100" cy="100" r="20" fill="none" stroke={accent} strokeWidth="2.5" />
      <text
        x="100"
        y="105"
        textAnchor="middle"
        fontSize="13"
        fontWeight="800"
        letterSpacing="0.5"
        fill={accent}
      >
        ML
      </text>
    </svg>
  );
}

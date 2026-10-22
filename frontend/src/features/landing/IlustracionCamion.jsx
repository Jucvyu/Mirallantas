/**
 * Camión de carga en carretera al atardecer, dibujado en SVG con la paleta
 * de la marca. Es el respaldo del hero mientras no haya una fotografía real
 * (ver Hero.jsx): no pesa nada y se adapta a cualquier ancho.
 *
 * `claro`: paleta de día (cielo azul pastel, carretera clara y remolque
 * blanco) para el modo claro; sin él, el atardecer azul marino.
 */
const PALETAS = {
  oscuro: {
    cielo: ['#0B1B33', '#1C3A66', '#5C6F86'],
    via: ['#233247', '#0B1B33'],
    remolque: ['#5E7491', '#2B4366', '#13284A'],
    montana: ['#14264A', '#0F1F3B'],
    surco: '#FFFFFF',
  },
  claro: {
    cielo: ['#CFE4FB', '#E6F1FD', '#F8EFD8'],
    via: ['#9FB1C6', '#7A8EA6'],
    remolque: ['#FFFFFF', '#E3EAF3', '#B7C6D8'],
    montana: ['#AFC6E2', '#9BB4D3'],
    surco: '#17375E',
  },
};

export default function IlustracionCamion({ className = '', claro = false }) {
  const p = claro ? PALETAS.claro : PALETAS.oscuro;
  return (
    <svg
      viewBox="0 0 1200 620"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      role="img"
      aria-label="Camión de carga en carretera al atardecer"
    >
      <defs>
        <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.cielo[0]} />
          <stop offset="0.55" stopColor={p.cielo[1]} />
          <stop offset="1" stopColor={p.cielo[2]} />
        </linearGradient>
        <radialGradient id="sol" cx="0.86" cy="0.52" r="0.38">
          <stop offset="0" stopColor="#FFE7A1" stopOpacity="0.95" />
          <stop offset="0.25" stopColor="#FFC81E" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFC81E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="via" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.via[0]} />
          <stop offset="1" stopColor={p.via[1]} />
        </linearGradient>
        <linearGradient id="remolque" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.remolque[0]} />
          <stop offset="0.45" stopColor={p.remolque[1]} />
          <stop offset="1" stopColor={p.remolque[2]} />
        </linearGradient>
        <linearGradient id="cabina" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#24477D" />
          <stop offset="1" stopColor="#0E2140" />
        </linearGradient>
        <linearGradient id="vidrio" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9CC4F2" stopOpacity="0.9" />
          <stop offset="1" stopColor="#24456F" stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id="farol" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFF4CC" />
          <stop offset="0.4" stopColor="#FFC81E" stopOpacity="0.7" />
          <stop offset="1" stopColor="#FFC81E" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="rin" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#C9D4E2" />
          <stop offset="0.55" stopColor="#5D6B7E" />
          <stop offset="1" stopColor="#1B2533" />
        </radialGradient>
      </defs>

      {/* Cielo, sol y montañas */}
      <rect width="1200" height="620" fill="url(#cielo)" />
      <rect width="1200" height="620" fill="url(#sol)" />
      <path d="M0 400 L130 330 L240 372 L380 300 L520 360 L640 318 L780 372 L900 330 L1040 378 L1200 340 L1200 430 L0 430 Z" fill={p.montana[0]} opacity="0.9" />
      <path d="M0 425 L160 385 L300 410 L470 372 L640 410 L820 380 L1000 412 L1200 392 L1200 450 L0 450 Z" fill={p.montana[1]} />

      {/* Carretera */}
      <path d="M0 450 L1200 430 L1200 620 L0 620 Z" fill="url(#via)" />
      <path d="M0 540 L1200 498" stroke="#FFC81E" strokeOpacity="0.55" strokeWidth="5" strokeDasharray="70 55" />
      <path d="M0 610 L1200 560" stroke="#FFFFFF" strokeOpacity="0.12" strokeWidth="3" />

      {/* Camión (de frente hacia la izquierda) */}
      {/* En la mitad derecha, para que el texto del hero no lo tape */}
      <g transform="translate(560 122) scale(0.75)">
        {/* sombra */}
        <ellipse cx="420" cy="512" rx="420" ry="16" fill="#000" opacity="0.35" />

        {/* remolque */}
        <rect x="300" y="250" width="540" height="200" rx="8" fill="url(#remolque)" />
        <rect x="300" y="250" width="540" height="12" rx="6" fill="#FFFFFF" opacity="0.22" />
        <path d="M318 300 H822 M318 345 H822 M318 390 H822" stroke={p.surco} strokeOpacity="0.12" strokeWidth="3" />
        <rect x="300" y="440" width="540" height="16" fill="#0B1B33" />

        {/* chasis */}
        <rect x="40" y="440" width="290" height="22" rx="4" fill="#0B1B33" />

        {/* cabina */}
        <path d="M120 300 Q124 262 158 256 L250 252 Q284 252 290 286 L296 446 L120 446 Z" fill="url(#cabina)" />
        {/* capó y frente */}
        <path d="M40 360 Q42 336 70 332 L124 330 L124 446 L40 446 Z" fill="url(#cabina)" />
        <rect x="44" y="370" width="38" height="58" rx="5" fill="#0A1426" />
        <path d="M50 380 H76 M50 392 H76 M50 404 H76 M50 416 H76" stroke="#9AA8BC" strokeOpacity="0.6" strokeWidth="2.5" />
        {/* parabrisas y ventana */}
        <path d="M134 300 Q138 274 162 270 L206 268 L206 330 L132 330 Z" fill="url(#vidrio)" />
        <rect x="216" y="270" width="60" height="58" rx="6" fill="url(#vidrio)" opacity="0.85" />
        {/* exosto y espejo */}
        <rect x="282" y="196" width="10" height="120" rx="4" fill="#9AA8BC" />
        <rect x="112" y="288" width="8" height="34" rx="3" fill="#0A1426" />
        {/* farol encendido */}
        <circle cx="46" cy="352" r="34" fill="url(#farol)" />
        <rect x="40" y="346" width="16" height="10" rx="3" fill="#FFF4CC" />
        {/* defensa */}
        <rect x="32" y="440" width="96" height="16" rx="5" fill="#AEB9C8" />
        {/* línea amarilla de marca */}
        <rect x="124" y="410" width="170" height="6" rx="3" fill="#FFC81E" />

        {/* ruedas */}
        {[100, 240, 560, 640, 760].map((x) => (
          <g key={x}>
            <circle cx={x} cy="478" r="38" fill="#0A0F18" />
            <circle cx={x} cy="478" r="20" fill="url(#rin)" />
            <circle cx={x} cy="478" r="5" fill="#1B2533" />
          </g>
        ))}
      </g>
    </svg>
  );
}

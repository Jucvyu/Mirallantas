/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          // Navy — fondo principal en modo oscuro
          navy: {
            DEFAULT: '#12161C',
            50: '#F3F4F6',
            100: '#E3E5E9',
            200: '#C6CAD1',
            700: '#1B2230',
            800: '#161B24',
            900: '#12161C',
            950: '#0B0E13',
          },
          // Dorado — acento de marca (aros, iconos de contacto, enlace activo)
          gold: {
            300: '#E4D3A6',
            400: '#D9C08C',
            500: '#C9A876',
            600: '#B08D52',
            700: '#8A6D3C',
          },
          // Colores exactos de marca para redes sociales
          whatsapp: '#00D492',
          facebook: '#2196F3',
          instagram: '#EC4899',
          // Ámbar vivo — acento principal de la app (botones, links activos, KPIs)
          amber: {
            300: '#FCD34D',
            400: '#FBBF24',
            500: '#F5B914',
            600: '#D69E0A',
          },
        },
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */

// -------------------------------------------------------------------------
// Identidad cromática de Comercializadora Mirallantas
//
//   Azul industrial   #17375E  profundidad y solidez (superficies oscuras)
//   Amarillo marca    #F4C400  acciones principales, indicadores y detalles
//   Carbón            #24282D  texto sobre amarillo y titulares en claro
//   Blanco            #FFFFFF  contenidos comerciales
//
// La escala `amber` se redefine con el amarillo de marca: así todos los
// botones, enlaces activos e indicadores que ya usan `amber-*` adoptan el
// tono oficial sin tocar su lógica. Igual con `brand.navy`, que pasa del
// gris casi negro anterior a un azul medianoche derivado del azul industrial.
// -------------------------------------------------------------------------
const amarillo = {
  50: '#FFFBE6',
  100: '#FFF4BF',
  200: '#FFE680',
  300: '#FFD83D',
  400: '#F4C400',
  500: '#DDB000',
  600: '#A68500',
  700: '#7A6200',
  800: '#574600',
  900: '#3A2F00',
};

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        // Titulares: grotesca industrial de ancho ampliado
        display: ['Archivo', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        amber: amarillo,
        slate: {
          // Carbón de marca para el texto más oscuro y el texto sobre amarillo
          900: '#24282D',
        },
        brand: {
          blue: '#17375E',
          yellow: '#F4C400',
          carbon: '#24282D',
          // Navy — azul medianoche, fondo principal en modo oscuro
          navy: {
            DEFAULT: '#081426',
            50: '#F3F6FA',
            100: '#E2E8F1',
            200: '#C3CFDF',
            700: '#17375E',
            800: '#0E2140',
            900: '#081426',
            950: '#050D1A',
          },
          // Antes dorado: ahora tonos del amarillo de marca
          gold: {
            300: amarillo[300],
            400: amarillo[400],
            500: amarillo[500],
            600: amarillo[600],
            700: amarillo[700],
          },
          // Colores exactos de marca para redes sociales
          whatsapp: '#00D492',
          facebook: '#2196F3',
          instagram: '#EC4899',
          amber: {
            300: amarillo[300],
            400: amarillo[400],
            500: amarillo[500],
            600: amarillo[500],
          },
        },
      },
    },
  },
  plugins: [],
}

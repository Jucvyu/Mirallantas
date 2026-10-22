/**
 * Colores de MarcaCristal por tema. El canvas es transparente (se ve el fondo
 * real de la página); estos tonos son los que el vidrio refracta y su tinte,
 * imitando el fondo de la web: azul medianoche en oscuro, gris claro en claro.
 */
export const TEMAS = {
  oscuro: {
    base: '#050D1A', // brand-navy-950
    mancha: '#17375E', // azul industrial (como .ml-ambiente)
    luz: '#8DB4E2',
    amarillo: '#F4C400',
    vidrio: '#FFFFFF',
    tinte: '#E6F0FF',
    distanciaTinte: 1.6,
    transmision: 0.9, // algo de blanco propio: sobre fondo oscuro el vidrio se ve lechoso
  },
  claro: {
    base: '#F8FAFC', // slate-50
    mancha: '#C9D7EA',
    luz: '#FFFFFF',
    amarillo: '#F4C400',
    vidrio: '#EEF4FB',
    tinte: '#6F95C8', // tinte azul de marca: el vidrio se distingue sobre el fondo claro
    distanciaTinte: 1.4,
    transmision: 1,
  },
};

import { useEffect, useRef, useState } from 'react';

/**
 * Aparición sutil al hacer scroll: el bloque sube 16 px y gana opacidad una
 * sola vez, cuando entra en pantalla. Con "menos movimiento" se ve desde el
 * principio, sin animación.
 *
 *   <Revelar retraso={80}>…</Revelar>
 */
export default function Revelar({ as: Elemento = 'div', retraso = 0, className = '', children, ...resto }) {
  const ref = useRef(null);
  // Con "menos movimiento" (o sin IntersectionObserver) se ve desde el principio:
  // el contenido nunca queda oculto
  const [visto, setVisto] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window),
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || visto) return undefined;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisto(true);
          observador.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [visto]);

  return (
    <Elemento
      ref={ref}
      className={`transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        visto ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      } ${className}`}
      style={{ transitionDelay: visto ? `${retraso}ms` : '0ms' }}
      {...resto}
    >
      {children}
    </Elemento>
  );
}

import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import LiquidGlass from '../LiquidGlass';

// La escena (three + @react-three/*) va en su propio chunk: solo se descarga
// cuando la sección se acerca a la pantalla, no en la carga inicial.
const EscenaCristal = lazy(() => import('./EscenaCristal'));

/** true si el navegador puede crear un contexto WebGL. */
function hayWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

/** Sigue una media query y devuelve si coincide. */
function useMediaQuery(query) {
  const [coincide, setCoincide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const alCambiar = () => setCoincide(mq.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, [query]);
  return coincide;
}

/** Si la escena falla (contexto WebGL perdido, chunk que no carga…), muestra el respaldo. */
class LimiteError extends Component {
  state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  render() {
    return this.state.fallo ? this.props.respaldo : this.props.children;
  }
}

/** Versión sin WebGL: una llanta dibujada en SVG sobre vidrio pastel (sigue el tema). */
function LlantaRespaldo({ compacto }) {
  const lado = compacto ? 150 : 230;
  // Tacos de la banda de rodadura, repartidos alrededor del borde
  const tacos = Array.from({ length: 28 }, (_, i) => (i / 28) * 360);
  return (
    <div className="flex h-full items-center justify-center px-4">
      <LiquidGlass as="span" variante="pastel" inclinacion={4} className="rounded-full p-5">
        <svg width={lado} height={lado} viewBox="0 0 100 100" className="text-brand-blue dark:text-white" aria-hidden="true">
          {/* Caucho */}
          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="9" opacity="0.9" />
          {/* Banda de rodadura */}
          {tacos.map((a) => (
            <rect
              key={a}
              x="48.3"
              y="1.5"
              width="3.4"
              height="6"
              rx="0.8"
              fill="currentColor"
              transform={`rotate(${a} 50 50)`}
            />
          ))}
          {/* Rin */}
          <circle cx="50" cy="50" r="22" fill="none" stroke="#F4C400" strokeWidth="6" />
          <circle cx="50" cy="50" r="7" fill="#F4C400" />
          {/* Pernos */}
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx="50" cy="36" r="1.8" fill="#F4C400" transform={`rotate(${a} 50 50)`} />
          ))}
        </svg>
      </LiquidGlass>
    </div>
  );
}

/**
 * Una llanta en 3D girando despacio sobre su eje (vista de 3/4), como
 * elemento de marca del landing.
 * - `velocidad`: radianes por segundo del giro (0.6 ≈ una vuelta cada 10 s).
 * - `compacto`: altura menor.
 *
 * El render se pausa cuando la sección sale de pantalla; con
 * `prefers-reduced-motion` la llanta queda quieta; sin WebGL se ve una
 * llanta en SVG.
 */
export default function MarcaCristal({ velocidad = 0.6, compacto = false }) {
  const ref = useRef(null);
  const [cerca, setCerca] = useState(false); // ya estuvo cerca de la pantalla: monta la escena
  const [visible, setVisible] = useState(false); // está en pantalla ahora: anima
  const [webgl] = useState(hayWebGL);
  const sinMovimiento = useMediaQuery('(prefers-reduced-motion: reduce)');
  const movil = useMediaQuery('(max-width: 767px), (pointer: coarse)');
  const { theme } = useTheme();
  const [lista, setLista] = useState(false); // la palabra ya está dibujada: hace su entrada
  const alEstarLista = useCallback(() => setLista(true), []);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return undefined;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        setVisible(entrada.isIntersecting);
        if (entrada.isIntersecting) setCerca(true);
      },
      { rootMargin: '200px 0px' },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const respaldo = <LlantaRespaldo compacto={compacto} />;
  // Sin fondo propio: el canvas es transparente y se ve el fondo de la página.
  const contenedor = compacto ? 'h-[200px] sm:h-[240px]' : 'h-[300px] sm:h-[400px] lg:h-[460px]';

  return (
    <section ref={ref} aria-label="Llanta" className={`relative overflow-hidden ${contenedor}`}>
      {!webgl ? (
        respaldo
      ) : (
        cerca && (
          <LimiteError respaldo={respaldo}>
            {/* Entrada por CSS (opacidad y escala, fuera del hilo principal):
                así se ve fluida aunque coincida con el montaje de la escena.
                Mientras carga no se muestra el respaldo, para no cambiar de
                un diseño a otro; con movimiento reducido solo hay fundido. */}
            <div
              className="h-full"
              style={{
                opacity: lista ? 1 : 0,
                transform: lista || sinMovimiento ? 'none' : 'scale(0.98)',
                transition: 'opacity 600ms var(--ml-ease-out), transform 600ms var(--ml-ease-out)',
              }}
            >
              <Suspense fallback={null}>
                <EscenaCristal
                  velocidad={velocidad}
                  activa={visible}
                  animar={!sinMovimiento}
                  calidad={movil ? 'baja' : 'alta'}
                  oscuro={theme === 'dark'}
                  onLista={alEstarLista}
                />
              </Suspense>
            </div>
          </LimiteError>
        )
      )}
    </section>
  );
}

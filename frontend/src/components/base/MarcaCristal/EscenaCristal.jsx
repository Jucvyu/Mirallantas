import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { MathUtils } from 'three';
import { TEMAS } from './colores';

/** Radio exterior de la llanta (caucho) y ancho de la banda. */
const RADIO = 1.05;
const TUBO = 0.45;
const ANCHO = 0.64;

/** En móviles se bajan los segmentos y los tacos de la banda para la fluidez. */
const CALIDAD = {
  alta: { dpr: [1, 1.5], tubular: 80, radial: 22, tacos: 48, samples: true },
  baja: { dpr: [1, 1.25], tubular: 48, radial: 12, tacos: 26, samples: false },
};

/** Delta máximo por cuadro: al volver de otra pestaña no hay salto. */
const DELTA_MAX = 1 / 30;

/** Un taco de la banda de rodadura (una pequeña saliente de caucho). */
function tacosDeBanda(cantidad) {
  const radio = RADIO + TUBO - 0.06;
  return Array.from({ length: cantidad }, (_, i) => {
    const angulo = (i / cantidad) * Math.PI * 2;
    return {
      key: i,
      position: [Math.cos(angulo) * radio, Math.sin(angulo) * radio, 0],
      rotation: [0, 0, angulo],
    };
  });
}

/** 5 pernos del rin, repartidos alrededor del centro. */
const PERNOS = Array.from({ length: 5 }, (_, i) => {
  const a = (i / 5) * Math.PI * 2;
  return { key: i, position: [Math.cos(a) * 0.3, Math.sin(a) * 0.3, ANCHO / 2 + 0.02] };
});

/**
 * Llanta en 3D: cuerpo de caucho (toro) con su banda de rodadura y un rin
 * metálico con pernos. Gira despacio sobre su eje, en una vista de 3/4, y se
 * inclina un poco con el mouse. El giro arranca en 0 y acelera en ~1 s.
 */
function Llanta({ velocidad, animar, calidad, oscuro, onLista }) {
  const marco = useRef(null); // sostiene la inclinación (vista de 3/4 + mouse)
  const rueda = useRef(null); // gira sobre su eje
  const giro = useRef(0);
  const viewport = useThree((s) => s.viewport);
  const q = CALIDAD[calidad];
  const t = oscuro ? TEMAS.oscuro : TEMAS.claro;

  const tacos = useMemo(() => tacosDeBanda(q.tacos), [q.tacos]);

  // Encaja la llanta (diámetro ≈ 3.2) en el ancho o el alto disponible.
  const escala = Math.min((viewport.width * 0.62) / 3.2, (viewport.height * 0.7) / 3.2);

  useEffect(() => {
    onLista?.();
  }, [onLista]);

  useFrame((state, delta) => {
    if (!animar) return;
    const dt = Math.min(delta, DELTA_MAX);
    giro.current = MathUtils.damp(giro.current, velocidad, 3, dt);
    if (rueda.current) rueda.current.rotation.z -= dt * giro.current;
    if (marco.current) {
      marco.current.rotation.x = MathUtils.damp(marco.current.rotation.x, -0.5 - state.pointer.y * 0.15, 4, dt);
      marco.current.rotation.y = MathUtils.damp(marco.current.rotation.y, -0.45 + state.pointer.x * 0.15, 4, dt);
    }
  });

  // Caucho: oscuro y mate; en tema claro un poco más claro para que resalte.
  const caucho = oscuro ? '#23262d' : '#2c3039';
  const rin = { color: '#c9ced8', metalness: 0.95, roughness: 0.28 };

  return (
    <group ref={marco} scale={escala} rotation={[-0.5, -0.45, 0]}>
      <group ref={rueda}>
        {/* Cuerpo de caucho */}
        <mesh castShadow>
          <torusGeometry args={[RADIO, TUBO, q.radial, q.tubular]} />
          <meshStandardMaterial color={caucho} roughness={0.75} metalness={0.05} />
        </mesh>

        {/* Banda de rodadura: tacos alrededor del exterior */}
        {tacos.map((taco) => (
          <mesh key={taco.key} position={taco.position} rotation={taco.rotation}>
            <boxGeometry args={[0.16, 0.14, ANCHO + 0.04]} />
            <meshStandardMaterial color={caucho} roughness={0.85} metalness={0.05} />
          </mesh>
        ))}

        {/* Rin metálico que llena el centro */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.66, 0.66, ANCHO, 40]} />
          <meshStandardMaterial {...rin} />
        </mesh>

        {/* Cara del rin, con su acento de marca */}
        <mesh position={[0, 0, ANCHO / 2]}>
          <circleGeometry args={[0.66, 40]} />
          <meshStandardMaterial color={t.amarillo} metalness={0.9} roughness={0.35} />
        </mesh>

        {/* Centro (buje) y pernos */}
        <mesh position={[0, 0, ANCHO / 2 + 0.01]}>
          <circleGeometry args={[0.2, 24]} />
          <meshStandardMaterial {...rin} />
        </mesh>
        {PERNOS.map((p) => (
          <mesh key={p.key} position={p.position} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.06, 10]} />
            <meshStandardMaterial {...rin} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * Escena WebGL de MarcaCristal: una llanta en 3D. Se carga con React.lazy
 * (todo three.js queda en este chunk). Al desmontarse, @react-three/fiber
 * libera el renderer y los buffers.
 */
export default function EscenaCristal({ velocidad, activa, animar, calidad, oscuro, onLista }) {
  const q = CALIDAD[calidad];
  // Fuera de pantalla no se dibuja; sin animación solo cuando algo cambia.
  const frameloop = !activa ? 'never' : animar ? 'always' : 'demand';

  return (
    <Canvas
      dpr={q.dpr}
      frameloop={frameloop}
      camera={{ position: [0, 0, 24], fov: 15 }}
      gl={{ alpha: true, antialias: q.samples, powerPreference: 'high-performance' }}
      style={{ touchAction: 'pan-y' }}
      aria-hidden="true"
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 8]} intensity={1.4} />
      <directionalLight position={[-6, -2, 4]} intensity={0.5} />
      <Llanta velocidad={velocidad} animar={animar} calidad={calidad} oscuro={oscuro} onLista={onLista} />

      {/* Luces "de estudio" locales (sin descargar HDR): reflejos en el rin */}
      <Environment resolution={256}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer form="circle" intensity={7} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={2} />
          <Lightformer form="rect" intensity={6} rotation-y={Math.PI / 2} position={[-8, -1, -1]} scale={[10, 2, 1]} />
          <Lightformer form="rect" intensity={6} rotation-y={-Math.PI / 2} position={[8, 0, 0]} scale={[10, 2, 1]} />
          <Lightformer form="rect" intensity={3} position={[0, 0, 12]} scale={[14, 1.5, 1]} />
          <Lightformer
            form="ring"
            color={TEMAS.oscuro.amarillo}
            intensity={3}
            rotation-y={-Math.PI / 2}
            position={[10, 1, 0]}
            scale={5}
          />
        </group>
      </Environment>
    </Canvas>
  );
}

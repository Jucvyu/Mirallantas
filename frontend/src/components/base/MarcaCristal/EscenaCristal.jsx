import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Environment, Lightformer, MeshTransmissionMaterial } from '@react-three/drei';
import { CanvasTexture, FileLoader, MathUtils, SRGBColorSpace } from 'three';
import { TEMAS } from './colores';
import { geometriaManuscrita, leerFuenteSVG } from './manuscrita';

// Fuente manuscrita de trazo único (EMS Allure, derivada de Allura; licencia OFL en la misma carpeta).
const FUENTE = '/fonts/EMSAllure.svg';

/** Grosor del tubo, en em (proporción de la altura de la letra). */
const RADIO_TUBO = 0.05;

/** En móviles se baja la resolución del vidrio y de los tubos para mantener la fluidez. */
const CALIDAD = {
  alta: { dpr: [1, 1.5], samples: 10, resolution: 512, backside: true, radial: 12, densidad: 80 },
  baja: { dpr: [1, 1.25], samples: 5, resolution: 256, backside: false, radial: 8, densidad: 60 },
};

/**
 * Textura que el vidrio refracta. El canvas es transparente (se ve el fondo
 * real de la página), así que esta textura solo imita ese fondo con los
 * tonos del tema para que el esmerilado tenga algo que difuminar.
 */
function useTexturaFondo(t) {
  const textura = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = t.base;
    ctx.fillRect(0, 0, 1024, 512);

    // Mancha radial; `achatado` > 1 la estira a lo ancho.
    const halo = (x, y, radio, color, alfa, achatado = 1) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(achatado, 1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radio);
      g.addColorStop(0, color);
      g.addColorStop(1, `${color}00`); // el mismo color sin opacidad: 'transparent' oscurece el borde
      ctx.globalAlpha = alfa;
      ctx.fillStyle = g;
      ctx.fillRect(-radio, -radio, radio * 2, radio * 2);
      ctx.restore();
    };
    halo(120, 40, 520, t.mancha, 0.9, 1.4); // luz azul arriba a la izquierda, como .ml-ambiente
    halo(900, 90, 240, t.amarillo, 0.22); // toque amarillo de marca
    halo(260, 200, 150, t.luz, 0.45, 2.2);
    halo(720, 320, 180, t.luz, 0.35, 2.4);
    halo(500, 480, 240, t.mancha, 0.6, 3);

    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, [t]);

  useEffect(() => () => textura.dispose(), [textura]);
  return textura;
}

/** Delta máximo por cuadro: al volver de otra pestaña o de fuera de pantalla no hay salto. */
const DELTA_MAX = 1 / 30;

/** Ángulo máximo del vaivén (radianes, ≈28°): siempre se ve el frente de la palabra. */
const AMPLITUD = 0.5;

/** El texto en tubos de vidrio. Gira en useFrame (sin setState) y se inclina un poco con el mouse. */
function Texto({ texto, velocidad, animar, calidad, oscuro, onLista }) {
  const grupo = useRef(null);
  const giro = useRef(0); // velocidad actual: arranca en 0 y alcanza `velocidad` en ~1 s
  const fase = useRef(0); // posición en el vaivén
  const viewport = useThree((s) => s.viewport);
  const q = CALIDAD[calidad];
  const t = oscuro ? TEMAS.oscuro : TEMAS.claro;
  const fondo = useTexturaFondo(t);

  // La fuente se descarga una vez (useLoader la guarda en caché y suspende mientras llega).
  const svg = useLoader(FileLoader, FUENTE);
  const fuente = useMemo(() => leerFuenteSVG(svg), [svg]);
  const geometria = useMemo(
    () => geometriaManuscrita(fuente, texto, { radio: RADIO_TUBO, radial: q.radial, densidad: q.densidad }),
    [fuente, texto, q],
  );
  useEffect(() => () => geometria.dispose(), [geometria]);

  // Encaja la palabra: 62 % del ancho o 45 % del alto, lo que limite primero.
  const caja = geometria.boundingBox;
  const ancho = caja.max.x - caja.min.x;
  const alto = caja.max.y - caja.min.y;
  const escala = Math.min((viewport.width * 0.62) / ancho, (viewport.height * 0.45) / alto);

  // La malla ya existe (la fuente cargó y la geometría está hecha): el
  // contenedor puede hacer su entrada.
  useEffect(() => {
    onLista?.();
  }, [onLista]);

  useFrame((state, delta) => {
    const g = grupo.current;
    if (!g || !animar) return;
    const dt = Math.min(delta, DELTA_MAX);
    // Vaivén de ±AMPLITUD alrededor del frente (no un giro completo): la cara
    // trasera de la palabra se ve en espejo, así que nunca se muestra.
    giro.current = MathUtils.damp(giro.current, velocidad, 3, dt);
    fase.current += dt * giro.current;
    g.rotation.y = Math.sin(fase.current) * AMPLITUD;
    g.rotation.x = MathUtils.damp(g.rotation.x, -state.pointer.y * 0.15, 4, dt);
  });

  return (
    <group ref={grupo} scale={escala} rotation={[0, -0.2, 0]}>
      <mesh geometry={geometria}>
        <MeshTransmissionMaterial
          background={fondo}
          samples={q.samples}
          resolution={q.resolution}
          backside={q.backside}
          backsideThickness={0.1}
          // Vidrio esmerilado: la rugosidad difumina lo que se ve a través.
          transmission={t.transmision}
          roughness={0.3}
          thickness={0.5}
          ior={1.4}
          chromaticAberration={0.03}
          anisotropicBlur={0.2}
          distortion={0.05}
          distortionScale={0.3}
          temporalDistortion={0}
          clearcoat={1}
          clearcoatRoughness={0.1}
          attenuationDistance={t.distanciaTinte}
          attenuationColor={t.tinte}
          envMapIntensity={2.4}
          color={t.vidrio}
        />
      </mesh>
    </group>
  );
}

/**
 * Escena WebGL de MarcaCristal. Se carga con React.lazy: todo three.js
 * queda en este chunk. Al desmontarse, @react-three/fiber libera el
 * renderer y los buffers; la textura del fondo se libera en useTexturaFondo.
 */
export default function EscenaCristal({ texto, velocidad, activa, animar, calidad, oscuro, onLista }) {
  const q = CALIDAD[calidad];
  // Fuera de pantalla no se dibuja; sin animación solo se dibuja cuando algo cambia.
  const frameloop = !activa ? 'never' : animar ? 'always' : 'demand';

  return (
    <Canvas
      dpr={q.dpr}
      frameloop={frameloop}
      // Cámara lejana y lente estrecha: al girar, el extremo cercano de la palabra no se agiganta.
      camera={{ position: [0, 0, 24], fov: 15 }}
      // alpha: el canvas no pinta fondo, se ve el de la página.
      gl={{ alpha: true, antialias: calidad === 'alta', powerPreference: 'high-performance' }}
      style={{ touchAction: 'pan-y' }}
      aria-hidden="true"
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 6, 8]} intensity={1.2} />
      <Texto
        texto={texto}
        velocidad={velocidad}
        animar={animar}
        calidad={calidad}
        oscuro={oscuro}
        onLista={onLista}
      />

      {/* Luces "de estudio" locales (sin descargar HDR): reflejos especulares en el vidrio */}
      <Environment resolution={256}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer form="circle" intensity={8} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={2} />
          <Lightformer form="circle" intensity={4} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={2} />
          <Lightformer form="rect" intensity={8} rotation-y={Math.PI / 2} position={[-8, -1, -1]} scale={[10, 2, 1]} />
          <Lightformer form="rect" intensity={8} rotation-y={-Math.PI / 2} position={[8, 0, 0]} scale={[10, 2, 1]} />
          <Lightformer form="rect" intensity={4} position={[0, 0, 12]} scale={[14, 1.5, 1]} />
          <Lightformer
            form="ring"
            color={TEMAS.oscuro.amarillo}
            intensity={3}
            rotation-y={-Math.PI / 2}
            position={[10, 1, 0]}
            scale={6}
          />
        </group>
      </Environment>
    </Canvas>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Check, X, ZoomIn } from 'lucide-react';

/** Lado máximo (en píxeles de pantalla) del área donde se muestra la imagen. */
const AREA = 300;
/** Tamaño de la foto final (cuadrada; se muestra recortada en círculo). */
const LADO_FINAL = 400;

/**
 * Recorte circular de la foto de perfil, al estilo de Instagram.
 *
 * Se ve la imagen COMPLETA y encima un círculo que el usuario arrastra (y
 * agranda o achica con la barra) para elegir qué parte será su foto. Lo de
 * afuera del círculo se oscurece. Al confirmar se dibuja esa parte en un
 * <canvas> y se entrega como imagen JPG cuadrada de 400×400; la app la
 * muestra siempre dentro de un círculo.
 *
 * props:
 *   imagen     data URL de la foto que eligió el usuario
 *   onCambio   (dataUrl) => void   el recorte actual, cada vez que el círculo
 *              se queda quieto: así el formulario guarda lo que se ve aunque
 *              no se pulse "Usar esta foto"
 *   onListo    (dataUrl) => void   con la foto ya recortada
 *   onCancelar () => void
 */
export default function RecorteCircular({ imagen, onCambio, onListo, onCancelar }) {
  const [medidas, setMedidas] = useState(null); // tamaño original y en pantalla
  const [circulo, setCirculo] = useState(null); // { x, y, d } en píxeles de pantalla
  const arrastre = useRef(null);
  const elementoImagen = useRef(null);
  const avisarCambio = useRef(onCambio);
  avisarCambio.current = onCambio;

  // Al cargar la imagen se calcula cómo cabe completa en el área y se
  // empieza con el círculo más grande posible, centrado.
  const alCargar = (e) => {
    const { naturalWidth: ancho, naturalHeight: alto } = e.currentTarget;
    const escala = Math.min(AREA / ancho, AREA / alto, 1);
    const vista = { ancho: ancho * escala, alto: alto * escala };
    setMedidas({ ancho, alto, escala, ...vista });
    const d = Math.min(vista.ancho, vista.alto);
    setCirculo({ x: (vista.ancho - d) / 2, y: (vista.alto - d) / 2, d });
  };

  /** Mantiene el círculo dentro de la imagen. */
  const ajustar = ({ x, y, d }) => ({
    d,
    x: Math.min(Math.max(0, x), medidas.ancho - d),
    y: Math.min(Math.max(0, y), medidas.alto - d),
  });

  // ---- Arrastrar el círculo (mouse, lápiz o dedo) ----
  const alPresionar = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { inicioX: e.clientX, inicioY: e.clientY, desde: circulo };
  };
  const alMover = (e) => {
    if (!arrastre.current) return;
    const { inicioX, inicioY, desde } = arrastre.current;
    setCirculo(ajustar({ ...desde, x: desde.x + e.clientX - inicioX, y: desde.y + e.clientY - inicioY }));
  };
  const alSoltar = () => {
    arrastre.current = null;
  };

  // ---- Tamaño del círculo (la barra cambia el diámetro sin mover el centro) ----
  const minimo = medidas ? Math.min(medidas.ancho, medidas.alto) * 0.25 : 0;
  const maximo = medidas ? Math.min(medidas.ancho, medidas.alto) : 0;
  const cambiarTamano = (d) => {
    const centroX = circulo.x + circulo.d / 2;
    const centroY = circulo.y + circulo.d / 2;
    setCirculo(ajustar({ d, x: centroX - d / 2, y: centroY - d / 2 }));
  };

  // Con el teclado también se mueve (flechas), para quien no usa mouse
  useEffect(() => {
    if (!circulo) return undefined;
    const alTeclear = (e) => {
      const pasos = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[e.key];
      if (!pasos || document.activeElement?.dataset?.recorte !== 'circulo') return;
      e.preventDefault();
      setCirculo((c) => ajustar({ ...c, x: c.x + pasos[0], y: c.y + pasos[1] }));
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  });

  /** Dibuja la parte elegida en un canvas y la devuelve como JPG. */
  const recortar = () => {
    const canvas = document.createElement('canvas');
    canvas.width = LADO_FINAL;
    canvas.height = LADO_FINAL;
    const ctx = canvas.getContext('2d');
    // Del círculo en pantalla a píxeles de la imagen original
    const lado = circulo.d / medidas.escala;
    ctx.drawImage(
      elementoImagen.current,
      circulo.x / medidas.escala,
      circulo.y / medidas.escala,
      lado,
      lado,
      0,
      0,
      LADO_FINAL,
      LADO_FINAL,
    );
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  // Cuando el círculo deja de moverse, el formulario recibe el recorte actual
  useEffect(() => {
    if (!circulo) return undefined;
    const espera = setTimeout(() => avisarCambio.current?.(recortar()), 200);
    return () => clearTimeout(espera);
    // recortar() lee el círculo y las medidas de este mismo render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circulo]);

  const confirmar = () => onListo(recortar());

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Arrastra el círculo hasta la parte de la foto que quieres mostrar.
      </p>

      <div className="flex justify-center">
        <div
          className="relative touch-none select-none overflow-hidden rounded-lg bg-slate-100 dark:bg-white/5"
          style={medidas ? { width: medidas.ancho, height: medidas.alto } : { width: AREA, height: AREA }}
        >
          <img
            ref={elementoImagen}
            src={imagen}
            alt="Foto que se va a recortar"
            onLoad={alCargar}
            draggable={false}
            className="block h-full w-full"
          />

          {circulo && (
            <div
              role="slider"
              tabIndex={0}
              data-recorte="circulo"
              aria-label="Zona visible de la foto (muévela con las flechas)"
              aria-valuenow={Math.round(circulo.x)}
              onPointerDown={alPresionar}
              onPointerMove={alMover}
              onPointerUp={alSoltar}
              onPointerCancel={alSoltar}
              className="absolute cursor-move rounded-full ring-2 ring-white outline-none focus-visible:ring-amber-400"
              style={{
                left: circulo.x,
                top: circulo.y,
                width: circulo.d,
                height: circulo.d,
                // La sombra enorme oscurece todo lo que queda afuera del círculo
                boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.6)',
              }}
            />
          )}
        </div>
      </div>

      {circulo && (
        <label className="mt-4 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <ZoomIn size={15} className="shrink-0" />
          <span className="sr-only">Tamaño del círculo</span>
          <input
            type="range"
            min={minimo}
            max={maximo}
            step="1"
            value={circulo.d}
            onChange={(e) => cambiarTamano(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
        </label>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
        >
          <X size={14} /> Cancelar
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={!circulo}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-50"
        >
          <Check size={14} /> Usar esta foto
        </button>
      </div>
    </div>
  );
}

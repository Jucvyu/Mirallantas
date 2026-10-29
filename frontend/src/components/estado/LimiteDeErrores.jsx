import { Component } from 'react';
import { Bug, Home, RefreshCw, Sparkles } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import PantallaEstado, { BOTON_PRINCIPAL, BOTON_SECUNDARIO } from '../base/PantallaEstado';

/** ¿El error es porque se publicó una versión nueva y falta un archivo de la anterior? */
const esVersionNueva = (error) =>
  /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i.test(error?.message ?? '');

/**
 * Atrapa cualquier error al dibujar una pantalla y, en vez de dejarla en
 * blanco, muestra un aviso con salidas (recargar o ir al inicio). Al
 * cambiar de pantalla se intenta de nuevo.
 */
class Limite extends Component {
  state = { error: null, ruta: this.props.ruta };

  static getDerivedStateFromError(error) {
    return { error };
  }

  // Cambió la pantalla: se olvida el error y se vuelve a intentar dibujar
  static getDerivedStateFromProps(props, state) {
    return props.ruta !== state.ruta ? { error: null, ruta: props.ruta } : null;
  }

  componentDidCatch(error, info) {
    console.error('Error en la aplicación:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (esVersionNueva(error)) {
      return (
        <PantallaEstado
          icono={Sparkles}
          tono="azul"
          titulo="Hay una versión nueva de MiraLlantas"
          mensaje="Actualizamos la aplicación mientras la tenías abierta. Recarga la página para seguir con la versión nueva."
        >
          <button type="button" onClick={() => window.location.reload()} className={BOTON_PRINCIPAL}>
            <RefreshCw size={16} /> Recargar
          </button>
        </PantallaEstado>
      );
    }

    return (
      <PantallaEstado
        icono={Bug}
        tono="rojo"
        codigo="Error"
        titulo="Algo salió mal"
        mensaje="Ocurrió un error inesperado en esta pantalla. Tus datos guardados no se perdieron: recarga la página o vuelve al inicio."
        detalle={
          <details className="mt-6 max-w-md text-left text-xs text-slate-400">
            <summary className="cursor-pointer text-center">Detalle técnico</summary>
            <p className="mt-2 break-words rounded-lg bg-slate-100 p-3 font-mono dark:bg-white/5">{String(error.message ?? error)}</p>
          </details>
        }
      >
        <a href="/" className={BOTON_SECUNDARIO}>
          <Home size={16} /> Ir al inicio
        </a>
        <button type="button" onClick={() => window.location.reload()} className={BOTON_PRINCIPAL}>
          <RefreshCw size={16} /> Recargar
        </button>
      </PantallaEstado>
    );
  }
}

/** Límite de errores que se reinicia al cambiar de pantalla. */
export default function LimiteDeErrores({ children }) {
  const { pathname } = useLocation();
  return <Limite ruta={pathname}>{children}</Limite>;
}

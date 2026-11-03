import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { cargarReferencias, reintentarReferencias } from './services'
import { activarImagenRespaldo } from './utils/imagenRespaldo'

// Imagen por defecto para cualquier foto que no cargue (p. ej. borrada de Cloudinary)
activarImagenRespaldo()

/** Dibuja la aplicación. */
function iniciar() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// Primero se traen de la base las listas de los formularios (tipos de
// documento y métodos de pago). Si la API no responde, la app abre igual,
// cada pantalla muestra su aviso de "sin conexión" y las listas se siguen
// pidiendo en segundo plano hasta que lleguen.
cargarReferencias()
  .catch(reintentarReferencias)
  .finally(iniciar)

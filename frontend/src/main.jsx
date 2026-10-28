import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { cargarReferencias } from './services'
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
// documento, métodos y medios de pago). Si la API no responde, la app abre
// igual y cada pantalla muestra su aviso de "sin conexión".
cargarReferencias()
  .catch(() => {})
  .finally(iniciar)

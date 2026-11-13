import PageHeader from '../../components/base/PageHeader';
import LicenciasContenido from './LicenciasContenido';

/** Licencias dentro del panel (/admin/licencias): el mismo contenido, sin salir del panel. */
export default function LicenciasPanelPage() {
  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Licencias']} />
      <LicenciasContenido />
    </div>
  );
}

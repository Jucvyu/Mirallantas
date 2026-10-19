import { Mail, MapPin, Phone } from 'lucide-react';
import { FaFacebookF, FaInstagram, FaWhatsapp } from 'react-icons/fa';
import Logo from '../Logo';

const NAV_LINKS = [
  { label: 'Catálogo de llantas', href: '#catalogo' },
  { label: 'Servicio de reencauche', href: '#reencauche' },
  { label: 'Sobre nosotros', href: '#nosotros' },
  { label: 'Portal de clientes', href: '#portal', highlight: true },
];

const CONTACT_ITEMS = [
  { icon: MapPin, text: 'Calle 34 #81-27, Medellín' },
  { icon: Phone, text: '+57 310 897 69 43' },
  { icon: Mail, text: 'contabilidadmirallantas@gmail.com' },
];

const SOCIAL_LINKS = [
  { icon: FaWhatsapp, label: 'WhatsApp', href: '#', className: 'bg-brand-whatsapp' },
  { icon: FaFacebookF, label: 'Facebook', href: '#', className: 'bg-brand-facebook' },
  { icon: FaInstagram, label: 'Instagram', href: '#', className: 'bg-brand-instagram' },
];

function SectionHeading({ children }) {
  return (
    <h3 className="text-[13px] font-bold tracking-wide text-slate-900 dark:text-white">
      {children}
    </h3>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-brand-navy-900">
      <div className="mx-auto max-w-7xl px-6 py-14 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1.2fr_1fr]">
          {/* Marca */}
          <div>
            {/* Logo estandarizado con la insignia "ML" del resto de la app */}
            <Logo size="md" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Microempresa especializada en venta y reencauche de llantas en Medellín y el
              Valle de Aburrá.
            </p>
          </div>

          {/* Navegación */}
          <div>
            <SectionHeading>NAVEGACIÓN</SectionHeading>
            <div className="mt-3 h-px w-full bg-slate-200 dark:bg-white/10" />
            <ul className="mt-4 space-y-3">
              {NAV_LINKS.map(({ label, href, highlight }) => (
                <li key={label}>
                  <a
                    href={href}
                    className={
                      highlight
                        ? 'text-sm font-semibold text-brand-gold-600 hover:text-brand-gold-700 dark:text-brand-gold-400 dark:hover:text-brand-gold-300'
                        : 'text-sm text-slate-600 hover:text-brand-gold-600 dark:text-slate-300 dark:hover:text-brand-gold-400'
                    }
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <SectionHeading>CONTACTO</SectionHeading>
            <div className="mt-3 h-px w-full bg-slate-200 dark:bg-white/10" />
            <ul className="mt-4 space-y-3">
              {CONTACT_ITEMS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5">
                  <Icon
                    size={16}
                    strokeWidth={2}
                    className="mt-0.5 shrink-0 text-brand-gold-600 dark:text-brand-gold-400"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-300">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Síguenos */}
          <div>
            <SectionHeading>SÍGUENOS</SectionHeading>
            <div className="mt-3 h-px w-full bg-slate-200 dark:bg-white/10" />
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Escríbenos por redes o WhatsApp.
            </p>
            <div className="mt-4 flex items-center gap-3">
              {SOCIAL_LINKS.map(({ icon: Icon, label, href, className }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-white transition-transform hover:scale-105 ${className}`}
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Barra inferior */}
        <div className="mt-12 flex flex-col items-center gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400 sm:flex-row sm:justify-between">
          <p>© {year} MiraLlantas. Todos los derechos reservados.</p>
          <p>Proyecto ADSO SENA · React y Tailwind CSS</p>
        </div>
      </div>
    </footer>
  );
}

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import PublicNavbar from '../../components/layout/PublicNavbar';
import Footer from '../../components/base/Footer';
import Hero from './Hero';
import Features from './Features';
import Modules from './Modules';
import CTA from './CTA';

export default function LandingPage() {
  // Si se llega desde otra página con "/#modulos", baja a esa sección
  // cuando ya está dibujada (el navegador lo intenta antes y no la encuentra).
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="min-h-screen bg-white dark:bg-brand-navy-950">
      <PublicNavbar />
      <Hero />
      <Features />
      <Modules />
      <CTA />
      <Footer />
    </div>
  );
}

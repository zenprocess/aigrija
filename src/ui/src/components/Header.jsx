import React, { useState } from 'react';
import { ShieldCheck, Menu, X } from 'lucide-react';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const scrollTo = (id) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-panel transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="p-1.5 bg-blue-600/20 rounded-lg border border-blue-500/30">
              <ShieldCheck className="w-6 h-6 text-blue-500" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">ai-grija<span className="text-blue-500">.ro</span></span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <button data-testid="header-nav-verifica" onClick={() => scrollTo('verifica')} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">Verifică</button>
            <button data-testid="header-nav-cum-functioneaza" onClick={() => scrollTo('cum-functioneaza')} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">Cum funcționează</button>
            <button data-testid="header-nav-alerte" onClick={() => scrollTo('alerte')} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">Alerte</button>
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              data-testid="header-hamburger-btn"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-300 hover:text-white p-2"
              aria-label="Meniu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav Panel */}
      <div className={`md:hidden absolute top-16 left-0 right-0 glass-panel transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'opacity-100 visible border-b border-white/10' : 'opacity-0 invisible h-0 overflow-hidden'}`}>
        <div className="px-4 pt-2 pb-6 space-y-4 flex flex-col bg-[#0A0A0F]/95">
          <button data-testid="header-mobile-verifica" onClick={() => scrollTo('verifica')} className="text-left text-gray-300 hover:text-white transition-colors text-lg font-medium py-2">Verifică un mesaj</button>
          <button data-testid="header-mobile-cum-functioneaza" onClick={() => scrollTo('cum-functioneaza')} className="text-left text-gray-300 hover:text-white transition-colors text-lg font-medium py-2">Cum funcționează</button>
          <button data-testid="header-mobile-alerte" onClick={() => scrollTo('alerte')} className="text-left text-gray-300 hover:text-white transition-colors text-lg font-medium py-2">Alerte active</button>
        </div>
      </div>
    </header>
  );
}

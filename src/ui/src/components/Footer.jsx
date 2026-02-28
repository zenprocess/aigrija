import React from 'react';
import { Github, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-black/80 border-t border-white/10 pt-12 pb-8 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white">ai-grija<span className="text-blue-500">.ro</span></span>
          </div>
          
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Confidențialitate</a>
            <a href="#" className="hover:text-white transition-colors">Termeni de utilizare</a>
            <a href="#" className="hover:text-white transition-colors">Despre proiect</a>
          </div>
        </div>
        
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} ai-grija.ro. Toate drepturile rezervate.</p>
          
          <div className="flex items-center gap-1">
            <span>Proiect civic gratuit dezvoltat cu</span>
            <Heart className="w-4 h-4 text-red-500 mx-1" />
            <span>de</span>
            <a href="https://zen-labs.ro" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors font-medium ml-1">Zen Labs</a>
          </div>
          
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
            <Github className="w-4 h-4" />
            <span>Cod sursă deschis pe GitHub</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
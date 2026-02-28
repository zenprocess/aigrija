import React from "react";

export default function About() {
  return (
    <section id="despre" className="py-20 relative z-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-card p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Despre ai-grija.ro</h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-4">
            ai-grija.ro este un proiect civic gratuit dezvoltat de Zen Labs. Scopul nostru este sa ajutam cetatenii romani sa identifice mesajele de phishing si sa se protejeze de fraude online.
          </p>
          <p className="text-gray-300 text-lg leading-relaxed">
            Platforma foloseste inteligenta artificiala pentru a analiza mesajele suspecte si a oferi recomandari clare de actiune.
          </p>
        </div>
      </div>
    </section>
  );
}

import React from 'react';
import { ClipboardPaste, Brain, CheckCircle } from 'lucide-react';

export default function HowItWorks() {
  const steps = [
    {
      icon: ClipboardPaste,
      iconColor: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      glow: 'shadow-[0_0_20px_rgba(37,99,235,0.2)]',
      title: 'Lipești mesajul',
      desc: 'Copiezi textul suspect din SMS, WhatsApp sau email și-l lipești în formular.'
    },
    {
      icon: Brain,
      iconColor: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      glow: 'shadow-[0_0_20px_rgba(168,85,247,0.2)]',
      title: 'AI-ul analizează',
      desc: 'Modelul AI verifică textul contra bazei de date cu tipare de fraudă cunoscute.'
    },
    {
      icon: CheckCircle,
      iconColor: 'text-green-400',
      bgColor: 'bg-green-500/20',
      glow: 'shadow-[0_0_20px_rgba(22,163,74,0.2)]',
      title: 'Primești verdict',
      desc: 'Afli instant dacă e phishing și primești pași exacți despre ce trebuie să faci.'
    }
  ];

  return (
    <section id="cum-functioneaza" className="py-24 relative z-10 border-t border-white/5 bg-gradient-to-b from-[#0A0A0F] to-[#0f0f16]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 inline-block relative">
            Cum funcționează?
            <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>
          </h2>
        </div>

        <div className="relative">
          {/* Desktop Connecting Line */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/10 via-purple-500/30 to-green-500/10 -translate-y-1/2 z-0"></div>

          <div className="grid md:grid-cols-3 gap-8 relative z-10">
            {steps.map((step, idx) => (
              <div key={idx} className="glass-card p-8 flex flex-col items-center text-center transform hover:-translate-y-2 transition-transform duration-300">
                <div className={`w-16 h-16 rounded-2xl ${step.bgColor} ${step.glow} flex items-center justify-center mb-6 border border-white/10 rotate-3`}>
                  <step.icon className={`w-8 h-8 ${step.iconColor} -rotate-3`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
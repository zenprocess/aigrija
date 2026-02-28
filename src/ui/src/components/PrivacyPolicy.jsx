import React from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col relative selection:bg-blue-500/30 selection:text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
        <button
          data-testid="privacy-back-btn"
          onClick={() => { window.location.hash = ''; }}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Înapoi la pagina principală
        </button>

        <div className="glass-card p-8 md:p-12 space-y-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
              <ShieldCheck className="w-7 h-7 text-blue-500" />
            </div>
            <h1 className="text-3xl font-bold text-white">Politica de Confidențialitate</h1>
          </div>

          <p className="text-gray-400 text-sm">Ultima actualizare: februarie 2026</p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">1. Introducere</h2>
            <p className="text-gray-300 leading-relaxed">
              ai-grija.ro este un instrument civic gratuit pentru detectarea tentativelor de fraudă și phishing.
              Protecția datelor dumneavoastră personale este o prioritate absolută pentru noi.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">2. Ce date colectăm</h2>
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 space-y-2">
              <p className="text-green-400 font-semibold">Nu colectăm date personale.</p>
              <ul className="text-gray-300 space-y-2 list-disc list-inside text-sm">
                <li>Nu există conturi de utilizator</li>
                <li>Nu folosim cookies de tracking</li>
                <li>Nu stocăm mesajele trimise spre verificare</li>
                <li>Nu colectăm adrese IP în mod identificabil</li>
                <li>Nu folosim sisteme de analytics cu date personale</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">3. Mascarea automată a datelor personale (PII)</h2>
            <p className="text-gray-300 leading-relaxed">
              Înainte ca textul să fie trimis spre analiză, sistemul nostru aplică automat o filtrare
              client-side (în browserul dumneavoastră) care maschează:
            </p>
            <ul className="text-gray-300 space-y-1 list-disc list-inside text-sm">
              <li>CNP-uri (cod numeric personal)</li>
              <li>IBAN-uri românești</li>
              <li>Numere de card bancar</li>
              <li>Adrese de email</li>
              <li>Numere de telefon în format românesc</li>
            </ul>
            <p className="text-gray-400 text-sm">
              Această operațiune se produce exclusiv pe dispozitivul dumneavoastră, înainte de orice
              transmisie către serverele noastre.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">4. Analiza AI — caracter efemer</h2>
            <p className="text-gray-300 leading-relaxed">
              Textul mascat este transmis unui model AI (Llama 3.1 prin Cloudflare Workers AI) exclusiv
              pentru analiza în timp real. Rezultatul analizei nu este stocat pe serverele noastre și
              nu este asociat cu nicio identitate.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">5. Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              ai-grija.ro nu utilizează cookies de tracking, publicitate sau marketing. Pot exista
              cookies tehnice strict necesare funcționării aplicației (ex. sesiune), fără scop de
              identificare sau profilare.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">6. Drepturile dumneavoastră (GDPR)</h2>
            <p className="text-gray-300 leading-relaxed">
              Întrucât nu colectăm date personale identificabile, nu există date de șters, exportat sau
              rectificat. Dacă aveți întrebări legate de confidențialitate, ne puteți contacta la:
            </p>
            <a
              data-testid="privacy-contact-link"
              href="mailto:privacy@ai-grija.ro"
              className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              privacy@ai-grija.ro
            </a>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">7. Modificări ale politicii</h2>
            <p className="text-gray-300 leading-relaxed">
              Ne rezervăm dreptul de a actualiza această politică. Orice modificare va fi publicată
              pe această pagină cu data actualizării.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

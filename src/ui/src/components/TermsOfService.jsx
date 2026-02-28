import React from 'react';
import { FileText, ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="min-h-screen flex flex-col relative selection:bg-blue-500/30 selection:text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
        <button
          data-testid="terms-back-btn"
          onClick={() => { window.location.hash = ''; }}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Înapoi la pagina principală
        </button>

        <div className="glass-card p-8 md:p-12 space-y-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
              <FileText className="w-7 h-7 text-blue-500" />
            </div>
            <h1 className="text-3xl font-bold text-white">Termeni de Utilizare</h1>
          </div>

          <p className="text-gray-400 text-sm">Ultima actualizare: februarie 2026</p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">1. Acceptarea termenilor</h2>
            <p className="text-gray-300 leading-relaxed">
              Prin utilizarea platformei ai-grija.ro, acceptați în totalitate prezentii termeni de
              utilizare. Dacă nu sunteți de acord, vă rugăm să nu utilizați serviciul.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">2. Natura serviciului</h2>
            <p className="text-gray-300 leading-relaxed">
              ai-grija.ro este un instrument civic gratuit, fără scop comercial, destinat informării
              publice cu privire la tentativele de fraudă online din România. Serviciul este oferit
              "ca atare" (as-is), fără nicio garanție de disponibilitate continuă sau acuratețe absolută.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">3. Caracter informativ al rezultatelor AI</h2>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5">
              <p className="text-yellow-300 font-semibold mb-2">Important — Limitele analizei automate</p>
              <p className="text-gray-300 text-sm leading-relaxed">
                Rezultatele furnizate de sistemul AI sunt <strong className="text-white">strict orientative</strong>.
                Ele nu constituie consultanță juridică, financiară sau de securitate informatică.
                Utilizatorul este singurul responsabil pentru deciziile luate pe baza acestor informații.
                Vă recomandăm să consultați autorități competente (DNSC, Poliția Română, banca dvs.)
                pentru situații cu impact financiar sau personal.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">4. Utilizare permisă</h2>
            <p className="text-gray-300 leading-relaxed">Serviciul poate fi utilizat pentru:</p>
            <ul className="text-gray-300 space-y-1 list-disc list-inside text-sm">
              <li>Verificarea mesajelor suspecte primite personal</li>
              <li>Educarea și informarea altor persoane despre fraudele online</li>
              <li>Utilizare civică și jurnalistică non-comercială</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">5. Utilizare interzisă</h2>
            <ul className="text-gray-300 space-y-1 list-disc list-inside text-sm">
              <li>Utilizarea automată (scraping/bot) fără acordul scris al echipei</li>
              <li>Testarea sistemului cu date personale ale unor terți fără consimțământul acestora</li>
              <li>Orice utilizare în scopuri ilegale sau frauduloase</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">6. Limitarea răspunderii</h2>
            <p className="text-gray-300 leading-relaxed">
              Echipa ai-grija.ro nu poate fi trasă la răspundere pentru nicio pierdere directă sau
              indirectă rezultată din utilizarea sau imposibilitatea de utilizare a serviciului,
              inclusiv din decizii luate pe baza analizelor AI furnizate.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">7. Proprietate intelectuală</h2>
            <p className="text-gray-300 leading-relaxed">
              Codul sursă al platformei este open-source (licența MIT). Conținutul editorial
              (texte, descrieri campanii) este proprietatea echipei ai-grija.ro / Zen Labs.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">8. Contact</h2>
            <p className="text-gray-300 leading-relaxed">
              Pentru orice întrebări legate de acești termeni:
            </p>
            <a
              data-testid="terms-contact-link"
              href="mailto:contact@ai-grija.ro"
              className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              contact@ai-grija.ro
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}

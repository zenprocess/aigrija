import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Checker from './components/Checker';
import HowItWorks from './components/HowItWorks';
import ActiveAlerts from './components/ActiveAlerts';
import Footer from './components/Footer';
import About from './components/About';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import ContentList from './components/ContentList';
import ContentPost from './components/ContentPost';
import ThreatReports from './components/ThreatReports';

const BG_PATTERN = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=";

const CONTENT_CATEGORIES = ['amenintari', 'ghid', 'educatie', 'povesti', 'rapoarte', 'presa'];

function PageShell({ children }) {
  return (
    <div className="min-h-screen flex flex-col relative selection:bg-blue-500/30 selection:text-white">
      <div className={`fixed inset-0 bg-[url('${BG_PATTERN}')] opacity-30 pointer-events-none z-0`} />
      <Header />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  );
}

function App() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (hash === '#/confidentialitate') {
    return (
      <div className="min-h-screen flex flex-col relative selection:bg-blue-500/30 selection:text-white">
        <div className={`fixed inset-0 bg-[url('${BG_PATTERN}')] opacity-30 pointer-events-none z-0`} />
        <PrivacyPolicy />
        <Footer />
      </div>
    );
  }

  if (hash === '#/termeni') {
    return (
      <div className="min-h-screen flex flex-col relative selection:bg-blue-500/30 selection:text-white">
        <div className={`fixed inset-0 bg-[url('${BG_PATTERN}')] opacity-30 pointer-events-none z-0`} />
        <TermsOfService />
        <Footer />
      </div>
    );
  }

  // Content category list pages: /amenintari, /ghid, /educatie, /povesti, /rapoarte, /presa
  for (const cat of CONTENT_CATEGORIES) {
    if (hash === `#/${cat}`) {
      return (
        <PageShell>
          <ContentList category={cat} />
        </PageShell>
      );
    }
    const postMatch = hash.match(new RegExp(`^#\/${cat}\/(.+)$`));
    if (postMatch) {
      return (
        <PageShell>
          <ContentPost slug={postMatch[1]} category={cat} />
        </PageShell>
      );
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative selection:bg-blue-500/30 selection:text-white">
      <a href="#main-content" className="skip-to-content">Treci la continut principal</a>
      <div className={`fixed inset-0 bg-[url('${BG_PATTERN}')] opacity-30 pointer-events-none z-0`} />
      
      <Header />
      
      <main id="main-content" className="flex-grow pt-16">
        <Hero />
        <Checker />
        <HowItWorks />
        <ActiveAlerts />
      </main>
      
      <About />
      <Footer />
    </div>
  );
}

export default App;

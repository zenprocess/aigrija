import React, { useState, useEffect, lazy, Suspense } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Checker from './components/Checker';
import HowItWorks from './components/HowItWorks';
import ActiveAlerts from './components/ActiveAlerts';
import Footer from './components/Footer';
import About from './components/About';
import ErrorBoundary from './components/ErrorBoundary';

const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./components/TermsOfService'));
const ContentList = lazy(() => import('./components/ContentList'));
const ContentPost = lazy(() => import('./components/ContentPost'));
const Quiz = lazy(() => import('./components/Quiz'));
const CookieConsent = lazy(() => import('./components/CookieConsent'));

function LoadingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm font-mono">Se incarca...</p>
      </div>
    </div>
  );
}

const BG_PATTERN = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=";

const CONTENT_CATEGORIES = ['amenintari', 'ghid', 'educatie', 'povesti', 'rapoarte', 'presa'];

function PageShell({ children }) {
  const [consentVisible, setConsentVisible] = useState(false);
  return (
    <ErrorBoundary>
      <div className={`min-h-screen flex flex-col relative selection:bg-green-500/30 selection:text-white overflow-x-hidden${consentVisible ? ' pb-20' : ''}`}>
        <a href="#main-content" className="skip-to-content">Treci la continut principal</a>
        <div className={`fixed inset-0 bg-[url('${BG_PATTERN}')] opacity-30 pointer-events-none z-0`} />
        <Header />
        <main id="main-content" className="flex-grow">
          <Suspense fallback={<LoadingSkeleton />}>
            {children}
          </Suspense>
        </main>
        <Footer />
        <Suspense fallback={null}><CookieConsent onVisibilityChange={setConsentVisible} /></Suspense>
      </div>
    </ErrorBoundary>
  );
}

function App() {
  const [hash, setHash] = useState(window.location.hash);
  const [consentVisible, setConsentVisible] = useState(false);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (hash === '#/quiz') {
    return (
      <PageShell>
        <Quiz />
      </PageShell>
    );
  }

  if (hash === '#/confidentialitate') {
    return (
      <PageShell>
        <PrivacyPolicy />
      </PageShell>
    );
  }

  if (hash === '#/termeni') {
    return (
      <PageShell>
        <TermsOfService />
      </PageShell>
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
    <ErrorBoundary>
      <div className={`min-h-screen flex flex-col relative selection:bg-green-500/30 selection:text-white overflow-x-hidden${consentVisible ? ' pb-20' : ''}`}>
        <a href="#main-content" className="skip-to-content">Treci la continut principal</a>
        <div className={`fixed inset-0 bg-[url('${BG_PATTERN}')] opacity-30 pointer-events-none z-0`} />

        <Header />

        <main id="main-content" className="flex-grow pt-16">
          <Hero />
          <Checker />
          <HowItWorks />
          <ActiveAlerts />
          <About />
        </main>
        <Footer />
        <Suspense fallback={null}><CookieConsent onVisibilityChange={setConsentVisible} /></Suspense>
      </div>
    </ErrorBoundary>
  );
}

export default App;

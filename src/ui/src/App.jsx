import React from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Checker from './components/Checker';
import HowItWorks from './components/HowItWorks';
import ActiveAlerts from './components/ActiveAlerts';
import Footer from './components/Footer';
import About from './components/About';

function App() {
  return (
    <div className="min-h-screen flex flex-col relative selection:bg-blue-500/30 selection:text-white">
      {/* Global Background Elements */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-30 pointer-events-none z-0"></div>
      
      <Header />
      
      <main className="flex-grow pt-16">
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
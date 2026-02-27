import React from 'react';
import { Smile, ArrowRight } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-white py-20 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 tracking-tight mb-8">
            Making the web a <span className="text-blue-600">happier place</span>
          </h1>
          <p className="text-xl text-gray-600 mb-12 leading-relaxed">
            We build tools that bring joy to your daily workflow. Simple, elegant, and designed with a smile in mind.
          </p>
          
          {/* Smiley face under the text */}
          <div className="flex justify-center mb-12 animate-bounce">
            <Smile className="w-24 h-24 text-yellow-500 drop-shadow-lg" strokeWidth={1.5} />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
            <button className="inline-flex items-center justify-center px-8 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 shadow-sm hover:shadow transition-all duration-200">
              View Demo
            </button>
          </div>
        </div>
      </div>
      
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-50 rounded-full opacity-50 blur-3xl -z-10"></div>
    </section>
  );
}
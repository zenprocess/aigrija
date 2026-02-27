import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white">
      <div className="animate-bounce hover:animate-spin cursor-pointer transition-all duration-500">
        <span role="img" aria-label="smiley face" className="text-[200px] leading-none select-none filter drop-shadow-xl">
          🙂
        </span>
      </div>
    </div>
  );
}
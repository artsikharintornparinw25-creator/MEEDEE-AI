
import React, { useState, useEffect } from 'react';

const ENCOURAGING_PHRASES = [
  "Synthesizing visual echoes...",
  "Decoding atmospheric data...",
  "Consulting the digital muse...",
  "Weaving the first thread...",
  "Capturing the mood's essence...",
  "Drafting the unspoken...",
  "Painting with algorithm and soul...",
  "Gathering ink from shadows...",
  "Synchronizing narrative vectors...",
  "Calibrating the story engine..."
];

export const MorphingLoader: React.FC = () => {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % ENCOURAGING_PHRASES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-md flex items-center justify-center rounded-2xl z-20">
      <div className="flex flex-col items-center gap-12 max-w-xs text-center">
        {/* Morphing Shape */}
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 bg-cyan-600/20 blur-2xl rounded-full animate-pulse"></div>
          <div className="relative w-full h-full bg-gradient-to-tr from-cyan-600 to-cyan-400 animate-morph shadow-[0_0_30px_rgba(8,145,178,0.3)]"></div>
        </div>

        {/* Dynamic Text */}
        <div className="space-y-2 h-12">
          <p className="text-sm font-medium tracking-widest text-cyan-500 uppercase animate-in fade-in slide-in-from-bottom-2 duration-1000 key={phraseIndex}">
            {ENCOURAGING_PHRASES[phraseIndex]}
          </p>
          <div className="flex justify-center gap-1.5 pt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-bounce"></span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes morph {
          0% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
          50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
          100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
        }
        .animate-morph {
          animation: morph 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

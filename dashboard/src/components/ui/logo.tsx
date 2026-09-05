import React from 'react';

interface LogoProps {
  className?: string;
  collapsed?: boolean;
}

export function Logo({ className = '', collapsed = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Symbol: 3 rounded overlapping triangles */}
      <div className="relative flex-shrink-0 flex items-center justify-center w-14 h-14 -ml-2">
        <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full overflow-visible">
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            
            {/* Left Triangle - Dark/transparent teal */}
            <linearGradient id="tri1" x1="15" y1="20" x2="55" y2="80">
              <stop stopColor="#006A75" stopOpacity="0.4" />
              <stop offset="1" stopColor="#004050" stopOpacity="0.6" />
            </linearGradient>

            {/* Middle Triangle - Medium teal */}
            <linearGradient id="tri2" x1="35" y1="20" x2="75" y2="80">
              <stop stopColor="#00B090" stopOpacity="0.8" />
              <stop offset="1" stopColor="#007A80" stopOpacity="0.9" />
            </linearGradient>

            {/* Right Triangle - Bright neon teal */}
            <linearGradient id="tri3" x1="55" y1="20" x2="95" y2="80">
              <stop stopColor="#00F5B0" />
              <stop offset="1" stopColor="#00B090" />
            </linearGradient>

            <linearGradient id="teal-x" x1="52" y1="25" x2="85" y2="75">
              <stop stopColor="#00F5B0" />
              <stop offset="1" stopColor="#008080" />
            </linearGradient>
          </defs>

          {/* Triangle 1 */}
          <path d="M 20 20 L 55 50 L 20 80 Z" fill="url(#tri1)" stroke="url(#tri1)" strokeWidth="10" strokeLinejoin="round" />
          
          {/* Triangle 2 */}
          <path d="M 40 20 L 75 50 L 40 80 Z" fill="url(#tri2)" stroke="url(#tri2)" strokeWidth="10" strokeLinejoin="round" />
          
          {/* Triangle 3 (with glow) */}
          <path d="M 60 20 L 95 50 L 60 80 Z" fill="url(#tri3)" stroke="url(#tri3)" strokeWidth="10" strokeLinejoin="round" filter="url(#glow)" />
        </svg>
      </div>

      {/* Wordmark */}
      <div className={`flex flex-col justify-center ${collapsed ? 'hidden sm:flex' : 'flex'}`}>
        <div className="flex items-center text-[#F8FAFC] font-bold text-[52px] tracking-tight leading-none font-sans" style={{ letterSpacing: '-0.04em' }}>
          <span>Ne</span>
          
          {/* Custom 'x' split exactly in half: left side white, right side teal */}
          <span 
            className="text-transparent bg-clip-text"
            style={{ 
              backgroundImage: 'linear-gradient(to right, #F8FAFC 50%, #00F5B0 50%, #00AFA0 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text'
            }}
          >
            x
          </span>
          
          <span>t</span>
        </div>
        
        <span className="text-[#94A3B8] font-normal text-[11px] tracking-[0.55em] lowercase mt-0.5 text-right pr-1 opacity-80">
          soluções
        </span>
      </div>
    </div>
  );
}

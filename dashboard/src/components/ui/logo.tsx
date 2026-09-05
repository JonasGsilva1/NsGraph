import React from 'react';

interface LogoProps {
  className?: string;
  collapsed?: boolean;
}

export function Logo({ className = '', collapsed = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Symbol: 3 overlapping triangles pointing right */}
      <div className="relative flex-shrink-0 flex items-center justify-center w-11 h-11">
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-md">
          {/* Triangle 1 (Back/Left) - Blue/Teal mix */}
          <path d="M6 10 L26 24 L6 38 Z" fill="url(#grad1)" opacity="0.6" />
          
          {/* Triangle 2 (Middle) */}
          <path d="M14 10 L34 24 L14 38 Z" fill="url(#grad2)" opacity="0.85" />
          
          {/* Triangle 3 (Front/Right) - Solid Teal */}
          <path d="M22 10 L42 24 L22 38 Z" fill="url(#grad3)" />
          
          <defs>
            <linearGradient id="grad1" x1="6" y1="10" x2="26" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3B82F6" /> {/* Blue */}
              <stop offset="1" stopColor="#00C98B" /> {/* Teal */}
            </linearGradient>
            <linearGradient id="grad2" x1="14" y1="10" x2="34" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#00C98B" />
              <stop offset="1" stopColor="#00AFA0" />
            </linearGradient>
            <linearGradient id="grad3" x1="22" y1="10" x2="42" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#00E5FF" />
              <stop offset="1" stopColor="#00C98B" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Wordmark */}
      <div className={`flex flex-col justify-center ${collapsed ? 'hidden sm:flex' : 'flex'}`}>
        <div className="text-[#F8FAFC] font-extrabold text-[28px] tracking-tight leading-none flex items-baseline">
          <span>Ne</span>
          <span className="text-white relative">
            X
            {/* Subtle teal accent on the X */}
            <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#00C98B] rounded-full opacity-0"></span>
          </span>
          <span>t</span>
        </div>
        <span className="text-[#00C98B] font-bold text-[0.65rem] tracking-[0.4em] uppercase mt-1 pl-0.5 opacity-90">
          Soluções
        </span>
      </div>
    </div>
  );
}

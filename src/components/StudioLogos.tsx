import React from 'react';

export const StudioLogo: React.FC<{ slug: string; name: string; className?: string }> = ({
  slug,
  name,
  className = '',
}) => {
  const key = slug.toLowerCase();

  switch (key) {
    case 'mappa':
      return (
        <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
          <span
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            className="font-black text-2xl sm:text-3xl md:text-[32px] tracking-[0.18em] leading-none text-current pl-[0.18em]"
          >
            MAPPA
          </span>
          <span className="w-full h-[2.5px] bg-current mt-1.5 opacity-90 rounded-full" />
        </div>
      );

    case 'ufotable':
      return (
        <div className={`inline-flex items-center justify-center gap-2.5 select-none ${className}`}>
          <svg viewBox="0 0 40 28" fill="none" className="w-8 sm:w-9 h-6 sm:h-7 shrink-0">
            <ellipse cx="20" cy="16" rx="17" ry="6.5" stroke="currentColor" strokeWidth="3" />
            <path
              d="M10 14c2-6 6-9 10-9s8 3 10 9"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <circle cx="20" cy="16" r="2.5" fill="currentColor" />
          </svg>
          <span
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            className="font-extrabold text-2xl sm:text-[28px] tracking-tight leading-none lowercase"
          >
            ufotable
          </span>
        </div>
      );

    case 'madhouse':
      return (
        <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
          <span className="w-full h-[2px] bg-current opacity-45 mb-1" />
          <span
            style={{ fontFamily: "'Bebas Neue', Impact, sans-serif" }}
            className="font-black text-3xl sm:text-4xl tracking-[0.16em] leading-none pl-[0.16em]"
          >
            MADHOUSE
          </span>
          <span className="w-full h-[2px] bg-current opacity-45 mt-1" />
        </div>
      );

    case 'bones':
      return (
        <div className={`inline-flex items-center justify-center gap-2.5 select-none ${className}`}>
          <svg viewBox="0 0 32 32" fill="none" className="w-6 sm:w-7 h-6 sm:h-7 shrink-0">
            <g stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <line x1="6" y1="6" x2="26" y2="26" />
              <line x1="26" y1="6" x2="6" y2="26" />
              <circle cx="5" cy="5" r="2.5" fill="currentColor" />
              <circle cx="27" cy="5" r="2.5" fill="currentColor" />
              <circle cx="5" cy="27" r="2.5" fill="currentColor" />
              <circle cx="27" cy="27" r="2.5" fill="currentColor" />
            </g>
          </svg>
          <span
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            className="font-black text-2xl sm:text-[28px] tracking-[0.2em] leading-none"
          >
            BONES
          </span>
        </div>
      );

    case 'wit-studio':
      return (
        <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
          <span
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            className="font-black text-2xl sm:text-3xl tracking-[0.22em] leading-none pl-[0.22em]"
          >
            WIT
          </span>
          <span className="w-20 sm:w-24 h-[1.5px] bg-current opacity-55 my-1" />
          <span
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            className="font-bold text-[10px] sm:text-[11px] tracking-[0.45em] leading-none opacity-85 pl-[0.45em]"
          >
            STUDIO
          </span>
        </div>
      );

    case 'a-1-pictures':
      return (
        <div className={`inline-flex items-center justify-center gap-2.5 select-none ${className}`}>
          <span
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            className="inline-flex items-center justify-center px-2.5 py-1 rounded-[6px] border-[2.5px] border-current font-black text-lg sm:text-xl tracking-wider leading-none"
          >
            A-1
          </span>
          <span
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            className="font-bold text-xl sm:text-2xl tracking-wide leading-none"
          >
            Pictures
          </span>
        </div>
      );

    case 'kyoto-animation':
      return (
        <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
          <span
            style={{ fontFamily: 'Georgia, serif' }}
            className="font-bold text-xl sm:text-2xl tracking-[0.16em] leading-none pl-[0.16em]"
          >
            KYOTO
          </span>
          <span
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            className="font-semibold text-[10px] sm:text-[11px] tracking-[0.38em] leading-none opacity-80 mt-1.5 pl-[0.38em]"
          >
            ANIMATION
          </span>
        </div>
      );

    case 'cloverworks':
      return (
        <div className={`inline-flex items-center justify-center gap-2.5 select-none ${className}`}>
          <svg viewBox="0 0 32 32" fill="currentColor" className="w-6 sm:w-7 h-6 sm:h-7 shrink-0">
            <circle cx="10" cy="10" r="6.2" />
            <circle cx="22" cy="10" r="6.2" />
            <circle cx="10" cy="22" r="6.2" />
            <circle cx="22" cy="22" r="6.2" />
          </svg>
          <span
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            className="font-extrabold text-xl sm:text-2xl tracking-tight leading-none"
          >
            CloverWorks
          </span>
        </div>
      );

    case 'toei-animation':
      return (
        <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
          <div className="flex items-center justify-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
              <polygon points="12,2 15,9 22,9 16.5,13.5 18.5,21 12,16.5 5.5,21 7.5,13.5 2,9 9,9" />
            </svg>
            <span
              style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
              className="font-black text-xl sm:text-2xl tracking-[0.2em] leading-none"
            >
              TOEI
            </span>
          </div>
          <span
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            className="font-semibold text-[9.5px] sm:text-[10.5px] tracking-[0.36em] leading-none opacity-80 mt-1 pl-[0.36em]"
          >
            ANIMATION
          </span>
        </div>
      );

    case 'studio-ghibli':
      return (
        <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
          <span
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            className="font-semibold text-[10px] sm:text-[11px] tracking-[0.42em] leading-none opacity-80 mb-1 pl-[0.42em]"
          >
            STUDIO
          </span>
          <span
            style={{ fontFamily: 'Georgia, serif' }}
            className="font-bold text-2xl sm:text-[28px] tracking-[0.18em] leading-none pl-[0.18em]"
          >
            GHIBLI
          </span>
        </div>
      );

    case 'production-ig':
      return (
        <div className={`inline-flex items-center justify-center gap-2 select-none ${className}`}>
          <span
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            className="font-bold text-lg sm:text-xl tracking-tight leading-none"
          >
            Production
          </span>
          <span
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            className="inline-flex items-center justify-center px-2 py-1 rounded-[4px] bg-white text-black font-black text-lg sm:text-xl tracking-wider leading-none"
          >
            I.G
          </span>
        </div>
      );

    case 'trigger':
      return (
        <div className={`inline-flex items-center justify-center gap-2 select-none ${className}`}>
          <svg viewBox="0 0 32 32" fill="currentColor" className="w-6 sm:w-7 h-6 sm:h-7 shrink-0">
            <path d="M16 2 L19.5 12.5 L30 16 L19.5 19.5 L16 30 L12.5 19.5 L2 16 L12.5 12.5 Z" />
          </svg>
          <span
            style={{ fontFamily: "'Bebas Neue', Impact, sans-serif" }}
            className="italic font-black text-3xl sm:text-4xl tracking-[0.12em] leading-none"
          >
            TRIGGER
          </span>
        </div>
      );

    default:
      return (
        <span
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          className="text-2xl sm:text-3xl md:text-4xl tracking-wider text-white text-center"
        >
          {name}
        </span>
      );
  }
};

export const GenreIcon: React.FC<{ slug: string; className?: string }> = ({
  slug,
  className = 'w-4 h-4',
}) => {
  const key = slug.toLowerCase();
  switch (key) {
    case 'action':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
          <line x1="13" y1="19" x2="19" y2="13" />
          <line x1="16" y1="16" x2="20" y2="20" />
          <line x1="19" y1="21" x2="21" y2="19" />
        </svg>
      );
    case 'fantasy':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
        </svg>
      );
    case 'romance':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      );
    case 'sci-fi':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="12" cy="12" r="3" />
          <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(30 12 12)" />
          <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-30 12 12)" />
        </svg>
      );
    case 'supernatural':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      );
    case 'comedy':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      );
    case 'psychological':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'slice of life':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
          <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
          <line x1="6" y1="2" x2="6" y2="4" />
          <line x1="10" y1="2" x2="10" y2="4" />
          <line x1="14" y1="2" x2="14" y2="4" />
        </svg>
      );
    case 'sports':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
      );
    case 'adventure':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      );
    case 'mystery':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'mecha':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
  }
};

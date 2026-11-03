import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface SelectOption {
  value: string | number;
  label: string;
}

interface AnimatedSelectProps {
  value: string | number;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  icon?: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  align?: 'left' | 'right';
}

export const AnimatedSelect: React.FC<AnimatedSelectProps> = ({
  value,
  options,
  onChange,
  ariaLabel = 'Select option',
  icon,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  align = 'left',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption =
    options.find((opt) => String(opt.value) === String(value)) || options[0];

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`h-9 shrink-0 rounded-[12px] border px-3.5 text-[12.5px] font-semibold text-white flex items-center justify-between gap-2.5 transition-all duration-200 select-none cursor-pointer focus:outline-none ${
          open
            ? 'bg-[#141414] border-white/25'
            : 'bg-[#0a0a0a] border-white/[0.1] hover:bg-[#121212] hover:border-white/20'
        } ${triggerClassName}`}
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          {icon && <span className="shrink-0 text-white/55 flex items-center">{icon}</span>}
          <span className="truncate">{selectedOption?.label ?? value}</span>
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-white/60 transition-transform duration-200 ease-out ${
            open ? 'rotate-180 text-white' : ''
          }`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: align === 'right' ? 'top right' : 'top left' }}
            className={`absolute ${
              align === 'right' ? 'right-0' : 'left-0'
            } mt-2 z-50 min-w-full w-max max-h-[260px] overflow-y-auto custom-scrollbar rounded-[12px] border border-white/[0.12] bg-[#0a0a0a]/95 backdrop-blur-xl p-1.5 text-white shadow-[0_16px_40px_rgba(0,0,0,0.9)] ${menuClassName}`}
          >
            {options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(String(opt.value));
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-4 rounded-[8px] px-3 py-2 text-[12.5px] text-left transition-colors duration-150 cursor-pointer select-none ${
                    isSelected
                      ? 'bg-white/[0.12] text-white font-semibold'
                      : 'text-white/75 hover:bg-white/[0.06] hover:text-white font-medium'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 text-white"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

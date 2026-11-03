import React, { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useMotionValue, useTransform, useSpring, MotionValue } from 'framer-motion';
import { toast } from 'sonner';
import {
  HomeIcon,
  SearchIcon,
  TvIcon,
  MoviesIcon,
  WatchlistIcon,
  ScheduleIcon,
  KotatsuLogo,
} from './icons';
import { isKidsMode } from '../lib/storage';

interface NavItem {
  name: string;
  path: string;
  icon: React.FC<{ active?: boolean }>;
  isWip?: boolean;
}

const triggerWipToast = (name: string) => {
  toast(`${name} is a work in progress`, {
    description: 'This feature is not out yet — stay tuned for upcoming updates.',
  });
};

interface DockIconProps {
  item: NavItem;
  isActive: boolean;
  mouseX: MotionValue<number>;
}

const MobileDockIcon: React.FC<DockIconProps> = ({ item, isActive, mouseX }) => {
  const ref = useRef<HTMLDivElement>(null);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const scaleTransform = useTransform(distance, [-100, 0, 100], [1, 1.35, 1]);
  const yTransform = useTransform(distance, [-100, 0, 100], [0, -8, 0]);

  const scale = useSpring(scaleTransform, { mass: 0.1, stiffness: 200, damping: 12 });
  const y = useSpring(yTransform, { mass: 0.1, stiffness: 200, damping: 12 });

  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      onClick={(e) => {
        if (item.isWip) {
          e.preventDefault();
          triggerWipToast(item.name);
        }
      }}
      className="relative flex flex-col items-center justify-center h-full flex-1 min-w-[40px] select-none touch-manipulation z-10 focus:outline-none"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <motion.div
        ref={ref}
        style={{ scale, y }}
        className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-300 ${
          isActive
            ? 'text-white bg-white/15 ring-1 ring-white/20'
            : 'text-[#8f98a2] hover:text-white/80'
        }`}
      >
        <div className={`${isActive ? 'scale-[1.12]' : 'scale-[0.85]'} transform-gpu flex items-center justify-center relative transition-transform duration-200`}>
          <Icon active={isActive} />
        </div>
        {isActive && (
          <motion.span
            layoutId="activeDockIndicator"
            className="absolute -bottom-1.5 w-1 h-1 bg-white rounded-full"
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          />
        )}
      </motion.div>
    </Link>
  );
};

export const Sidebar: React.FC = () => {
  const [hovered, setHovered] = useState(false);
  const location = useLocation();
  const mouseX = useMotionValue(Infinity);
  const kidsMode = isKidsMode();

  const navItems: NavItem[] = [
    { name: 'Home', path: '/home', icon: HomeIcon },
    { name: 'Search', path: '/explore', icon: SearchIcon },
    { name: 'Series', path: '/series', icon: TvIcon },
    { name: 'Movies', path: '/movies', icon: MoviesIcon },
    { name: 'Watchlist', path: '/watchlist', icon: WatchlistIcon },
    { name: 'Schedules', path: '/schedules', icon: ScheduleIcon },
  ];

  const isRouteActive = (path: string) => {
    if (path === '/home') return location.pathname === '/home' || location.pathname === '/';
    if (path === '/watchlist') {
      return (
        location.pathname.startsWith('/watchlist') ||
        location.pathname.startsWith('/space/watchlist')
      );
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Desktop Left Sidebar */}
      <aside
        className={`hidden md:flex fixed top-0 left-0 h-screen z-50 flex-col justify-between py-8 transition-all duration-300 ease-out select-none ${
          hovered ? 'w-[240px]' : 'w-[80px]'
        }`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Seamless shadow vignette that only emerges smoothly on hover (never cuts off or forms a sharp line) */}
        <div
          className={`fixed top-0 left-0 h-screen pointer-events-none -z-10 transition-all duration-300 ease-out ${
            hovered ? 'w-[480px] sm:w-[540px] opacity-100' : 'w-[80px] opacity-0'
          }`}
          style={{
            background:
              'linear-gradient(to right, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.85) 30%, rgba(0, 0, 0, 0.48) 60%, rgba(0, 0, 0, 0.12) 85%, transparent 100%)',
          }}
        />

        <div className="px-5 mb-2 flex items-center h-12 z-10 gap-2">
          <Link to="/home" className="flex items-center group focus:outline-none" aria-label="Kotatsu Home">
            <div className="w-10 h-10 flex items-center justify-center relative text-white">
              <KotatsuLogo className="w-8 h-8 object-contain group-hover:scale-110 transition-transform duration-300" />
            </div>
            {kidsMode && (
              <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-white text-black rounded-md leading-none">
                KIDS
              </span>
            )}
          </Link>
        </div>

        <nav className="flex flex-col justify-center flex-1 space-y-1 z-10 w-full">
          {navItems.map((item, idx) => {
            const active = isRouteActive(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={(e) => {
                  if (item.isWip) {
                    e.preventDefault();
                    triggerWipToast(item.name);
                  }
                }}
                className={`flex items-center px-7 py-3.5 relative group transition-all duration-200 outline-none ${
                  active ? 'text-[#f9f9f9] font-bold' : 'text-[#8f98a2] hover:text-[#f9f9f9] font-medium'
                }`}
              >
                {/* Active Tab Vertical Indicator Line (Pure GPU-composited CSS: grows & fades from center, shrinks & fades to center at 60/120fps) */}
                <div
                  className={`sidebar-indicator absolute left-0 top-1/2 -mt-3 w-1 h-6 bg-white rounded-r-full shadow-[0_0_12px_rgba(255,255,255,0.7)] pointer-events-none ${
                    active ? 'sidebar-indicator-active' : 'sidebar-indicator-inactive'
                  }`}
                />
                <div
                  className={`flex items-center justify-center w-6 h-6 transition-transform duration-250 ease-out relative ${
                    active
                      ? 'scale-[1.28] group-hover:scale-[1.33]'
                      : 'group-hover:scale-110'
                  }`}
                >
                  <Icon active={active} />
                </div>
                {/* Sequential / Staggered Text Reveal on Hover & Smooth Slide-Left Fade-Out on Exit */}
                <span
                  style={{
                    transition: hovered
                      ? `opacity 260ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 35}ms, translate 260ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 35}ms, transform 260ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 35}ms`
                      : 'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, translate 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, transform 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
                  }}
                  className={`ml-5 text-[15px] tracking-wide whitespace-nowrap origin-left will-change-[transform,opacity,translate] ${
                    hovered
                      ? 'opacity-100 translate-x-0'
                      : 'opacity-0 -translate-x-4 pointer-events-none'
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="h-10" />
      </aside>

      {/* Mobile Floating Bottom Dock */}
      <div className="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-[440px]">
        <motion.nav
          onMouseMove={(e) => mouseX.set(e.pageX)}
          onMouseLeave={() => mouseX.set(Infinity)}
          onTouchMove={(e) => {
            if (e.touches.length > 0) mouseX.set(e.touches[0].pageX);
          }}
          onTouchEnd={() => mouseX.set(Infinity)}
          className="flex justify-around items-center h-[60px] px-2 rounded-3xl bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.9)]"
        >
          {navItems.map((item) => (
            <MobileDockIcon
              key={item.name}
              item={item}
              isActive={isRouteActive(item.path)}
              mouseX={mouseX}
            />
          ))}
        </motion.nav>
      </div>
    </>
  );
};

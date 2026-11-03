import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { KotatsuLogo } from './icons';

export const TopProgressBar: React.FC = () => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setVisible(true);
    setProgress(30);
    const t1 = setTimeout(() => setProgress(75), 120);
    const t2 = setTimeout(() => setProgress(100), 300);
    const t3 = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 520);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [location.pathname, location.search]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-[2px] z-[9999] pointer-events-none">
      <div
        className="h-full bg-white transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export const ScrollToTopButton: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
      className="fixed bottom-24 md:bottom-8 right-5 md:right-8 z-40 w-10 h-10 md:w-11 md:h-11 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-xl border border-white/15 shadow-[0_8px_25px_rgba(0,0,0,0.6)] flex items-center justify-center transition-all duration-300 hover:scale-110"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
};

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-black border-t border-white/[0.06] pt-12 pb-28 md:pb-12 px-4 sm:px-6 md:px-12 md:pl-28 text-[#8f98a2] select-none mt-auto">
      <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
        <div>
          <h4 className="text-white font-bold text-sm mb-3.5 tracking-wide">Company</h4>
          <ul className="space-y-2 text-xs sm:text-sm font-medium">
            <li>
              <Link to="/home" className="hover:text-white transition-colors">
                About Kotatsu
              </Link>
            </li>
            <li>
              <Link to="/categories" className="hover:text-white transition-colors">
                Anime Studios
              </Link>
            </li>
            <li>
              <Link to="/categories/all/genres" className="hover:text-white transition-colors">
                Anime Genres
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold text-sm mb-3.5 tracking-wide">Browse</h4>
          <ul className="space-y-2 text-xs sm:text-sm font-medium">
            <li>
              <Link to="/series" className="hover:text-white transition-colors">
                Series
              </Link>
            </li>
            <li>
              <Link to="/movies" className="hover:text-white transition-colors">
                Movies
              </Link>
            </li>
            <li>
              <Link to="/explore" className="hover:text-white transition-colors">
                Search
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold text-sm mb-3.5 tracking-wide">Need Help?</h4>
          <ul className="space-y-2 text-xs sm:text-sm font-medium">
            <li>
              <Link to="/help" className="hover:text-white transition-colors">
                Visit Help Center
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold text-sm mb-3.5 tracking-wide">Legal</h4>
          <ul className="space-y-2 text-xs sm:text-sm font-medium">
            <li>
              <Link to="/legal/terms" className="hover:text-white transition-colors">
                Terms of Use
              </Link>
            </li>
            <li>
              <Link to="/legal/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/legal/dmca" className="hover:text-white transition-colors">
                DMCA Notice
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-6 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <KotatsuLogo className="w-6 h-6 text-white opacity-85" />
          <span>© {new Date().getFullYear()} Kotatsu. All Rights Reserved.</span>
        </div>
        <p className="text-[11px] text-[#8f98a2]/70 text-center sm:text-right max-w-md">
          Kotatsu does not host any media files on its servers. All content is provided by non-affiliated third parties.
        </p>
      </div>
    </footer>
  );
};

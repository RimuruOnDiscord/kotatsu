import React, { useEffect, Suspense, lazy } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useParams,
} from 'react-router-dom';
import { resolveStudioFilterName, resolveGenreFilterName } from './lib/api';
import { Toaster } from 'sonner';
import { Sidebar } from './components/Sidebar';
import {
  Footer,
  TopProgressBar,
  ScrollToTopButton,
} from './components/Footer';
import { Home } from './pages/Home';

// Lazy-load route components to eliminate heavy initial bundle lag (splits Hls.js, YouTube API, and large secondary pages)
const AnimePage = lazy(() => import('./pages/AnimePage').then((m) => ({ default: m.AnimePage })));
const Explore = lazy(() => import('./pages/Explore').then((m) => ({ default: m.Explore })));
const AnimeDetails = lazy(() => import('./pages/AnimeDetails').then((m) => ({ default: m.AnimeDetails })));
const Watch = lazy(() => import('./pages/Watch').then((m) => ({ default: m.Watch })));
const Discovery = lazy(() => import('./pages/Discovery').then((m) => ({ default: m.Discovery })));
const WatchlistPage = lazy(() => import('./pages/Watchlist').then((m) => ({ default: m.WatchlistPage })));
const SchedulePage = lazy(() => import('./pages/Schedule').then((m) => ({ default: m.SchedulePage })));
const MySpace = lazy(() => import('./pages/MySpace').then((m) => ({ default: m.MySpace })));
const Settings = lazy(() => import('./pages/MySpace').then((m) => ({ default: m.Settings })));
const WatchPartyHub = lazy(() => import('./pages/WatchPartyHub').then((m) => ({ default: m.WatchPartyHub })));
const HelpPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.HelpPage })));
const TermsPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.PrivacyPage })));
const DmcaPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.DmcaPage })));

const StudioRedirect: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const resolved = resolveStudioFilterName(name);
  return <Navigate to={`/explore?studio=${encodeURIComponent(resolved)}`} replace />;
};

const GenreRedirect: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const resolved = resolveGenreFilterName(name);
  return <Navigate to={`/explore?genre=${encodeURIComponent(resolved)}`} replace />;
};

const AppLayout: React.FC = () => {
  const location = useLocation();
  const isWatchPlayer = location.pathname.startsWith('/watch/');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  // Prevent Ctrl+A/Cmd+A and text/media selection globally (except in inputs and textareas)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        const target = e.target as HTMLElement | null;
        const isInput =
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable);
        if (!isInput) {
          e.preventDefault();
        }
      }
    };

    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (!isInput) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('selectstart', handleSelectStart);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('selectstart', handleSelectStart);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-[#f9f9f9] flex flex-col">
      <TopProgressBar />
      {!isWatchPlayer && <Sidebar />}

      <main className="flex-1">
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/anime" element={<AnimePage mode="all" />} />
            <Route path="/series" element={<AnimePage mode="series" />} />
            <Route path="/tv" element={<AnimePage mode="series" />} />
            <Route path="/movies" element={<AnimePage mode="movies" />} />
            <Route path="/explore" element={<Explore />} />

            <Route path="/anime/:id" element={<AnimeDetails />} />
            <Route path="/tv/:id" element={<AnimeDetails />} />
            <Route path="/movie/:id" element={<AnimeDetails />} />

            <Route path="/watch/anime/:id" element={<Watch />} />
            <Route path="/watch/anime/:id/:ep" element={<Watch />} />
            <Route path="/watch/anime/:id/:season/:ep" element={<Watch />} />

            <Route path="/discover" element={<Discovery />} />
            <Route path="/discover/:type" element={<Discovery />} />

            <Route path="/categories" element={<Navigate to="/explore" replace />} />
            <Route path="/categories/all/:type" element={<Navigate to="/explore" replace />} />
            <Route path="/studio/:name" element={<StudioRedirect />} />
            <Route path="/genre/:name" element={<GenreRedirect />} />
            <Route path="/category/:name" element={<GenreRedirect />} />

            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/schedules" element={<SchedulePage />} />
            <Route path="/schedule" element={<Navigate to="/schedules" replace />} />
            <Route path="/space" element={<MySpace />} />
            <Route path="/space/watchlist" element={<WatchlistPage />} />
            <Route path="/settings" element={<Settings />} />

            <Route path="/watch-party" element={<WatchPartyHub />} />
            <Route path="/watch-party/:code" element={<WatchPartyHub />} />

            <Route path="/help" element={<HelpPage />} />
            <Route path="/legal/terms" element={<TermsPage />} />
            <Route path="/legal/privacy" element={<PrivacyPage />} />
            <Route path="/legal/dmca" element={<DmcaPage />} />

            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
      </main>

      {!isWatchPlayer && <ScrollToTopButton />}
      {!isWatchPlayer && <Footer />}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0a0a0a',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#ffffff',
            borderRadius: '14px',
          },
        }}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
};

export default App;

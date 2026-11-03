import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getProfiles,
  saveProfiles,
  getActiveProfile,
  setActiveProfile,
  getWatchlist,
  getContinueWatching,
  clearSearchHistory,
  UserProfile,
  WatchlistEntry,
} from '../lib/storage';
import { ContinueWatchingRow } from '../components/ContentSections';
import { PosterCard } from '../components/PosterCard';
import { EditPencilIcon, UserIcon } from '../components/icons';
import { AnimatedSelect } from '../components/AnimatedSelect';

export const MySpace: React.FC = () => {
  const [profiles, setProfiles] = useState<UserProfile[]>(getProfiles());
  const [active, setActive] = useState<UserProfile>(getActiveProfile());
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>(getWatchlist());
  const [continueList, setContinueList] = useState(getContinueWatching());
  const [newProfileName, setNewProfileName] = useState('');
  const [addingProfile, setAddingProfile] = useState(false);

  const sync = () => {
    setProfiles(getProfiles());
    setActive(getActiveProfile());
    setWatchlist(getWatchlist());
    setContinueList(getContinueWatching());
  };

  useEffect(() => {
    window.addEventListener('bingr-storage-update', sync);
    return () => window.removeEventListener('bingr-storage-update', sync);
  }, []);

  const handleAddProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    const id = `profile-${Date.now()}`;
    const created: UserProfile = {
      id,
      name: newProfileName.trim(),
      avatar: `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(
        newProfileName.trim()
      )}`,
      isKids: false,
    };
    const updated = [...profiles, created];
    saveProfiles(updated);
    setActiveProfile(id);
    setNewProfileName('');
    setAddingProfile(false);
    sync();
  };

  return (
    <div className="min-h-screen bg-black pt-8 sm:pt-12 pb-24 select-none">
      {/* Top Profile Banner */}
      <div className="px-4 sm:px-6 md:px-12 md:pl-28 max-w-7xl mx-auto mb-10">
        <div className="rounded-3xl bg-[#0d0d0d] border border-white/10 p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 border-b border-white/[0.08]">
            <div className="flex items-center gap-4">
              <img
                src={active.avatar}
                alt={active.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover ring-2 ring-white/25 bg-[#141414]"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{active.name}</h1>
                  {active.isKids && (
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-black text-[10px] font-black uppercase">
                      Kids Mode
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-[#8f98a2] mt-0.5">
                  {watchlist.length} in Watchlist • {continueList.length} Active Streams
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/space/watchlist"
                className="px-5 py-2.5 rounded-xl bg-white text-black font-bold text-xs sm:text-sm hover:scale-105 transition-transform"
              >
                Full Watchlist
              </Link>
              <Link
                to="/settings"
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/15 transition-colors flex items-center gap-2"
              >
                <EditPencilIcon /> Settings
              </Link>
            </div>
          </div>

          {/* Profiles Switcher */}
          <div className="pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8f98a2] mb-4">
              Profiles
            </h3>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              {profiles.map((prof) => {
                const isCurrent = prof.id === active.id;
                return (
                  <button
                    key={prof.id}
                    onClick={() => {
                      setActiveProfile(prof.id);
                      sync();
                    }}
                    className="group flex flex-col items-center gap-2"
                  >
                    <div
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden transition-all ${
                        isCurrent
                          ? 'ring-2 ring-white scale-105'
                          : 'opacity-60 group-hover:opacity-100'
                      }`}
                    >
                      <img src={prof.avatar} alt={prof.name} className="w-full h-full object-cover" />
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        isCurrent ? 'text-white' : 'text-[#8f98a2] group-hover:text-white'
                      }`}
                    >
                      {prof.name}
                    </span>
                  </button>
                );
              })}

              {addingProfile ? (
                <form onSubmit={handleAddProfile} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="Profile name..."
                    autoFocus
                    className="bg-black text-white text-xs px-3 py-2 rounded-xl border border-white/20 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl bg-white text-black text-xs font-bold"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingProfile(false)}
                    className="text-xs text-[#8f98a2] hover:text-white px-2"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setAddingProfile(true)}
                  className="flex flex-col items-center gap-2 text-[#8f98a2] hover:text-white transition-colors"
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/5 hover:bg-white/10 border border-dashed border-white/25 flex items-center justify-center text-2xl">
                    +
                  </div>
                  <span className="text-xs font-bold">Add</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Continue Watching */}
      <ContinueWatchingRow items={continueList} onRemove={sync} />

      {/* Watchlist Preview */}
      <div className="px-4 sm:px-6 md:px-12 md:pl-28 max-w-7xl mx-auto mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-white">My Watchlist</h2>
          {watchlist.length > 0 && (
            <Link
              to="/space/watchlist"
              className="text-xs sm:text-sm font-bold text-[#8f98a2] hover:text-white"
            >
              View All ({watchlist.length}) &#10095;
            </Link>
          )}
        </div>

        {watchlist.length === 0 ? (
          <div className="rounded-2xl bg-[#0d0d0d] border border-white/10 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3 text-[#8f98a2]">
              <UserIcon />
            </div>
            <p className="text-sm sm:text-base font-bold text-white mb-1">
              Your Anime Watchlist is Empty
            </p>
            <p className="text-xs text-[#8f98a2] mb-5">
              Save anime series and movies to keep track of what you want to watch next.
            </p>
            <Link
              to="/discover/anime"
              className="inline-block px-6 py-2.5 rounded-full bg-white text-black font-bold text-xs sm:text-sm hover:scale-105 transition-transform"
            >
              Explore Anime
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4">
            {watchlist.slice(0, 14).map((entry) => (
              <PosterCard key={entry.id} item={entry as any} className="w-full" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const Settings: React.FC = () => {
  const [defaultLang, setDefaultLang] = useState(
    localStorage.getItem('bingr_default_lang') || 'sub'
  );
  const [autoSkip, setAutoSkip] = useState(
    localStorage.getItem('bingr_auto_skip') !== 'false'
  );
  const [toast, setToast] = useState('');

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  return (
    <div className="min-h-screen bg-black pt-8 sm:pt-12 pb-24 px-4 sm:px-6 md:px-12 md:pl-28 select-none">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/space"
          className="text-xs font-bold text-[#8f98a2] hover:text-white inline-flex items-center gap-1.5 mb-2"
        >
          &#10094; Back to My Space
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">
          Settings & Preferences
        </h1>

        {toast && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-xs sm:text-sm font-bold">
            {toast}
          </div>
        )}

        <div className="space-y-6">
          <div className="rounded-2xl bg-[#0d0d0d] border border-white/10 p-6 space-y-5">
            <h2 className="text-base sm:text-lg font-bold text-white">Playback Preferences</h2>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-white">Preferred Anime Audio</p>
                <p className="text-xs text-[#8f98a2]">
                  Default audio track when launching the player
                </p>
              </div>
              <AnimatedSelect
                value={defaultLang}
                onChange={(val) => {
                  setDefaultLang(val);
                  localStorage.setItem('bingr_default_lang', val);
                  showNotice('Default audio preference saved.');
                }}
                options={[
                  { value: 'sub', label: 'Original Japanese (SUB)' },
                  { value: 'dub', label: 'English Dubbed (DUB)' },
                  { value: 'multi', label: 'Multi-Audio (Anivexa)' },
                ]}
                align="right"
                triggerClassName="min-w-[200px]"
              />
            </div>

            <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
              <div>
                <p className="text-sm font-bold text-white">AniSkip Intro & Outro Prompts</p>
                <p className="text-xs text-[#8f98a2]">
                  Show skip buttons during anime openings and endings
                </p>
              </div>
              <button
                onClick={() => {
                  const next = !autoSkip;
                  setAutoSkip(next);
                  localStorage.setItem('bingr_auto_skip', String(next));
                  showNotice('AniSkip setting updated.');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors ${
                  autoSkip ? 'bg-white text-black' : 'bg-white/10 text-[#8f98a2]'
                }`}
              >
                {autoSkip ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0d0d0d] border border-white/10 p-6 space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-white">Storage & Privacy</h2>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  localStorage.removeItem('bingr_anime_continue_watching');
                  window.dispatchEvent(new Event('bingr-storage-update'));
                  showNotice('Continue Watching history cleared.');
                }}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white"
              >
                Clear Continue Watching
              </button>

              <button
                onClick={() => {
                  clearSearchHistory();
                  showNotice('Recent search history cleared.');
                }}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white"
              >
                Clear Search History
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

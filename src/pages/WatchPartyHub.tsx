import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimeMedia, fetchTrendingAnime, fetchSearchAnime } from '../lib/api';
import { getActiveProfile } from '../lib/storage';
import { UsersIcon, PlayIcon, SearchIcon } from '../components/icons';

interface ChatMessage {
  id: string;
  sender: string;
  avatar: string;
  text: string;
  time: string;
}

export const WatchPartyHub: React.FC = () => {
  const { code } = useParams<{ code?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialAnimeId = searchParams.get('anime') || '113415';
  const initialAnimeTitle = searchParams.get('title') || 'Jujutsu Kaisen';

  const [joinCode, setJoinCode] = useState('');
  const [trending, setTrending] = useState<AnimeMedia[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<AnimeMedia[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<{ id: string | number; title: string }>({
    id: initialAnimeId,
    title: initialAnimeTitle,
  });
  const [episode, setEpisode] = useState(1);
  const [audioMode, setAudioMode] = useState<'sub' | 'dub'>('sub');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'sys-1',
      sender: 'Kotatsu Sync',
      avatar: '/brand/logo.png',
      text: 'Welcome to the Watch Party! Share your room code with friends to watch together.',
      time: 'Now',
    },
  ]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    fetchTrendingAnime(1)
      .then((res) => {
        setTrending(res.results);
        if (!searchParams.get('anime') && res.results[0]) {
          setSelectedAnime({ id: res.results[0].id, title: res.results[0].title });
        }
      })
      .catch(() => {});
  }, [searchParams]);

  useEffect(() => {
    if (!searchQ.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetchSearchAnime(searchQ, 1)
        .then((res) => setSearchResults(res.results.slice(0, 8)))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  const handleCreateRoom = () => {
    const generated = Math.random().toString(36).substring(2, 8).toUpperCase();
    navigate(
      `/watch-party/${generated}?anime=${selectedAnime.id}&title=${encodeURIComponent(
        selectedAnime.title
      )}&ep=${episode}`
    );
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    navigate(`/watch-party/${joinCode.trim().toUpperCase()}`);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const profile = getActiveProfile();
    const msg: ChatMessage = {
      id: String(Date.now()),
      sender: profile.name,
      avatar: profile.avatar,
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, msg]);
    setChatInput('');
  };

  if (code) {
    const activeAnimeId = searchParams.get('anime') || selectedAnime.id;
    const activeTitle = searchParams.get('title') || selectedAnime.title;

    return (
      <div className="min-h-screen bg-black pt-6 pb-20 px-4 sm:px-6 md:px-10 md:pl-28 flex flex-col lg:flex-row gap-6 select-none">
        {/* Left: Synchronized Video Player */}
        <div className="flex-1 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                  Live Watch Party • Room {code}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
                {activeTitle} — Episode {episode}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-[#0d0d0d] p-1 rounded-xl border border-white/10">
                {(['sub', 'dub'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setAudioMode(m)}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold uppercase ${
                      audioMode === m ? 'bg-white text-black' : 'text-[#8f98a2] hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                }}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/15"
              >
                Copy Invite Link
              </button>
            </div>
          </div>

          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl">
            <iframe
              src={`https://vidsrc.cc/v2/embed/anime/ani${activeAnimeId}/${episode}/${audioMode}?autoPlay=true`}
              title={activeTitle}
              allowFullScreen
              allow="autoplay; fullscreen"
              className="w-full h-full border-0"
            />
          </div>

          <div className="mt-4 flex items-center justify-between bg-[#0d0d0d] p-3.5 rounded-xl border border-white/10">
            <span className="text-xs font-bold text-[#8f98a2]">Switch Episode:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEpisode((ep) => Math.max(1, ep - 1))}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white"
              >
                &#10094; Prev EP
              </button>
              <span className="text-xs font-extrabold text-white px-2">EP {episode}</span>
              <button
                onClick={() => setEpisode((ep) => ep + 1)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white"
              >
                Next EP &#10095;
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Party Chat */}
        <div className="w-full lg:w-88 xl:w-96 rounded-2xl bg-[#0d0d0d] border border-white/10 flex flex-col h-[520px] lg:h-auto">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UsersIcon active />
              <span className="text-sm font-bold text-white">Party Chat</span>
            </div>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-gray-300">
              Room: {code}
            </span>
          </div>

          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3">
            {messages.map((m) => (
              <div key={m.id} className="flex items-start gap-2.5">
                <img
                  src={m.avatar}
                  alt={m.sender}
                  className="w-7 h-7 rounded-full object-cover bg-black shrink-0 mt-0.5"
                />
                <div className="bg-white/[0.05] rounded-2xl rounded-tl-sm px-3.5 py-2 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-bold text-white">{m.sender}</span>
                    <span className="text-[10px] text-[#8f98a2]">{m.time}</span>
                  </div>
                  <p className="text-xs text-gray-200 leading-relaxed">{m.text}</p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendChat} className="p-3 border-t border-white/10 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Say something to the room..."
              className="flex-1 bg-black text-white text-xs px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/30"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:scale-105 transition-transform"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-10 sm:pt-14 pb-24 px-4 sm:px-6 md:px-12 md:pl-28 select-none">
      <div className="max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="w-16 h-16 rounded-3xl bg-white/10 border border-white/15 flex items-center justify-center mx-auto mb-4 text-white">
            <UsersIcon active />
          </div>
          <h1
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            className="text-4xl sm:text-6xl tracking-wider text-white uppercase"
          >
            Kotatsu Anime Watch Party
          </h1>
          <p className="text-xs sm:text-sm text-[#8f98a2] mt-2">
            Stream anime in real-time sync with friends, switch between Sub & Dub, and chat live.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Room Card */}
          <div className="rounded-3xl bg-[#0d0d0d] border border-white/10 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/50">
                Host a Session
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-1 mb-4">
                Create a Watch Party
              </h2>

              <div className="mb-4">
                <label className="block text-xs font-bold text-[#8f98a2] mb-1.5">
                  Selected Anime
                </label>
                <div className="p-3 rounded-xl bg-black border border-white/10 text-sm font-bold text-white mb-2">
                  {selectedAnime.title}
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#8f98a2]">
                    <SearchIcon />
                  </div>
                  <input
                    type="text"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="Search another anime to host..."
                    className="w-full bg-black text-white text-xs pl-9 pr-3 py-2.5 rounded-xl border border-white/10 focus:outline-none"
                  />
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-black border border-white/10 divide-y divide-white/5">
                    {searchResults.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedAnime({ id: item.id, title: item.title });
                          setSearchQ('');
                          setSearchResults([]);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-white hover:bg-white/10 flex items-center justify-between"
                      >
                        <span className="truncate">{item.title}</span>
                        <span className="text-[10px] text-[#8f98a2]">{item.year}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleCreateRoom}
              className="w-full h-12 rounded-xl bg-white text-black font-extrabold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
            >
              <PlayIcon /> Launch Party Room
            </button>
          </div>

          {/* Join Existing Room Card */}
          <div className="rounded-3xl bg-[#0d0d0d] border border-white/10 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/50">
                Have an Invite Code?
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-1 mb-4">
                Join Friend&rsquo;s Room
              </h2>
              <p className="text-xs sm:text-sm text-[#8f98a2] mb-6">
                Enter the 6-character room code shared by the host to jump directly into the synchronized stream.
              </p>

              <form onSubmit={handleJoinRoom} className="space-y-4">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="E.G. K8X92A"
                  maxLength={8}
                  className="w-full h-12 text-center tracking-[0.3em] uppercase font-extrabold text-lg rounded-xl bg-black text-white border border-white/15 focus:outline-none focus:border-white/40"
                />
                <button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-sm border border-white/15 transition-colors"
                >
                  Join Room
                </button>
              </form>
            </div>

            {trending.length > 0 && (
              <div className="mt-6 pt-4 border-t border-white/5">
                <p className="text-[11px] text-[#8f98a2] font-bold mb-2">
                  Popular Party Picks Right Now:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {trending.slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedAnime({ id: item.id, title: item.title })}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-[11px] font-bold text-gray-300 transition-colors"
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

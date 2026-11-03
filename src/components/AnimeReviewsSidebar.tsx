import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimeMedia, AnimeReview, fetchAnimeReviews } from '../lib/api';

interface AnimeReviewsSidebarProps {
  anime: AnimeMedia;
  className?: string;
}

// Clean review text for snippets: remove custom markdown, spoilers, images, and raw markup
function cleanSnippet(text: string): string {
  if (!text) return '';
  return text
    .replace(/~~~[\s\S]*?~~~/g, '') // Remove code/image blocks
    .replace(/~![\s\S]*?!~/g, '[Spoiler]') // Mask spoilers in excerpt
    .replace(/!\[.*?\]\(.*?\)/g, '') // Markdown images
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Markdown links -> text
    .replace(/<[^>]+>/g, '') // HTML tags
    .replace(/[#*_~`]/g, '') // Markdown styling symbols
    .replace(/\s+/g, ' ')
    .trim();
}

// Format relative or date string
function formatReviewDate(timestampMs?: number | null): string {
  if (!timestampMs) return '';
  const date = new Date(timestampMs);
  const now = Date.now();
  const diffDays = Math.floor((now - timestampMs) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months}mo ago`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years}y ago`;
}

// Interactive spoiler element inside review modal body
const SpoilerText: React.FC<{ text: string }> = ({ text }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setRevealed(!revealed);
      }}
      title={revealed ? 'Click to hide spoiler' : 'Spoiler: click to reveal'}
      className={`cursor-pointer rounded px-1.5 py-0.5 transition-all text-xs font-mono select-none ${
        revealed
          ? 'bg-red-500/15 text-white/90 border border-red-500/30'
          : 'bg-white/10 hover:bg-white/15 text-white/30 border border-white/10'
      }`}
    >
      {revealed ? text : '⚠ Spoiler (click to show)'}
    </span>
  );
};

// Render full review paragraphs with spoiler support
const ReviewBodyRenderer: React.FC<{ body: string }> = ({ body }) => {
  if (!body) return null;

  // Split into paragraphs
  const cleanBody = body
    .replace(/~~~[\s\S]*?~~~/g, '') // Strip large embedded images
    .replace(/<br\s*\/?>/gi, '\n');

  const paragraphs = cleanBody
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3.5 text-[13.5px] sm:text-[14px] leading-relaxed text-white/80">
      {paragraphs.map((para, idx) => {
        // Parse spoilers within paragraph
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        const spoilerRegex = /~!([\s\S]*?)!~/g;
        let match: RegExpExecArray | null;

        while ((match = spoilerRegex.exec(para)) !== null) {
          if (match.index > lastIndex) {
            parts.push(para.substring(lastIndex, match.index));
          }
          const spoilerContent = match[1];
          parts.push(
            <SpoilerText
              key={`spoiler-${idx}-${match.index}`}
              text={spoilerContent}
            />
          );
          lastIndex = match.index + match[0].length;
        }

        if (lastIndex < para.length) {
          parts.push(para.substring(lastIndex));
        }

        return (
          <p key={idx} className="whitespace-pre-line">
            {parts}
          </p>
        );
      })}
    </div>
  );
};

export const AnimeReviewsSidebar: React.FC<AnimeReviewsSidebarProps> = memo(({
  anime,
  className = '',
}) => {
  const [reviews, setReviews] = useState<AnimeReview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedReview, setSelectedReview] = useState<AnimeReview | null>(null);

  // Fetch reviews whenever the anime changes
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    fetchAnimeReviews(anime.id, anime.idMal)
      .then((data) => {
        if (!isCancelled) {
          setReviews(data || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setReviews([]);
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [anime.id, anime.idMal]);

  // Lock body scroll when review modal is open
  useEffect(() => {
    if (selectedReview) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setSelectedReview(null);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [selectedReview]);

  // Overall average score calculation or AniList score fallback
  const averageReviewScore = (() => {
    const scores = reviews.filter((r) => typeof r.score === 'number').map((r) => r.score as number);
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return (avg / 10).toFixed(1);
    }
    if (anime.score) {
      return (anime.score / 10).toFixed(1);
    }
    return null;
  })();

  const anilistUrl = `https://anilist.co/anime/${anime.id}`;

  return (
    <>
      <aside
        aria-label="Community Reviews"
        className={`w-full rounded-2xl bg-transparent backdrop-blur-md flex flex-col max-h-[620px] xl:max-h-[660px] select-none ${className}`}
      >


        {/* Content list (scrollable, no scrollbar) */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-2.5 mt-3 pr-0.5 min-h-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {loading ? (
            /* Loading skeletons */
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/10" />
                      <div className="w-20 h-3 bg-white/10 rounded" />
                    </div>
                    <div className="w-10 h-3 bg-white/10 rounded" />
                  </div>
                  <div className="w-3/4 h-3.5 bg-white/10 rounded" />
                  <div className="w-full h-2.5 bg-white/5 rounded" />
                  <div className="w-4/5 h-2.5 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            /* Empty state */
            <div className="py-10 px-4 text-center flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/30 mb-3">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-[13px] font-semibold text-white/70">No reviews yet</p>
              <p className="text-[11.5px] text-white/40 mt-1 max-w-[200px]">
                Be the first to share your thoughts on this series.
              </p>
              <a
                href={anilistUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 text-[11.5px] font-medium text-white/70 hover:text-white inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-all"
              >
                Write on AniList
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          ) : (
            /* Reviews list */
            reviews.map((review) => {
              const displayScore =
                typeof review.score === 'number'
                  ? (review.score / 10).toFixed(1)
                  : null;
              const excerpt = cleanSnippet(review.body || review.summary);
              const dateStr = formatReviewDate(review.createdAt);

              return (
                <div
                  key={review.id}
                  onClick={() => setSelectedReview(review)}
                  className="group p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/20 transition-all duration-200 cursor-pointer flex flex-col gap-1.5"
                >
                  {/* Card Header: User & Rating */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {review.user?.avatar ? (
                        <img
                          src={review.user.avatar}
                          alt={review.user.name}
                          className="w-5 h-5 rounded-full object-cover shrink-0 bg-white/10"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-white/10 text-white/80 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {review.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <span className="text-[12px] font-semibold text-white/90 group-hover:text-white truncate">
                        {review.user?.name || 'Reviewer'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {dateStr && (
                        <span className="text-[10.5px] text-white/40 font-normal">
                          {dateStr}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Headline / Summary */}
                  {review.summary && (
                    <h4 className="text-[12.5px] font-semibold text-white/95 group-hover:text-white leading-snug line-clamp-2">
                      {review.summary}
                    </h4>
                  )}

                  {/* Body Snippet */}
                  {excerpt && (
                    <p className="text-[11.5px] text-white/55 group-hover:text-white/65 leading-relaxed line-clamp-2">
                      {excerpt}
                    </p>
                  )}

                  {/* Card Footer: Upvotes & Read Action */}
                  <div className="flex items-center justify-between pt-1 text-[10.5px] text-white/40">
                    <div className="flex items-center gap-1">
                      {review.rating && review.rating > 0 ? (
                        <span className="flex items-center gap-1 text-white/50">
                          <svg
                            width="9"
                            height="9"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="text-white/40"
                          >
                            <path d="M12 4l8 16H4z" />
                          </svg>
                          <span>{review.rating}</span>
                        </span>
                      ) : null}
                    </div>
                    <span className="group-hover:text-white/80 transition-colors flex items-center gap-0.5 font-medium">
                      Read full
                      <svg
                        width="9"
                        height="9"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* FULL REVIEW MODAL DIALOG */}
      <AnimatePresence>
        {selectedReview && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Full Anime Review"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setSelectedReview(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Dialog Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-full max-w-xl max-h-[85vh] bg-[#111111] border border-white/[0.12] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/[0.08] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {selectedReview.user?.avatar ? (
                    <img
                      src={selectedReview.user.avatar}
                      alt={selectedReview.user.name}
                      className="w-9 h-9 rounded-full object-cover shrink-0 bg-white/10 border border-white/10"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-white/10 text-white font-bold flex items-center justify-center shrink-0 text-sm">
                      {selectedReview.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white truncate">
                        {selectedReview.user?.name || 'Reviewer'}
                      </h3>
                      {typeof selectedReview.score === 'number' && (
                        <span className="text-xs font-bold text-white bg-white/[0.08] border border-white/10 px-2 py-0.5 rounded-md">
                          ★ {(selectedReview.score / 10).toFixed(1)}/10
                        </span>
                      )}
                    </div>
                    {selectedReview.createdAt && (
                      <span className="text-[11px] text-white/40 block">
                        Reviewed {new Date(selectedReview.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setSelectedReview(null)}
                  className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white/60 hover:text-white flex items-center justify-center transition-colors shrink-0"
                  title="Close review (Esc)"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {selectedReview.summary && (
                  <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
                    {selectedReview.summary}
                  </h2>
                )}

                <ReviewBodyRenderer body={selectedReview.body} />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-4 px-5 border-t border-white/[0.08] bg-[#0c0c0c] shrink-0">
                <div className="text-xs text-white/50 flex items-center gap-1.5">
                  {selectedReview.rating && selectedReview.rating > 0 ? (
                    <>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="text-white/60"
                      >
                        <path d="M12 4l8 16H4z" />
                      </svg>
                      <span>
                        <strong className="text-white/90">{selectedReview.rating}</strong> people found this helpful
                      </span>
                    </>
                  ) : (
                    <span>Community review from AniList</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedReview(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/15 text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
});

AnimeReviewsSidebar.displayName = 'AnimeReviewsSidebar';

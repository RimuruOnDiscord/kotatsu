import React from 'react';
import {
  HelpEmblem,
  TermsEmblem,
  PrivacyEmblem,
  DmcaEmblem,
} from '../components/icons';

export const HelpPage: React.FC = () => (
  <div className="min-h-screen bg-black pt-12 pb-24 px-4 sm:px-6 md:px-12 md:pl-28 select-none">
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center gap-6 mb-10 p-6 sm:p-8 rounded-3xl bg-[#0d0d0d] border border-white/10">
        <HelpEmblem />
        <div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-2">
            Kotatsu Help Center
          </h1>
          <p className="text-xs sm:text-sm text-[#8f98a2]">
            Answers to common questions about anime playback, subtitles, audio tracks, and watch parties.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {[
          {
            q: 'How do I switch between Japanese (SUB) and English (DUB) audio?',
            a: 'Inside the video player top bar, click the SUB or DUB toggle buttons. You can also set your default preferred audio language in Settings.',
          },
          {
            q: 'What if an anime episode buffers or fails to load?',
            a: 'Use the provider dropdown in the top-right corner of the video player to switch between Anivexa HLS providers, VidSrc Pro, and VidLink HD.',
          },
          {
            q: 'How does Watchlist and Continue Watching work?',
            a: 'Your Watchlist and Continue Watching progress are automatically saved locally to your browser profile inside My Space.',
          },
        ].map((faq, idx) => (
          <div key={idx} className="p-6 rounded-2xl bg-[#0d0d0d] border border-white/10">
            <h3 className="text-sm sm:text-base font-bold text-white mb-2">{faq.q}</h3>
            <p className="text-xs sm:text-sm text-[#8f98a2] leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const TermsPage: React.FC = () => (
  <div className="min-h-screen bg-black pt-12 pb-24 px-4 sm:px-6 md:px-12 md:pl-28 select-none">
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center gap-6 mb-10 p-6 sm:p-8 rounded-3xl bg-[#0d0d0d] border border-white/10">
        <TermsEmblem />
        <div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-2">Terms of Use</h1>
          <p className="text-xs sm:text-sm text-[#8f98a2]">
            Please read these terms carefully before using Kotatsu.
          </p>
        </div>
      </div>

      <div className="p-6 sm:p-8 rounded-2xl bg-[#0d0d0d] border border-white/10 space-y-4 text-xs sm:text-sm text-[#8f98a2] leading-relaxed">
        <p>
          Kotatsu is a client-side anime discovery and indexing interface. We do not host, store, or upload any video or media files on our servers.
        </p>
        <p>
          All metadata, posters, and episode synopses are provided for informational and personal entertainment discovery purposes.
        </p>
      </div>
    </div>
  </div>
);

export const PrivacyPage: React.FC = () => (
  <div className="min-h-screen bg-black pt-12 pb-24 px-4 sm:px-6 md:px-12 md:pl-28 select-none">
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center gap-6 mb-10 p-6 sm:p-8 rounded-3xl bg-[#0d0d0d] border border-white/10">
        <PrivacyEmblem />
        <div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-2">Privacy Policy</h1>
          <p className="text-xs sm:text-sm text-[#8f98a2]">
            Your privacy and local profile data stay on your device.
          </p>
        </div>
      </div>

      <div className="p-6 sm:p-8 rounded-2xl bg-[#0d0d0d] border border-white/10 space-y-4 text-xs sm:text-sm text-[#8f98a2] leading-relaxed">
        <p>
          Kotatsu stores your Watchlist, Continue Watching progress, profiles, and playback preferences directly in your browser&rsquo;s localStorage.
        </p>
        <p>
          You can clear your watch history and search history at any time from the Settings page.
        </p>
      </div>
    </div>
  </div>
);

export const DmcaPage: React.FC = () => (
  <div className="min-h-screen bg-black pt-12 pb-24 px-4 sm:px-6 md:px-12 md:pl-28 select-none">
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center gap-6 mb-10 p-6 sm:p-8 rounded-3xl bg-[#0d0d0d] border border-white/10">
        <DmcaEmblem />
        <div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-2">DMCA Disclaimer</h1>
          <p className="text-xs sm:text-sm text-[#8f98a2]">
            Digital Millennium Copyright Act compliance statement.
          </p>
        </div>
      </div>

      <div className="p-6 sm:p-8 rounded-2xl bg-[#0d0d0d] border border-white/10 space-y-4 text-xs sm:text-sm text-[#8f98a2] leading-relaxed">
        <p>
          Kotatsu respects the intellectual property rights of others. Because Kotatsu merely indexes publicly available third-party embeds and does not host any media content, any takedown requests should be directed to the respective third-party hosting providers.
        </p>
      </div>
    </div>
  </div>
);

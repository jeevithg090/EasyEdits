import React from 'react';
import { Github, Video } from 'lucide-react';
import { REPO_URL } from '../lib/site';

export const Footer: React.FC = () => (
  <footer className="relative z-10 border-t border-white/5 py-10">
    <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-pink-500">
          <Video className="h-5 w-5 text-white" aria-hidden="true" />
        </span>
        <span className="text-lg font-bold text-white">Easy Edits</span>
      </div>
      <p className="text-center text-sm text-gray-400">
        Short-form content studio. Runs locally with your own API keys.
      </p>
      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
      >
        <Github className="h-5 w-5" aria-hidden="true" />
        Source on GitHub
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  </footer>
);

import React from 'react';
import { ArrowLeft, Compass } from 'lucide-react';

interface NotFoundPageProps {
  path: string;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ path }) => (
  <div className="flex min-h-[80svh] flex-col items-center justify-center px-4 pb-16 pt-28 text-center">
    <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
      <Compass className="h-8 w-8 text-brand-300" aria-hidden="true" />
    </span>
    <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand-300">404</p>
    <h1 className="mb-3 text-3xl font-bold text-white sm:text-4xl">Page not found</h1>
    <p className="mb-8 max-w-md text-gray-400">
      There is no studio at{' '}
      <code className="break-all rounded bg-white/10 px-1.5 py-0.5 text-gray-200">{path}</code>. It
      may have been renamed, or the link is mistyped.
    </p>
    <a
      href="#/"
      className="inline-flex items-center rounded-xl bg-gradient-to-r from-brand-600 to-pink-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-500/20 transition-opacity hover:opacity-90"
    >
      <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
      Back to all studios
    </a>
  </div>
);

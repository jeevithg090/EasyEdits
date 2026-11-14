import React from 'react';
import { Loader2 } from 'lucide-react';

/** Shown while a lazily loaded studio's code is downloading. */
export const PageLoader: React.FC<{ label?: string }> = ({ label = 'Loading studio…' }) => (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-[70svh] flex-col items-center justify-center gap-3 pt-16 text-gray-400"
  >
    <Loader2 className="h-8 w-8 animate-spin text-brand-400" aria-hidden="true" />
    <span className="text-sm">{label}</span>
  </div>
);

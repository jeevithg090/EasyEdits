import React from 'react';
import { ViewState } from '../types';
import { Video } from 'lucide-react';

interface NavbarProps {
  onNavigate: (view: ViewState) => void;
}

const sectionLinks = [
  { id: 'categories', label: 'Studios' },
  { id: 'how-it-works', label: 'How it works' },
];

export const Navbar: React.FC<NavbarProps> = ({ onNavigate }) => {
  const goToSection = (id: string) => {
    onNavigate('HOME');
    // Wait for the home view to render before scrolling to the section.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      });
    });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-surface/70 backdrop-blur-lg">
      <nav aria-label="Main" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onNavigate('HOME')}
            className="group -ml-1 flex items-center gap-2 rounded-lg p-1"
            aria-label="Easy Edits home"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-pink-500 shadow-lg shadow-brand-500/20 transition-transform group-hover:scale-105">
              <Video className="h-5 w-5 text-white" aria-hidden="true" />
            </span>
            <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-lg font-bold text-transparent sm:text-xl">
              Easy Edits
            </span>
          </button>

          <div className="flex items-center gap-1 sm:gap-2">
            {sectionLinks.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  goToSection(link.id);
                }}
                className="inline-flex min-h-[44px] items-center rounded-lg px-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white sm:px-3"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
};

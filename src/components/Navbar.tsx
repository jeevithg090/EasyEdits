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
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  return (
    <nav
      aria-label="Main"
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-lg"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            type="button"
            onClick={() => onNavigate('HOME')}
            className="flex items-center space-x-2 group"
            aria-label="Easy Edits home"
          >
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center group-hover:bg-brand-400 transition-colors">
              <Video className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Easy Edits
            </span>
          </button>

          <div className="flex items-center gap-4">
            {sectionLinks.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  goToSection(link.id);
                }}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};

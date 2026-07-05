import React from 'react';
import { ViewState } from '../types';
import { Sparkles, Video } from 'lucide-react';

interface NavbarProps {
  onNavigate: (view: ViewState) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate }) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button 
            onClick={() => onNavigate('HOME')}
            className="flex items-center space-x-2 group"
          >
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center group-hover:bg-brand-400 transition-colors">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Easy Edits
            </span>
          </button>
          
          <div className="flex items-center space-x-4">
            <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">How it works</a>
            <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
            <button className="text-sm font-medium text-brand-400 flex items-center px-3 py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 transition-colors">
              <Sparkles className="w-4 h-4 mr-2" />
              Pro Access
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
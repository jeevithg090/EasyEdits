import React from 'react';
import { ContentCategory } from '../types';
import { Mic, Trophy, Smartphone, Clapperboard, GraduationCap, Flame } from 'lucide-react';

interface CategoryCardProps {
  category: ContentCategory;
  onClick: (category: ContentCategory) => void;
}

const getCategoryIcon = (category: ContentCategory) => {
  switch (category) {
    case ContentCategory.PODCAST:
      return <Mic className="w-8 h-8" />;
    case ContentCategory.SPORTS:
      return <Trophy className="w-8 h-8" />;
    case ContentCategory.TECHNOLOGY:
      return <Smartphone className="w-8 h-8" />;
    case ContentCategory.ENTERTAINMENT:
      return <Clapperboard className="w-8 h-8" />;
    case ContentCategory.EDUCATIONAL:
      return <GraduationCap className="w-8 h-8" />;
    case ContentCategory.MOTIVATIONAL:
      return <Flame className="w-8 h-8" />;
  }
};

const getCategoryGradient = (category: ContentCategory) => {
  switch (category) {
    case ContentCategory.PODCAST:
      return 'from-purple-500 to-indigo-500';
    case ContentCategory.SPORTS:
      return 'from-orange-500 to-red-500';
    case ContentCategory.TECHNOLOGY:
      return 'from-blue-500 to-cyan-500';
    case ContentCategory.ENTERTAINMENT:
      return 'from-pink-500 to-rose-500';
    case ContentCategory.EDUCATIONAL:
      return 'from-green-500 to-emerald-500';
    case ContentCategory.MOTIVATIONAL:
      return 'from-yellow-500 to-amber-500';
  }
};

export const CategoryCard: React.FC<CategoryCardProps> = ({ category, onClick }) => {
  return (
    <button
      onClick={() => onClick(category)}
      className="group relative h-64 w-full overflow-hidden rounded-2xl glass-card transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl text-left"
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${getCategoryGradient(category)} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
      />

      <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
        <div
          className={`w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform duration-300 border border-white/10`}
        >
          {getCategoryIcon(category)}
        </div>

        <div>
          <h3 className="text-2xl font-bold text-white mb-2">{category}</h3>
          <p className="text-gray-400 text-sm opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
            Generate viral scripts and ideas for {category.toLowerCase()} content.
          </p>
        </div>
      </div>

      {/* Decorative blurs */}
      <div
        className={`absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br ${getCategoryGradient(category)} rounded-full blur-[80px] opacity-20`}
      />
    </button>
  );
};

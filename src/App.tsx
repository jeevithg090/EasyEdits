import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';

import { Generator } from './components/Generator';
import { PodcastPage } from './components/PodcastPage';
import { TextHighlighterPage } from './components/TextHighlighterPage';
import { MusicPage } from './components/MusicPage';
import { MotivationalPage } from './components/MotivationalPage';
import { SportsPage } from './components/SportsPage';
import { MovieTVPage } from './components/MovieTVPage';
import { NewsPage } from './components/NewsPage';
import { ContentCategory, ViewState } from './types';
import {
  ArrowRight,
  PlayCircle,
  Sparkles,
  Zap,
  Layers,
  Wand2,
  Video,
  FileText,
  Music,
  Mic,
  Trophy,
  Newspaper,
  ChevronDown,
  TrendingUp,
  Github,
  Twitter,
  Instagram,
  Check,
} from 'lucide-react';

const categories = Object.values(ContentCategory);

const features = [
  {
    icon: <Wand2 className="w-6 h-6" />,
    title: "AI-Powered Scripts",
    description: "Generate viral hooks, compelling narratives, and CTAs tailored to your niche",
    gradient: "from-violet-500 to-purple-600"
  },
  {
    icon: <Video className="w-6 h-6" />,
    title: "Visual Cue Suggestions",
    description: "Get shot-by-shot visual recommendations that match your script perfectly",
    gradient: "from-pink-500 to-rose-600"
  },
  {
    icon: <Layers className="w-6 h-6" />,
    title: "Multi-Format Export",
    description: "Export to TikTok, Reels, Shorts, or any platform-optimized format",
    gradient: "from-cyan-500 to-blue-600"
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Instant Generation",
    description: "From idea to content-ready assets in under 30 seconds",
    gradient: "from-amber-500 to-orange-600"
  }
];



const categoryDescriptions: Record<ContentCategory, { tagline: string; features: string[] }> = {
  [ContentCategory.PODCAST]: {
    tagline: "Create captioned clips that go viral",
    features: ["Auto-captions", "Voice sync", "Multiple styles"]
  },
  [ContentCategory.SPORTS]: {
    tagline: "Epic sports edits with dynamic effects",
    features: ["Beat sync", "Highlight reels", "Commentary overlays"]
  },
  [ContentCategory.TECHNOLOGY]: {
    tagline: "Tech reviews & tutorials that educate",
    features: ["Text highlights", "Code snippets", "Screen recordings"]
  },
  [ContentCategory.ENTERTAINMENT]: {
    tagline: "Movie & TV content that engages",
    features: ["Scene breakdowns", "Easter eggs", "Fan theories"]
  },
  [ContentCategory.EDUCATIONAL]: {
    tagline: "Learn & teach with visual clarity",
    features: ["Step-by-step", "Diagrams", "Quick tips"]
  },
  [ContentCategory.MOTIVATIONAL]: {
    tagline: "Inspire millions with powerful stories",
    features: ["Quote overlays", "Cinematic B-roll", "Music sync"]
  },
  [ContentCategory.MUSIC]: {
    tagline: "Audio-visual experiences that mesmerize",
    features: ["Waveforms", "Lyrics sync", "Beat drops"]
  },
  [ContentCategory.NEWS]: {
    tagline: "Breaking news that informs instantly",
    features: ["Ticker overlays", "Source cards", "Fact checks"]
  }
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('HOME');
  const [selectedCategory, setSelectedCategory] = useState<ContentCategory | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleCategorySelect = (category: ContentCategory) => {
    setSelectedCategory(category);
    if (category === ContentCategory.PODCAST) {
      setCurrentView('PODCAST');
    } else if (category === ContentCategory.TECHNOLOGY) {
      setCurrentView('TEXT_HIGHLIGHTER');
    } else if (category === ContentCategory.MUSIC) {
      setCurrentView('MUSIC');
    } else if (category === ContentCategory.MOTIVATIONAL) {
      setCurrentView('MOTIVATIONAL');
    } else if (category === ContentCategory.SPORTS) {
      setCurrentView('SPORTS');
    } else if (category === ContentCategory.ENTERTAINMENT) {
      setCurrentView('ENTERTAINMENT');
    } else if (category === ContentCategory.NEWS) {
      setCurrentView('NEWS');
    } else {
      setCurrentView('GENERATOR');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (view: ViewState) => {
    setCurrentView(view);
    if (view === 'HOME') {
      setSelectedCategory(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#030014] text-white font-sans selection:bg-violet-500/30 overflow-x-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Main gradient orbs */}
        <div
          className="absolute w-[800px] h-[800px] rounded-full blur-[150px] opacity-30 transition-all duration-1000"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
            left: `${mousePosition.x * 0.02}px`,
            top: `${mousePosition.y * 0.02 - 200}px`,
          }}
        />
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.5) 0%, transparent 70%)',
            right: '10%',
            top: '30%',
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, transparent 70%)',
            left: '20%',
            bottom: '10%',
          }}
        />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '80px 80px'
          }}
        />
      </div>

      <Navbar onNavigate={handleNavigate} />

      {currentView === 'HOME' && (
        <main className="relative z-10 animate-fade-in">
          {/* Hero Section */}
          <section className="relative min-h-screen flex items-center justify-center pt-20 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto text-center relative">
              {/* Badge */}
              <div className="inline-flex items-center px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-500/10 to-pink-500/10 border border-violet-500/20 mb-8 backdrop-blur-xl animate-slide-up">
                <Sparkles className="w-4 h-4 text-violet-400 mr-2 animate-pulse" />
                <span className="text-sm font-medium bg-gradient-to-r from-violet-300 to-pink-300 bg-clip-text text-transparent">
                  AI-Powered Content Creation Platform
                </span>
              </div>

              {/* Main Heading */}
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <span className="block text-white/90">Create Content That</span>
                <span className="relative inline-block mt-2">
                  <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent animate-gradient bg-300%">
                    Goes Viral
                  </span>
                  <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                    <path
                      d="M2 10C60 2 180 2 298 10"
                      stroke="url(#underline-gradient)"
                      strokeWidth="4"
                      strokeLinecap="round"
                      className="animate-draw"
                    />
                    <defs>
                      <linearGradient id="underline-gradient" x1="0" y1="0" x2="300" y2="0">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="50%" stopColor="#ec4899" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                  </svg>
                </span>
              </h1>

              {/* Subheading */}
              <p className="max-w-3xl mx-auto text-lg sm:text-xl md:text-2xl text-gray-400 mb-12 leading-relaxed animate-slide-up" style={{ animationDelay: '0.2s' }}>
                Generate <span className="text-white font-medium">scripts</span>, <span className="text-white font-medium">visual cues</span>, and <span className="text-white font-medium">content blueprints</span> for
                <span className="text-violet-400"> Podcasts</span>, <span className="text-pink-400">Sports</span>, <span className="text-cyan-400">News</span> & more — in seconds.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                <button
                  onClick={() => document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' })}
                  className="group relative px-8 py-4 bg-gradient-to-r from-violet-600 to-pink-600 rounded-2xl font-bold text-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(139,92,246,0.4)]"
                >
                  <span className="relative z-10 flex items-center">
                    Start Creating Free
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button className="group px-8 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl font-medium text-lg hover:bg-white/10 hover:border-white/20 transition-all duration-300 flex items-center">
                  <PlayCircle className="mr-2 w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform" />
                  Watch Demo
                </button>
              </div>

              {/* Scroll indicator */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce hidden md:block">
                <ChevronDown className="w-6 h-6 text-white/30" />
              </div>
            </div>
          </section>



          {/* Features Section */}
          <section className="relative py-24 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 mb-6">
                  <Zap className="w-4 h-4 text-violet-400 mr-2" />
                  <span className="text-sm text-violet-300">Powerful Features</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                  Everything You Need to<br />
                  <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
                    Dominate Social Media
                  </span>
                </h2>
                <p className="max-w-2xl mx-auto text-lg text-gray-400">
                  Stop spending hours on content. Our AI analyzes viral trends and generates ready-to-use assets in seconds.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {features.map((feature, idx) => (
                  <div
                    key={feature.title}
                    className="group relative p-8 rounded-3xl bg-gradient-to-br from-white/[0.05] to-transparent border border-white/5 hover:border-violet-500/30 transition-all duration-500 hover:-translate-y-2"
                    style={{ animationDelay: `${idx * 0.1}s` }}
                  >
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg`}>
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-violet-300 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-gray-400 leading-relaxed">
                      {feature.description}
                    </p>
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Categories Grid */}
          <section id="categories" className="relative py-24">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/20 to-transparent" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
              <div className="text-center mb-16">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-pink-500/10 border border-pink-500/20 mb-6">
                  <Layers className="w-4 h-4 text-pink-400 mr-2" />
                  <span className="text-sm text-pink-300">Content Niches</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                  Choose Your<br />
                  <span className="bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text text-transparent">
                    Content Niche
                  </span>
                </h2>
                <p className="max-w-2xl mx-auto text-lg text-gray-400">
                  Each niche is fine-tuned with specialized AI prompts to generate the most engaging content for your audience.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {categories.map((cat, idx) => (
                  <EnhancedCategoryCard
                    key={cat}
                    category={cat}
                    onClick={handleCategorySelect}
                    details={categoryDescriptions[cat]}
                    index={idx}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section className="relative py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
                  <TrendingUp className="w-4 h-4 text-cyan-400 mr-2" />
                  <span className="text-sm text-cyan-300">Simple Process</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                  From Idea to Content<br />
                  <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                    In 3 Easy Steps
                  </span>
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                {[
                  { step: "01", title: "Choose a Niche", desc: "Select from 8 specialized content categories tailored to your audience" },
                  { step: "02", title: "Describe Your Idea", desc: "Tell our AI about your topic, style, and target audience preferences" },
                  { step: "03", title: "Get Your Assets", desc: "Receive scripts, visual cues, hashtags, and ready-to-use content instantly" }
                ].map((item, idx) => (
                  <div key={item.step} className="relative group">
                    <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
                    <div className="relative p-8 rounded-3xl bg-white/[0.02] border border-white/5 group-hover:border-violet-500/30 transition-all">
                      <div className="text-6xl font-bold bg-gradient-to-br from-violet-500/20 to-pink-500/20 bg-clip-text text-transparent mb-6">
                        {item.step}
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-3">{item.title}</h3>
                      <p className="text-gray-400">{item.desc}</p>
                    </div>
                    {idx < 2 && (
                      <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 text-violet-500/30">
                        <ArrowRight className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Final CTA */}
          <section className="relative py-24">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="relative rounded-3xl overflow-hidden">
                {/* Background effects */}
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-pink-600/20 to-cyan-600/20" />
                <div className="absolute inset-0 backdrop-blur-3xl" />

                <div className="relative p-12 md:p-16 text-center">
                  <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                    Ready to Create Content<br />
                    <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                      That Actually Performs?
                    </span>
                  </h2>
                  <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
                    Join thousands of creators using AI to generate viral-worthy content in seconds, not hours.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                      onClick={() => document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' })}
                      className="group px-10 py-5 bg-white text-black rounded-2xl font-bold text-lg hover:bg-gray-100 transition-all flex items-center hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                    >
                      Get Started — It's Free
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
                    <div className="flex items-center"><Check className="w-4 h-4 text-green-400 mr-2" /> No credit card required</div>
                    <div className="flex items-center"><Check className="w-4 h-4 text-green-400 mr-2" /> Unlimited generations</div>
                    <div className="flex items-center"><Check className="w-4 h-4 text-green-400 mr-2" /> 8 content niches</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="relative py-16 border-t border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    Easy Edits
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    <Github className="w-5 h-5" />
                  </a>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    <Twitter className="w-5 h-5" />
                  </a>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    <Instagram className="w-5 h-5" />
                  </a>
                </div>
                <div className="text-sm text-gray-500">
                  © 2025 Easy Edits. Built with AI.
                </div>
              </div>
            </div>
          </footer>
        </main>
      )}

      {currentView === 'GENERATOR' && selectedCategory && (
        <Generator
          category={selectedCategory}
          onBack={() => handleNavigate('HOME')}
        />
      )}

      {currentView === 'PODCAST' && (
        <PodcastPage
          onBack={() => handleNavigate('HOME')}
        />
      )}

      {currentView === 'TEXT_HIGHLIGHTER' && (
        <TextHighlighterPage
          onBack={() => handleNavigate('HOME')}
        />
      )}

      {currentView === 'MUSIC' && (
        <MusicPage
          onBack={() => handleNavigate('HOME')}
        />
      )}

      {currentView === 'MOTIVATIONAL' && (
        <MotivationalPage
          onBack={() => handleNavigate('HOME')}
        />
      )}

      {currentView === 'SPORTS' && (
        <SportsPage
          onBack={() => handleNavigate('HOME')}
        />
      )}

      {currentView === 'ENTERTAINMENT' && (
        <MovieTVPage
          onBack={() => handleNavigate('HOME')}
        />
      )}

      {currentView === 'NEWS' && (
        <NewsPage
          onBack={() => handleNavigate('HOME')}
        />
      )}
    </div>
  );
};

// Enhanced Category Card Component
interface EnhancedCategoryCardProps {
  category: ContentCategory;
  onClick: (category: ContentCategory) => void;
  details: { tagline: string; features: string[] };
  index: number;
}

const getCategoryIcon = (category: ContentCategory) => {
  const iconClass = "w-7 h-7";
  switch (category) {
    case ContentCategory.PODCAST: return <Mic className={iconClass} />;
    case ContentCategory.SPORTS: return <Trophy className={iconClass} />;
    case ContentCategory.TECHNOLOGY: return <Zap className={iconClass} />;
    case ContentCategory.ENTERTAINMENT: return <Video className={iconClass} />;
    case ContentCategory.EDUCATIONAL: return <FileText className={iconClass} />;
    case ContentCategory.MOTIVATIONAL: return <Sparkles className={iconClass} />;
    case ContentCategory.MUSIC: return <Music className={iconClass} />;
    case ContentCategory.NEWS: return <Newspaper className={iconClass} />;
    default: return <Layers className={iconClass} />;
  }
};

const getCategoryGradient = (category: ContentCategory) => {
  switch (category) {
    case ContentCategory.PODCAST: return "from-violet-500 to-purple-600";
    case ContentCategory.SPORTS: return "from-orange-500 to-red-600";
    case ContentCategory.TECHNOLOGY: return "from-cyan-500 to-blue-600";
    case ContentCategory.ENTERTAINMENT: return "from-pink-500 to-rose-600";
    case ContentCategory.EDUCATIONAL: return "from-emerald-500 to-teal-600";
    case ContentCategory.MOTIVATIONAL: return "from-amber-500 to-orange-600";
    case ContentCategory.MUSIC: return "from-fuchsia-500 to-pink-600";
    case ContentCategory.NEWS: return "from-blue-500 to-indigo-600";
    default: return "from-gray-500 to-gray-600";
  }
};

const EnhancedCategoryCard: React.FC<EnhancedCategoryCardProps> = ({ category, onClick, details, index }) => {
  return (
    <button
      onClick={() => onClick(category)}
      className="group relative h-72 w-full overflow-hidden rounded-3xl bg-white/[0.02] border border-white/5 hover:border-violet-500/30 transition-all duration-500 hover:-translate-y-2 text-left"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Gradient background on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${getCategoryGradient(category)} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />

      {/* Decorative blur */}
      <div className={`absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br ${getCategoryGradient(category)} rounded-full blur-[80px] opacity-0 group-hover:opacity-40 transition-opacity duration-500`} />

      <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
        {/* Icon */}
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getCategoryGradient(category)} flex items-center justify-center text-white shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
          {getCategoryIcon(category)}
        </div>

        {/* Content */}
        <div>
          <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-violet-300 transition-colors">
            {category}
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            {details.tagline}
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
            {details.features.map((feature) => (
              <span
                key={feature}
                className="px-3 py-1 text-xs rounded-full bg-white/10 text-gray-300 border border-white/5"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Arrow indicator */}
      <div className="absolute bottom-6 right-6 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-300">
        <ArrowRight className="w-5 h-5 text-white" />
      </div>
    </button>
  );
};

export default App;
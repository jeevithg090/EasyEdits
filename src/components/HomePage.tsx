import React from 'react';
import {
  ArrowRight,
  Captions,
  Check,
  ChevronDown,
  Clapperboard,
  FileText,
  Github,
  Layers,
  Mic,
  Music,
  Newspaper,
  PlayCircle,
  Scan,
  Server,
  Sparkles,
  TrendingUp,
  Trophy,
  Wand2,
  Zap,
} from 'lucide-react';
import { ContentCategory } from '../types';
import { routeForCategory, routeToHash } from '../lib/router';
import { REPO_URL } from '../lib/site';

const categories = Object.values(ContentCategory);

const features = [
  {
    icon: Scan,
    title: 'Auto-reframe to 9:16',
    description:
      'Download a time range from a long video and crop it to vertical with person tracking, locally or on a Colab GPU.',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    icon: Captions,
    title: 'Captions, voice & B-roll',
    description:
      'Burn word-level captions, generate voiceovers and pull stock B-roll from Pexels, Pixabay and Unsplash.',
    gradient: 'from-pink-500 to-rose-600',
  },
  {
    icon: Wand2,
    title: 'AI scripts & suggestions',
    description:
      'Draft hooks, scripts and hashtags, get song and scene suggestions, and turn headlines into image posts.',
    gradient: 'from-cyan-500 to-blue-600',
  },
  {
    icon: Server,
    title: 'Runs on your machine',
    description:
      'A local Express API drives yt-dlp, FFmpeg and Python. API keys stay on the server, and every integration is optional.',
    gradient: 'from-amber-500 to-orange-600',
  },
];

const categoryDetails: Record<
  ContentCategory,
  { tagline: string; features: string[]; icon: React.ElementType; gradient: string }
> = {
  [ContentCategory.PODCAST]: {
    tagline: 'Reframe long interviews into captioned vertical clips',
    features: ['Person tracking', 'Word-level captions', 'Split screen'],
    icon: Mic,
    gradient: 'from-violet-500 to-purple-600',
  },
  [ContentCategory.SPORTS]: {
    tagline: 'Highlight clips set to the best part of a song',
    features: ['Clip download', 'AI song picks', 'Music merge'],
    icon: Trophy,
    gradient: 'from-orange-500 to-red-600',
  },
  [ContentCategory.TECHNOLOGY]: {
    tagline: 'Animated text highlights on your screenshots',
    features: ['OCR highlights', 'Voiceover', 'Stock B-roll'],
    icon: Zap,
    gradient: 'from-cyan-500 to-blue-600',
  },
  [ContentCategory.ENTERTAINMENT]: {
    tagline: 'Scene ideas, fan edits and meme overlays',
    features: ['Scene suggestions', 'Filter timeline', 'Text overlays'],
    icon: Clapperboard,
    gradient: 'from-pink-500 to-rose-600',
  },
  [ContentCategory.EDUCATIONAL]: {
    tagline: 'Structured short-form scripts with concept art',
    features: ['Hook, body, CTA', 'Visual cues', 'Hashtags'],
    icon: FileText,
    gradient: 'from-emerald-500 to-teal-600',
  },
  [ContentCategory.MOTIVATIONAL]: {
    tagline: 'Quotes turned into narrated B-roll videos',
    features: ['Quote sources', 'Text-to-speech', 'Burned captions'],
    icon: Sparkles,
    gradient: 'from-amber-500 to-orange-600',
  },
  [ContentCategory.MUSIC]: {
    tagline: 'Vertical music edits with retro filter presets',
    features: ['Auto-crop', 'Filter timeline', 'Lyric transcription'],
    icon: Music,
    gradient: 'from-fuchsia-500 to-pink-600',
  },
  [ContentCategory.NEWS]: {
    tagline: 'Current stories for your interests, as image posts',
    features: ['Interest quiz', 'Search grounding', 'Image posts'],
    icon: Newspaper,
    gradient: 'from-blue-500 to-indigo-600',
  },
};

const steps = [
  {
    step: '01',
    title: 'Pick a studio',
    desc: 'Each of the 8 niches has a workflow tuned to its format, from podcasts to news.',
  },
  {
    step: '02',
    title: 'Bring your source',
    desc: 'Paste a video URL, upload screenshots, choose a quote or describe your idea.',
  },
  {
    step: '03',
    title: 'Review and download',
    desc: 'Preview every step, tweak captions, music or filters, then download the result.',
  },
];

const scrollToSection = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
};

const SectionHeading: React.FC<{
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  highlight: string;
  description?: string;
  tone: 'violet' | 'pink' | 'cyan';
  id: string;
}> = ({ icon: Icon, eyebrow, title, highlight, description, tone, id }) => {
  const tones = {
    violet: 'bg-violet-500/10 border-violet-500/20 text-violet-300',
    pink: 'bg-pink-500/10 border-pink-500/20 text-pink-300',
    cyan: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300',
  };
  const gradients = {
    violet: 'from-violet-400 to-pink-400',
    pink: 'from-pink-400 to-violet-400',
    cyan: 'from-cyan-400 to-violet-400',
  };
  return (
    <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
      <p
        className={`mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm ${tones[tone]}`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mb-5 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl"
      >
        {title}{' '}
        <span className={`block bg-gradient-to-r ${gradients[tone]} bg-clip-text text-transparent`}>
          {highlight}
        </span>
      </h2>
      {description && <p className="text-base text-gray-400 sm:text-lg">{description}</p>}
    </div>
  );
};

export const HomePage: React.FC = () => {
  return (
    <>
      {/* Hero */}
      <section
        aria-labelledby="hero-title"
        className="relative flex min-h-[88svh] items-center justify-center px-4 pb-16 pt-28 sm:px-6 lg:px-8"
      >
        <div className="relative mx-auto max-w-5xl text-center">
          <p className="mb-8 inline-flex animate-slide-up items-center rounded-full border border-violet-500/20 bg-gradient-to-r from-violet-500/10 to-pink-500/10 px-4 py-2 backdrop-blur-xl sm:px-5">
            <Sparkles className="mr-2 h-4 w-4 text-violet-300" aria-hidden="true" />
            <span className="text-sm font-medium text-violet-200">
              AI-assisted studio for vertical video
            </span>
          </p>

          <h1
            id="hero-title"
            className="mb-6 animate-slide-up text-4xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl"
            style={{ animationDelay: '0.1s' }}
          >
            <span className="block text-white/90">Create Content That</span>
            <span className="relative mt-2 inline-block">
              <span className="animate-gradient bg-300% bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                Goes Viral
              </span>
              <svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 300 12"
                fill="none"
                aria-hidden="true"
              >
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

          <p
            className="mx-auto mb-10 max-w-2xl animate-slide-up text-lg leading-relaxed text-gray-400 sm:text-xl md:text-2xl"
            style={{ animationDelay: '0.2s' }}
          >
            Turn long videos, quotes, news and music into{' '}
            <span className="font-medium text-white">ready-to-post vertical clips</span>, with
            AI-assisted <span className="text-violet-300">scripts</span>,{' '}
            <span className="text-pink-300">captions</span> and{' '}
            <span className="text-cyan-300">voiceovers</span>.
          </p>

          <div
            className="flex animate-slide-up flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4"
            style={{ animationDelay: '0.3s' }}
          >
            <a
              href="#categories"
              onClick={(event) => {
                event.preventDefault();
                scrollToSection('categories');
              }}
              className="group relative inline-flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 px-8 py-4 text-lg font-bold text-white transition-all duration-300 hover:shadow-[0_0_40px_rgba(139,92,246,0.4)] motion-safe:hover:scale-[1.03]"
            >
              <span className="relative z-10 flex items-center">
                Explore the studios
                <ArrowRight
                  className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </span>
              <span
                className="absolute inset-0 bg-gradient-to-r from-violet-500 to-pink-500 opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden="true"
              />
            </a>
            <a
              href="#how-it-works"
              onClick={(event) => {
                event.preventDefault();
                scrollToSection('how-it-works');
              }}
              className="group inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-lg font-medium text-white backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:bg-white/10"
            >
              <PlayCircle
                className="mr-2 h-5 w-5 text-violet-300 transition-transform group-hover:scale-110"
                aria-hidden="true"
              />
              How it works
            </a>
          </div>
        </div>

        <ChevronDown
          className="absolute bottom-6 left-1/2 hidden h-6 w-6 -translate-x-1/2 animate-bounce text-white/30 md:block"
          aria-hidden="true"
        />
      </section>

      {/* Features */}
      <section aria-labelledby="features-title" className="relative py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            id="features-title"
            icon={Zap}
            eyebrow="What it does"
            title="Everything for short-form,"
            highlight="in one place"
            description="Easy Edits orchestrates proven open-source media tools and AI providers behind one consistent interface."
            tone="violet"
          />

          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {features.map(({ icon: Icon, title, description, gradient }) => (
              <li
                key={title}
                className="group relative rounded-3xl border border-white/5 bg-gradient-to-br from-white/[0.05] to-transparent p-6 transition-all duration-300 hover:border-violet-500/30 motion-safe:hover:-translate-y-1 sm:p-8"
              >
                <div
                  className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-gray-400 sm:text-base">{description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Studios */}
      <section
        id="categories"
        aria-labelledby="categories-title"
        className="relative scroll-mt-16 py-20 md:py-24"
      >
        <div
          className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/20 to-transparent"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            id="categories-title"
            icon={Layers}
            eyebrow="Studios"
            title="Choose your"
            highlight="content niche"
            description="Every niche opens a studio with a workflow and prompts tuned to that format."
            tone="pink"
          />

          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {categories.map((category) => (
              <li key={category}>
                <StudioCard category={category} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        aria-labelledby="how-title"
        className="relative scroll-mt-16 py-20 md:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            id="how-title"
            icon={TrendingUp}
            eyebrow="How it works"
            title="From idea to clip"
            highlight="in three steps"
            tone="cyan"
          />

          <ol className="grid gap-6 md:grid-cols-3 md:gap-8">
            {steps.map((item, idx) => (
              <li key={item.step} className="group relative">
                <div className="relative h-full rounded-3xl border border-white/5 bg-white/[0.02] p-6 transition-colors group-hover:border-violet-500/30 sm:p-8">
                  <div
                    className="mb-4 bg-gradient-to-br from-violet-400/60 to-pink-400/60 bg-clip-text text-5xl font-bold text-transparent"
                    aria-hidden="true"
                  >
                    {item.step}
                  </div>
                  <h3 className="mb-2 text-xl font-bold text-white sm:text-2xl">
                    <span className="sr-only">Step {idx + 1}: </span>
                    {item.title}
                  </h3>
                  <p className="text-gray-400">{item.desc}</p>
                </div>
                {idx < steps.length - 1 && (
                  <ArrowRight
                    className="absolute -right-6 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-violet-400/40 md:block"
                    aria-hidden="true"
                  />
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing call to action */}
      <section aria-labelledby="cta-title" className="relative py-20 md:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-white/10">
            <div
              className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-pink-600/20 to-cyan-600/20"
              aria-hidden="true"
            />
            <div className="relative px-6 py-12 text-center sm:px-12 md:py-16">
              <h2
                id="cta-title"
                className="mb-5 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl"
              >
                Your studio,
                <span className="block bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                  on your own machine
                </span>
              </h2>
              <p className="mx-auto mb-8 max-w-2xl text-base text-gray-300 sm:text-lg">
                Clone the repository, add the API keys you have, and start the web app and media API
                with a single command.
              </p>
              <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <a
                  href="#categories"
                  onClick={(event) => {
                    event.preventDefault();
                    scrollToSection('categories');
                  }}
                  className="group inline-flex items-center justify-center rounded-2xl bg-white px-8 py-4 text-lg font-bold text-black transition-all hover:bg-gray-100 hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                >
                  Open a studio
                  <ArrowRight
                    className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </a>
                <a
                  href={`${REPO_URL}#getting-started`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-8 py-4 text-lg font-medium text-white transition-colors hover:bg-white/10"
                >
                  <Github className="mr-2 h-5 w-5" aria-hidden="true" />
                  Setup guide
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
              <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-300">
                {[
                  'API keys stay on the server',
                  'Every integration optional',
                  '8 content niches',
                ].map((item) => (
                  <li key={item} className="flex items-center">
                    <Check className="mr-2 h-4 w-4 text-emerald-400" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

const StudioCard: React.FC<{ category: ContentCategory }> = ({ category }) => {
  const { tagline, features: pills, icon: Icon, gradient } = categoryDetails[category];
  return (
    <a
      href={routeToHash(routeForCategory(category))}
      className="group relative flex h-full min-h-[15rem] flex-col justify-between overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] p-6 text-left transition-all duration-300 hover:border-violet-500/30 focus-visible:border-violet-400/60 motion-safe:hover:-translate-y-1"
    >
      <span
        className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-10`}
        aria-hidden="true"
      />
      <span
        className={`absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${gradient} opacity-0 blur-[80px] transition-opacity duration-500 group-hover:opacity-40`}
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}
        >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <ArrowRight
          className="h-5 w-5 text-white/30 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white"
          aria-hidden="true"
        />
      </div>

      <div className="relative mt-8">
        <h3 className="mb-1.5 text-xl font-bold text-white transition-colors group-hover:text-violet-200">
          {category}
        </h3>
        <span className="mb-4 block text-sm text-gray-400">{tagline}</span>
        <span className="flex flex-wrap gap-1.5">
          {pills.map((pill) => (
            <span
              key={pill}
              className="rounded-full border border-white/5 bg-white/10 px-2.5 py-0.5 text-xs text-gray-300"
            >
              {pill}
            </span>
          ))}
        </span>
      </div>
    </a>
  );
};

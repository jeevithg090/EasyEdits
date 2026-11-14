import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './components/HomePage';
import { NotFoundPage } from './components/NotFoundPage';
import { PageLoader } from './components/PageLoader';
import { Background } from './components/Background';
import { ViewState } from './types';
import { Route, titleForRoute, useHashRoute } from './lib/router';

// Studios are code-split so the landing page loads only what it needs.
const Generator = lazy(() =>
  import('./components/Generator').then((m) => ({ default: m.Generator })),
);
const PodcastPage = lazy(() =>
  import('./components/PodcastPage').then((m) => ({ default: m.PodcastPage })),
);
const TextHighlighterPage = lazy(() =>
  import('./components/TextHighlighterPage').then((m) => ({ default: m.TextHighlighterPage })),
);
const MusicPage = lazy(() =>
  import('./components/MusicPage').then((m) => ({ default: m.MusicPage })),
);
const MotivationalPage = lazy(() =>
  import('./components/MotivationalPage').then((m) => ({ default: m.MotivationalPage })),
);
const SportsPage = lazy(() =>
  import('./components/SportsPage').then((m) => ({ default: m.SportsPage })),
);
const MovieTVPage = lazy(() =>
  import('./components/MovieTVPage').then((m) => ({ default: m.MovieTVPage })),
);
const NewsPage = lazy(() => import('./components/NewsPage').then((m) => ({ default: m.NewsPage })));

const routeKey = (route: Route) =>
  route.view === 'GENERATOR'
    ? `GENERATOR:${route.category}`
    : route.view === 'NOT_FOUND'
      ? `NOT_FOUND:${route.path}`
      : route.view;

const App: React.FC = () => {
  const [route, navigate] = useHashRoute();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);
  const key = routeKey(route);

  const goHome = () => navigate({ view: 'HOME' });

  const handleNavigate = (view: ViewState) => {
    if (view === 'HOME') goHome();
  };

  // Keep the tab title in sync, and move focus to the new page so keyboard and
  // screen-reader users start at the top of it after navigating.
  useEffect(() => {
    document.title = titleForRoute(route);
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Plain section anchors (#categories) scroll themselves; only reset for real routes.
    if (window.location.hash.startsWith('#/') || route.view !== 'HOME') {
      window.scrollTo({ top: 0 });
      mainRef.current?.focus({ preventScroll: true });
    }
    // `key` captures every route change, including between generator niches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Deep links such as /#categories should land on that section.
  useEffect(() => {
    const anchor = window.location.hash.replace(/^#/, '');
    if (anchor && !anchor.startsWith('/')) {
      requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView());
    }
  }, []);

  const renderPage = () => {
    switch (route.view) {
      case 'HOME':
        return <HomePage />;
      case 'GENERATOR':
        return <Generator key={route.category} category={route.category} onBack={goHome} />;
      case 'PODCAST':
        return <PodcastPage onBack={goHome} />;
      case 'TEXT_HIGHLIGHTER':
        return <TextHighlighterPage onBack={goHome} />;
      case 'MUSIC':
        return <MusicPage onBack={goHome} />;
      case 'MOTIVATIONAL':
        return <MotivationalPage onBack={goHome} />;
      case 'SPORTS':
        return <SportsPage onBack={goHome} />;
      case 'ENTERTAINMENT':
        return <MovieTVPage onBack={goHome} />;
      case 'NEWS':
        return <NewsPage onBack={goHome} />;
      case 'NOT_FOUND':
        return <NotFoundPage path={route.path} />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-surface font-sans text-white selection:bg-violet-500/30">
      <a
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
        className="sr-only-focusable fixed left-4 top-3 z-[60] rounded-lg bg-white px-4 py-2 font-semibold text-black"
      >
        Skip to content
      </a>

      <Background />
      <Navbar onNavigate={handleNavigate} />

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="relative z-10 flex-1 focus:outline-none"
      >
        <Suspense fallback={<PageLoader />}>
          <div key={key} className="animate-fade-in">
            {renderPage()}
          </div>
        </Suspense>
      </main>

      <Footer />
    </div>
  );
};

export default App;

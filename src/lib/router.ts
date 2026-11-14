import { useCallback, useEffect, useState } from 'react';
import { ContentCategory, ViewState } from '../types';

/**
 * Minimal hash router. Hash URLs (`/#/studio/podcast`) work on any static host
 * without server rewrites, keep the browser back button working and make every
 * studio linkable.
 */

export type Route =
  | { view: Exclude<ViewState, 'GENERATOR'> }
  | { view: 'GENERATOR'; category: ContentCategory }
  | { view: 'NOT_FOUND'; path: string };

type StudioView = Exclude<ViewState, 'HOME' | 'GENERATOR'>;

/** Path segment for each dedicated studio. */
export const STUDIO_PATHS: Record<StudioView, string> = {
  PODCAST: 'podcast',
  TEXT_HIGHLIGHTER: 'tech',
  MUSIC: 'music',
  MOTIVATIONAL: 'motivational',
  SPORTS: 'sports',
  ENTERTAINMENT: 'movie-tv',
  NEWS: 'news',
};

/** Human-readable page name, used for document.title. */
export const VIEW_TITLES: Record<StudioView, string> = {
  PODCAST: 'Podcast Studio',
  TEXT_HIGHLIGHTER: 'Text Highlighter',
  MUSIC: 'Music Studio',
  MOTIVATIONAL: 'Motivational Studio',
  SPORTS: 'Sports Studio',
  ENTERTAINMENT: 'Movie & TV Studio',
  NEWS: 'News Studio',
};

/** Which screen opens when a niche card is picked on the home page. */
export const CATEGORY_VIEWS: Record<ContentCategory, ViewState> = {
  [ContentCategory.PODCAST]: 'PODCAST',
  [ContentCategory.SPORTS]: 'SPORTS',
  [ContentCategory.TECHNOLOGY]: 'TEXT_HIGHLIGHTER',
  [ContentCategory.ENTERTAINMENT]: 'ENTERTAINMENT',
  [ContentCategory.EDUCATIONAL]: 'GENERATOR',
  [ContentCategory.MOTIVATIONAL]: 'MOTIVATIONAL',
  [ContentCategory.MUSIC]: 'MUSIC',
  [ContentCategory.NEWS]: 'NEWS',
};

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** Parse `location.hash` into a route. Plain anchors (`#categories`) map to home. */
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  if (!raw.startsWith('/')) return { view: 'HOME' };

  const segments = raw
    .split(/[?#]/)[0]
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment).toLowerCase());

  if (segments.length === 0) return { view: 'HOME' };

  if (segments[0] === 'studio' && segments.length === 2) {
    const view = (Object.keys(STUDIO_PATHS) as StudioView[]).find(
      (key) => STUDIO_PATHS[key] === segments[1],
    );
    if (view) return { view };
  }

  if (segments[0] === 'generator' && segments.length === 2) {
    const category = Object.values(ContentCategory).find((c) => slugify(c) === segments[1]);
    if (category) return { view: 'GENERATOR', category };
  }

  return { view: 'NOT_FOUND', path: raw };
}

/** Build the hash for a route. */
export function routeToHash(route: Route): string {
  switch (route.view) {
    case 'HOME':
      return '#/';
    case 'GENERATOR':
      return `#/generator/${slugify(route.category)}`;
    case 'NOT_FOUND':
      return `#${route.path}`;
    default:
      return `#/studio/${STUDIO_PATHS[route.view]}`;
  }
}

/** Route for a niche picked on the home page. */
export function routeForCategory(category: ContentCategory): Route {
  const view = CATEGORY_VIEWS[category];
  return view === 'GENERATOR' ? { view, category } : ({ view } as Route);
}

/** Document title for a route. */
export function titleForRoute(route: Route): string {
  const suffix = 'Easy Edits';
  switch (route.view) {
    case 'HOME':
      return 'Easy Edits – Short-form content studio';
    case 'GENERATOR':
      return `${route.category} Script Generator · ${suffix}`;
    case 'NOT_FOUND':
      return `Page not found · ${suffix}`;
    default:
      return `${VIEW_TITLES[route.view]} · ${suffix}`;
  }
}

/** Current route plus a navigate function that pushes a history entry. */
export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    const hash = routeToHash(next);
    if (window.location.hash === hash) {
      setRoute(next);
    } else {
      window.location.hash = hash;
    }
  }, []);

  return [route, navigate];
}

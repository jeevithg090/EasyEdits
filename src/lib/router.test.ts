import { describe, expect, it } from 'vitest';
import { ContentCategory } from '../types';
import { parseHash, routeForCategory, routeToHash, titleForRoute } from './router';

describe('parseHash', () => {
  it('maps empty hashes and plain anchors to home', () => {
    expect(parseHash('')).toEqual({ view: 'HOME' });
    expect(parseHash('#/')).toEqual({ view: 'HOME' });
    expect(parseHash('#categories')).toEqual({ view: 'HOME' });
  });

  it('resolves studio paths case-insensitively', () => {
    expect(parseHash('#/studio/podcast')).toEqual({ view: 'PODCAST' });
    expect(parseHash('#/studio/Movie-TV')).toEqual({ view: 'ENTERTAINMENT' });
    expect(parseHash('#/studio/tech/')).toEqual({ view: 'TEXT_HIGHLIGHTER' });
  });

  it('resolves generator niches', () => {
    expect(parseHash('#/generator/educational')).toEqual({
      view: 'GENERATOR',
      category: ContentCategory.EDUCATIONAL,
    });
  });

  it('reports unknown paths as not found', () => {
    expect(parseHash('#/studio/cooking')).toEqual({ view: 'NOT_FOUND', path: '/studio/cooking' });
    expect(parseHash('#/nope')).toEqual({ view: 'NOT_FOUND', path: '/nope' });
    expect(parseHash('#/generator/unknown')).toMatchObject({ view: 'NOT_FOUND' });
  });
});

describe('routeToHash', () => {
  it('round-trips every niche route', () => {
    for (const category of Object.values(ContentCategory)) {
      const route = routeForCategory(category);
      expect(parseHash(routeToHash(route))).toEqual(route);
    }
  });
});

describe('titleForRoute', () => {
  it('names the page in the document title', () => {
    expect(titleForRoute({ view: 'PODCAST' })).toBe('Podcast Studio · Easy Edits');
    expect(titleForRoute({ view: 'NOT_FOUND', path: '/x' })).toMatch(/not found/i);
    expect(titleForRoute({ view: 'GENERATOR', category: ContentCategory.EDUCATIONAL })).toMatch(
      /^Educational/,
    );
  });
});

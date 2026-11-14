import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';

const goTo = async (hash: string) => {
  await act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};

describe('App routing', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('renders the landing page with a link to every studio', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: /create content that/i })).toBeVisible();
    expect(screen.getByRole('link', { name: /podcast/i })).toHaveAttribute(
      'href',
      '#/studio/podcast',
    );
    expect(document.title).toMatch(/easy edits/i);
  });

  it('shows a not-found page for unknown routes', async () => {
    render(<App />);
    await goTo('#/does-not-exist');
    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeVisible();
    expect(document.title).toMatch(/not found/i);
    expect(screen.getByRole('link', { name: /back to all studios/i })).toHaveAttribute(
      'href',
      '#/',
    );
  });

  it('lazy-loads the generator for a niche route', async () => {
    render(<App />);
    await goTo('#/generator/educational');
    expect(
      await screen.findByRole('heading', { name: /educational generator/i }),
    ).toBeInTheDocument();
    expect(document.title).toBe('Educational Script Generator · Easy Edits');
  });

  it('offers a skip link to the main content', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveAttribute('href', '#main');
  });
});

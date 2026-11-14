import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Navbar } from './Navbar';

describe('Navbar', () => {
  it('navigates home from the logo', async () => {
    const onNavigate = vi.fn();
    render(<Navbar onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('button', { name: /easy edits home/i }));
    expect(onNavigate).toHaveBeenCalledWith('HOME');
  });

  it('links only to sections that exist on the home page', async () => {
    const onNavigate = vi.fn();
    render(<Navbar onNavigate={onNavigate} />);
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#categories',
      '#how-it-works',
    ]);
    await userEvent.click(screen.getByRole('link', { name: /how it works/i }));
    expect(onNavigate).toHaveBeenCalledWith('HOME');
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Generator } from './Generator';
import { ContentCategory } from '../types';

const script = {
  title: 'Five Lo-Fi Tricks',
  hook: 'Stop scrolling!',
  script_body: 'Body text',
  cta: 'Follow for more',
  visual_cues: ['Close-up of a turntable'],
  hashtags: ['#lofi', 'beats'],
};

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Generator', () => {
  it('disables generation until a topic is entered', async () => {
    render(<Generator category={ContentCategory.MUSIC} onBack={() => {}} />);
    const button = screen.getByRole('button', { name: /generate magic/i });
    expect(button).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/what's your video about/i), 'lo-fi');
    expect(button).toBeEnabled();
  });

  it('renders the generated script from the API', async () => {
    const fetchMock = mockFetch(new Response(JSON.stringify({ script }), { status: 200 }));
    render(<Generator category={ContentCategory.MUSIC} onBack={() => {}} />);

    await userEvent.type(screen.getByLabelText(/what's your video about/i), 'lo-fi beats');
    await userEvent.click(screen.getByRole('button', { name: 'Chill' }));
    await userEvent.click(screen.getByRole('button', { name: /generate magic/i }));

    expect(await screen.findByText('Five Lo-Fi Tricks')).toBeInTheDocument();
    expect(screen.getByText('"Stop scrolling!"')).toBeInTheDocument();
    // Hashtags are rendered with exactly one leading "#".
    expect(screen.getByText('#lofi')).toBeInTheDocument();
    expect(screen.getByText('#beats')).toBeInTheDocument();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3005/api/generator/script');
    expect(JSON.parse(init.body)).toEqual({
      category: 'Music',
      topic: 'lo-fi beats',
      tone: 'Chill',
    });
  });

  it('shows the server error inline when generation fails', async () => {
    mockFetch(
      new Response(JSON.stringify({ error: 'Gemini API key is not configured on the server' }), {
        status: 503,
      }),
    );
    render(<Generator category={ContentCategory.MUSIC} onBack={() => {}} />);

    await userEvent.type(screen.getByLabelText(/what's your video about/i), 'anything');
    await userEvent.click(screen.getByRole('button', { name: /generate magic/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Gemini API key is not configured on the server');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /generate magic/i })).toBeEnabled(),
    );
  });

  it('marks the selected tone as pressed', async () => {
    render(<Generator category={ContentCategory.MUSIC} onBack={() => {}} />);
    const funny = screen.getByRole('button', { name: 'Funny' });
    expect(funny).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(funny);
    expect(funny).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Energetic' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

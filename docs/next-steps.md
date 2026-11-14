# Next Steps

This document tracks the remaining work to keep **Easy Edits** stable and moving forward.

## Done

- Secrets removed from code: all keys are read from environment variables (`server/.env.example`),
  the Colab worker reads Colab Secrets, and the Gemini key no longer ships in the browser bundle.
- Committed media, virtual environments and macOS metadata removed; `.gitignore` covers them.
- Path traversal, `yt-dlp` option injection and SSRF guards on media endpoints, with tests.
- Config centralised in `server/lib/config.cjs` (port, CORS, body limit, model ids).
- Test suite (Vitest + Supertest + Testing Library), linting (ESLint, Ruff), formatting
  (Prettier, Ruff) and CI.
- UI/UX pass: design tokens, hash routing with a 404 page and per-page titles, lazy-loaded
  studios, honest landing-page copy, responsive fixes at phone width, and zero axe WCAG A/AA
  violations on every route.

## Priority fixes

1. **Rotate any credentials that were ever committed**
   Earlier versions of these notes recorded hardcoded Gemini keys and Firebase service-account
   files in the working copy. Rotate/revoke those credentials even though they are not in the
   repository.
2. **Replace mock AI beat detection**
   `/api/music-video/ai-beat-detect` returns placeholder data. Implement real beat detection
   (e.g. FFmpeg audio analysis or `librosa`).
3. **Authentication and rate limiting**
   Required before the API is reachable by anyone other than its owner.

## Roadmap

1. **Modularise the server**
   `server/server.cjs` is ~6,000 lines. Continue the pattern started in `server/routes/` and
   `server/lib/`: one router per studio (podcast, music, motivational, sports, entertainment,
   news, text highlighter), shared helpers for spawning `yt-dlp`/FFmpeg, and route-level tests.
2. **Downloads lifecycle**
   Add a retention policy / cleanup job for `server/downloads/`.
3. **Job progress**
   Long-running requests currently hold the HTTP connection open. Move them to background jobs
   with progress polling (the cloud job queue already follows this pattern).
4. **Split large page components**
   Several studio pages exceed 1,000 lines; extract hooks and sub-components so they can be
   tested in isolation.

## Open questions

1. Which environment is the primary deployment target (local, VPS, container platform)?
2. Should the AI features run locally, in Colab, or via hosted services by default?
3. Which user workflows are highest priority (shorts, long-form, captions, B-roll, music)?

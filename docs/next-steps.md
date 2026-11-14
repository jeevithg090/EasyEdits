# Next Steps

Date: 2026-02-03

This document captures the immediate fixes and the near-term work to keep **easy-edits** stable and moving forward.

## Priority Fixes (Do First)

1. **Remove hardcoded Gemini API keys from code**
   The Gemini API key pool is hardcoded in `server/server.cjs`, which is a security risk. Move keys to environment variables and rotate/revoke the exposed keys.
2. **Remove service account keys from the repo**
   There are Firebase service account JSON files under `server/`. These should not live in the repo. Remove them, rotate the keys, and load credentials from `.env` or a secrets manager.
3. **Replace mock AI beat detection**
   The `/api/music-video/ai-beat-detect` endpoint returns mock beat data. Implement real beat detection (e.g., FFmpeg audio analysis or `librosa`) and update the response accordingly.

## Next Steps (Build Roadmap)

1. **Modularize the server**
   `server/server.cjs` is ~6,300 lines. Split routes into modules (e.g., `routes/`, `services/`, `lib/`) and add a simple dependency boundary.
2. **Define a stable config system**
   Standardize config loading (API keys, file paths, feature toggles). Document required env vars and add validation at startup.
3. **Add a minimal test and health suite**
   Add smoke tests for critical endpoints (upload, export, transcription, AI calls) and a basic health check endpoint for deployments.

## Cleanup / Repo Hygiene

1. **Avoid committing large/binary artifacts**
   Large video files and local artifacts are present in the repo root. Move to a `samples/` or `assets/` directory and update `.gitignore` if needed.
2. **Exclude local virtual environments**
   `server/venv` and `server/autocrop-vertical/venv` should be gitignored and removed from version control.
3. **Validate `.env.local` usage**
   Ensure the frontend reads required keys from `.env.local` only and no secrets are committed.

## Open Questions

1. Which environment is the primary deployment target (local, VPS, serverless)?
2. Should the AI features run locally, in Colab, or via hosted services by default?
3. Which user workflows are highest priority (shorts, long-form, captions, B-roll, music)?

---

If you want, I can convert this into a tracked issue list (GitHub Projects/Issues) and break down each item into concrete tasks with owners and estimates.

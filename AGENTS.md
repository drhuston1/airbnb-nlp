# Repository Guidelines

## Project Structure & Module Organization
- `src/`: React + TypeScript (Vite). Key folders: `components/`, `hooks/`, `utils/`, `config/`, `types/`, `assets/`.
- `api/`: Vercel serverless functions (TypeScript). Key routes:
  - `search.ts`: unified search with LLM tool-calling + fallback parser
  - `providers/`: source adapters (Airbnb, Booking)
  - `tools/`: lightweight NL extraction helpers
- `public/`: Static assets.
- Root tests/tools: Node scripts like `test-workflow.js`, `test-*.js`, `*-test.js`.
- Docs: Operational/integration guides (`OPENAI_SETUP.md`, `VERCEL_DEPLOYMENT.md`, `HTTP_API_TESTING.md`).

## Build, Test, and Development Commands
- `npm run dev`: Start Vite dev server (default http://localhost:5173). Proxies `/api` to `http://localhost:3001`.
- `npx vercel dev --listen 3001`: Run API locally for serverless endpoints.
- `npm run build`: Type-check (`tsc -b`) and build for production (`vite build`).
- `npm run preview`: Preview the production build locally.
- `npm run lint`: Lint TS/JS using project ESLint config.
- Manual test: try “2BR in Charleston under $200/night” or “Paris 2025-07-10 to 2025-07-14 for 2”.
- Env: `cp .env.example .env.local` then add keys (see below).

## Coding Style & Naming Conventions
- TypeScript, React 19; 2-space indentation.
- ESLint: `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` (see `eslint.config.js`). Fix all lint errors before pushing.
- Files: Components PascalCase in `src/components` (e.g., `SearchBar.tsx`); utilities camelCase in `src/utils` (e.g., `parseQuery.ts`); API routes kebab-case in `api/` (e.g., `unified-search.ts`). Prefer named exports.

## Testing Guidelines
- Tests are Node scripts (no Jest). Naming: `test-*.js` or `*-test.js` at repo root.
- Start dev servers first (`npm run dev` and `npx vercel dev --listen 3001`), then run scripts: `node test-geocoding.js`.
- LLM Orchestration: `OPENAI_API_KEY` (enables tool-calling in `/api/search`).
- Providers: `SCRAPINGBEE_API_KEY` (optional, Airbnb proxy), `SERPAPI_KEY` (optional, Booking adapter).
- For API diagnosis/manual checks, see `HTTP_API_TESTING.md`.

## Commit & Pull Request Guidelines
- Commits: Use Conventional Commits (e.g., `feat:`, `fix:`, `chore:`). Keep messages imperative and scoped.
- PRs: Provide a clear description, linked issues, test steps, and screenshots/GIFs for UI changes. Note impacted modules (`api/...`, `src/...`); update docs when env/config changes.

## Security & Configuration Tips
- Never commit secrets. Use `.env.local` locally and Vercel Project Environment Variables in production.
- Common keys: `OPENAI_API_KEY`, `SCRAPINGBEE_API_KEY`, `SERPAPI_KEY`.
- Refer to `OPENAI_SETUP.md` and `VERCEL_DEPLOYMENT.md` for provider setup and deployment.

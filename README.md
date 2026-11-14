# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Studio (`/work/studio`)

Studio is a private page in the Work area that turns clips, photos and one song into a
beat-synced video. The page uploads the files, asks for a draft cut, and has it rendered by a
separate service, [studio-render](https://github.com/obiken-01/studio-render), which holds the
API reference.

The four steps on the page:

1. **Upload.** Files go up in chunks and resume after a dropped connection or a reload.
2. **Options.** Aspect (9:16, 16:9, 4:5), pace, length, music or silent, and an optional template.
3. **Draft.** A cut on the beat. Reshuffle for another one, swap a clip, skip a slot, or save the
   timings as a template (kept in this browser's `localStorage`).
4. **Render.** Progress, then Download. The server deletes the video 15 minutes after a download
   and the uploads after the service's time limit.

### Who sees it

The Studio tab only appears for Work users the render service allows
(`STUDIO_ALLOWED_USER_IDS` on that service). Everyone else sees no tab, and opening the URL
directly shows "Studio is private."

### Configuration

| Variable | Purpose |
| --- | --- |
| `VITE_STUDIO_URL` | Base URL of the render service, for example `https://studio.example.com`. Baked in at build time. |

In a production build without `VITE_STUDIO_URL`, Studio is switched off: no request is sent and
the tab never shows. In development it falls back to `http://localhost:8000`.

### Running it locally

1. Start the render service (see its README) with `CORS_ALLOWED_ORIGINS=http://localhost:5173`,
   the same `JWT_*` values as the API you sign in against, and your Work user id in
   `STUDIO_ALLOWED_USER_IDS`.
2. `npm run dev`, sign in at `/work/login`, and open `/work/studio`.

### Code

Everything lives in `src/work/studio/` and is loaded only when the page is opened, so the other
tools do not get heavier.

| File | What it does |
| --- | --- |
| `studioApi.js` | HTTP client for the render service; shares the Work login token and its refresh. |
| `useStudioSession.js` | Asks the service whether this user may use Studio. |
| `upload/chunks.js` | Chunked, resumable uploader. |
| `uploadQueue.js` | Runs at most two file uploads at a time. |
| `studioState.js` | The page's state and rules, as a pure reducer. |
| `templates.js`, `slotEdits.js` | Templates and slot-by-slot edits of a draft. |
| `useStudio.js`, `StudioPage.jsx`, `components/` | Side effects and the four step components. |

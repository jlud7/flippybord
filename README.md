# Flippy Bord

Flippy Bord is a digital split-flap display inspired by Vestaboard. This repo now runs as a React + Vite app so it can be developed locally, deployed as a normal web app, and opened cleanly on desktop, TV, or iPhone browser screens.

## What is set up

- React 18 + Vite project structure
- Responsive split-flap board UI
- Presentation mode for a chrome-free display screen
- Shareable display links that preserve the current message and styling
- Local persistence for the current board state
- GitHub Pages workflow for static deployment from `main`

## Local development

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## GitHub deployment

The repo includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`.

After the first push to `main`, set the repository Pages source to `GitHub Actions` if GitHub prompts for it. The production build will then deploy automatically on each push to `main`.

## Display workflow

1. Compose or choose a preset.
2. Click `Copy Display Link`.
3. Open that link on a TV, iPhone, or any browser.
4. Use `Display Mode` or `Fullscreen` for a clean presentation view.

## Next feature directions

- Multi-device live sync instead of URL-based sharing
- Saved scenes and playlists
- Scheduler and calendar feeds
- API/webhook control for home automation and signage workflows
- More Vestaboard-style transitions and content templates

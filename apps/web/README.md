# Web App

This directory owns the React/Vite product.

Current boundary:

- `src/` owns the web UI, hooks, Worker integration, and feature composition.
- `index.html` and `vite.config.ts` are the Vite entry and build configuration.
- `public/` contains source-controlled static assets only.
- Production artifacts are assembled in an explicit external staging directory.
- The external `dist` produced by `ops/assemble-web.ps1` is consumed by the
  EdgeOne deployment workflow.

Use the root npm scripts for development and validation so CI behavior remains stable.

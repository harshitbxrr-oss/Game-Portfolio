# Deploy configuration

These files are kept here so nothing deploys by accident. Copy the one you need to the place shown.

| Host | Copy this | To | Then |
|---|---|---|---|
| GitHub Pages | `github-pages/deploy.yml` | `.github/workflows/deploy.yml` | Settings → Pages → Source: **GitHub Actions** |
| Vercel | `vercel/vercel.json` | `vercel.json` (project root) | Import the repository at vercel.com/new and deploy |
| Vercel CLI only | `vercel/.vercelignore` | `.vercelignore` (project root) | Keeps the video and full-size art out of uploads |

Both configurations run `node build.mjs`, so nothing needs installing. Any other static host (Netlify, Cloudflare Pages, S3) works too: run `node build.mjs --out public` and publish the `public/` folder.

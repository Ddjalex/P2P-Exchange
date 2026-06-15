---
name: Build and package steps
description: Required steps when building and packaging xendrx-deploy.tar.gz
---

After running `pnpm --filter @workspace/p2p-exchange run build`, always run these two commands before packaging:

```
cp artifacts/p2p-exchange/src/assets/logo-banner.svg artifacts/p2p-exchange/dist/public/assets/
cp artifacts/p2p-exchange/src/assets/logo-icon.svg artifacts/p2p-exchange/dist/public/assets/
```

Then copy into xendrx-deploy and repack:

```
cp -r artifacts/p2p-exchange/dist/public/. xendrx-deploy/public/
cp artifacts/api-server/dist/*.mjs xendrx-deploy/api/
tar -czf xendrx-deploy.tar.gz xendrx-deploy/
```

**Why:** Vite does not automatically copy SVG assets from src/assets/ that aren't imported via JS — the logo files are referenced directly (e.g. in HTML/CSS/img tags) and must be manually copied into dist.

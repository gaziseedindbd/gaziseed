# Next.js 15 lint cleanup

Completed on 2026-10-02.

- `package.json` now runs `eslint .` directly.
- Added explicit `eslint.config.mjs` using the Next.js Core Web Vitals rules through a compatibility layer.
- Added CI verification in `.github/workflows/lint.yml`.
- Direct ESLint CI passes with the current codebase.
- `next.config.js` intentionally keeps `eslint.ignoreDuringBuilds: true` because the Next.js 15.5 production build on the current dependency set failed when build-time lint validation was enabled, while the standalone ESLint workflow passes successfully.
- Runtime/application behavior is unchanged by the lint migration.
- Vercel preview redeployment was retried after the verified build; platform deployment-rate limits may still block a new preview.

Warnings remain (primarily image optimization and React Hook dependency warnings), but there are no ESLint errors in the verified codebase.

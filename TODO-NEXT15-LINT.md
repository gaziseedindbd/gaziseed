# Next.js 15 lint cleanup

Completed on 2026-10-02.

- `package.json` now runs `eslint .` directly.
- Added explicit `eslint.config.mjs` using the Next.js Core Web Vitals rules.
- Added CI verification in `.github/workflows/lint.yml`.
- Direct ESLint CI passes with the current codebase.
- Removed the old `next.config.js` `eslint.ignoreDuringBuilds` bypass after lint verification.

Warnings remain (primarily image optimization and React Hook dependency warnings), but there are no ESLint errors in the verified codebase.

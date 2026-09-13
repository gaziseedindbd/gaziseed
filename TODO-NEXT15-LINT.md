# Next.js 15 lint cleanup

Deferred separately from the Next.js 15 upgrade.

- `package.json` still uses `next lint`.
- `next.config.js` currently has `eslint.ignoreDuringBuilds: true`.
- Do not change the lint command until an explicit ESLint configuration is established and `npm run lint` can be verified safely.

This file is only a tracking note and does not affect application runtime or production behavior.

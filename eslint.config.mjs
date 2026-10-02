import nextVitals from 'eslint-config-next/core-web-vitals.js';

const eslintConfig = [
  ...nextVitals,
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      '.tmp/**',
    ],
  },
];

export default eslintConfig;

import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Codebase ini memakai `any` secara sengaja untuk baris database yang
      // bentuknya dinamis (hasil query PostgreSQL). Menegakkan aturan ini
      // sebagai error akan menghasilkan 200+ pelanggaran sekaligus tanpa
      // menandakan bug nyata, sehingga tetap ditampilkan sebagai warning.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  globalIgnores([
    // Default ignores dari eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Area non-sumber: artefak debug, scratch scripts, dan generated files
    'node_modules/**',
    'scratch/**',
    'next.config.js',
  ]),
])

export default eslintConfig
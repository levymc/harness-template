import { defineConfig } from 'vitest/config';

// e2e usa um banco só; arquivos em paralelo disputariam as mesmas tabelas.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
  },
});

import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(viteConfig, defineConfig({
  // Backend staging and private evidence have their own runners and are never website test sources.
  test: { include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'], pool: 'threads', maxWorkers: 1 },
}))

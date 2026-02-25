/**
 * Node.js type declarations for vite.config.ts (used when @types/node is not installed or not resolved).
 */
declare module 'path' {
  export function resolve(...paths: string[]): string
}
declare module 'fs' {
  export function existsSync(path: string): boolean
  export function copyFileSync(src: string, dest: string): void
}
declare const __dirname: string
declare const process: { cwd(): string; env: Record<string, string | undefined> }

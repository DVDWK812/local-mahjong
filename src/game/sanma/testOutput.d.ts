/** Minimal Node declarations for durable Vitest evidence, matching the project's existing test-node shim. */
declare module 'node:fs' {
  export function writeFileSync(path: string, contents: string): void;
  export function mkdirSync(path: string, options: { recursive: boolean }): string | undefined;
}

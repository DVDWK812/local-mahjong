declare const process: {
  cwd: () => string;
};

declare module 'node:child_process' {
  export function execFileSync(command: string, args?: string[], options?: { cwd?: string; stdio?: 'pipe' | 'inherit' | 'ignore' }): unknown;
}

declare module 'node:fs' {
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string, encoding: 'utf8'): string;
}

declare module 'node:path' {
  export function resolve(...paths: string[]): string;
}

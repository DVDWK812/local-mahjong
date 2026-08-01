export const CURRENT_FORMAT_VERSION = 1 as const;

export type VersionedFormat = 'ReplayRecord' | 'MatchLog' | 'SavedMatch';
export type FormatVersionErrorReason = 'older' | 'future' | 'invalid';

export class FormatVersionError extends Error {
  readonly format: VersionedFormat;
  readonly actualVersion: unknown;
  readonly supportedVersion: number;
  readonly reason: FormatVersionErrorReason;

  constructor(format: VersionedFormat, actualVersion: unknown, reason: FormatVersionErrorReason) {
    const detail = reason === 'future'
      ? '不支持的未来版本（future/newer）'
      : reason === 'older'
        ? '不支持的旧版本（older；未提供明确迁移器）'
        : '无效或缺失的版本（invalid）';
    super(`${format} version ${detail}：实际版本 ${String(actualVersion)}，支持版本 ${CURRENT_FORMAT_VERSION}`);
    this.name = 'FormatVersionError';
    this.format = format;
    this.actualVersion = actualVersion;
    this.supportedVersion = CURRENT_FORMAT_VERSION;
    this.reason = reason;
  }
}

export function assertCurrentFormatVersion(format: VersionedFormat, actualVersion: unknown): asserts actualVersion is number {
  if (!Number.isInteger(actualVersion)) throw new FormatVersionError(format, actualVersion, 'invalid');
  if ((actualVersion as number) < CURRENT_FORMAT_VERSION) throw new FormatVersionError(format, actualVersion, 'older');
  if ((actualVersion as number) > CURRENT_FORMAT_VERSION) throw new FormatVersionError(format, actualVersion, 'future');
}

export type FormatMigrator<T extends { version: number }> = (input: T) => T;

export function migrateVersionedFormat<T extends { version: number }>(
  format: VersionedFormat,
  input: T,
  migrators: Readonly<Partial<Record<number, FormatMigrator<T>>>>,
): T {
  let current = input;
  while (current.version < CURRENT_FORMAT_VERSION) {
    const migrate = migrators[current.version];
    if (!migrate) throw new FormatVersionError(format, current.version, 'older');
    const previousVersion = current.version;
    current = migrate(current);
    if (!Number.isInteger(current.version) || current.version <= previousVersion) {
      throw new Error(`${format} version ${previousVersion} 迁移器未推进版本`);
    }
  }
  assertCurrentFormatVersion(format, current.version);
  return current;
}

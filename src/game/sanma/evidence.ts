/** Staleness is a view of evidence; never mutate a user's recorded verdict. */
export function sanmaEvidenceStale(record: { code: { fingerprint: string }; ruleVersion: string; fingerprint: string } | undefined,
  current: { code: string; ruleVersion: string; fingerprint: string }): boolean {
  return !!record && (record.code.fingerprint !== current.code || record.ruleVersion !== current.ruleVersion || record.fingerprint !== current.fingerprint);
}

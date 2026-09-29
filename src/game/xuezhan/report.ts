/** Reports are read-only evidence, not saves and never imported into acceptance storage. */
export function inspectXzReport(raw: string): { cases: number; fingerprint: string; snapshotId?: string } {
  if (raw.length > 8000000) throw new Error('报告超过 8 MB 限制');
  const v = JSON.parse(raw);
  if (!v || v.mode !== 'xuezhan' || v.schemaVersion !== 1 || !v.code || typeof v.code.fingerprint !== 'string' || !v.results || typeof v.results !== 'object' || Array.isArray(v.results)) throw new Error('不是血战 v1 测试报告');
  for (const [id, r] of Object.entries(v.results) as [string, any][]) {
    if (!id.startsWith('XZ-') || !r || !Number.isInteger(r.caseVersion) || typeof r.ruleId !== 'string' || typeof r.caseHash !== 'string' || !r.code || typeof r.code.fingerprint !== 'string' || !['未运行', '运行中', '通过', '失败', '阻塞', '跳过'].includes(r.automatic) || !['待复核', '通过', '失败', '阻塞', '不适用'].includes(r.manual)) throw new Error(`报告记录损坏：${id}`);
  }
  return { cases: Object.keys(v.results).length, fingerprint: v.code.fingerprint, snapshotId: v.code.snapshotId };
}

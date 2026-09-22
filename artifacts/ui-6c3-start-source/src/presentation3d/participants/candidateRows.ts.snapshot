/** Slots are anonymous presentation positions, never concealed tile identities. */
export function candidateRows(count: number) {
  const outerCount = Math.min(11, count);
  const innerCount = Math.max(0, count - 11);
  return { outerCount, innerCount };
}
export function candidateRowSlots(count: number, seat: 'bottom' | 'top') {
  const { innerCount } = candidateRows(count);
  // Keep existing visible candidate reading order; mirrored rows use the same semantic counts.
  return Array.from({ length: count }, (_, index) => {
    const outer = index >= innerCount;
    return { outer, row: outer === (seat === 'top') ? 1 : 2,
      column: outer ? index - innerCount + 1 : index + 1 };
  });
}

/** Presentation removal slot is count-only and says nothing about concealed order. */
export const concealedRemovalIndex = (count: number) => count > 11 ? count - 12 : count - 1;

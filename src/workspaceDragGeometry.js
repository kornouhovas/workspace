// In-table preview retains each real row's layout slot and moves the source-sized
// gap through intervening rows (including section headings and repeated headers).
export function tableDragDisplacements(rows, sourceIndex, targetIndex, after) {
  const offsets = rows.map(() => 0);
  if (targetIndex == null || sourceIndex < 0 || !rows[sourceIndex] || !rows[targetIndex]) return offsets;
  const slot = targetIndex + (after ? 1 : 0);
  const height = rows[sourceIndex].height;
  if (slot > sourceIndex) {
    for (let index = sourceIndex + 1; index < slot; index++) offsets[index] = -height;
  } else {
    for (let index = slot; index < sourceIndex; index++) offsets[index] = height;
  }
  return offsets;
}

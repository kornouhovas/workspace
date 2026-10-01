// Presentation-only placement while the existing service confirms rank / Status.
// No project fields, group settings or persisted ranks are changed here.
export function tableDropSections(sections, drop) {
  if (!drop) return sections;
  const rank = new Map(drop.order.map((id, index) => [id, index]));
  const crossing = drop.sourceGroupId !== drop.targetGroupId;
  const project = sections.flatMap(section => section.rows).find(project => project.id === drop.projectId);
  return sections.map(section => {
    let rows = [...section.rows];
    if (crossing && project) {
      rows = rows.filter(row => row.id !== project.id);
      if (section.id === drop.targetGroupId) rows.push(project);
    }
    rows.sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
    return { ...section, rows, ...(crossing ? { count: rows.length } : {}) };
  }).filter(section => !crossing || !drop.hideEmptyGroups || section.rows.length > 0);
}

export function tableDropTransitionValues(values, endpoint, progress, computed, delta) {
  const interpolated = values[0] + (values.at(-1) - values[0]) * progress;
  const scale = values.at(-1) && endpoint ? endpoint / values.at(-1)
    : interpolated ? computed / interpolated : 1;
  return values.map(value => value * scale - delta);
}

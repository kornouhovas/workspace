export type TableDropPlacement = { projectId: string; sourceGroupId: string; targetGroupId: string; order: readonly string[]; hideEmptyGroups?: boolean };
export function tableDropSections<T extends { readonly id: string; readonly rows: readonly { readonly id: string }[] }>(sections: readonly T[], drop: TableDropPlacement | null): readonly T[];

export function tableDropTransitionValues(values: readonly number[], endpoint: number, progress: number, computed: number, delta: number): number[];

import type { WorkspaceScreen } from './workspaceProjectSession';
export function viewPreviewId(screen: WorkspaceScreen | undefined, viewId: string): string | null;
export function rememberViewPreview(screen: WorkspaceScreen | undefined, viewId: string, projectId: string | null): WorkspaceScreen;
export function pruneViewPreviews(screen: WorkspaceScreen | undefined, viewIds: readonly string[]): WorkspaceScreen;
export function createPreviewRequestGuard(): { invalidate(): number; current(): number; accepts(token: number): boolean };
export function isPreviewBackground(target: EventTarget | null): boolean;
export function createPreviewBackgroundGesture(): {
 start(event: { button: number; defaultPrevented: boolean; target: EventTarget | null; clientX: number; clientY: number; pointerId: number }): void;
 move(event: { clientX: number; clientY: number; pointerId: number }): void;
 cancel(): void;
 finish(event: { button: number; defaultPrevented: boolean; target: EventTarget | null; clientX: number; clientY: number; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }, selection?: string): boolean;
};

export function createPreviewRestoreTracker(): { request(): number; needsRestore(identity: string): boolean; markRestored(identity: string): void };
export function retainViewPreview<T>(previous: { identity: string; project: T | undefined } | undefined, identity: string, project: T | undefined, visible: boolean): { identity: string; project: T | undefined };

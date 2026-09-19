import { WorkspaceServiceClient } from "./workspaceServiceClient.js";
export function duplicateWorkspaceView(client: WorkspaceServiceClient, workspaceId: string, sourceId: string, copyName: string): Promise<string>;

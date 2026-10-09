import type { RootPickerResult } from "../contracts/desktop-api.js";

export type DirectoryDialog = {
  showOpenDialog(options: {
    properties: ["openDirectory"];
    title?: string;
  }): Promise<{ canceled: boolean; filePaths: string[] }>;
};

export function createRootPicker(dialog: DirectoryDialog, automatedRoot?: string): () => Promise<RootPickerResult> {
  return async () => {
    // Runtime smoke tests use the same UI/API route while avoiding native dialogs.
    if (automatedRoot) return { outcome: "selected", path: automatedRoot };
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
      });
      if (result.canceled || !result.filePaths[0]) return { outcome: "cancelled" };
      return { outcome: "selected", path: result.filePaths[0] };
    } catch {
      return { outcome: "failed" };
    }
  };
}

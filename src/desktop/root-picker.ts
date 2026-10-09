import type { RootPickerResult } from "../contracts/desktop-api.js";

export type DirectoryDialog = {
  showOpenDialog(options: {
    properties: ["openDirectory"];
    title: string;
  }): Promise<{ canceled: boolean; filePaths: string[] }>;
};

export function createRootPicker(dialog: DirectoryDialog): () => Promise<RootPickerResult> {
  return async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
        title: "Choose workspace folder",
      });
      if (result.canceled || !result.filePaths[0]) return { outcome: "cancelled" };
      return { outcome: "selected", path: result.filePaths[0] };
    } catch {
      return { outcome: "failed" };
    }
  };
}

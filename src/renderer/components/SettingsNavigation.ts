import { createContext, useContext } from "react";

export type RecoverySettingsSection = "sources" | "backup";
export const SettingsNavigationContext = createContext<{ open(section: RecoverySettingsSection): void; workspaceVisible: boolean } | null>(null);
export const useSettingsNavigation = () => useContext(SettingsNavigationContext);

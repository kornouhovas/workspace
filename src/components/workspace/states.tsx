import { useI18n } from "@/i18n";

type WorkspaceEmptyStateProps = {
  readonly onOpenSettings: () => void;
};

export function WorkspaceEmptyState({ onOpenSettings }: WorkspaceEmptyStateProps) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-6 text-center">
      <div>
        <h2 className="text-lg font-semibold">{t("state.noSourceTitle")}</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {t("state.noSourceDescription")}
        </p>
      </div>
      <button
        type="button"
        className="inline-flex h-8 items-center rounded-lg bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        onClick={onOpenSettings}
      >
        {t("state.openSettings")}
      </button>
    </div>
  );
}

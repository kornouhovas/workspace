export class RendererLocalizedError extends Error {
  constructor(translationKey) {
    super(translationKey);
    this.name = "RendererLocalizedError";
    this.translationKey = translationKey;
  }
}

export function createRendererErrorState(error) {
  if (error instanceof RendererLocalizedError) {
    return { kind: "localized", translationKey: error.translationKey };
  }

  if (error instanceof Error) {
    return { kind: "opaque", message: error.message };
  }

  return { kind: "localized", translationKey: "error.workspaceServiceRequestFailed" };
}

export function resolveRendererErrorState(errorState, t) {
  if (typeof errorState === "string") {
    return errorState;
  }

  return errorState.kind === "localized"
    ? t(errorState.translationKey)
    : errorState.message;
}

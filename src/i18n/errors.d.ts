export type RendererErrorState =
  | { readonly kind: "localized"; readonly translationKey: string }
  | { readonly kind: "opaque"; readonly message: string };

export class RendererLocalizedError extends Error {
  readonly translationKey: string;
  constructor(translationKey: string);
}

export function createRendererErrorState(error: unknown): RendererErrorState;
export function resolveRendererErrorState(
  errorState: RendererErrorState | string,
  t: (key: string) => string,
): string;

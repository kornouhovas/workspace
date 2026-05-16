export const requiredViewPropertyIds: readonly ["property:name", "property:status"];

export function createPropertyOrder(
  visiblePropertyIds?: readonly string[],
): Record<string, number>;

export function createNextVisiblePropertyIds(input: {
  readonly currentVisiblePropertyIds?: readonly string[];
  readonly fallbackVisiblePropertyIds?: readonly string[];
  readonly availablePropertyIds?: readonly string[];
  readonly propertyId: string;
  readonly visible: boolean;
}): string[];

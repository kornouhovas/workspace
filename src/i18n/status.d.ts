type StatusDisplayValue = {
  readonly id?: string;
  readonly name?: string;
  readonly source?: string;
};

export function getStatusDisplayName(
  t: (key: string) => string,
  status: StatusDisplayValue,
): string;

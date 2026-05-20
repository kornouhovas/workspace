type NumberExpressionValue = {
  readonly expression: string;
  readonly value: number;
};

function isNumberExpressionValue(value: unknown): value is NumberExpressionValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { readonly expression?: unknown }).expression === "string" &&
    typeof (value as { readonly value?: unknown }).value === "number" &&
    Number.isFinite((value as { readonly value: number }).value)
  );
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

export function formatNumberDisplayValue(value: unknown) {
  if (isNumberExpressionValue(value)) {
    return formatNumber(value.value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return formatNumber(value);
  }

  if (value == null) {
    return "";
  }

  return String(value);
}

export function formatNumberEditorValue(value: unknown) {
  if (isNumberExpressionValue(value)) {
    return value.expression;
  }

  return formatNumberDisplayValue(value);
}

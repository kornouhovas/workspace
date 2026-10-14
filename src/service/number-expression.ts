// A bounded arithmetic parser; expressions never enter the JavaScript evaluator.
export function evaluateNumberExpression(expression: string): number | null {
  if (expression.length > 512) throw new Error("Expression too long");
  if (!expression.trim()) return null;
  const tokens = expression.match(/(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?|[()+*/-]|\s+|./g)!.filter(token => !/^\s+$/.test(token));
  if (tokens.length > 256) throw new Error("Too many tokens");
  let position = 0;
  const checked = (value: number) => {
    if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) throw new Error("Numeric result out of range");
    return Object.is(value, -0) ? 0 : value;
  };
  function primary(depth: number): number {
    if (depth > 32) throw new Error("Expression too deep");
    const token = tokens[position++];
    if (token === "+" || token === "-") return checked((token === "-" ? -1 : 1) * primary(depth + 1));
    if (token === "(") {
      const value = sum(depth + 1);
      if (tokens[position++] !== ")") throw new Error("Unclosed parentheses");
      return value;
    }
    if (!token || !/^(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(token)) throw new Error("Expected number");
    const value = checked(Number(token.replace(",", ".")));
    if (value === 0 && /[1-9]/.test(token.split(/[eE]/)[0])) throw new Error("Literal underflow");
    return value;
  }
  function product(depth: number): number {
    let value = primary(depth);
    while (tokens[position] === "*" || tokens[position] === "/") {
      const operator = tokens[position++], right = primary(depth);
      const next = checked(operator === "*" ? value * right : value / right);
      if (next === 0 && value !== 0 && right !== 0) throw new Error("Arithmetic underflow");
      value = next;
    }
    return value;
  }
  function sum(depth: number): number {
    let value = product(depth);
    while (tokens[position] === "+" || tokens[position] === "-") {
      const operator = tokens[position++], right = product(depth);
      value = checked(operator === "+" ? value + right : value - right);
    }
    return value;
  }
  const value = sum(0);
  if (position !== tokens.length) throw new Error("Unexpected token");
  return value;
}

import { parseAsEstreeExpression } from "./parse";
import { precook } from "./precook";
import { Expression } from "@babel/types";
import { EstreeVisitors } from "./interfaces";

export interface PreevaluateOptions {
  visitors?: EstreeVisitors;
}

export interface PreevaluateResult {
  expression: Expression;
  attemptToVisitGlobals: Set<string>;
  source: string;
}

// `raw` should always be asserted by `isEvaluable`.
export function preevaluate(
  raw: string,
  options?: PreevaluateOptions
): PreevaluateResult {
  const source = raw.replace(/^\s*<%~?\s|\s%>\s*$/g, "");
  let expression: Expression;
  try {
    expression = parseAsEstreeExpression(source);
  } catch (error) {
    throw new SyntaxError(`${error.message}, in "${raw}"`);
  }
  const attemptToVisitGlobals = precook(expression, {
    ...options,
    expressionOnly: true,
  });
  return {
    expression,
    attemptToVisitGlobals,
    source,
  };
}

export function isEvaluable(raw: string): boolean {
  return /^\s*<%~?\s/.test(raw) && /\s%>\s*$/.test(raw);
}

export function shouldAllowRecursiveEvaluations(raw: string): boolean {
  return /^\s*<%~\s/.test(raw);
}

import { parseExpression } from "@babel/parser";
import { FunctionExpression, Node } from "@babel/types";
import {
  PrecookOptions,
  PrecookVisitorState,
  PrefeastResult,
} from "./interfaces";
import { PrefeastVisitor } from "./PrefeastVisitor";
import { FLAG_BLOCK, PrecookScope } from "./Scope";
import { walkFactory } from "./utils";

export function prefeast(
  source: string,
  options?: PrecookOptions
): PrefeastResult {
  const func = parseExpression(source, {
    plugins: ["estree"],
    strictMode: true,
  }) as FunctionExpression;
  if (func.type !== "FunctionExpression") {
    throw new SyntaxError("Invalid function declaration");
  }
  const baseScope = new PrecookScope(FLAG_BLOCK);
  const state: PrecookVisitorState = {
    scopeStack: [baseScope],
    attemptToVisitGlobals: new Set(),
    scopeMapByNode: new WeakMap(),
    isRoot: true,
  };
  walkFactory(
    options?.visitors
      ? { ...PrefeastVisitor, ...options.visitors }
      : PrefeastVisitor,
    (node: Node) => {
      // eslint-disable-next-line no-console
      console.warn(
        `Unsupported node type \`${node.type}\`: \`${source.substring(
          node.start,
          node.end
        )}\``
      );
    }
  )(func, state);
  return {
    source,
    function: func,
    attemptToVisitGlobals: state.attemptToVisitGlobals,
    scopeMapByNode: state.scopeMapByNode,
    baseScope,
  };
}

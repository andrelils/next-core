import { Node } from "@babel/types";
import { parseExpression } from "@babel/parser";
import { walkFactory } from "./utils";
import { PrecookVisitor } from "./PrecookVisitor";
import { PrecookVisitorState, PrecookResult, PrecookOptions } from "./interfaces";
import { FLAG_GLOBAL, PrecookScope } from "./Scope";

export function precook(
  source: string,
  options?: PrecookOptions
): PrecookResult {
  const globalScope = new PrecookScope(FLAG_GLOBAL);
  const state: PrecookVisitorState = {
    scopeStack: [globalScope],
    attemptToVisitGlobals: new Set(),
    scopeMapByNode: new WeakMap(),
  };
  const expression = parseExpression(source, {
    plugins: ["estree", ["pipelineOperator", { proposal: "minimal" }]],
  });

  // const attemptToVisitMembers = new Map<string, Set<string>>();
  walkFactory(
    options?.visitors
      ? { ...PrecookVisitor, ...options.visitors }
      : PrecookVisitor,
    (node: Node) => {
      // eslint-disable-next-line no-console
      console.warn(
        `Unsupported node type \`${node.type}\`: \`${source.substring(
          node.start,
          node.end
        )}\``
      );
    }
  )(expression, state);

  return {
    source,
    expression,
    attemptToVisitGlobals: state.attemptToVisitGlobals,
    scopeMapByNode: state.scopeMapByNode,
    globalScope,
  };
}

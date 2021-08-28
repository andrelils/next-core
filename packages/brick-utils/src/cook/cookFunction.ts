import { Node } from "@babel/types";
import { walkFactory } from "./utils";
import { CookFunctionVisitor } from "./CookFunctionVisitor";
import { CookVisitorState, PrecookFunctionResult } from "./interfaces";
import { supply } from "./supply";

export function cookFunction<T extends (args: unknown[]) => unknown>(
  precookFunctioned: PrecookFunctionResult,
  globalVariables: Record<string, unknown> = {}
): T {
  const state: CookVisitorState<T> = {
    source: precookFunctioned.source,
    scopeMapByNode: precookFunctioned.scopeMapByNode,
    scopeStack: [
      supply(precookFunctioned.attemptToVisitGlobals, globalVariables),
    ],
    isRoot: true,
  };
  walkFactory(CookFunctionVisitor, (node: Node) => {
    throw new SyntaxError(
      `Unsupported node type \`${
        node.type
      }\`: \`${precookFunctioned.source.substring(node.start, node.end)}\``
    );
  })(precookFunctioned.function, state);
  return state.cooked;
}

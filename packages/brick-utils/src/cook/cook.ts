import { Node } from "@babel/types";
import { walkFactory } from "./utils";
import { CookVisitor } from "./CookVisitor";
import { CookVisitorState, PrecookResult } from "./interfaces";
import { supply } from "./supply";
import { CookScopeFactory } from "./Scope";

export function cook(
  precooked: PrecookResult,
  globalVariables: Record<string, unknown> = {}
): unknown {
  const state: CookVisitorState = {
    source: precooked.source,
    scopeMapByNode: precooked.scopeMapByNode,
    scopeStack: [
      supply(precooked.attemptToVisitGlobals, globalVariables),
      CookScopeFactory(precooked.globalScope),
    ],
  };
  walkFactory(CookVisitor, (node: Node) => {
    throw new SyntaxError(
      `Unsupported node type \`${node.type}\`: \`${precooked.source.substring(
        node.start,
        node.end
      )}\``
    );
  })(precooked.expression, state);
  return state.cooked;
}

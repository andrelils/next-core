import { Node } from "@babel/types";
import { walkFactory } from "./utils";
import { FeastVisitor } from "./FeastVisitor";
import { CookVisitorState, PrefeastResult } from "./interfaces";
import { supply } from "./supply";
import { CookScopeFactory } from "./Scope";

export function feast(
  prefeasted: PrefeastResult,
  globalVariables: Record<string, unknown> = {}
): unknown {
  const state: CookVisitorState = {
    source: prefeasted.source,
    scopeMapByNode: prefeasted.scopeMapByNode,
    scopeStack: [
      supply(prefeasted.attemptToVisitGlobals, globalVariables),
      CookScopeFactory(prefeasted.globalScope),
    ],
  };
  walkFactory(FeastVisitor, (node: Node) => {
    throw new SyntaxError(
      `Unsupported node type \`${node.type}\`: \`${prefeasted.source.substring(
        node.start,
        node.end
      )}\``
    );
  })(prefeasted.function, state);
  return state.cooked;
}

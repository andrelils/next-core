import { Node } from "@babel/types";
import { walkFactory } from "./utils";
import { FeastVisitor } from "./FeastVisitor";
import { CookVisitorState, PrefeastResult } from "./interfaces";
import { supply } from "./supply";
import { CookScope, FLAG_GLOBAL } from "./Scope";

export function feast(
  prefeasted: PrefeastResult,
  globalVariables: Record<string, unknown> = {}
): unknown {
  const state: CookVisitorState = {
    source: prefeasted.source,
    scopeMapByNode: prefeasted.scopeMapByNode,
    scopeStack: [
      new CookScope(FLAG_GLOBAL),
      supply(prefeasted.attemptToVisitGlobals, globalVariables),
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

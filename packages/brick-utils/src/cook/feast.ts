import { Node } from "@babel/types";
import { walkFactory } from "./utils";
import { FeastVisitor } from "./FeastVisitor";
import { CookVisitorState, PrefeastResult } from "./interfaces";
import { supply } from "./supply";
import { CookScopeFactory } from "./Scope";

export function feast<T extends (args: unknown[]) => unknown>(
  prefeasted: PrefeastResult,
  globalVariables: Record<string, unknown> = {}
): T {
  const state: CookVisitorState<T> = {
    source: prefeasted.source,
    scopeMapByNode: prefeasted.scopeMapByNode,
    scopeStack: [
      supply(prefeasted.attemptToVisitGlobals, globalVariables),
      CookScopeFactory(prefeasted.baseScope),
    ],
    isRoot: true,
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

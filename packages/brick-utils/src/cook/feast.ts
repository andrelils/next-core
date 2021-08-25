import { Node } from "@babel/types";
import { walkFactory } from "./utils";
import { FeastVisitor } from "./FeastVisitor";
import { CookVisitorState, PrefeastResult } from "./interfaces";
import { supply } from "./supply";

export function feast(
  prefeasted: PrefeastResult,
  globalVariables: Record<string, unknown> = {}
): unknown {
  const state: CookVisitorState = {
    source: prefeasted.source,
    currentScope: new Map(),
    closures: [supply(prefeasted.attemptToVisitGlobals, globalVariables)],
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

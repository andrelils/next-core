import { parse } from "@babel/parser";
import { FunctionDeclaration, Node } from "@babel/types";
import {
  PrecookOptions,
  PrecookVisitorState,
  PrefeastResult,
} from "./interfaces";
import { PrefeastVisitor } from "./PrefeastVisitor";
import { walkFactory } from "./utils";

export function prefeast(
  source: string,
  options?: PrecookOptions
): PrefeastResult {
  const file = parse(source, {
    plugins: ["estree"],
    strictMode: true,
  });
  const body = file.program.body;
  if (body.length !== 1 && body[0].type !== "FunctionDeclaration") {
    throw new SyntaxError("Invalid function declaration");
  }
  const func = body[0] as FunctionDeclaration;
  const state: PrecookVisitorState = {
    currentScope: new Set(),
    closures: [],
    attemptToVisitGlobals: new Set(),
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
  )(body[0], state);
  return {
    source,
    function: func,
    attemptToVisitGlobals: state.attemptToVisitGlobals,
  };
}

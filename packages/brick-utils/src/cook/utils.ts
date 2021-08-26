import {
  VisitorFn,
  PrecookVisitorState,
  CookVisitorState,
  ScopeVariableKind
} from "./interfaces";
import { CookScope, FLAG_BLOCK, FLAG_FUNCTION, FLAG_GLOBAL, PrecookScope } from "./Scope";

export function walkFactory<T>(
  visitor: Record<string, VisitorFn<T>>,
  catchUnsupportedNodeType: (node: any) => void
): (node: any, state: T) => void {
  return function walk(node: any, state: T) {
    const nodeVisitor = visitor[node.type];
    if (nodeVisitor) {
      nodeVisitor(node, state, walk);
    } else {
      catchUnsupportedNodeType(node);
    }
  };
}

export function spawnPrecookState(
  parentState: PrecookVisitorState,
  extendsState?: Partial<PrecookVisitorState>
): PrecookVisitorState {
  return {
    scopeStack: parentState.scopeStack,
    attemptToVisitGlobals: parentState.attemptToVisitGlobals,
    scopeMapByNode: parentState.scopeMapByNode,
    hoistOnly: parentState.hoistOnly,
    ...extendsState
  };
}

export function spawnCookState(
  parentState: CookVisitorState,
  extendsState?: Partial<CookVisitorState>
): CookVisitorState {
  return {
    source: parentState.source,
    // baseScopeStack: parentState.baseScopeStack,
    scopeMapByNode: parentState.scopeMapByNode,
    scopeStack: parentState.scopeStack,
    // hoistOnly: parentState.hoistOnly,
    returns: parentState.returns,
    ...extendsState
  };
}

export function addVariableToPrecookScopeStack(name: string, kind: ScopeVariableKind, scopeStack: PrecookScope[]): void {
  switch (kind) {
    case "param": {
      const scope = scopeStack[scopeStack.length - 1];
      if (process.env.NODE_ENV !== "production" && !(scope.flags & FLAG_FUNCTION)) {
        throw new Error(`The top scope stack for a param should always be function, but received: ${scope.flags}`);
      }
      scope.var.add(name);
      break;
    }
    case "let":
    case "const":
    case "functions": {
      const scope = findScopeByFlags(scopeStack, FLAG_GLOBAL | FLAG_FUNCTION | FLAG_BLOCK);
      scope.lexical.add(name);
      break;
    }
    case "var": {
      const scope = findScopeByFlags(scopeStack, FLAG_GLOBAL | FLAG_FUNCTION);
      scope.lexical.add(name);
      break;
    }
  }
}

export function findScopeByFlags(scopeStack: PrecookScope[], flags: number): PrecookScope;
export function findScopeByFlags(scopeStack: CookScope[], flags: number): CookScope;
export function findScopeByFlags(scopeStack: PrecookScope[] | CookScope[], flags: number): PrecookScope | CookScope {
  for (let i = scopeStack.length - 1; i >= 0; i--) {
    if (scopeStack[i].flags & flags) {
      return scopeStack[i];
    }
  }
}

import {
  VisitorFn,
  PrecookVisitorState,
  CookVisitorState,
  ScopeVariableKind
} from "./interfaces";
import { CookScope, CookScopeRef, FLAG_BLOCK, FLAG_FUNCTION, FLAG_GLOBAL, PrecookScope } from "./Scope";

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
    scopeMapByNode: parentState.scopeMapByNode,
    scopeStack: parentState.scopeStack,
    returns: parentState.returns,
    ...extendsState
  };
}

export function addVariableToScopeStack(name: string, kind: ScopeVariableKind, scopeStack: PrecookScope[], hasInit?: boolean): void {
  switch (kind) {
    case "param": {
      const scope = scopeStack[scopeStack.length - 1];
      if (process.env.NODE_ENV !== "production" && !(scope.flags & FLAG_FUNCTION)) {
        throw new Error(`The top scope stack for a param should always be function, but received: ${scope.flags}`);
      }
      scope.lexical.add(name);
      break;
    }
    case "let":
    case "const": {
      const scope = findScopeByFlags(scopeStack, FLAG_GLOBAL | FLAG_FUNCTION | FLAG_BLOCK);
      scope[kind === "let" ? "lexical" : "const"].add(name);
      break;
    }
    case "functions": {
      const scope = findScopeByFlags(scopeStack, FLAG_GLOBAL | FLAG_FUNCTION | FLAG_BLOCK);
      if (scope.var.has(name) && !scope.varHasInit.has(name)) {
        scope.var.delete(name);
      }
      if (!scope.var.has(name)) {
        scope.lexical.delete(name);
        getScopeRefOfFunctionDeclaration(scope).add(name);
      }
      break;
    }
    case "var": {
      const scope = findScopeByFlags(scopeStack, FLAG_GLOBAL | FLAG_FUNCTION);
      if (!hasInit && scope.functions.has(name)) {
        break;
      }
      for (const type of ["lexical", "const", "functions"] as const) {
        scope[type].delete(name);
      }
      scope.var.add(name);
      if (hasInit) {
        scope.varHasInit.add(name);
      }
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

export function getScopeRefOfFunctionDeclaration(scope: PrecookScope ): Set<string>;
export function getScopeRefOfFunctionDeclaration(scope: CookScope ): Map<string, CookScopeRef>;
export function getScopeRefOfFunctionDeclaration(scope: PrecookScope | CookScope): Set<string> | Map<string, CookScopeRef> {
  return scope[scope.flags & FLAG_GLOBAL ? "const" : "functions"];
}

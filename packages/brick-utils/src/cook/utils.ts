import {
  VisitorFn,
  PrecookVisitorState,
  CookVisitorState,
  ScopeVariableKind,
} from "./interfaces";
import {
  CookScope,
  FLAG_BLOCK,
  FLAG_FUNCTION,
  FLAG_GLOBAL,
  PrecookScope,
  VARIABLE_FLAG_CONST,
  VARIABLE_FLAG_FUNCTION,
  VARIABLE_FLAG_LET,
  VARIABLE_FLAG_PARAM,
  VARIABLE_FLAG_VAR,
} from "./Scope";

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
    hoisting: parentState.hoisting,
    ...extendsState,
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
    ...extendsState,
  };
}

export function addVariableToScopeStack(
  name: string,
  kind: ScopeVariableKind,
  scopeStack: PrecookScope[],
  hasInit?: boolean
): void {
  switch (kind) {
    case "param": {
      const scope = scopeStack[scopeStack.length - 1];
      // if (process.env.NODE_ENV !== "production" && !(scope.flags & FLAG_FUNCTION)) {
      //   throw new Error(`The top scope stack for a param should always be function, but received: ${scope.flags}`);
      // }
      // scope.lexical.add(name);

      scope.variables.add(name);
      scope.flagsMapByVariable.set(name, VARIABLE_FLAG_PARAM);
      break;
    }
    case "let":
    case "const": {
      const scope = findScopeByFlags(
        scopeStack,
        /* FLAG_GLOBAL | */ FLAG_FUNCTION | FLAG_BLOCK
      );
      // scope[kind === "let" ? "lexical" : "const"].add(name);

      scope.variables.add(name);
      scope.flagsMapByVariable.set(
        name,
        kind === "let" ? VARIABLE_FLAG_LET : VARIABLE_FLAG_CONST
      );
      break;
    }
    case "functions": {
      const scope = findScopeByFlags(
        scopeStack,
        FLAG_GLOBAL | FLAG_FUNCTION | FLAG_BLOCK
      );
      // if (scope.var.has(name) && !scope.varHasInit.has(name)) {
      //   scope.var.delete(name);
      // }
      // if (!scope.var.has(name)) {
      //   scope.lexical.delete(name);
      //   getScopeRefOfFunctionDeclaration(scope).add(name);
      // }

      scope.variables.add(name);
      const otherFlags =
        scope.flags & FLAG_GLOBAL
          ? VARIABLE_FLAG_CONST
          : scope.flagsMapByVariable.get(name) ?? 0;
      scope.flagsMapByVariable.set(name, otherFlags | VARIABLE_FLAG_FUNCTION);
      break;
    }
    case "var": {
      const scope = findScopeByFlags(
        scopeStack,
        /* FLAG_GLOBAL | */ FLAG_FUNCTION
      );
      // if (!hasInit && scope.functions.has(name)) {
      //   break;
      // }
      // for (const type of ["lexical", "const", "functions"] as const) {
      //   scope[type].delete(name);
      // }
      // scope.var.add(name);
      // if (hasInit) {
      //   scope.varHasInit.add(name);
      // }

      scope.variables.add(name);
      const prevFlags = scope.flagsMapByVariable.get(name) ?? 0;
      scope.flagsMapByVariable.set(name, prevFlags | VARIABLE_FLAG_VAR);
      break;
    }
  }
}

export function findScopeByFlags(
  scopeStack: PrecookScope[],
  flags: number
): PrecookScope;
export function findScopeByFlags(
  scopeStack: CookScope[],
  flags: number
): CookScope;
export function findScopeByFlags(
  scopeStack: PrecookScope[] | CookScope[],
  flags: number
): PrecookScope | CookScope {
  for (let i = scopeStack.length - 1; i >= 0; i--) {
    if (scopeStack[i].flags & flags) {
      return scopeStack[i];
    }
  }
}

// export function getScopeRefOfFunctionDeclaration(scope: PrecookScope ): Set<string>;
// export function getScopeRefOfFunctionDeclaration(scope: CookScope ): Map<string, CookScopeRef>;
// export function getScopeRefOfFunctionDeclaration(scope: PrecookScope | CookScope): Set<string> | Map<string, CookScopeRef> {
//   return scope[scope.flags & FLAG_GLOBAL ? "const" : "functions"];
// }

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
    controlFlow: parentState.controlFlow,
    ...extendsState,
  };
}

export function addVariableToScopeStack(
  name: string,
  kind: ScopeVariableKind,
  scopeStack: PrecookScope[]
): void {
  switch (kind) {
    case "param": {
      const scope = scopeStack[scopeStack.length - 1];
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

export function assertIterable(
  cooked: unknown,
  source: string,
  start: number,
  end: number
): void {
  if (!isIterable(cooked)) {
    throw new TypeError(
      `${typeof cooked} is not iterable: \`${source.substring(start, end)}\``
    );
  }
}

export function isTerminated(state: CookVisitorState): boolean {
  return state.returns.returned || state.controlFlow?.broken;
}

function isIterable(cooked: unknown): boolean {
  if (Array.isArray(cooked)) {
    return true;
  }
  if (cooked === null || cooked === undefined) {
    return false;
  }
  return typeof (cooked as Iterable<unknown>)[Symbol.iterator] === "function";
}

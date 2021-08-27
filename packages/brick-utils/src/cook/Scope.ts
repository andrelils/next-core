import { FunctionDeclaration } from "@babel/types";
import { CookAssignmentData } from "./interfaces";

export const FLAG_SANDBOX = 0b0001;
export const FLAG_GLOBAL = 0b0010;
export const FLAG_FUNCTION = 0b0100;
export const FLAG_BLOCK = 0b1000;

export const VARIABLE_FLAG_VAR = 0b00001;
export const VARIABLE_FLAG_LET = 0b00010;
export const VARIABLE_FLAG_CONST = 0b00100;
export const VARIABLE_FLAG_FUNCTION = 0b01000;
export const VARIABLE_FLAG_PARAM = 0b10000;

// export const INIT_KIND_PARAM      = 1;
// export const INIT_KIND_FUNCTION   = 2;
// export const INIT_KIND_ASSIGNMENT = 3;

export class PrecookScope {
  readonly flags: number;
  readonly variables: Set<string>;
  readonly flagsMapByVariable: Map<string, number>;
  readonly hoistedFunctions: Set<FunctionDeclaration>;

  constructor(flags: number) {
    this.variables = new Set();
    this.flagsMapByVariable = new Map();
    this.hoistedFunctions = new Set();

    this.flags = flags;
  }

  has(name: string): boolean {
    return this.variables.has(name);
  }
}

export class CookScope {
  readonly flags: number;
  readonly variables: Map<string, CookScopeRef>;

  constructor(flags: number) {
    this.variables = new Map();
    this.flags = flags;
  }

  get(name: string): CookScopeRef {
    return this.variables.get(name);
  }
}

export function CookScopeStackFactory(
  baseScopeStack: CookScope[],
  precookScope?: PrecookScope
): CookScope[] {
  return baseScopeStack.concat(
    precookScope ? CookScopeFactory(precookScope) : []
  );
}

export function CookScopeFactory(precookScope: PrecookScope): CookScope {
  const scope = new CookScope(precookScope.flags);
  for (const key of precookScope.variables) {
    const variableFlags = precookScope.flagsMapByVariable.get(key);
    scope.variables.set(key, {
      initialized: !!(variableFlags & VARIABLE_FLAG_VAR),
      const: !!(variableFlags & VARIABLE_FLAG_CONST),
    });
  }

  return scope;
}

export interface CookScopeRef {
  initialized: boolean;
  initializeKind?: number;
  const?: boolean;
  cooked?: unknown;
}

import { CookVisitorState } from "./interfaces";

export const FLAG_SANDBOX  = 0b0001;
export const FLAG_GLOBAL   = 0b0010;
export const FLAG_FUNCTION = 0b0100;
export const FLAG_BLOCK    = 0b1000;

export class PrecookScope {
  readonly flags: number;
  readonly var: Set<string>;
  readonly lexical: Set<string>;
  readonly const: Set<string>;
  readonly functions: Set<string>;
  readonly varHasInit: Set<string>;

  constructor(flags: number) {
    this.var = new Set();
    this.lexical = new Set();
    this.const = new Set();
    this.functions = new Set();
    this.varHasInit = new Set();
    this.flags = flags;
  }

  has(name: string): boolean {
    return this.var.has(name) || this.functions.has(name) || this.lexical.has(name) || this.const.has(name);
  }
}

export class CookScope {
  readonly flags: number;
  readonly var: Map<string, CookScopeRef>;
  readonly lexical: Map<string, CookScopeRef>;
  readonly const: Map<string, CookScopeRef>;
  readonly functions: Map<string, CookScopeRef>;
  readonly varHasInit: Set<string>;

  constructor(flags: number) {
    this.var = new Map();
    this.lexical = new Map();
    this.const = new Map();
    this.functions = new Map();
    this.varHasInit = new Set();
    this.flags = flags;
  }

  get(name: string): CookScopeRef {
    return this.var.get(name) || this.functions.get(name) || this.lexical.get(name) || this.const.get(name);
  }

  assign(name: string, assignment: CookVisitorState["assignment"]): boolean {
    if (assignment.isVarWithoutInit && !this.varHasInit.has(name)) {
      return true;
    }
    const ref = this.get(name);
    if (ref) {
      ref.cooked = assignment.rightCooked;
      ref.initialized = true;
      return true;
    }
  }
}

export function CookScopeStackFactory(baseScopeStack: CookScope[], precookScope?: PrecookScope): CookScope[] {
  return baseScopeStack.concat(precookScope ? CookScopeFactory(precookScope) : []);
}

export function CookScopeFactory(precookScope: PrecookScope): CookScope {
  const scope = new CookScope(precookScope.flags);
  for (const type of ["var", "lexical", "const", "functions"] as const) {
    for (const key of precookScope[type]) {
      scope[type].set(key, {
        initialized: type === "var" || type === "functions",
        const: type === "const",
      });
    }
  }
  for (const key of precookScope.varHasInit) {
    scope.varHasInit.add(key);
  }
  return scope;
}

export interface CookScopeRef {
  initialized: boolean;
  const?: boolean;
  cooked?: unknown;
}

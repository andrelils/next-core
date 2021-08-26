export const FLAG_SANDBOX  = 0b0001;
export const FLAG_GLOBAL   = 0b0010;
export const FLAG_FUNCTION = 0b0100;
export const FLAG_BLOCK    = 0b1000;

export class PrecookScope {
  readonly flags: number;
  readonly var: Set<string>;
  readonly lexical: Set<string>;
  readonly functions: Set<string>;

  constructor(flags: number) {
    this.var = new Set();
    this.lexical = new Set();
    this.functions = new Set();
    this.flags = flags;
  }

  has(name: string): boolean {
    return this.var.has(name) || this.lexical.has(name) || this.functions.has(name);
  }
}

export class CookScope {
  readonly flags: number;
  readonly var: Map<string, CookScopeRef>;
  readonly lexical: Map<string, CookScopeRef>;
  readonly functions: Map<string, CookScopeRef>;

  constructor(flags: number) {
    this.var = new Map();
    this.lexical = new Map();
    this.functions = new Map();
    this.flags = flags;
  }

  get(name: string): CookScopeRef {
    return this.var.get(name) || this.lexical.get(name) || this.functions.get(name);
  }
}

export function CookScopeStackFactory(baseScopeStack: CookScope[], precookScope?: PrecookScope): CookScope[] {
  // const lastIndex = precookScopeStack.length - 1;
  // const newStack: CookScope[] = [
  //   CookScopeFactory(precookScopeStack[lastIndex])
  // ];
  // for (let i = lastIndex - 1; i >= 0; i--) {
  //   if (precookScopeStack[i].flags & (FLAG_FUNCTION | FLAG_GLOBAL)) {
  //     break;
  //   }
  //   newStack.unshift(CookScopeFactory(precookScopeStack[i]));
  // }
  return baseScopeStack.concat(precookScope ? CookScopeFactory(precookScope) : []);
}

function CookScopeFactory(precookScope: PrecookScope): CookScope {
  const scope = new CookScope(precookScope.flags);
  for (const type of ["var", "lexical", "functions"] as const) {
    for (const key of precookScope[type]) {
      scope[type].set(key, {
        initialized: false
      });
    }
  }
  return scope;
}

export interface CookScopeRef {
  initialized: boolean;
  const?: boolean;
  cooked?: unknown;
}

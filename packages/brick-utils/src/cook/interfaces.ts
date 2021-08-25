import { Expression, FunctionDeclaration } from "@babel/types";

export interface ChainExpression {
  type: "ChainExpression";
  expression: Expression;
}

export interface PrecookOptions {
  visitors?: Record<string, VisitorFn<PrecookVisitorState>>;
}

export type PrecookScope = Set<string>;

export interface PrecookVisitorState {
  currentScope: PrecookScope;
  closures: PrecookScope[];
  attemptToVisitGlobals: Set<string>;
  identifierAsLiteralString?: boolean;
  collectVariableNamesOnly?: string[];
  isFunction?: boolean;
}

export interface PrecookResult {
  source: string;
  expression: Expression;
  attemptToVisitGlobals: Set<string>;
}

export type CookScope = Map<string, CookScopeRef>;

export type CookScopeRef = {
  initialized: boolean;
  const?: boolean;
  cooked?: any;
};

export interface CookVisitorState<T = any> {
  source: string;
  currentScope: CookScope;
  closures: CookScope[];
  identifierAsLiteralString?: boolean;
  spreadAsProperties?: boolean;
  collectVariableNamesOnly?: string[];
  assignment?: {
    operator?: string;
    initializeOnly?: boolean;
    rightCooked?: unknown;
  };
  chainRef?: {
    skipped?: boolean;
  };
  memberCooked?: {
    object: ObjectCooked;
    property: PropertyCooked;
  };
  returns?: {
    returned: boolean;
    cooked?: unknown;
  };
  switches?: {
    discriminantCooked: unknown;
    tested: boolean;
    // Broken or returned.
    terminated: boolean;
  };
  cooked?: T;
}

export type PropertyCooked = string | number;
export type PropertyEntryCooked = [PropertyCooked, any];
export type ObjectCooked = Record<PropertyCooked, any>;

export type VisitorCallback<T> = (node: any, state: T) => void;

export type VisitorFn<T> = (
  node: any,
  state: T,
  callback: VisitorCallback<T>
) => void;

export interface PrefeastResult {
  source: string;
  function: FunctionDeclaration;
  attemptToVisitGlobals: Set<string>;
}

import { Expression, FunctionDeclaration, Node, VariableDeclaration } from "@babel/types";
import { CookScope, PrecookScope } from "./Scope";

export interface ChainExpression {
  type: "ChainExpression";
  expression: Expression;
}

export interface PrecookOptions {
  visitors?: Record<string, VisitorFn<PrecookVisitorState>>;
}

export interface PrecookVisitorState {
  scopeStack: PrecookScope[];
  attemptToVisitGlobals: Set<string>;
  scopeMapByNode: WeakMap<Node, PrecookScope>;
  identifierAsLiteralString?: boolean;
  collectVariableNamesAsKind?: ScopeVariableKind;
  hasInit?: boolean;
  isFunctionBody?: boolean;
  hoistOnly?: boolean;
}

export type ScopeVariableKind = "param" | VariableDeclaration["kind"] | "functions";

export interface PrecookResult {
  source: string;
  expression: Expression;
  attemptToVisitGlobals: Set<string>;
  scopeMapByNode: WeakMap<Node, PrecookScope>;
  globalScope: PrecookScope;
}

export interface CookVisitorState<T = any> {
  source: string;
  scopeMapByNode: WeakMap<Node, PrecookScope>;
  scopeStack?: CookScope[];
  identifierAsLiteralString?: boolean;
  spreadAsProperties?: boolean;
  isFunctionBody?: boolean;
  assignment?: {
    operator?: string;
    initializeOnly?: boolean;
    rightCooked?: unknown;
    // kind?: VariableDeclaration["kind"];
    // hasInit?: boolean;
    isVarWithoutInit?: boolean;
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
  scopeMapByNode: WeakMap<Node, PrecookScope>;
  globalScope: PrecookScope;
}

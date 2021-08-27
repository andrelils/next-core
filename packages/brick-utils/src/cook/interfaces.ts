import {
  Expression,
  FunctionDeclaration,
  Node,
  VariableDeclaration,
} from "@babel/types";
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
  isRoot?: boolean;
  identifierAsLiteralString?: boolean;
  collectVariableNamesAsKind?: ScopeVariableKind;
  isFunctionBody?: boolean;
  hoisting?: boolean;
}

export type ScopeVariableKind =
  | "param"
  | VariableDeclaration["kind"]
  | "functions";

export interface BasePreResult {
  source: string;
  attemptToVisitGlobals: Set<string>;
  scopeMapByNode: WeakMap<Node, PrecookScope>;
  globalScope: PrecookScope;
}

export interface PrecookResult extends BasePreResult {
  expression: Expression;
}

export interface CookVisitorState<T = any> {
  source: string;
  scopeMapByNode: WeakMap<Node, PrecookScope>;
  scopeStack?: CookScope[];
  isRoot?: boolean;
  identifierAsLiteralString?: boolean;
  spreadAsProperties?: boolean;
  isFunctionBody?: boolean;
  hoisting?: boolean;
  checkTypeOf?: boolean;
  assignment?: CookAssignmentData;
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

export interface CookAssignmentData {
  operator?: string;
  initializeOnly?: boolean;
  // initializeKind?: number;
  rightCooked?: unknown;
  // kind?: VariableDeclaration["kind"];
  // hasInit?: boolean;
  // isVarWithoutInit?: boolean;
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

export interface PrefeastResult extends BasePreResult {
  function: FunctionDeclaration;
}

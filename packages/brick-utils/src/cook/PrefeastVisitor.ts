import {
  AssignmentExpression,
  BlockStatement,
  ExpressionStatement,
  ForInStatement,
  ForOfStatement,
  ForStatement,
  FunctionDeclaration,
  IfStatement,
  ReturnStatement,
  SwitchCase,
  SwitchStatement,
  VariableDeclaration,
} from "@babel/types";
import { PrecookScope, PrecookVisitorState, VisitorFn } from "./interfaces";
import { PrecookVisitor } from "./PrecookVisitor";
import { getScopes, spawnPrecookState } from "./utils";

export const PrefeastVisitor = Object.freeze<
  Record<string, VisitorFn<PrecookVisitorState>>
>({
  ...PrecookVisitor,
  AssignmentExpression(node: AssignmentExpression, state, callback) {
    callback(node.right, state);
    callback(node.left, state);
  },
  BlockStatement(node: BlockStatement, state, callback) {
    const bodyState: PrecookVisitorState = state.isFunction
      ? spawnPrecookState(state)
      : {
          currentScope: new Set(),
          closures: getScopes(state),
          attemptToVisitGlobals: state.attemptToVisitGlobals,
        };
    for (const statement of node.body) {
      callback(statement, bodyState);
    }
  },
  BreakStatement() {
    // Do nothing.
  },
  EmptyStatement() {
    // Do nothing.
  },
  ExpressionStatement(node: ExpressionStatement, state, callback) {
    callback(node.expression, state);
  },
  ForInStatement(node: ForInStatement, state, callback) {
    const currentScope: PrecookScope = new Set();
    const blockState: PrecookVisitorState = {
      currentScope,
      closures: getScopes(state),
      attemptToVisitGlobals: state.attemptToVisitGlobals,
    };
    callback(node.right, blockState);
    callback(node.left, blockState);
    callback(node.body, blockState);
  },
  ForOfStatement(node: ForOfStatement, state, callback) {
    const currentScope: PrecookScope = new Set();
    const blockState: PrecookVisitorState = {
      currentScope,
      closures: getScopes(state),
      attemptToVisitGlobals: state.attemptToVisitGlobals,
    };
    callback(node.right, blockState);
    callback(node.left, blockState);
    callback(node.body, blockState);
  },
  ForStatement(node: ForStatement, state, callback) {
    const currentScope: PrecookScope = new Set();
    const blockState: PrecookVisitorState = {
      currentScope,
      closures: getScopes(state),
      attemptToVisitGlobals: state.attemptToVisitGlobals,
    };
    if (node.init) {
      callback(node.init, blockState);
    }
    if (node.test) {
      callback(node.test, blockState);
    }
    callback(node.body, blockState);
    if (node.update) {
      callback(node.update, blockState);
    }
  },
  FunctionDeclaration(node: FunctionDeclaration, state, callback) {
    state.currentScope.add(node.id.name);

    const cookedParamNames: string[] = [];
    const paramState = spawnPrecookState(state, {
      collectVariableNamesOnly: cookedParamNames,
    });
    for (const param of node.params) {
      callback(param, paramState);
    }

    const currentScope: PrecookScope = new Set(cookedParamNames);
    const bodyState: PrecookVisitorState = {
      currentScope,
      closures: getScopes(state),
      attemptToVisitGlobals: state.attemptToVisitGlobals,
      isFunction: true,
    };

    for (const param of node.params) {
      callback(param, bodyState);
    }

    callback(node.body, bodyState);
  },
  IfStatement(node: IfStatement, state, callback) {
    callback(node.test, state);
    callback(node.consequent, state);
    if (node.alternate) {
      callback(node.alternate, state);
    }
  },
  ReturnStatement(node: ReturnStatement, state, callback) {
    if (node.argument) {
      callback(node.argument, state);
    }
  },
  SwitchCase(node: SwitchCase, state, callback) {
    if (node.test) {
      callback(node.test, state);
    }
    for (const statement of node.consequent) {
      callback(statement, state);
    }
  },
  SwitchStatement(node: SwitchStatement, state, callback) {
    callback(node.discriminant, state);
    for (const switchCase of node.cases) {
      callback(switchCase, state);
    }
  },
  VariableDeclaration(node: VariableDeclaration, state, callback) {
    // Todo(steve): collect scope variables (and functions) across the current scope.
    const declarationNames: string[] = [];
    const declarationState = spawnPrecookState(state, {
      collectVariableNamesOnly: declarationNames,
    });
    for (const declaration of node.declarations) {
      callback(declaration.id, declarationState);
    }
    for (const name of declarationNames) {
      state.currentScope.add(name);
    }
    for (const declaration of node.declarations) {
      callback(declaration.id, state);
      if (declaration.init) {
        callback(declaration.init, state);
      }
    }
  },
});

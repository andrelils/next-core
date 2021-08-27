import {
  ArrowFunctionExpression,
  AssignmentExpression,
  BlockStatement,
  CatchClause,
  ExpressionStatement,
  ForInStatement,
  ForOfStatement,
  ForStatement,
  FunctionDeclaration,
  FunctionExpression,
  IfStatement,
  ReturnStatement,
  SwitchCase,
  SwitchStatement,
  TryStatement,
  VariableDeclaration,
} from "@babel/types";
import { PrecookVisitorState, VisitorFn } from "./interfaces";
import { PrecookVisitor } from "./PrecookVisitor";
import {
  FLAG_BLOCK,
  FLAG_FUNCTION,
  PrecookScope,
  VARIABLE_FLAG_CONST,
  VARIABLE_FLAG_FUNCTION,
} from "./Scope";
import { addVariableToScopeStack, spawnPrecookState } from "./utils";

const ForOfStatementVisitor: VisitorFn<PrecookVisitorState> = (
  node: ForInStatement | ForOfStatement,
  state,
  callback
) => {
  if (state.hoisting) {
    callback(node.left, state);
    callback(node.body, state);
    return;
  }
  const newScope = new PrecookScope(FLAG_BLOCK);
  const blockState: PrecookVisitorState = spawnPrecookState(state, {
    scopeStack: state.scopeStack.concat(newScope),
  });
  state.scopeMapByNode.set(node, newScope);
  callback(node.right, blockState);
  callback(node.left, blockState);
  callback(node.body, blockState);
};

const FunctionVisitor: VisitorFn<PrecookVisitorState> = (
  node: FunctionDeclaration | FunctionExpression | ArrowFunctionExpression,
  state,
  callback
) => {
  if (
    node.type === "FunctionDeclaration"
      ? !(state.hoisting || state.isRoot)
      : state.hoisting
  ) {
    return;
  }

  if (node.type === "FunctionDeclaration") {
    addVariableToScopeStack(node.id.name, "functions", state.scopeStack);

    if (state.hoisting) {
      const topScope = state.scopeStack[state.scopeStack.length - 1];
      topScope.hoistedFunctions.add(node);
    }
  }

  const newScope = new PrecookScope(FLAG_FUNCTION);

  if (node.type === "FunctionExpression" && node.id) {
    newScope.variables.add(node.id.name);
    // A function expression itself is considered as const.
    newScope.flagsMapByVariable.set(
      node.id.name,
      VARIABLE_FLAG_CONST | VARIABLE_FLAG_FUNCTION
    );
  }

  const bodyState: PrecookVisitorState = spawnPrecookState(state, {
    scopeStack: state.scopeStack.concat(newScope),
    isFunctionBody: true,
  });
  state.scopeMapByNode.set(node, newScope);

  const paramState = spawnPrecookState(bodyState, {
    collectVariableNamesAsKind: "param",
  });
  for (const param of node.params) {
    callback(param, paramState);
  }

  for (const param of node.params) {
    callback(param, bodyState);
  }

  // Collect hoist var and function declarations first.
  callback(
    node.body,
    spawnPrecookState(bodyState, {
      isFunctionBody: true,
      hoisting: true,
    })
  );

  callback(node.body, bodyState);
};

export const PrefeastVisitor = Object.freeze<
  Record<string, VisitorFn<PrecookVisitorState>>
>({
  ...PrecookVisitor,
  ArrowFunctionExpression: FunctionVisitor,
  AssignmentExpression(node: AssignmentExpression, state, callback) {
    if (state.hoisting) {
      return;
    }
    callback(node.right, state);
    callback(node.left, state);
  },
  BlockStatement(node: BlockStatement, state, callback) {
    let bodyState = state;
    if (state.isFunctionBody) {
      bodyState = spawnPrecookState(state);
    } else {
      const newScope = state.hoisting
        ? new PrecookScope(FLAG_BLOCK)
        : state.scopeMapByNode.get(node);
      bodyState = spawnPrecookState(state, {
        scopeStack: state.scopeStack.concat(newScope),
      });
      if (state.hoisting) {
        state.scopeMapByNode.set(node, newScope);
      }
    }
    for (const statement of node.body) {
      callback(statement, bodyState);
    }
  },
  BreakStatement() {
    // Do nothing.
  },
  CatchClause(node: CatchClause, state, callback) {
    let newScope: PrecookScope;
    if (state.hoisting) {
      newScope = new PrecookScope(FLAG_BLOCK);
      state.scopeMapByNode.set(node, newScope);
    } else {
      newScope = state.scopeMapByNode.get(node);
    }
    const blockState = spawnPrecookState(state, {
      scopeStack: state.scopeStack.concat(newScope),
    });
    if (!state.hoisting) {
      callback(
        node.param,
        spawnPrecookState(blockState, {
          collectVariableNamesAsKind: "let",
        })
      );
    }
    callback(node.body, blockState);
  },
  EmptyStatement() {
    // Do nothing.
  },
  ExpressionStatement(node: ExpressionStatement, state, callback) {
    if (!state.hoisting) {
      callback(node.expression, state);
    }
  },
  ForInStatement: ForOfStatementVisitor,
  ForOfStatement: ForOfStatementVisitor,
  ForStatement(node: ForStatement, state, callback) {
    if (state.hoisting) {
      if (node.init) {
        callback(node.init, state);
      }
      callback(node.body, state);
      return;
    }
    const newScope = new PrecookScope(FLAG_BLOCK);
    const blockState: PrecookVisitorState = spawnPrecookState(state, {
      scopeStack: state.scopeStack.concat(newScope),
    });
    state.scopeMapByNode.set(node, newScope);
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
  FunctionDeclaration: FunctionVisitor,
  FunctionExpression: FunctionVisitor,
  IfStatement(node: IfStatement, state, callback) {
    if (!state.hoisting) {
      callback(node.test, state);
    }
    callback(node.consequent, state);
    if (node.alternate) {
      callback(node.alternate, state);
    }
  },
  ReturnStatement(node: ReturnStatement, state, callback) {
    if (!state.hoisting && node.argument) {
      callback(node.argument, state);
    }
  },
  SwitchCase(node: SwitchCase, state, callback) {
    if (!state.hoisting && node.test) {
      callback(node.test, state);
    }
    for (const statement of node.consequent) {
      callback(statement, state);
    }
  },
  SwitchStatement(node: SwitchStatement, state, callback) {
    let newScope: PrecookScope;
    if (state.hoisting) {
      newScope = new PrecookScope(FLAG_BLOCK);
      state.scopeMapByNode.set(node, newScope);
    } else {
      newScope = state.scopeMapByNode.get(node);
    }
    const bodyState = spawnPrecookState(state, {
      scopeStack: state.scopeStack.concat(newScope),
    });
    if (!state.hoisting) {
      callback(node.discriminant, state);
    }
    for (const switchCase of node.cases) {
      callback(switchCase, bodyState);
    }
  },
  TryStatement(node: TryStatement, state, callback) {
    callback(node.block, state);
    if (node.handler) {
      callback(node.handler, state);
    }
    if (node.finalizer) {
      callback(node.finalizer, state);
    }
  },
  VariableDeclaration(node: VariableDeclaration, state, callback) {
    // `var`s are collected only in hoist stage.
    // While others are collected only in non-hoist stage.
    if (Number(!state.hoisting) ^ Number(node.kind === "var")) {
      for (const declaration of node.declarations) {
        callback(
          declaration.id,
          spawnPrecookState(state, {
            collectVariableNamesAsKind: node.kind,
          })
        );
      }
    }

    if (!state.hoisting) {
      for (const declaration of node.declarations) {
        callback(declaration.id, state);
        if (declaration.init) {
          callback(declaration.init, state);
        }
      }
    }
  },
});

import {
  ArrowFunctionExpression,
  AssignmentExpression,
  BlockStatement,
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
  VariableDeclaration,
} from "@babel/types";
import { PrecookVisitorState, VisitorFn } from "./interfaces";
import { PrecookVisitor } from "./PrecookVisitor";
import { FLAG_BLOCK, FLAG_FUNCTION, FLAG_GLOBAL, PrecookScope } from "./Scope";
import { addVariableToScopeStack, spawnPrecookState } from "./utils";

export const PrefeastVisitor = Object.freeze<
  Record<string, VisitorFn<PrecookVisitorState>>
>({
  ...PrecookVisitor,
  ArrowFunctionExpression(node: ArrowFunctionExpression, state, callback) {
    if (state.hoistOnly) {
      return;
    }

    const newScope = new PrecookScope(FLAG_FUNCTION);
    const bodyState = spawnPrecookState(state, {
      scopeStack: state.scopeStack.concat(newScope),
      isFunctionBody: true,
    });
    state.scopeMapByNode.set(node, newScope);

    const collectParamNamesState = spawnPrecookState(bodyState, {
      collectVariableNamesAsKind: "param",
    });
    for (const param of node.params) {
      callback(param, collectParamNamesState);
    }

    for (const param of node.params) {
      callback(param, bodyState);
    }

    // Collect hoist var and function declarations first.
    callback(node.body, spawnPrecookState(
      bodyState, {
        hoistOnly: true,
      }
    ));

    callback(node.body, bodyState);
  },
  AssignmentExpression(node: AssignmentExpression, state, callback) {
    if (state.hoistOnly) {
      return;
    }
    callback(node.right, state);
    callback(node.left, state);
  },
  BlockStatement(node: BlockStatement, state, callback) {
    let bodyState = state;
    if (!state.hoistOnly) {
      if (state.isFunctionBody) {
        bodyState = spawnPrecookState(state);
      } else {
        const newScope = new PrecookScope(FLAG_BLOCK);
        bodyState = spawnPrecookState(state, {
          scopeStack: state.scopeStack.concat(newScope),
        });
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
  EmptyStatement() {
    // Do nothing.
  },
  ExpressionStatement(node: ExpressionStatement, state, callback) {
    if (!state.hoistOnly) {
      callback(node.expression, state);
    }
  },
  ForInStatement(node: ForInStatement, state, callback) {
    if (state.hoistOnly) {
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
  },
  ForOfStatement(node: ForOfStatement, state, callback) {
    if (state.hoistOnly) {
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
  },
  ForStatement(node: ForStatement, state, callback) {
    if (state.hoistOnly) {
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
  FunctionDeclaration(node: FunctionDeclaration, state, callback) {
    if (state.hoistOnly || (state.scopeStack[state.scopeStack.length - 1].flags & FLAG_GLOBAL)) {
      addVariableToScopeStack(
        node.id.name,
        "functions",
        state.scopeStack,
      );

      if (state.hoistOnly) {
        return;
      }
    }

    const newScope = new PrecookScope(FLAG_FUNCTION);
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
    callback(node.body, spawnPrecookState(
      bodyState, {
        hoistOnly: true,
      }
    ));

    callback(node.body, bodyState);
  },
  FunctionExpression(node: FunctionExpression, state, callback) {
    if (state.hoistOnly) {
      return;
    }

    const newScope = new PrecookScope(FLAG_FUNCTION);
    if (node.id) {
      // A function expression is considered as const.
      newScope.const.add(node.id.name);
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
    callback(node.body, spawnPrecookState(
      bodyState, {
        hoistOnly: true,
      }
    ));

    callback(node.body, bodyState);
  },
  IfStatement(node: IfStatement, state, callback) {
    if (!state.hoistOnly) {
      callback(node.test, state);
    }
    callback(node.consequent, state);
    if (node.alternate) {
      callback(node.alternate, state);
    }
  },
  ReturnStatement(node: ReturnStatement, state, callback) {
    if (!state.hoistOnly && node.argument) {
      callback(node.argument, state);
    }
  },
  SwitchCase(node: SwitchCase, state, callback) {
    if (!state.hoistOnly && node.test) {
      callback(node.test, state);
    }
    for (const statement of node.consequent) {
      callback(statement, state);
    }
  },
  SwitchStatement(node: SwitchStatement, state, callback) {
    let switchState = state;
    if (!state.hoistOnly) {
      callback(node.discriminant, state);
      const newScope = new PrecookScope(FLAG_BLOCK);
      switchState = spawnPrecookState(state, {
        scopeStack: state.scopeStack.concat(newScope),
      });
      state.scopeMapByNode.set(node, newScope);
    }
    for (const switchCase of node.cases) {
      callback(switchCase, switchState);
    }
  },
  VariableDeclaration(node: VariableDeclaration, state, callback) {
    // `var`s are collected only in hoist stage.
    // While others are collected only in non-hoist stage.
    if (Number(!state.hoistOnly) ^ Number(node.kind === "var")) {
      // const declarationState = spawnPrecookState(state, {
      //   collectVariableNamesAsKind: node.kind,
      // });
      for (const declaration of node.declarations) {
        callback(declaration.id, spawnPrecookState(state, {
          collectVariableNamesAsKind: node.kind,
          hasInit: !!declaration.init
        }));
      }
    }

    if (!state.hoistOnly) {
      for (const declaration of node.declarations) {
        callback(declaration.id, state);
        if (declaration.init) {
          callback(declaration.init, state);
        }
      }
    }
  },
});

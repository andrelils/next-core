import {
  ArrowFunctionExpression,
  AssignmentExpression,
  BlockStatement,
  BreakStatement,
  ExpressionStatement,
  FunctionDeclaration,
  FunctionExpression,
  IfStatement,
  ReturnStatement,
  SwitchCase,
  SwitchStatement,
  VariableDeclaration,
} from "@babel/types";
import { CookVisitorState, VisitorFn } from "./interfaces";
import { CookVisitor } from "./CookVisitor";
import { spawnCookState } from "./utils";
import { CookScopeStackFactory } from "./Scope";

const FunctionVisitor: VisitorFn<CookVisitorState> = (
  node: FunctionDeclaration | FunctionExpression | ArrowFunctionExpression,
  state,
  callback
) => {
  if (node.async || node.generator) {
    throw new SyntaxError(
      `${
        node.async ? "Async" : "Generator"
      } function is not allowed, but received: \`${state.source.substring(
        node.start,
        node.end
      )}\``
    );
  }

  if (
    node.type === "FunctionDeclaration" &&
    !(state.hoisting || state.isRoot)
  ) {
    return;
  }

  const fn = function (...args: unknown[]): unknown {
    const precookScope = state.scopeMapByNode.get(node);
    const scopeStack = CookScopeStackFactory(state.scopeStack, precookScope);

    if (node.type === "FunctionExpression" && node.id) {
      const topScope = scopeStack[scopeStack.length - 1];
      const ref = topScope.variables.get(node.id.name);
      ref.cooked = state.cooked;
      ref.initialized = true;
    }

    const bodyState: CookVisitorState = spawnCookState(state, {
      scopeStack,
      isFunctionBody: true,
      returns: {
        returned: false,
      },
    });

    node.params.forEach((param, index) => {
      const variableInitValue =
        param.type === "RestElement" ? args.slice(index) : args[index];

      const paramState = spawnCookState(bodyState, {
        assignment: {
          initializeOnly: true,
          rightCooked: variableInitValue,
        },
      });

      callback(param, paramState);
    });

    for (const hoistedFn of precookScope.hoistedFunctions) {
      callback(
        hoistedFn,
        spawnCookState(bodyState, {
          isFunctionBody: true,
          hoisting: true,
        })
      );
    }

    callback(node.body, bodyState);

    return bodyState.returns.cooked;
  };

  if (state.isRoot || node.type !== "FunctionDeclaration") {
    state.cooked = fn;
  }

  if (node.type === "FunctionDeclaration") {
    const topScope = state.scopeStack[state.scopeStack.length - 1];
    const ref = topScope.get(node.id.name);
    ref.cooked = fn;
    ref.initialized = true;
  }
};

export const FeastVisitor = Object.freeze<
  Record<string, VisitorFn<CookVisitorState>>
>({
  ...CookVisitor,
  ArrowFunctionExpression: FunctionVisitor,
  AssignmentExpression(node: AssignmentExpression, state, callback) {
    const rightState = spawnCookState(state);
    callback(node.right, rightState);

    const leftState = spawnCookState(state, {
      assignment: {
        operator: node.operator,
        rightCooked: rightState.cooked,
      },
    });
    callback(node.left, leftState);

    state.cooked = rightState.cooked;
  },
  BlockStatement(node: BlockStatement, state, callback) {
    const precookScope = state.scopeMapByNode.get(node);
    const scopeStack = CookScopeStackFactory(
      state.scopeStack,
      state.scopeMapByNode.get(node)
    );

    const bodyState = spawnCookState(state, {
      scopeStack,
      switches: state.switches,
    });

    if (precookScope) {
      for (const hoistedFn of precookScope.hoistedFunctions) {
        callback(
          hoistedFn,
          spawnCookState(bodyState, {
            hoisting: true,
          })
        );
      }
    }

    for (const statement of node.body) {
      callback(statement, bodyState);
      if (bodyState.returns.returned) {
        break;
      }
    }
  },
  BreakStatement(node: BreakStatement, state) {
    state.switches.terminated = true;
  },
  EmptyStatement() {
    // Do nothing.
  },
  ExpressionStatement(node: ExpressionStatement, state, callback) {
    callback(node.expression, spawnCookState(state));
  },
  FunctionDeclaration: FunctionVisitor,
  FunctionExpression: FunctionVisitor,
  IfStatement(node: IfStatement, state, callback) {
    const testState = spawnCookState(state);
    callback(node.test, testState);
    if (testState.cooked) {
      callback(node.consequent, spawnCookState(state));
    } else if (node.alternate) {
      callback(node.alternate, spawnCookState(state));
    }
  },
  ReturnStatement(node: ReturnStatement, state, callback) {
    const argumentState = spawnCookState(state);
    if (node.argument) {
      callback(node.argument, argumentState);
    }
    state.returns.returned = true;
    state.returns.cooked = argumentState.cooked;
    if (state.switches) {
      state.switches.terminated = true;
    }
  },
  SwitchCase(node: SwitchCase, state, callback) {
    if (!state.switches.tested && node.test) {
      const testState = spawnCookState(state);
      callback(node.test, testState);
      state.switches.tested =
        testState.cooked === state.switches.discriminantCooked;
    }
    if (state.switches.tested || !node.test) {
      for (const statement of node.consequent) {
        callback(statement, state);
        if (state.switches.terminated) {
          state.switches.tested = false;
          break;
        }
      }
    }
  },
  SwitchStatement(node: SwitchStatement, state, callback) {
    const discriminantState = spawnCookState(state);
    callback(node.discriminant, discriminantState);

    const precookScope = state.scopeMapByNode.get(node);
    const scopeStack = CookScopeStackFactory(state.scopeStack, precookScope);
    const bodyState = spawnCookState(state, {
      scopeStack,
      switches: {
        discriminantCooked: discriminantState.cooked,
        tested: false,
        terminated: false,
      },
    });

    for (const hoistedFn of precookScope.hoistedFunctions) {
      callback(
        hoistedFn,
        spawnCookState(bodyState, {
          hoisting: true,
        })
      );
    }

    for (const switchCase of node.cases) {
      callback(switchCase, bodyState);
      if (bodyState.switches.terminated) {
        break;
      }
    }
  },
  VariableDeclaration(node: VariableDeclaration, state, callback) {
    for (const declaration of node.declarations) {
      let initCooked;
      if (declaration.init) {
        const initState = spawnCookState(state);
        callback(declaration.init, initState);
        initCooked = initState.cooked;
      }
      if (node.kind !== "var" || declaration.init) {
        const idState = spawnCookState(state, {
          assignment: {
            initializeOnly: true,
            rightCooked: initCooked,
          },
        });
        callback(declaration.id, idState);
      }
    }
  },
});

import {
  ArrayPattern,
  ArrowFunctionExpression,
  BlockStatement,
  CallExpression,
  Expression,
  ForInStatement,
  ForOfStatement,
  ForStatement,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  NewExpression,
  ObjectPattern,
  PatternLike,
  RestElement,
  Statement,
  SwitchCase,
  VariableDeclaration,
} from "@babel/types";
import {
  ApplyStringOrNumericAssignment,
  CreateListIteratorRecord,
  ApplyStringOrNumericBinaryOperator,
  GetV,
  GetValue,
  InitializeReferencedBinding,
  IsPropertyReference,
  LoopContinues,
  PutValue,
  RequireObjectCoercible,
  ToObject,
  ToPropertyKey,
  UpdateEmpty,
} from "./context-free";
import {
  CompletionRecord,
  DeclarativeEnvironment,
  ECMAScriptCode,
  Empty,
  Environment,
  EnvironmentRecord,
  ExecutionContext,
  FormalParameters,
  FunctionEnvironment,
  FunctionObject,
  NormalCompletion,
  ReferenceRecord,
} from "./ExecutionContext";
import {
  EstreeLVal,
  EstreeNode,
  EstreeObjectExpression,
  EstreeObjectPattern,
  EstreeProperty,
} from "./interfaces";
import {
  collectBoundNames,
  collectScopedDeclarations,
  containsExpression,
  getDeclaredNames,
} from "./traverse";

export function evaluate(
  root: FunctionDeclaration | ArrowFunctionExpression
): FunctionObject {
  const expressionOnly = root.type === "ArrowFunctionExpression";

  const ThrowIfFunctionIsInvalid = (
    func: FunctionDeclaration | FunctionExpression | ArrowFunctionExpression
  ): void => {
    if (func.async || func.generator) {
      throw new SyntaxError(
        `${func.async ? "Async" : "Generator"} function is not allowed`
      );
    }
    if (expressionOnly && !(func as ArrowFunctionExpression).expression) {
      throw new SyntaxError(
        "Only an `Expression` is allowed in `ArrowFunctionExpression`'s body"
      );
    }
  };

  ThrowIfFunctionIsInvalid(root);

  const rootEnv = new DeclarativeEnvironment(null);
  const rootContext = new ExecutionContext();
  rootContext.VariableEnvironment = rootEnv;
  rootContext.LexicalEnvironment = rootEnv;
  const executionContextStack = [rootContext];

  function getRunningContext(): ExecutionContext {
    return executionContextStack[executionContextStack.length - 1];
  }

  function Evaluate(node: EstreeNode): CompletionRecord {
    // Expressions:
    switch (node.type) {
      case "Identifier": {
        const ref = ResolveBinding(node.name);
        return NormalCompletion(ref);
      }
      case "ArrayExpression": {
        const array = [];
        let nextIndex = 0;
        for (const element of node.elements) {
          if (element) {
            const initValue = GetValue(Evaluate(element));
            array[nextIndex] = initValue;
            nextIndex++;
          } else {
            nextIndex++;
            array.length = nextIndex;
          }
        }
        return NormalCompletion(array);
      }
      case "ArrowFunctionExpression": {
        ThrowIfFunctionIsInvalid(node);
        const closure = InstantiateArrowFunctionExpression(node);
        return NormalCompletion(closure);
      }
      // case "AssignmentPattern":
      case "BinaryExpression":
      case "LogicalExpression": {
        const leftRef = Evaluate(node.left);
        const leftValue = GetValue(leftRef);
        if (
          node.operator === "??" &&
          (leftValue === null || leftValue === undefined)
        ) {
          const rightRef = Evaluate(node.right);
          return NormalCompletion(GetValue(rightRef));
        }
        const rightRef = Evaluate(node.right);
        const rightValue = GetValue(rightRef);
        const result = ApplyStringOrNumericBinaryOperator(
          leftValue as number,
          node.operator,
          rightValue as number
        );
        return NormalCompletion(result);
      }
      case "CallExpression": {
        const ref = Evaluate(node.callee).Value;
        const func = GetValue(ref) as FunctionObject;
        return EvaluateCall(func, ref, node.arguments);
      }
      case "NewExpression":
        return EvaluateNew(node.callee, node.arguments);
      //   Evaluate(node.callee);
      //   Evaluate(node.arguments);
      //   return;
      // case "ChainExpression":
      //   Evaluate(node.expression);
      //   return;
      case "ConditionalExpression":
        return NormalCompletion(
          GetValue(
            Evaluate(
              GetValue(Evaluate(node.test)) ? node.consequent : node.alternate
            )
          )
        );
      case "MemberExpression": {
        const baseReference = Evaluate(node.object);
        const baseValue = GetValue(baseReference);
        return NormalCompletion(
          node.computed
            ? EvaluatePropertyAccessWithExpressionKey(
                baseValue,
                node.property as Expression,
                true
              )
            : EvaluatePropertyAccessWithIdentifierKey(
                baseValue,
                node.property as Identifier,
                true
              )
        );
      }
      case "ObjectExpression": {
        const object: Record<PropertyKey, unknown> = {};
        for (const prop of (node as EstreeObjectExpression).properties) {
          if (prop.type === "SpreadElement") {
            const fromValue = GetValue(Evaluate(prop.argument));
            CopyDataProperties(object, fromValue, []);
          } else {
            if (prop.kind !== "init") {
              throw new SyntaxError("Unsupported object getter/setter");
            }
            // Todo: __proto__
            const propName =
              !prop.computed && prop.key.type === "Identifier"
                ? (GetValue(Evaluate(prop.key)) as PropertyKey)
                : EvaluatePropertyName(prop.key);
            object[propName] = GetValue(Evaluate(prop.value));
          }
        }
        return NormalCompletion(object);
      }
      // case "Property":
      //   if (node.computed) {
      //     Evaluate(node.key);
      //   }
      //   Evaluate(node.value);
      //   return;
      // case "RestElement":
      // case "SpreadElement":
      // case "UnaryExpression":
      //   Evaluate(node.argument);
      //   return;
      case "SequenceExpression": {
        let result: CompletionRecord;
        for (const expr of node.expressions) {
          result = NormalCompletion(GetValue(Evaluate(expr)));
        }
        return result;
      }
      // case "TemplateLiteral":
      //   Evaluate(node.expressions);
      //   return;
      // case "TaggedTemplateExpression":
      //   Evaluate(node.tag);
      //   Evaluate(node.quasi);
      //   return;
      case "Literal":
        return NormalCompletion(node.value);
    }
    if (!expressionOnly) {
      // Statements and assignments:
      switch (node.type) {
        case "AssignmentExpression": {
          if (node.operator === "=") {
            if (
              !(
                node.left.type === "ArrayPattern" ||
                node.left.type === "ObjectPattern"
              )
            ) {
              const lref = Evaluate(node.left).Value as ReferenceRecord;
              // If IsAnonymousFunctionDefinition(AssignmentExpression) and IsIdentifierRef of LeftHandSideExpression are both true, then
              // Else
              const rref = Evaluate(node.right);
              const rval = GetValue(rref);

              PutValue(lref, rval);
              return NormalCompletion(rval);
            }
            const rref = Evaluate(node.right);
            const rval = GetValue(rref) as string | number;
            DestructuringAssignmentEvaluation(node.left, rval);
            return NormalCompletion(rval);
          } else {
            const lref = Evaluate(node.left).Value as ReferenceRecord;
            const lval = GetValue(lref) as string | number;
            const rref = Evaluate(node.right);
            const rval = GetValue(rref) as string | number;
            const r = ApplyStringOrNumericAssignment(lval, node.operator, rval);
            PutValue(lref, r);
            return NormalCompletion(r);
          }
        }
        //   Evaluate(node.right);
        //   Evaluate(node.left);
        //   return;
        case "BlockStatement": {
          if (!node.body.length) {
            return NormalCompletion(Empty);
          }
          const oldEnv = getRunningContext().LexicalEnvironment;
          const blockEnv = new DeclarativeEnvironment(oldEnv);
          BlockDeclarationInstantiation(node.body, blockEnv);
          getRunningContext().LexicalEnvironment = blockEnv;
          const blockValue = EvaluateStatementList(node.body);
          getRunningContext().LexicalEnvironment = oldEnv;
          return blockValue;
        }
        case "BreakStatement":
          return new CompletionRecord("break", Empty);
        case "ContinueStatement":
          return new CompletionRecord("continue", Empty);
        case "EmptyStatement":
          return NormalCompletion(Empty);
        // case "CatchClause": {
        //   const oldEnv = getRunningContext().LexicalEnvironment;
        //   const catchEnv = new DeclarativeEnvironment(oldEnv);
        //   for (const argName of collectBoundNames(node.param)) {
        //     catchEnv.CreateMutableBinding(argName, false);
        //   }
        //   getRunningContext().LexicalEnvironment = catchEnv;
        //   Evaluate(node.param);
        //   Evaluate(node.body);
        //   getRunningContext().LexicalEnvironment = oldEnv;
        //   return;
        // }
        // case "DoWhileStatement":
        //   Evaluate(node.body);
        //   Evaluate(node.test);
        //   return;
        case "ExpressionStatement":
        case "TSAsExpression":
          return Evaluate(node.expression);
        case "ForInStatement":
        case "ForOfStatement":
          return EvaluateBreakableStatement(ForInOfLoopEvaluation(node));
        case "ForStatement":
          return EvaluateBreakableStatement(ForLoopEvaluation(node));
        case "FunctionDeclaration": {
          return NormalCompletion(Empty);
        }
        case "FunctionExpression": {
          ThrowIfFunctionIsInvalid(node);
          const closure = InstantiateOrdinaryFunctionExpression(node);
          return NormalCompletion(closure);
        }
        case "IfStatement":
          return GetValue(Evaluate(node.test))
            ? UpdateEmpty(Evaluate(node.consequent), undefined)
            : node.alternate
            ? UpdateEmpty(Evaluate(node.alternate), undefined)
            : NormalCompletion(undefined);
        case "ReturnStatement": {
          let v: unknown;
          if (node.argument) {
            const exprRef = Evaluate(node.argument);
            v = GetValue(exprRef);
          }
          return new CompletionRecord("return", v);
        }
        // case "ThrowStatement":
        // case "UpdateExpression":
        //   Evaluate(node.argument);
        //   return;
        case "SwitchCase":
          return EvaluateStatementList(node.consequent);
        case "SwitchStatement": {
          const exprRef = Evaluate(node.discriminant);
          const switchValue = GetValue(exprRef);
          const oldEnv = getRunningContext().LexicalEnvironment;
          const blockEnv = new DeclarativeEnvironment(oldEnv);
          BlockDeclarationInstantiation(node.cases, blockEnv);
          getRunningContext().LexicalEnvironment = blockEnv;
          const R = CaseBlockEvaluation(node.cases, switchValue);
          getRunningContext().LexicalEnvironment = oldEnv;
          return EvaluateBreakableStatement(R);
        }
        // case "TryStatement":
        //   Evaluate(node.block);
        //   Evaluate(node.handler);
        //   Evaluate(node.finalizer);
        //   return;
        case "VariableDeclaration": {
          let result: CompletionRecord;
          for (const declarator of node.declarations) {
            if (!declarator.init) {
              if (node.kind === "var") {
                result = NormalCompletion(Empty);
              } else if (declarator.id.type === "Identifier") {
                const lhs = ResolveBinding(declarator.id.name);
                result = InitializeReferencedBinding(lhs, undefined);
              }
            } else if (declarator.id.type === "Identifier") {
              const bindingId = declarator.id.name;
              const lhs = ResolveBinding(bindingId);
              // Todo: IsAnonymousFunctionDefinition(Initializer)
              const rhs = Evaluate(declarator.init);
              const value = GetValue(rhs);
              result =
                node.kind === "var"
                  ? PutValue(lhs, value)
                  : InitializeReferencedBinding(lhs, value);
            } else {
              const rhs = Evaluate(declarator.init);
              const rval = GetValue(rhs);
              result = BindingInitialization(
                declarator.id,
                rval,
                node.kind === "var"
                  ? undefined
                  : getRunningContext().LexicalEnvironment
              );
            }
          }
          return result;
        }
        // case "WhileStatement":
        //   Evaluate(node.test);
        //   Evaluate(node.body);
        //   return;
      }
    }
    // eslint-disable-next-line no-console
    throw new SyntaxError(`Unsupported node type \`${node.type}\``);
  }

  function CaseBlockEvaluation(
    cases: SwitchCase[],
    input: unknown
  ): CompletionRecord {
    let V: unknown;

    const defaultCaseIndex = cases.findIndex((switchCase) => !switchCase.test);
    const hasDefaultCase = defaultCaseIndex >= 0;
    const A = hasDefaultCase ? cases.slice(0, defaultCaseIndex) : cases;
    let found = false;
    for (const C of A) {
      if (!found) {
        found = CaseClauseIsSelected(C, input);
      }
      if (found) {
        const R = Evaluate(C);
        if (R.Value !== Empty) {
          V = R.Value;
        }
        if (R.Type !== "normal") {
          return UpdateEmpty(R, V);
        }
      }
    }

    if (!hasDefaultCase) {
      return NormalCompletion(V);
    }

    let foundInB = false;
    const B = cases.slice(defaultCaseIndex + 1);
    if (!found) {
      for (const C of B) {
        if (!foundInB) {
          foundInB = CaseClauseIsSelected(C, input);
        }
        if (foundInB) {
          const R = Evaluate(C);
          if (R.Value !== Empty) {
            V = R.Value;
          }
          if (R.Type !== "normal") {
            return UpdateEmpty(R, V);
          }
        }
      }
    }

    if (foundInB) {
      return NormalCompletion(V);
    }
    const R = Evaluate(cases[defaultCaseIndex]);
    if (R.Value !== Empty) {
      V = R.Value;
    }
    if (R.Type !== "normal") {
      return UpdateEmpty(R, V);
    }

    // 14. NOTE: The following is another complete iteration of the second CaseClauses.
    for (const C of B) {
      const R = Evaluate(C);
      if (R.Value !== Empty) {
        V = R.Value;
      }
      if (R.Type !== "normal") {
        return UpdateEmpty(R, V);
      }
    }
    return NormalCompletion(V);
  }

  function CaseClauseIsSelected(C: SwitchCase, input: unknown): boolean {
    const clauseSelector = GetValue(Evaluate(C.test));
    return input === clauseSelector;
  }

  function EvaluatePropertyAccessWithExpressionKey(
    baseValue: unknown,
    expression: Expression,
    strict: boolean
  ): ReferenceRecord {
    const propertyNameReference = Evaluate(expression);
    const propertyNameValue = GetValue(propertyNameReference);
    const propertyKey = ToPropertyKey(propertyNameValue);
    return new ReferenceRecord(baseValue, propertyKey, strict);
  }

  function EvaluatePropertyAccessWithIdentifierKey(
    baseValue: unknown,
    identifierName: Identifier,
    strict: boolean
  ): ReferenceRecord {
    const propertyNameString = identifierName.name;
    return new ReferenceRecord(baseValue, propertyNameString, strict);
  }

  function EvaluateCall(
    func: FunctionObject,
    ref: ReferenceRecord,
    args: CallExpression["arguments"]
  ): CompletionRecord {
    let thisValue;
    if (ref instanceof ReferenceRecord) {
      if (IsPropertyReference(ref)) {
        thisValue = ref.Base;
      } else {
        throw new TypeError();
      }
    }
    const argList = ArgumentListEvaluation(args);
    if (typeof func !== "function") {
      throw new TypeError();
    }
    return NormalCompletion(func.apply(thisValue, argList));
  }

  function EvaluateNew(
    constructExpr: CallExpression["callee"],
    args: NewExpression["arguments"]
  ): CompletionRecord {
    const ref = Evaluate(constructExpr);
    const constructor = GetValue(ref) as new (...args: unknown[]) => unknown;
    const argList = ArgumentListEvaluation(args);
    return NormalCompletion(new constructor(...argList));
  }

  function ArgumentListEvaluation(
    args: CallExpression["arguments"]
  ): unknown[] {
    const array: unknown[] = [];
    for (const arg of args) {
      if (arg.type === "SpreadElement") {
        array.push(...(GetValue(Evaluate(arg)) as unknown[]));
      } else {
        array.push(GetValue(Evaluate(arg)));
      }
    }
    return array;
  }

  function EvaluateBreakableStatement(
    stmtResult: CompletionRecord
  ): CompletionRecord {
    return stmtResult.Type === "break"
      ? stmtResult.Value === Empty
        ? NormalCompletion(undefined)
        : NormalCompletion(stmtResult.Value)
      : stmtResult;
  }

  function ForInOfLoopEvaluation(
    node: ForInStatement | ForOfStatement
  ): CompletionRecord {
    const lhs = node.left;
    const isVariableDeclaration = lhs.type === "VariableDeclaration";
    const lhsKind = isVariableDeclaration
      ? lhs.kind === "var"
        ? "varBinding"
        : "lexicalBinding"
      : "assignment";
    const uninitializedBoundNames =
      lhsKind === "lexicalBinding" ? collectBoundNames(lhs) : [];
    const iterationKind =
      node.type === "ForInStatement" ? "enumerate" : "iterate";
    const keyResult = ForInOfHeadEvaluation(
      uninitializedBoundNames,
      node.right,
      iterationKind
    );
    if (keyResult.Type !== "normal") {
      // When enumerate, if the target is nil, a break completion will be returned.
      return keyResult;
    }
    return ForInOfBodyEvaluation(
      lhs,
      node.body,
      keyResult.Value as Iterator<unknown>,
      iterationKind,
      lhsKind
    );
  }

  function ForInOfHeadEvaluation(
    uninitializedBoundNames: string[],
    expr: Expression,
    iterationKind: "enumerate" | "iterate"
  ): CompletionRecord {
    const runningContext = getRunningContext();
    const oldEnv = runningContext.LexicalEnvironment;
    if (uninitializedBoundNames.length > 0) {
      const newEnv = new DeclarativeEnvironment(oldEnv);
      for (const name of uninitializedBoundNames) {
        newEnv.CreateMutableBinding(name, false);
      }
      runningContext.LexicalEnvironment = newEnv;
    }
    const exprRef = Evaluate(expr);
    runningContext.LexicalEnvironment = oldEnv;
    const exprValue = GetValue(exprRef);
    if (iterationKind === "enumerate") {
      if (exprValue === null || exprValue === undefined) {
        return new CompletionRecord("break", Empty);
      }
      const iterator = EnumerateObjectProperties(exprValue);
      return NormalCompletion(iterator);
    }
    const iterator = CreateListIteratorRecord(exprValue as Iterable<unknown>);
    return NormalCompletion(iterator);
  }

  function* EnumerateObjectProperties(value: any): Iterator<PropertyKey> {
    for (const key in value) {
      yield key;
    }
  }

  function ForInOfBodyEvaluation(
    node: VariableDeclaration | EstreeLVal,
    stmt: Statement,
    iteratorRecord: Iterator<unknown>,
    iterationKind: "enumerate" | "iterate",
    lhsKind: "varBinding" | "lexicalBinding" | "assignment"
  ): CompletionRecord {
    const lhs =
      lhsKind === "assignment"
        ? (node as EstreeLVal)
        : (node as VariableDeclaration).declarations[0].id;
    const oldEnv = getRunningContext().LexicalEnvironment;
    let V: unknown;
    // When `destructuring` is false,
    // For `node` whose `kind` is assignment:
    //   `lhs` is an `Identifier` or a `MemberExpression`,
    // Otherwise:
    //   `lhs` is an `Identifier`.
    const destructuring =
      lhs.type === "ObjectPattern" || lhs.type === "ArrayPattern";
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value: nextValue } = iteratorRecord.next();
      if (done) {
        return NormalCompletion(V);
      }
      let lhsRef: ReferenceRecord;
      let iterationEnv: DeclarativeEnvironment;
      if (lhsKind === "lexicalBinding") {
        iterationEnv = new DeclarativeEnvironment(oldEnv);
        ForDeclarationBindingInstantiation(
          node as VariableDeclaration,
          iterationEnv
        );
        getRunningContext().LexicalEnvironment = iterationEnv;
        if (!destructuring) {
          const [lhsName] = collectBoundNames(lhs);
          lhsRef = ResolveBinding(lhsName);
        }
      } else if (!destructuring) {
        lhsRef = Evaluate(lhs).Value as ReferenceRecord;
      }
      destructuring
        ? lhsKind === "assignment"
          ? DestructuringAssignmentEvaluation(lhs, nextValue)
          : lhsKind === "varBinding"
          ? BindingInitialization(lhs, nextValue, undefined)
          : BindingInitialization(lhs, nextValue, iterationEnv)
        : lhsKind === "lexicalBinding"
        ? InitializeReferencedBinding(lhsRef, nextValue)
        : PutValue(lhsRef, nextValue);

      const result = Evaluate(stmt);
      getRunningContext().LexicalEnvironment = oldEnv;
      if (!LoopContinues(result)) {
        return UpdateEmpty(result, V);
      }
      if (result.Value !== Empty) {
        V = result.Value;
      }
    }
  }

  function DestructuringAssignmentEvaluation(
    pattern: ObjectPattern | EstreeObjectPattern | ArrayPattern,
    value: unknown
  ): CompletionRecord {
    if (pattern.type === "ObjectPattern") {
      RequireObjectCoercible(value);
      if (pattern.properties.length > 0) {
        PropertyDestructuringAssignmentEvaluation(
          (pattern as EstreeObjectPattern).properties,
          value
        );
      }
      return NormalCompletion(Empty);
    }
    const iteratorRecord = CreateListIteratorRecord(value as Iterable<unknown>);
    return IteratorDestructuringAssignmentEvaluation(
      pattern.elements,
      iteratorRecord
    );
  }

  function PropertyDestructuringAssignmentEvaluation(
    properties: (EstreeProperty | RestElement)[],
    value: unknown
  ): CompletionRecord {
    const excludedNames: PropertyKey[] = [];
    for (const prop of properties) {
      if (prop.type === "Property") {
        if (!prop.computed && prop.key.type === "Identifier") {
          const P = prop.key.name;
          const lref = ResolveBinding(P);
          let v = GetV(value, P);
          if (prop.value.type === "AssignmentPattern" && v === undefined) {
            // Todo(steve): check IsAnonymousFunctionDefinition(Initializer)
            const defaultValue = Evaluate(prop.value.right);
            v = GetValue(defaultValue);
          }
          PutValue(lref, v);
          excludedNames.push(P);
        } else {
          const name = EvaluatePropertyName(prop.key);
          KeyedDestructuringAssignmentEvaluation(prop.value, value, name);
          excludedNames.push(name);
        }
      } else {
        return RestDestructuringAssignmentEvaluation(
          prop,
          value,
          excludedNames
        );
      }
    }
  }

  function KeyedDestructuringAssignmentEvaluation(
    node: EstreeNode,
    value: unknown,
    propertyName: PropertyKey
  ): CompletionRecord {
    const assignmentTarget =
      node.type === "RestElement"
        ? node.argument
        : node.type === "AssignmentPattern"
        ? node.left
        : node;
    const isObjectOrArray =
      assignmentTarget.type === "ArrayPattern" ||
      assignmentTarget.type === "ObjectPattern";
    let lref;
    if (!isObjectOrArray) {
      lref = Evaluate(assignmentTarget).Value as ReferenceRecord;
    }
    const v = GetV(value, propertyName);
    let rhsValue;
    if (node.type === "AssignmentPattern" && v === undefined) {
      // Todo(steve): check IsAnonymousFunctionDefinition(Initializer)
      const defaultValue = Evaluate(node.right);
      rhsValue = GetValue(defaultValue);
    } else {
      rhsValue = v;
    }
    if (isObjectOrArray) {
      return DestructuringAssignmentEvaluation(assignmentTarget, rhsValue);
    }
    return PutValue(lref, rhsValue);
  }

  function RestDestructuringAssignmentEvaluation(
    restProperty: RestElement,
    value: unknown,
    excludedNames: PropertyKey[]
  ): CompletionRecord {
    const lref = Evaluate(restProperty.argument).Value as ReferenceRecord;
    const restObj = CopyDataProperties({}, value, excludedNames);
    return PutValue(lref, restObj);
  }

  function IteratorDestructuringAssignmentEvaluation(
    elements: PatternLike[],
    iteratorRecord: Iterator<unknown>
  ): CompletionRecord {
    let status = NormalCompletion(Empty);
    for (const element of elements) {
      if (!element) {
        iteratorRecord.next();
        status = NormalCompletion(Empty);
        continue;
      }
      const assignmentTarget =
        element.type === "RestElement"
          ? element.argument
          : element.type === "AssignmentPattern"
          ? element.left
          : element;
      const isObjectOrArray =
        assignmentTarget.type === "ArrayPattern" ||
        assignmentTarget.type === "ObjectPattern";
      let lref: ReferenceRecord;
      if (!isObjectOrArray) {
        lref = Evaluate(assignmentTarget).Value as ReferenceRecord;
      }
      let v: unknown;
      if (element.type !== "RestElement") {
        const { done, value: nextValue } = iteratorRecord.next();
        const value = done ? undefined : nextValue;
        if (element.type === "AssignmentPattern" && value === undefined) {
          // Todo(steve): check IsAnonymousFunctionDefinition(Initializer)
          const defaultValue = Evaluate(element.right);
          v = GetValue(defaultValue);
        } else {
          v = value;
        }
      } else {
        // RestElement
        v = [];
        let n = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value: nextValue } = iteratorRecord.next();
          if (done) {
            break;
          }
          (v as unknown[])[n] = nextValue;
          n++;
        }
      }
      if (isObjectOrArray) {
        status = DestructuringAssignmentEvaluation(assignmentTarget, v);
      } else {
        status = PutValue(lref, v);
      }
    }
    return status;
  }

  // https://tc39.es/ecma262/#sec-runtime-semantics-forloopevaluation
  function ForLoopEvaluation(node: ForStatement): CompletionRecord {
    if (node.init?.type === "VariableDeclaration") {
      // `for (var … ; … ; … ) …`
      if (node.init.kind === "var") {
        Evaluate(node.init);
        return ForBodyEvaluation(node.test, node.update, node.body, []);
      }
      // `for (let/const … ; … ; … ) …`
      const oldEnv = getRunningContext().LexicalEnvironment;
      const loopEnv = new DeclarativeEnvironment(oldEnv);
      const isConst = node.init.kind === "const";
      const boundNames = collectBoundNames(node.init);
      for (const dn of boundNames) {
        if (isConst) {
          loopEnv.CreateImmutableBinding(dn, true);
        } else {
          loopEnv.CreateMutableBinding(dn, false);
        }
      }
      getRunningContext().LexicalEnvironment = loopEnv;
      Evaluate(node.init);
      const perIterationLets = isConst ? [] : Array.from(boundNames);
      const bodyResult = ForBodyEvaluation(
        node.test,
        node.update,
        node.body,
        perIterationLets
      );
      getRunningContext().LexicalEnvironment = oldEnv;
      return bodyResult;
    }
    // `for ( … ; … ; … ) …`
    if (node.init) {
      const exprRef = Evaluate(node.init);
      GetValue(exprRef);
    }
    return ForBodyEvaluation(node.test, node.update, node.body, []);
  }

  function ForBodyEvaluation(
    test: Expression,
    increment: Expression,
    stmt: Statement,
    perIterationBindings: string[]
  ): CompletionRecord {
    CreatePerIterationEnvironment(perIterationBindings);
    let V: unknown;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (test) {
        const testRef = Evaluate(test);
        const testValue = GetValue(testRef);
        if (!testValue) {
          return NormalCompletion(V);
        }
      }
      const result = Evaluate(stmt) as CompletionRecord;
      if (!LoopContinues(result)) {
        return UpdateEmpty(result, V);
      }
      if (result.Value) {
        V = result.Value;
      }
      CreatePerIterationEnvironment(perIterationBindings);
      if (increment) {
        const incRef = Evaluate(increment);
        GetValue(incRef);
      }
    }
  }

  function CreatePerIterationEnvironment(
    perIterationBindings: string[]
  ): unknown {
    if (perIterationBindings.length === 0) {
      return;
    }
    const lastIterationEnv = getRunningContext().LexicalEnvironment;
    const outer = lastIterationEnv.OuterEnv;
    const thisIterationEnv = new DeclarativeEnvironment(outer);
    for (const bn of perIterationBindings) {
      thisIterationEnv.CreateMutableBinding(bn, false);
      const lastValue = lastIterationEnv.GetBindingValue(bn, false);
      thisIterationEnv.InitializeBinding(bn, lastValue);
    }
    getRunningContext().LexicalEnvironment = thisIterationEnv;
  }

  function ForDeclarationBindingInstantiation(
    forDeclaration: VariableDeclaration,
    env: EnvironmentRecord
  ): void {
    const isConst = forDeclaration.kind === "const";
    for (const name of collectBoundNames(forDeclaration.declarations)) {
      if (isConst) {
        env.CreateImmutableBinding(name, true);
      } else {
        env.CreateMutableBinding(name, false);
      }
    }
  }

  function ResolveBinding(
    name: string,
    env?: EnvironmentRecord
  ): ReferenceRecord {
    if (!env) {
      env = getRunningContext().LexicalEnvironment;
    }
    return GetIdentifierReference(env, name, true);
  }

  function GetIdentifierReference(
    env: EnvironmentRecord,
    name: string,
    strict: boolean
  ): ReferenceRecord {
    if (!env) {
      return new ReferenceRecord("unresolvable", name, strict);
    }
    if (env.HasBinding(name)) {
      return new ReferenceRecord(env, name, strict);
    }
    return GetIdentifierReference(env.OuterEnv, name, strict);
  }

  function BlockDeclarationInstantiation(
    code: Statement[] | SwitchCase[],
    env: EnvironmentRecord
  ): void {
    const declarations = collectScopedDeclarations(code, {
      var: false,
      topLevel: false,
    });
    for (const d of declarations) {
      const IsConstantDeclaration =
        d.type === "VariableDeclaration" && d.kind === "const";
      for (const dn of collectBoundNames(d)) {
        if (IsConstantDeclaration) {
          env.CreateImmutableBinding(dn, true);
        } else if (!env.HasBinding(dn)) {
          env.CreateMutableBinding(dn, false);
        }
      }
      if (d.type === "FunctionDeclaration") {
        const [fn] = collectBoundNames(d);
        const fo = InstantiateFunctionObject(d, env);
        if (env.IsUninitializedBinding(fn)) {
          env.InitializeBinding(fn, fo);
        } else {
          env.SetMutableBinding(fn, fo, false);
        }
      }
    }
  }

  function CallFunction(
    closure: FunctionObject,
    args: Iterable<unknown>
  ): unknown {
    PrepareOrdinaryCall(closure);
    const result = OrdinaryCallEvaluateBody(closure, args);
    executionContextStack.pop();
    if (result.Type === "return") {
      return result.Value;
    }
    return undefined;
  }

  function PrepareOrdinaryCall(F: FunctionObject): ExecutionContext {
    // const callerContext = getRunningContext();
    const calleeContext = new ExecutionContext();
    calleeContext.Function = F;
    const localEnv = new FunctionEnvironment(F[Environment]);
    calleeContext.VariableEnvironment = localEnv;
    calleeContext.LexicalEnvironment = localEnv;
    // callerContext.suspend();
    executionContextStack.push(calleeContext);
    return calleeContext;
  }

  function OrdinaryCallEvaluateBody(
    F: FunctionObject,
    args: Iterable<unknown>
  ): CompletionRecord {
    return EvaluateFunctionBody(F[ECMAScriptCode], F, args);
  }

  function EvaluateFunctionBody(
    body: Statement[] | Expression,
    F: FunctionObject,
    args: Iterable<unknown>
  ): CompletionRecord {
    FunctionDeclarationInstantiation(F, args);
    return Array.isArray(body) ? EvaluateStatementList(body) : Evaluate(body);
  }

  function EvaluateStatementList(statements: Statement[]): CompletionRecord {
    let result = NormalCompletion(Empty);
    for (const stmt of statements) {
      const s = Evaluate(stmt);
      if (s.Type !== "normal") {
        return s;
      }
      if (s.Value) {
        result = s;
      }
    }
    return result;
  }

  function FunctionDeclarationInstantiation(
    func: FunctionObject,
    args: Iterable<unknown>
  ): void {
    const calleeContext = getRunningContext();
    const code = func[ECMAScriptCode] as BlockStatement | Expression;
    const formals = func[FormalParameters] as FunctionDeclaration["params"];
    const parameterNames = collectBoundNames(formals);
    const hasParameterExpressions = containsExpression(formals);
    const varDeclarations = collectScopedDeclarations(code, {
      var: true,
      topLevel: true,
    });
    const varNames = getDeclaredNames(varDeclarations);

    // `functionNames` ∈ `varNames`
    // `functionsToInitialize` ≈ `functionNames`
    const functionNames: string[] = [];
    const functionsToInitialize: FunctionDeclaration[] = [];
    for (let i = varDeclarations.length - 1; i >= 0; i--) {
      const d = varDeclarations[i];
      if (d.type === "FunctionDeclaration") {
        ThrowIfFunctionIsInvalid(d);
        const [fn] = collectBoundNames(d);
        if (!functionNames.includes(fn)) {
          functionNames.unshift(fn);
          functionsToInitialize.unshift(d);
        }
      }
    }

    const env = calleeContext.LexicalEnvironment;
    for (const paramName of parameterNames) {
      // In strict mode, it's guaranteed no duplicate params exist.
      env.CreateMutableBinding(paramName, false);
    }

    const iteratorRecord = CreateListIteratorRecord(args);
    IteratorBindingInitialization(formals, iteratorRecord, env);

    let varEnv: EnvironmentRecord;
    let instantiatedVarNames: string[];
    if (!hasParameterExpressions) {
      // NOTE: Only a single Environment Record is needed for the parameters
      // and top-level vars.
      instantiatedVarNames = Array.from(parameterNames);
      for (const n of varNames) {
        if (!instantiatedVarNames.includes(n)) {
          instantiatedVarNames.push(n);
          env.CreateMutableBinding(n, false);
          env.InitializeBinding(n, undefined);
        }
      }
      varEnv = env;
    } else {
      // NOTE: A separate Environment Record is needed to ensure that closures
      // created by expressions in the formal parameter list do not have
      // visibility of declarations in the function body.
      varEnv = new DeclarativeEnvironment(env);
      calleeContext.VariableEnvironment = varEnv;
      instantiatedVarNames = [];
      for (const n of varNames) {
        if (!instantiatedVarNames.includes(n)) {
          instantiatedVarNames.push(n);
          varEnv.CreateMutableBinding(n, false);
          let initialValue: unknown;
          if (!parameterNames.includes(n) || functionNames.includes(n)) {
            //
          } else {
            initialValue = env.GetBindingValue(n, false);
          }
          varEnv.InitializeBinding(n, initialValue);
          // NOTE: A var with the same name as a formal parameter initially has
          // the same value as the corresponding initialized parameter.
        }
      }
    }
    const lexEnv = varEnv;
    calleeContext.LexicalEnvironment = lexEnv;

    const lexDeclarations = collectScopedDeclarations(code, {
      var: false,
      topLevel: true,
    });
    for (const d of lexDeclarations) {
      for (const dn of collectBoundNames(d)) {
        // Only lexical VariableDeclaration here in top-level.
        if ((d as VariableDeclaration).kind === "const") {
          lexEnv.CreateImmutableBinding(dn, true);
        } else {
          lexEnv.CreateMutableBinding(dn, false);
        }
      }
    }

    for (const f of functionsToInitialize) {
      const [fn] = collectBoundNames(f);
      const fo = InstantiateFunctionObject(f, lexEnv);
      varEnv.SetMutableBinding(fn, fo, false);
    }
  }

  function IteratorBindingInitialization(
    elements: PatternLike[],
    iteratorRecord: Iterator<unknown>,
    environment: EnvironmentRecord
  ): CompletionRecord {
    if (elements.length === 0) {
      return NormalCompletion(Empty);
    }
    let result;
    for (const node of elements) {
      if (!node) {
        // Elision element.
        iteratorRecord.next();
        result = NormalCompletion(Empty);
      } else if (node.type === "RestElement") {
        // Rest element.
        if (node.argument.type === "Identifier") {
          const lhs = ResolveBinding(node.argument.name, environment);
          const A: unknown[] = [];
          let n = 0;
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = iteratorRecord.next();
            if (done) {
              result = environment
                ? InitializeReferencedBinding(lhs, A)
                : PutValue(lhs, A);
              break;
            }
            A[n] = value;
            n++;
          }
        } else {
          const A: unknown[] = [];
          let n = 0;
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = iteratorRecord.next();
            if (done) {
              result = BindingInitialization(node.argument, A, environment);
              break;
            }
            A[n] = value;
            n++;
          }
        }
      } else {
        // Normal element.
        const bindingElement =
          node.type === "AssignmentPattern" ? node.left : node;
        switch (bindingElement.type) {
          case "ObjectPattern":
          case "ArrayPattern": {
            let v: unknown;
            const { done, value } = iteratorRecord.next();
            if (!done) {
              v = value;
            }
            if (node.type === "AssignmentPattern" && v === undefined) {
              const defaultValue = Evaluate(node.right);
              v = GetValue(defaultValue);
            }
            result = BindingInitialization(bindingElement, v, environment);
            break;
          }
          case "Identifier": {
            const bindingId = bindingElement.name;
            const lhs = ResolveBinding(bindingId, environment);
            let v: unknown;
            const { done, value } = iteratorRecord.next();
            if (!done) {
              v = value;
            }
            if (node.type === "AssignmentPattern" && v === undefined) {
              // IsAnonymousFunctionDefinition(Initializer)
              const defaultValue = Evaluate(node.right);
              v = GetValue(defaultValue);
            }
            result = environment
              ? InitializeReferencedBinding(lhs, v)
              : PutValue(lhs, v);
            break;
          }
        }
      }
    }
    return result;
  }

  function BindingInitialization(
    node: EstreeLVal,
    value: unknown,
    environment: EnvironmentRecord
  ): CompletionRecord {
    switch (node.type) {
      case "Identifier":
        return InitializeBoundName(node.name, value, environment);
      case "ObjectPattern":
        RequireObjectCoercible(value);
        return PropertyBindingInitialization(
          (node as EstreeObjectPattern).properties,
          value,
          environment
        );
      case "ArrayPattern": {
        const iteratorRecord = CreateListIteratorRecord(
          value as Iterable<unknown>
        );
        return IteratorBindingInitialization(
          node.elements,
          iteratorRecord,
          environment
        );
      }
    }
  }

  function PropertyBindingInitialization(
    properties: (EstreeProperty | RestElement)[],
    value: unknown,
    environment: EnvironmentRecord
  ): CompletionRecord {
    const excludedNames: PropertyKey[] = [];
    for (const prop of properties) {
      if (prop.type === "RestElement") {
        return RestBindingInitialization(
          prop,
          value,
          environment,
          excludedNames
        );
      }
      if (!prop.computed && prop.key.type === "Identifier") {
        KeyedBindingInitialization(
          prop.value as EstreeLVal,
          value,
          environment,
          prop.key.name
        );
        excludedNames.push(prop.key.name);
      } else {
        const P = EvaluatePropertyName(prop.key);
        KeyedBindingInitialization(
          prop.value as EstreeLVal,
          value,
          environment,
          P
        );
        excludedNames.push(P);
      }
    }
    return NormalCompletion(Empty);
  }

  function EvaluatePropertyName(node: Expression): PropertyKey {
    const exprValue = Evaluate(node);
    const propName = GetValue(exprValue);
    return ToPropertyKey(propName);
  }

  function RestBindingInitialization(
    restProperty: RestElement,
    value: unknown,
    environment: EnvironmentRecord,
    excludedNames: PropertyKey[]
  ): CompletionRecord {
    const lhs = ResolveBinding(
      (restProperty.argument as Identifier).name,
      environment
    );
    const restObj = CopyDataProperties({}, value, excludedNames);
    if (!environment) {
      return PutValue(lhs, restObj);
    }
    return InitializeReferencedBinding(lhs, restObj);
  }

  function CopyDataProperties(
    target: Record<PropertyKey, unknown>,
    source: unknown,
    excludedItems: PropertyKey[]
  ): Record<PropertyKey, unknown> {
    if (source === undefined || source === null) {
      return target;
    }
    const from = ToObject(source);
    const keys = (Object.getOwnPropertyNames(from) as PropertyKey[]).concat(
      Object.getOwnPropertySymbols(from)
    );
    for (const nextKey of keys) {
      if (!excludedItems.includes(nextKey)) {
        const desc = Object.getOwnPropertyDescriptor(from, nextKey);
        if (desc?.enumerable) {
          target[nextKey] = from[nextKey];
        }
      }
    }
    return target;
  }

  function KeyedBindingInitialization(
    node: EstreeLVal,
    value: unknown,
    environment: EnvironmentRecord,
    propertyName: PropertyKey
  ): CompletionRecord {
    const isIdentifier =
      node.type === "Identifier" ||
      (node.type === "AssignmentPattern" && node.left.type === "Identifier");
    if (isIdentifier) {
      const bindingId =
        node.type === "Identifier" ? node.name : (node.left as Identifier).name;
      const lhs = ResolveBinding(bindingId, environment);
      let v = GetV(value, propertyName);
      if (node.type === "AssignmentPattern" && v === undefined) {
        // If IsAnonymousFunctionDefinition(Initializer)
        const defaultValue = Evaluate(node.right);
        v = GetValue(defaultValue);
      }
      if (!environment) {
        return PutValue(lhs, v);
      }
      return InitializeReferencedBinding(lhs, v);
    }

    let v = GetV(value, propertyName);
    if (node.type === "AssignmentPattern" && v === undefined) {
      const defaultValue = Evaluate(node.right);
      v = GetValue(defaultValue);
    }
    return BindingInitialization(
      node.type === "AssignmentPattern" ? node.left : node,
      v,
      environment
    );
  }

  function InitializeBoundName(
    name: string,
    value: unknown,
    environment?: EnvironmentRecord
  ): CompletionRecord {
    if (environment) {
      environment.InitializeBinding(name, value);
      return NormalCompletion(Empty);
    }
    const lhs = ResolveBinding(name);
    return PutValue(lhs, value);
  }

  function InstantiateFunctionObject(
    func: FunctionDeclaration,
    scope: EnvironmentRecord
  ): FunctionObject {
    const F = OrdinaryFunctionCreate(func.params, func.body, scope);
    return F;
  }

  function InstantiateOrdinaryFunctionExpression(
    functionExpression: FunctionExpression
  ): FunctionObject {
    const scope = getRunningContext().LexicalEnvironment;
    if (functionExpression.id) {
      const name = functionExpression.id.name;
      const funcEnv = new DeclarativeEnvironment(scope);
      funcEnv.CreateImmutableBinding(name, false);
      const closure = OrdinaryFunctionCreate(
        functionExpression.params,
        functionExpression.body,
        funcEnv
      );
      funcEnv.InitializeBinding(name, closure);
      return closure;
    } else {
      const closure = OrdinaryFunctionCreate(
        functionExpression.params,
        functionExpression.body,
        scope
      );
      return closure;
    }
  }

  function InstantiateArrowFunctionExpression(
    arrowFunction: ArrowFunctionExpression
  ): FunctionObject {
    const scope = getRunningContext().LexicalEnvironment;
    const closure = OrdinaryFunctionCreate(
      arrowFunction.params,
      arrowFunction.body,
      scope
    );
    return closure;
  }

  function OrdinaryFunctionCreate(
    parameterList: FunctionDeclaration["params"],
    body: BlockStatement | Expression,
    scope: EnvironmentRecord
  ): FunctionObject {
    const F = function () {
      // eslint-disable-next-line prefer-rest-params
      return CallFunction(F, arguments);
    } as FunctionObject;
    Object.defineProperties(F, {
      [FormalParameters]: {
        enumerable: false,
        writable: false,
        value: parameterList,
      },
      [ECMAScriptCode]: {
        enumerable: false,
        writable: false,
        value: body.type === "BlockStatement" ? body.body : body,
      },
      [Environment]: {
        enumerable: false,
        writable: false,
        value: scope,
      },
    });
    return F;
  }

  if (expressionOnly) {
    if (!root.expression) {
      throw new SyntaxError(
        "Only an `Expression` is allowed in `ArrowFunctionExpression`'s body"
      );
    }
    return InstantiateArrowFunctionExpression(root);
  } else {
    const [fn] = collectBoundNames(root);
    const fo = InstantiateFunctionObject(root, rootEnv);
    rootEnv.CreateImmutableBinding(fn, true);
    rootEnv.InitializeBinding(fn, fo);
    return fo;
  }
}

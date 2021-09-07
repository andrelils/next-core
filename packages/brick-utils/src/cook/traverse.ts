import {
  FunctionDeclaration,
  VariableDeclaration,
  VariableDeclarator,
} from "@babel/types";
import { EstreeNode } from "./interfaces";

type InternalCollect<T = void, O = unknown> = (
  node: EstreeNode | EstreeNode[],
  options?: O
) => T;
type InternalCollectWithOptions<T = void, O = unknown> = (
  node: EstreeNode | EstreeNode[],
  options: O
) => T;

export function collectBoundNames(
  root: EstreeNode | EstreeNode[]
): Set<string> {
  const names = new Set<string>();
  const collect: InternalCollect = (node) => {
    if (Array.isArray(node)) {
      for (const n of node) {
        collect(n);
      }
    } else if (node) {
      // `node` maybe `null` in some cases.
      switch (node.type) {
        case "Identifier":
          names.add(node.name);
          break;
        case "VariableDeclaration":
          collect(node.declarations);
          break;
        case "VariableDeclarator":
          collect(node.id);
          break;
        case "ArrayPattern":
          collect(node.elements);
          break;
        case "AssignmentPattern":
          collect(node.left);
          break;
        case "ObjectPattern":
          collect(node.properties);
          break;
        case "Property":
          collect(node.value);
          break;
        case "RestElement":
          collect(node.argument);
          break;
        case "FunctionDeclaration":
          collect(node.id);
          break;
      }
    }
  };
  collect(root);
  return names;
}

export function containsExpression(root: EstreeNode | EstreeNode[]): boolean {
  const collect: InternalCollect<boolean> = (node) => {
    if (Array.isArray(node)) {
      return node.some(collect);
    } else if (node) {
      // `node` maybe `null` in some cases.
      switch (node.type) {
        case "ArrayPattern":
          return collect(node.elements);
        case "AssignmentPattern":
          return true;
        case "ObjectPattern":
          return collect(node.properties);
        case "Property":
          return node.computed || collect(node.value);
        case "RestElement":
          return collect(node.argument);
      }
    }
  };
  return collect(root);
}

interface ScopedDeclarationOptions {
  var?: boolean;
  topLevel?: boolean;
}

type ScopedDeclaration =
  | VariableDeclarator
  | VariableDeclaration
  | FunctionDeclaration;

export function collectScopedDeclarations(
  root: EstreeNode | EstreeNode[],
  options: ScopedDeclarationOptions
): ScopedDeclaration[] {
  const declarations: ScopedDeclaration[] = [];
  const nextOptions = { var: options.var };
  const collect: InternalCollectWithOptions<void, ScopedDeclarationOptions> = (
    node,
    options
  ): void => {
    if (Array.isArray(node)) {
      for (const n of node) {
        collect(n, options);
      }
    } else if (node) {
      // `node` maybe `null` in some cases.
      switch (node.type) {
        case "FunctionDeclaration":
          // At the top level of a function, or script, function declarations are
          // treated like var declarations rather than like lexical declarations.
          // See https://tc39.es/ecma262/#sec-static-semantics-toplevellexicallydeclarednames
          if (Number(!options.var) ^ Number(options.topLevel)) {
            declarations.push(node);
          }
          break;
        case "VariableDeclaration":
          if (Number(!options.var) ^ Number(node.kind === "var")) {
            collect(node.declarations, nextOptions);
          }
          break;
        case "VariableDeclarator":
          declarations.push(node);
          break;
        case "SwitchCase":
          collect(node.consequent, nextOptions);
          break;
        case "CatchClause":
          collect(node.body, nextOptions);
          break;
      }
      if (options.var) {
        switch (node.type) {
          case "BlockStatement":
            collect(node.body, nextOptions);
            break;
          case "IfStatement":
            collect(node.consequent, nextOptions);
            collect(node.alternate, nextOptions);
            break;
          case "DoWhileStatement":
          case "WhileStatement":
            collect(node.body, nextOptions);
            break;
          case "ForStatement":
            collect(node.init, nextOptions);
            collect(node.body, nextOptions);
            break;
          case "ForInStatement":
          case "ForOfStatement":
            collect(node.left, nextOptions);
            collect(node.body, nextOptions);
            break;
          case "SwitchStatement":
            collect(node.cases, nextOptions);
            break;
          case "TryStatement":
            collect(node.block, nextOptions);
            collect(node.handler, nextOptions);
            collect(node.finalizer, nextOptions);
            break;
        }
      }
    }
  };
  collect(root, options);
  return declarations;
}

export function getDeclaredNames(
  declarations: ScopedDeclaration[]
): Set<string> {
  const names = new Set<string>();
  for (const d of declarations) {
    for (const n of collectBoundNames(d)) {
      names.add(n);
    }
  }
  return names;
}

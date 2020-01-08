/**
 * // heavily modified version of https://github.com/palantir/tslint/blob/master/src/rules/typedefRule.ts with original license below
 *
 * @license
 * Copyright 2013 Palantir Technologies, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as ts from "typescript";
import * as tslint from "tslint";
import * as tsutils from "tsutils";

type InterestingNode = ts.CallSignatureDeclaration | ts.ArrowFunction | ts.PropertyDeclaration;

export class Rule extends tslint.Rules.TypedRule {

  public static metadata: tslint.IRuleMetadata = {
    ruleName: "no-return-any",
    description: "Requires return type definitions to exist if the return type is expected to be any.",
    options: undefined,
    optionsDescription: 'Not configurable.',
    type: "typescript",
    typescriptOnly: true,
    requiresTypeInfo: true,
  };

  public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): tslint.RuleFailure[] {
    return this.applyWithWalker(new Walker(sourceFile, this.ruleName, program.getTypeChecker()));
  }

}

class Walker extends tslint.AbstractWalker<void> {

  constructor(sourceFile: ts.SourceFile, ruleName: string, private readonly checker: ts.TypeChecker) {
    super(sourceFile, ruleName, undefined);
  }

  public walk(sourceFile: ts.SourceFile): void {
    const cb = (node: ts.Node): void => {
      switch (node.kind) {
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.GetAccessor:
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.MethodSignature: {
          const { name, parameters, type } = node as ts.CallSignatureDeclaration;
          this.checkReturnType(name !== undefined ? name : parameters, type, node as ts.CallSignatureDeclaration, name);
          break;
        }
        case ts.SyntaxKind.ArrowFunction: {
          this.checkArrowFunction(node as ts.ArrowFunction);
          break;
        }
      }
      return ts.forEachChild(node, cb);
    };
    return ts.forEachChild(sourceFile, cb);
  }

  private checkArrowFunction(node: ts.ArrowFunction): void {
    const { parent, parameters, type } = node;
    if (parent.kind !== ts.SyntaxKind.CallExpression && !isTypedPropertyDeclaration(parent)) {
      this.checkReturnType(parameters, type, node);
    }
  }

  private checkReturnType(location: ts.Node | ts.NodeArray<ts.Node>, typeAnnotation: ts.TypeNode | undefined, node: InterestingNode, name?: ts.Node): void {
    const inferredType = this.checker.getTypeAtLocation(node);
    if (typeAnnotation === undefined && potentiallyReturnsUndeclaredAny(this.checker, inferredType)) {
      const nameStr = name === undefined ? this.checker.getFullyQualifiedName(inferredType.getSymbol()!) : name.getText();
      const failure = `${nameStr || 'function'} must clarify return type. Implicit any is dangerous`;
      if (isNodeArray(location)) {
        this.addFailure(location.pos - 1, location.end + 1, failure);
      } else {
        this.addFailureAtNode(location, failure);
      }
    }
  }

}

const isTypedPropertyDeclaration = (node: ts.Node) => {
  return tsutils.isPropertyDeclaration(node) && node.type !== undefined;
};

const isNodeArray = (nodeOrArray: ts.Node | ts.NodeArray<ts.Node>): nodeOrArray is ts.NodeArray<ts.Node> => {
  return Array.isArray(nodeOrArray);
};

const potentiallyReturnsUndeclaredAny = (checker: ts.TypeChecker, typeAt: ts.Type) => {
  if (!typeAt) {
    return true; // this may cause trouble - could be overly aggressive
  }
  const typeStr = checker.typeToString(typeAt);
  if (/ => any$/.test(typeStr) || / => Promise<any>$/.test(typeStr)) {
    return true;
  }
  return false;
};

import * as ts from "typescript";
import * as tslint from "tslint";

const DO_NOT_USE_EMPTY_LINES_IN_FUNC = `Do not leave empty lines in a function body.

Function too long? Consider splitting it into smaller functions.

Function too dense? If it's really that dense, consider explaining what is going on. Use a comment line instead of an empty line.
`;

export class Rule extends tslint.Rules.AbstractRule {

  public apply(sourceFile: ts.SourceFile): tslint.RuleFailure[] {
    return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
  }
}

class Walker extends tslint.RuleWalker {

  public visitFunctionDeclaration(node: ts.FunctionDeclaration) {
    this.lintFunctionBodyEmptyLines(node.body);
  }

  public visitArrowFunction(node: ts.ArrowFunction) {
    this.lintFunctionBodyEmptyLines(node.body);
  }

  public visitMethodDeclaration(node: ts.MethodDeclaration) {
    this.lintFunctionBodyEmptyLines(node.body);
  }

  public visitFunctionExpression(node: ts.FunctionExpression) {
    this.lintFunctionBodyEmptyLines(node.body);
  }

  private lintFunctionBodyEmptyLines(node: ts.FunctionBody | ts.ConciseBody | undefined) {
    if (node && (node as ts.FunctionBody).statements && (node as ts.FunctionBody).statements.length) {
      const body = (node as ts.FunctionBody);
      if (ts.isArrowFunction(body.parent) && (ts.isCallExpression(body.parent.parent) || ts.isCallExpression(body.parent.parent.parent))) {
        return; // does not apply to root async function, this should be good enough approximation
      }
      const text = body.getText(this.getSourceFile()).replace(/\/\*[\s\S]*?\*\/\n/g, ''); // remove multiline comments first
      if (/\n *\n/.test(text)) { // check for double lines
        this.addFailure(this.createFailure(body.getStart(this.getSourceFile()), body.getWidth(this.getSourceFile()), DO_NOT_USE_EMPTY_LINES_IN_FUNC));
      }
    }
  }

}

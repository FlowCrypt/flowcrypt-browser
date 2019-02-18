import * as ts from "typescript";
import * as tslint from "tslint";

const DO_USE_LOOPS = `

There should be only one obvious way to do a thing.
- JS already has good tooling for loops
- It's hard to return a value from inside .each/map/forEach and friends
- breaking from inside .each/map/forEach loop uses non-obvious semantics
- consistency matters

// Allowed array loops:
for (const v of arr) { } // loop through values
for (let i = 0; i < arr.length; i++) { } // loop through indexes

// Allowed jQuery selector loops:
for (const element of $('selector')) { } // selector results are iterable

// Allowed Object loops:
for (const v of Object.values(obj)) { } // get values, no need obj.hasOwnProperty
for (const v of Object.keys(obj)) { } // get keys, no need obj.hasOwnProperty`;

const DO_NOT_USE_EACH = `Using .each for looping is heavily discouraged. ${DO_USE_LOOPS}`;
const DO_NOT_USE_MAP_EXPR_STMT = `Use .map() when you want to transform an array, not as a substitute for loops. ${DO_USE_LOOPS}`;

export class Rule extends tslint.Rules.AbstractRule {

  public apply(sourceFile: ts.SourceFile): tslint.RuleFailure[] {
    return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
  }
}

class Walker extends tslint.RuleWalker {

  public visitCallExpression(node: ts.CallExpression) {
    if (ts.isPropertyAccessExpression(node.expression)) {
      if (node.expression.name.escapedText === 'each' || node.expression.name.escapedText === 'forEach') {
        this.addFailure(this.createFailure(node.getStart(this.getSourceFile()), node.getWidth(this.getSourceFile()), DO_NOT_USE_EACH));
      } else if (node.expression.name.escapedText === 'map' && ts.isExpressionStatement(node.parent)) {
        this.addFailure(this.createFailure(node.getStart(this.getSourceFile()), node.getWidth(this.getSourceFile()), DO_NOT_USE_MAP_EXPR_STMT));
      }
    }
  }

}

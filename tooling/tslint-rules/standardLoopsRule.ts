import * as ts from "typescript";
import * as tslint from "tslint";

const FAILURE_STRING_EACH = `Using .each for looping is heavily discouraged.

There should be only one obvious way to do a thing.
- JS already has good tooling for loops
- It's hard to return a value from inside .each()
- breaking from inside .each loop uses non-obvious semantics
- consistency matters

// Allowed array loops:
for (const v of arr) { } // loop through values
for (let i = 0; i < arr.length; i++) { } // loop through indexes

// Allowed jQuery selector loops:
for (const element of $('selector').get()) { } // .get() returns an array of HTMLElement

// Allowed Object loops:
for (const v of Object.values(obj)) { } // get values, no need obj.hasOwnProperty
for (const v of Object.keys(obj)) { } // get keys, no need obj.hasOwnProperty
`;

export class Rule extends tslint.Rules.AbstractRule {

  public apply(sourceFile: ts.SourceFile): tslint.RuleFailure[] {
    return this.applyWithWalker(new StandardLoopsWalker(sourceFile, this.getOptions()));
  }
}

class StandardLoopsWalker extends tslint.RuleWalker {

  public visitCallExpression(node: ts.CallExpression) {
    if (ts.isPropertyAccessExpression(node.expression)) {
      if (node.expression.name.escapedText === 'each') {
        this.addFailure(this.createFailure(node.getStart(), node.getWidth(), FAILURE_STRING_EACH));
      }
    }
  }

}

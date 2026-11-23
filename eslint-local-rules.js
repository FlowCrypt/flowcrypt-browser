/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
const COPYRIGHT_HEADER = '/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */';

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

const DO_NOT_USE_EACH = `Using .each or .forEach for looping is heavily discouraged. ${DO_USE_LOOPS}`;
const DO_NOT_USE_MAP_EXPR_STMT = 'Use .map() when you want to transform an array,' + ` not as a substitute for loops. ${DO_USE_LOOPS}`;

module.exports = {
  'copyright-header': {
    meta: {
      type: 'layout',
      fixable: 'whitespace',
      schema: [],
      messages: {
        required: 'Expected the FlowCrypt copyright header followed by a newline.',
      },
    },
    create: context => {
      const { sourceCode } = context;
      return {
        Program: () => {
          const { text } = sourceCode;
          const shebang = text.match(/^#![^\r\n]*(?:\r?\n|$)/)?.[0] ?? '';
          const headerStart = shebang.length;
          const headerLine = shebang ? 2 : 1;
          const firstComment = sourceCode.getAllComments().find(comment => comment.type !== 'Shebang');
          const isLeadingComment = firstComment?.loc.start.line === headerLine && !text.slice(headerStart, firstComment.range[0]).trim();
          // Preserve leading comments that are unrelated to the copyright header.
          const isCopyrightHeader = isLeadingComment && /^[\s*]*(?:©|copyright\b).*\bFlowCrypt\b/is.test(firstComment.value);
          const range = isCopyrightHeader ? firstComment.range : [headerStart, headerStart];
          const [start, end] = range;
          const hasNewline = /^\r?\n/.test(text.slice(end));
          if (hasNewline && isCopyrightHeader && sourceCode.getText(firstComment) === COPYRIGHT_HEADER) {
            return;
          }

          const newline = text.match(/\r?\n/)?.[0] ?? '\n';
          const before = shebang && !shebang.endsWith('\n') ? newline : '';
          const after = hasNewline ? '' : newline;
          context.report({
            loc: { start: sourceCode.getLocFromIndex(start), end: sourceCode.getLocFromIndex(end) },
            messageId: 'required',
            fix: fixer => fixer.replaceTextRange(range, before + COPYRIGHT_HEADER + after),
          });
        },
      };
    },
  },
  'standard-loops': {
    meta: {
      docs: {
        description: 'disallow identifiers',
        category: 'Possible Errors',
        recommended: false,
      },
      schema: [],
    },
    create: context => {
      return {
        CallExpression: node => {
          if (node.callee.property) {
            const propertyName = node.callee.property.name;

            if (propertyName === 'forEach' || propertyName === 'each') {
              context.report({ node, message: DO_NOT_USE_EACH });
            } else if (propertyName === 'map') {
              const sourceCode = context.sourceCode ?? context.getSourceCode();
              const ancestors = sourceCode.getAncestors ? sourceCode.getAncestors(node) : context.getAncestors();
              const parent = ancestors[ancestors.length - 1];
              if (parent && parent.type === 'ExpressionStatement') {
                context.report({ node, message: DO_NOT_USE_MAP_EXPR_STMT });
              }
            }
          }
        },
      };
    },
  },
};

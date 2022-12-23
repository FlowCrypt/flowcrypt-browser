/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
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

/* eslint-disable @typescript-eslint/naming-convention */
module.exports = {
  'standard-loops': {
    meta: {
      docs: {
        description: 'disallow identifiers',
        category: 'Possible Errors',
        recommended: false
      },
      schema: []
    },
    create: (context) => {
      return {
        CallExpression: (node) => {
          if (node.callee.property) {
            const propertyName = node.callee.property.name;

            if (propertyName === 'forEach' || propertyName === 'each') {
              context.report({ node, message: DO_NOT_USE_EACH });
            } else if (propertyName === 'map') {
              const ancestors = context.getAncestors();
              const parent = ancestors[ancestors.length - 1];
              if (parent && parent.type === 'ExpressionStatement') {
                context.report({ node, message: DO_NOT_USE_MAP_EXPR_STMT });
              }
            }
          }
        }
      };
    }
  }
};

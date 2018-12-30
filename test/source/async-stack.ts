
// tslint:disable:only-arrow-functions

const wait = () => new Promise(resolve => setTimeout(resolve, 100));

const thisWillFail = () => {
  throw new Error('this failed');
};

function func() {
  thisWillFail();
}

class Class {
  static staticConstAttr = () => {
    func();
  }
  static staticFunc() {
    Class.staticConstAttr();
  }
}

const asyncArrowConst = async () => {
  await wait();
  Class.staticFunc();
  await wait();
};

async function asyncFunc() {
  await wait();
  await asyncArrowConst();
  await wait();
}

class ClassAsync {
  static staticConstAttrAsync = async () => {
    await wait();
    await asyncFunc();
    await wait();
  }
  static async staticAsyncFunc() {
    await wait();
    await ClassAsync.staticConstAttrAsync();
    await wait();
  }
}

(async () => {

  try {
    await ClassAsync.staticAsyncFunc();
  } catch (e) {
    const expectedStack = `Error: this failed
    at thisWillFail (/home/luke/git/flowcrypt-browser/experimental/code/experimental-code.js:5:11)
    at func (/home/luke/git/flowcrypt-browser/experimental/code/experimental-code.js:8:5)
    at Function.Class.staticConstAttr (/home/luke/git/flowcrypt-browser/experimental/code/experimental-code.js:16:5)
    at Function.staticFunc (/home/luke/git/flowcrypt-browser/experimental/code/experimental-code.js:12:15)
    at asyncArrowConst (/home/luke/git/flowcrypt-browser/experimental/code/experimental-code.js:21:15)
    at <anonymous>
    at async asyncArrowConst? (../code/experimental-code.ts:21:23)
    at async asyncFunc (../code/experimental-code.ts:25:2)
    at async staticConstAttrAsync? (../code/experimental-code.ts:34:31)
    at async staticAsyncFunc (../code/experimental-code.ts:38:3)`;
    if (e.stack !== expectedStack) {
      console.error(`Unexpected stack format:\n${e.stack}\n\n\nExpected:\n${expectedStack}`);
      process.exit(1);
    } else {
      process.exit(0);
    }
  }

  console.error(`Fail - expected Error to be thrown`);
  process.exit(1);

})();

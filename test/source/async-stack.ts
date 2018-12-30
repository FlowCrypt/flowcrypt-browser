
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
    const expectedStackStatements = [
      'Error: this failed',
      ' at thisWillFail ',
      ' at func ',
      ' at Function.Class.staticConstAttr ',
      ' at Function.staticFunc ',
      ' at asyncArrowConst ',
      ' at async asyncArrowConst? ',
      ' at async asyncFunc ',
      ' at async staticConstAttrAsync? ',
      ' at async staticAsyncFunc ',
    ];
    for (const statement of expectedStackStatements) {
      if (e instanceof Error && (e.stack || '').indexOf(statement) === -1) {
        console.error(`Unexpected stack format:\n${e.stack}\n\n\nExpected to include:\n${expectedStackStatements.join('\n')}`);
        process.exit(1);
      }
    }
    process.exit(0);
  }

  console.error(`Fail - expected Error to be thrown`);
  process.exit(1);

})();

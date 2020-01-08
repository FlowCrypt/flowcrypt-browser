/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

(() => {

  type Type = 'error' | 'object';

  const wait = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 100));

  const acceptCb = (cb: () => Promise<number | void>) => {
    // nothing
  };

  acceptCb(async () => { // test if will get replaced
    await wait();
  });

  acceptCb(async () => { // test if will get replaced
    Math.random();
  });

  acceptCb(async () => await wait()); // test if will get replaced

  acceptCb(async () => Math.random()); // test if will get replaced

  const thisWillFail = (type: Type) => {
    if (type === 'error') {
      throw new Error('this failed');
    } else if (type === 'object') {
      throw { nonsense: 'yes' };
    }
  };

  function func(type: Type) {
    thisWillFail(type);
  }

  class Class {
    public static staticConstAttr = (type: Type) => {
      func(type);
    }
    public static staticFunc(type: Type) {
      Class.staticConstAttr(type);
    }
  }

  const asyncArrowConst = async (type: Type) => {
    await wait();
    Class.staticFunc(type);
    await wait();
  };

  async function asyncFunc(type: Type) {
    await wait();
    await asyncArrowConst(type);
    await wait();
  }

  const obj = {
    paramFunc: async (type: Type) => {
      await asyncFunc(type);
    },
  };

  class ClassAsync {
    public static staticConstAttrAsync = async (type: Type) => {
      await wait();
      await obj.paramFunc(type);
      await wait();
    }
    public static async staticAsyncFunc(type: Type) {
      await wait();
      await ClassAsync.staticConstAttrAsync(type);
      await wait();
    }
  }

  (async () => {

    const doTestWith = async (type: Type, expectedStackStatements: string[]) => {
      try {
        await ClassAsync.staticAsyncFunc(type);
      } catch (e) {
        if (!(e instanceof Error)) {
          console.error(`Thrown was unexpectedly not an error for type ${type}`, e);
          return process.exit(1);
        }
        for (const statement of expectedStackStatements) {
          if ((e.stack || '').indexOf(statement) === -1) {
            console.error(`Unexpected stack format for type ${type}:\n${e.stack}\n\n\nExpected to include:\n${expectedStackStatements.join('\n')}`);
            process.exit(1);
          }
        }
        if (type === 'object' && JSON.stringify((e as any).thrown) !== '{"nonsense":"yes"}') {
          console.error(`Unexpected e.throw for type ${type}:\n${JSON.stringify((e as any).thrown)}`);
          process.exit(1);
        }
        return;
      }
      console.error(`Fail - expected Error to be thrown for type ${type}`);
      return process.exit(1);
    };

    try {
      await doTestWith('error', [
        'Error: this failed',
        ' at thisWillFail ',
        ' at func ',
        ' at Function.Class.staticConstAttr ',
        ' at Function.staticFunc ',
        ' at asyncArrowConst ',
        ' at <async> asyncArrowConst ',
        ' at <async> asyncFunc ',
        ' at <async> paramFunc ',
        ' at <async> staticConstAttrAsync ',
        ' at <async> staticAsyncFunc ',
      ]);
      await doTestWith('object', [
        'Error: Thrown[object][object Object]',
        ' at asyncArrowConst ',
        ' at <async> asyncFunc ',
        ' at <async> paramFunc ',
        ' at <async> staticConstAttrAsync ',
        ' at <async> staticAsyncFunc ',
      ]);
      process.exit(0);
    } catch (e) {
      console.error(e);
      return process.exit(1);
    }

  })().catch(e => {
    console.error(e);
    process.exit(1);
  });

})();

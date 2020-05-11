const expect = require('expect.js');
const cache = require('../source/utils/cache');

describe('cache', () => {
  it('should be invokable several times', async () => {
    let i = 0;
    const key = cache.registerFunc(() => i++);

    const val2 = await cache.resolveFunc(key);

    expect(val2).to.be(0);

    const val = await cache.resolveFunc(key);

    return expect(val).to.be(0);
  });

  it('should work when failing sync', async () => {
    const errorMsg = 'A nasty error...';
    const key = cache.registerFunc(() => {
      throw new Error(errorMsg);
    });

    try {
      await cache.resolveFunc(key);

      throw new Error('should have thrown exception!');
    } catch (e) {
      if (e.message !== errorMsg) throw new Error('error message does not match!');
    }
  });

  it('should work when failing async', async () => {
    const errorMsg = 'A nasty error...';
    const key = cache.registerFunc(() => Promise.reject(new Error(errorMsg)));

    try {
      await cache.resolveFunc(key);

      throw new Error('should have thrown exception!');
    } catch (e) {
      if (e.message !== errorMsg) throw new Error('error message does not match!');
    }
  });

  it('should be possible to invalidate cache', async () => {
    let i = 0;
    const key = cache.registerFunc(() => i++);

    const val2 = await cache.resolveFunc(key);

    expect(val2).to.be(0);
    cache.invalidateFunc(key);

    const val = await cache.resolveFunc(key);

    expect(val).to.be(1);
  });

  it('creating a same function with different keys', async () => {
    let i = 0;
    const key1 = 'func1';
    const key2 = 'func2';
    const func = () => i++;
    cache.registerFunc(key1, func);
    cache.registerFunc(key2, func);

    const val5 = await cache.resolveFunc(key1);

    expect(val5).to.be(0);
    const val4 = await cache.resolveFunc(key1);
    expect(val4).to.be(0);
    const val3 = await cache.resolveFunc(key2);
    expect(val3).to.be(1);
    cache.invalidateFunc(key1);
    const val2 = await cache.resolveFunc(key1);
    expect(val2).to.be(2);

    const val = await cache.resolveFunc(key2);

    expect(val).to.be(1);
  });

  it('Testing ttl', async function () {
    let i = 0;
    const func = () => i++;
    const key = cache.registerFunc(1, null, func);
    this.timeout(3000);

    const val4 = await cache.resolveFunc(key);

    expect(val4).to.be(0);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const val3 = await cache.resolveFunc(key);
    expect(val3).to.be(0);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const val2 = await cache.resolveFunc(key);
    expect(val2).to.be(1);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const val = await cache.resolveFunc(key);

    expect(val).to.be(1);
  });
});

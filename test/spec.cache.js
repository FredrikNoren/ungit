const expect = require('expect.js');
const cache = require('../source/utils/cache');

describe('cache', () => {
  it('should be invokable several times', async () => {
    let i = 0;
    const key = cache.registerFunc(() => i++);

    const val = await cache
      .resolveFunc(key)
      .then((val) => {
        expect(val).to.be(0);
      })
      .then(() => cache.resolveFunc(key));

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

    const val = await cache
      .resolveFunc(key)
      .then((val) => {
        expect(val).to.be(0);
      })
      .then(() => {
        cache.invalidateFunc(key);
        return cache.resolveFunc(key);
      });

    expect(val).to.be(1);
  });

  it('creating a same function with different keys', async () => {
    let i = 0;
    const key1 = 'func1';
    const key2 = 'func2';
    const func = () => i++;
    cache.registerFunc(key1, func);
    cache.registerFunc(key2, func);

    const val = await cache
      .resolveFunc(key1)
      .then((val) => {
        expect(val).to.be(0);
      })
      .then(() => cache.resolveFunc(key1))
      .then((val) => {
        expect(val).to.be(0);
      })
      .then(() => cache.resolveFunc(key2))
      .then((val) => {
        expect(val).to.be(1);
      })
      .then(() => {
        cache.invalidateFunc(key1);
        return cache.resolveFunc(key1);
      })
      .then((val) => {
        expect(val).to.be(2);
      })
      .then(() => cache.resolveFunc(key2));

    expect(val).to.be(1);
  });

  it('Testing ttl', async function () {
    let i = 0;
    const func = () => i++;
    const key = cache.registerFunc(1, null, func);
    this.timeout(3000);

    const val = await cache
      .resolveFunc(key)
      .then((val) => {
        expect(val).to.be(0);
      })
      .then(() => new Promise((resolve) => setTimeout(resolve, 500)))
      .then(() => {
        return cache.resolveFunc(key);
      })
      .then((val) => {
        expect(val).to.be(0);
      })
      .then(() => new Promise((resolve) => setTimeout(resolve, 1000)))
      .then(() => {
        return cache.resolveFunc(key);
      })
      .then((val) => {
        expect(val).to.be(1);
      })
      .then(() => new Promise((resolve) => setTimeout(resolve, 500)))
      .then(() => cache.resolveFunc(key));

    expect(val).to.be(1);
  });
});

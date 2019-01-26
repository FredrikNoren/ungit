const expect = require('expect.js');
const sysinfo = require('../src/sysinfo');

describe('sysinfo', () => {
  it('returns the gitversion', () => {
    sysinfo.getGitVersionInfo().then((version) => expect(version).to.match(/\d+\.\d+\.\d+/))
  });
});

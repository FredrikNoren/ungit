

var expect = require('expect.js');
var gerrit = require('../source/gerrit');


describe('gerrit', function () {


  it('getGerritAddress for ssh without port', function() {
    var addr = 'ssh://some.address.com/my/gerrit/project';
    var parsed = gerrit.parseRemote(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.port).to.be(undefined);
    expect(parsed.project).to.be('my/gerrit/project');
  });

  it('getGerritAddress for ssh with port', function() {
    var addr = 'ssh://some.address.com:8080/my/gerrit/project';
    var parsed = gerrit.parseRemote(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.port).to.be('8080');
    expect(parsed.project).to.be('my/gerrit/project');
  });

  it('getGerritAddress for git without port without username', function() {
    var addr = 'some.address.com:my/gerrit/project';
    var parsed = gerrit.parseRemote(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/gerrit/project');
  });

  it('getGerritAddress for git without port with username', function() {
    var addr = 'someuser@some.address.com:my/gerrit/project';
    var parsed = gerrit.parseRemote(addr);
    expect(parsed.username).to.be('someuser');
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/gerrit/project');
  });

});  
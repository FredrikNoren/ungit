

var expect = require('expect.js');
var gitParser = require('../source/git-parser');


describe('git-parser', function () {


  it('parseRemoteAddress ssh://some.address.com/my/gerrit/project', function() {
    var addr = 'ssh://some.address.com/my/gerrit/project';
    var parsed = gitParser.parseRemoteAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.port).to.be(undefined);
    expect(parsed.project).to.be('my/gerrit/project');
  });

  it('parseRemoteAddress ssh://some.address.com:8080/my/gerrit/project', function() {
    var addr = 'ssh://some.address.com:8080/my/gerrit/project';
    var parsed = gitParser.parseRemoteAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.port).to.be('8080');
    expect(parsed.project).to.be('my/gerrit/project');
  });

  it('parseRemoteAddress some.address.com:my/gerrit/project.git', function() {
    var addr = 'some.address.com:my/gerrit/project.git';
    var parsed = gitParser.parseRemoteAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/gerrit/project');
  });

  it('parseRemoteAddress someuser@some.address.com:my/gerrit/project.git', function() {
    var addr = 'someuser@some.address.com:my/gerrit/project.git';
    var parsed = gitParser.parseRemoteAddress(addr);
    expect(parsed.username).to.be('someuser');
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/gerrit/project');
  });

  it('parseRemoteAddress some.address.com:my/gerrit/project', function() {
    var addr = 'some.address.com:my/gerrit/project';
    var parsed = gitParser.parseRemoteAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/gerrit/project');
  });

  it('parseRemoteAddress someuser@some.address.com:my/gerrit/project', function() {
    var addr = 'someuser@some.address.com:my/gerrit/project';
    var parsed = gitParser.parseRemoteAddress(addr);
    expect(parsed.username).to.be('someuser');
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/gerrit/project');
  });

  it('parseRemoteAddress https://some.address.com/my/gerrit/project', function() {
    var addr = 'https://some.address.com/my/gerrit/project';
    var parsed = gitParser.parseRemoteAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/gerrit/project');
  });


});

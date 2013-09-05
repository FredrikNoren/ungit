
var expect = require('expect.js');
var addressParser = require('../source/address-parser');


describe('git-parser addresses', function () {

  it('parseAddress ssh://some.address.com/my/gerrit/project', function() {
    var addr = 'ssh://some.address.com/my/gerrit/project';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.port).to.be(undefined);
    expect(parsed.project).to.be('my/gerrit/project');
  });

  it('parseAddress ssh://some.address.com:8080/my/gerrit/project', function() {
    var addr = 'ssh://some.address.com:8080/my/gerrit/project';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.port).to.be('8080');
    expect(parsed.project).to.be('my/gerrit/project');
  });

  it('parseAddress some.address.com:my/gerrit/project.git', function() {
    var addr = 'some.address.com:my/gerrit/project.git';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/gerrit/project');
  });

  it('parseAddress someuser@some.address.com:my/gerrit/project.git', function() {
    var addr = 'someuser@some.address.com:my/gerrit/project.git';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.username).to.be('someuser');
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/gerrit/project');
  });

  it('parseAddress some.address.com:my/gerrit/project', function() {
    var addr = 'some.address.com:my/gerrit/project';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/gerrit/project');
  });

  it('parseAddress someuser@some.address.com:my/gerrit/project', function() {
    var addr = 'someuser@some.address.com:my/gerrit/project';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.username).to.be('someuser');
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/gerrit/project');
  });

  it('parseAddress https://some.address.com/my/gerrit/project', function() {
    var addr = 'https://some.address.com/my/gerrit/project';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/gerrit/project');
  });


  it('parseAddress /home/username/somerepo', function() {
    var addr = '/home/username/somerepo';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('localhost');
    expect(parsed.project).to.be('somerepo');
  });

  it('parseAddress ~/something/somerepo', function() {
    var addr = '~/something/somerepo';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('localhost');
    expect(parsed.project).to.be('somerepo');
  });

  it('parseAddress C:\\something\\somerepo', function() {
    var addr = 'C:\\something\\somerepo';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('localhost');
    expect(parsed.project).to.be('somerepo');
  });

  it('parseAddress C:\\somerepo', function() {
    var addr = 'C:\\somerepo';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('localhost');
    expect(parsed.project).to.be('somerepo');
  });

});


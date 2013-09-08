
var expect = require('expect.js');
var addressParser = require('../source/address-parser');


describe('git-parser addresses', function () {

  it('parseAddress ssh://some.address.com/my/awesome/project', function() {
    var addr = 'ssh://some.address.com/my/awesome/project';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.port).to.be(undefined);
    expect(parsed.project).to.be('my/awesome/project');
    expect(parsed.shortProject).to.be('project');
  });

  it('parseAddress ssh://some.address.com:8080/my/awesome/project', function() {
    var addr = 'ssh://some.address.com:8080/my/awesome/project';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.port).to.be('8080');
    expect(parsed.project).to.be('my/awesome/project');
    expect(parsed.shortProject).to.be('project');
  });

  it('parseAddress some.address.com:my/awesome/project.git', function() {
    var addr = 'some.address.com:my/awesome/project.git';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/awesome/project');
    expect(parsed.shortProject).to.be('project');
  });

  it('parseAddress someuser@some.address.com:my/awesome/project.git', function() {
    var addr = 'someuser@some.address.com:my/awesome/project.git';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.username).to.be('someuser');
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/awesome/project');
    expect(parsed.shortProject).to.be('project');
  });

  it('parseAddress some.address.com:my/awesome/project', function() {
    var addr = 'some.address.com:my/awesome/project';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/awesome/project');
    expect(parsed.shortProject).to.be('project');
  });

  it('parseAddress someuser@some.address.com:my/awesome/project', function() {
    var addr = 'someuser@some.address.com:my/awesome/project';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.username).to.be('someuser');
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/awesome/project');
    expect(parsed.shortProject).to.be('project');
  });

  it('parseAddress https://some.address.com/my/awesome/project', function() {
    var addr = 'https://some.address.com/my/awesome/project';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/awesome/project');
    expect(parsed.shortProject).to.be('project');
  });

  it('parseAddress https://some.address.com/my/awesome/project.git', function() {
    var addr = 'https://some.address.com/my/awesome/project.git';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/awesome/project');
    expect(parsed.shortProject).to.be('project');
  });

  it('parseAddress /home/username/somerepo', function() {
    var addr = '/home/username/somerepo';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('localhost');
    expect(parsed.project).to.be('somerepo');
    expect(parsed.shortProject).to.be('somerepo');
  });

  it('parseAddress ~/something/somerepo', function() {
    var addr = '~/something/somerepo';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('localhost');
    expect(parsed.project).to.be('somerepo');
    expect(parsed.shortProject).to.be('somerepo');
  });

  it('parseAddress C:\\something\\somerepo', function() {
    var addr = 'C:\\something\\somerepo';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('localhost');
    expect(parsed.project).to.be('somerepo');
    expect(parsed.shortProject).to.be('somerepo');
  });

  it('parseAddress C:\\somerepo', function() {
    var addr = 'C:\\somerepo';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('localhost');
    expect(parsed.project).to.be('somerepo');
    expect(parsed.shortProject).to.be('somerepo');
  });

  it('parseAddress C:\\something\\somerepo\\', function() {
    var addr = 'C:\\something\\somerepo\\';
    var parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('localhost');
    expect(parsed.project).to.be('somerepo');
    expect(parsed.shortProject).to.be('somerepo');
  });

});


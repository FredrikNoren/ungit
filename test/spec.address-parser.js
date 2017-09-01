const expect = require('expect.js');
const addressParser = require('../src/address-parser');

describe('git-parser addresses', () => {
  it('parseAddress ssh://some.address.com/my/awesome/project', () => {
    const addr = 'ssh://some.address.com/my/awesome/project';
    const parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.port).to.be(undefined);
    expect(parsed.project).to.be('my/awesome/project');
    expect(parsed.shortProject).to.be('project');
  });

  it('parseAddress ssh://some.address.com:8080/my/awesome/project', () => {
    const addr = 'ssh://some.address.com:8080/my/awesome/project';
    const parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.port).to.be('8080');
    expect(parsed.project).to.be('my/awesome/project');
    expect(parsed.shortProject).to.be('project');
  });

  it('parseAddress some.address.com:my/awesome/project.git', () => {
    const addr = 'some.address.com:my/awesome/project.git';
    const parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/awesome/project');
    expect(parsed.shortProject).to.be('project');
  });

  it('parseAddress someuser@some.address.com:my/awesome/project.git', () => {
    const addr = 'someuser@some.address.com:my/awesome/project.git';
    const parsed = addressParser.parseAddress(addr);
    expect(parsed.username).to.be('someuser');
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/awesome/project');
    expect(parsed.shortProject).to.be('project');
  });

  it('parseAddress some.address.com:my/awesome/project', () => {
    const addr = 'some.address.com:my/awesome/project';
    const parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/awesome/project');
    expect(parsed.shortProject).to.be('project');
  });

  it('parseAddress someuser@some.address.com:my/awesome/project', () => {
    const addr = 'someuser@some.address.com:my/awesome/project';
    const parsed = addressParser.parseAddress(addr);
    expect(parsed.username).to.be('someuser');
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/awesome/project');
    expect(parsed.shortProject).to.be('project');
  });

  it('parseAddress https://some.address.com/my/awesome/project', () => {
    const addr = 'https://some.address.com/my/awesome/project';
    const parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/awesome/project');
    expect(parsed.shortProject).to.be('project');
  });

  it('parseAddress https://some.address.com/my/awesome/project.git', () => {
    const addr = 'https://some.address.com/my/awesome/project.git';
    const parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('some.address.com');
    expect(parsed.project).to.be('my/awesome/project');
    expect(parsed.shortProject).to.be('project');
  });

  it('parseAddress /home/username/somerepo', () => {
    const addr = '/home/username/somerepo';
    const parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('localhost');
    expect(parsed.project).to.be('somerepo');
    expect(parsed.shortProject).to.be('somerepo');
  });

  it('parseAddress ~/something/somerepo', () => {
    const addr = '~/something/somerepo';
    const parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('localhost');
    expect(parsed.project).to.be('somerepo');
    expect(parsed.shortProject).to.be('somerepo');
  });

  it('parseAddress C:\\something\\somerepo', () => {
    const addr = 'C:\\something\\somerepo';
    const parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('localhost');
    expect(parsed.project).to.be('somerepo');
    expect(parsed.shortProject).to.be('somerepo');
  });

  it('parseAddress C:\\somerepo', () => {
    const addr = 'C:\\somerepo';
    const parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('localhost');
    expect(parsed.project).to.be('somerepo');
    expect(parsed.shortProject).to.be('somerepo');
  });

  it('parseAddress C:\\something\\somerepo\\', () => {
    const addr = 'C:\\something\\somerepo\\';
    const parsed = addressParser.parseAddress(addr);
    expect(parsed.host).to.be('localhost');
    expect(parsed.project).to.be('somerepo');
    expect(parsed.shortProject).to.be('somerepo');
  });
});

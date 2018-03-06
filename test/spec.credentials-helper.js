
const expect = require('expect.js');
const child_process = require('child_process');
const path = require('path');
const http = require('http');
const config = require('../src/config');
const url = require('url');
const querystring = require('querystring');

describe('credentials-helper', () => {

  it('should be invokable', (done) => {
    const socketId = Math.floor(Math.random() * 1000);
    const remote = "origin";
    const payload = { username: 'testuser', password: 'testpassword' };
    const server = http.createServer((req, res) => {
      const reqUrl = url.parse(req.url);
      expect(reqUrl.pathname).to.be(`/api/credentials`);

      const params = querystring.parse(reqUrl.query);
      expect(params['remote']).to.be(`${remote}`);
      expect(params['socketId']).to.be(`${socketId}`);

      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify(payload));
    });

    server.listen(config.port, '127.0.0.1');

    const command = `node bin/credentials-helper ${socketId} ${config.port} ${remote} get`;
    child_process.exec(command, (err, stdout, stderr) => {
      expect(err).to.not.be.ok();
      const ss = stdout.split('\n');
      expect(ss[0]).to.be(`username=${payload.username}`);
      expect(ss[1]).to.be(`password=${payload.password}`);
      server.close();
      done();
    });
  });
});

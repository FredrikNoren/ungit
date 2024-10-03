const expect = require('expect.js');
const child_process = require('child_process');
const http = require('http');
const config = require('../source/config');

describe('credentials-helper', () => {
  it('should be invokable', (done) => {
    const socketId = Math.floor(Math.random() * 1000);
    const remote = 'origin';
    const payload = { username: 'testuser', password: 'testpassword' };
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url, `http://${req.headers.host}`);
        expect(reqUrl.pathname).to.be('/api/credentials');
        expect(reqUrl.searchParams.get('remote')).to.be(`${remote}`);
        expect(reqUrl.searchParams.get('socketId')).to.be(`${socketId}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      } finally {
        if (!res.writableFinished) {
          res.statusCode = 500;
          res.end();
        }
      }
    });

    server.listen({ port: config.port }, () => {
      const command = `node bin/credentials-helper ${socketId} ${config.port} ${remote} get`;
      child_process.exec(command, (err, stdout) => {
        server.close();
        expect(err).to.not.be.ok();
        const ss = stdout.split('\n');
        expect(ss[0]).to.be(`username=${payload.username}`);
        expect(ss[1]).to.be(`password=${payload.password}`);
        done();
      });
    });
  });
});

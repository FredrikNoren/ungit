const expect = require('expect.js');
const path = require('path');
const restGit = require('../src/git-api');
const Bluebird = require('bluebird');

exports.makeRequest = (method, req, path, payload) => {
  let r;
  if (method === 'GET' || method === 'PNG') {
    r = req.get(`${restGit.pathPrefix}${path}`);
  } else if (method === 'POST') {
    r = req.post(`${restGit.pathPrefix}${path}`);
  } else if (method === 'DELETE') {
    r = req.del(`${restGit.pathPrefix}${path}`);
  } else {
    throw new Error({message: `invalid method of ${method}`});
  }

  if (payload) {
    payload.socketId = 'ignore';
    ((method === 'POST') ? r.send : r.query)(payload);
  }

  return new Bluebird((resolve, reject) => {
    r.expect('Content-Type', method === 'PNG' ? 'image/png' : /json/)
      .end((err, res) => {
        if (err) {
          console.log(path);
          console.dir(err);
          console.dir(res.body);
          reject(err);
        } else {
          let data = (res || {}).body;
          try { data = JSON.parse(data); } catch(ex) {}
          resolve(data);
        }
      });
  });
}

exports.get = (req, path, payload) => this.makeRequest.bind(this, 'GET');
exports.getPng = (req, path, payload) => this.makeRequest.bind(this, 'PNG');
exports.post = (req, path, payload) => this.makeRequest.bind(this, 'POST');
exports.delete = (req, path, payload) => this.makeRequest.bind(this, 'DELETE');


exports.initRepo = (req, config) => {
  config = config || {};
  return this.post(req, '/testing/createtempdir', config.path)
    .then(res => {
      expect(res.body.path).to.be.ok();
      return this.post(req, '/init', { path: res.body.path, bare: !!config.bare })
        .then(() => res.body.path);
    });
}

exports.createSmallRepo = (req) => {
  return this.initRepo(req)
    .then((dir) => {
      const testFile = 'smalltestfile.txt';
      return this.post(req, '/testing/createfile', { file: path.join(dir, testFile) })
        .then(() => this.post(req, '/commit', { path: dir, message: 'Init', files: [{ name: testFile }] }) )
    });
}

// Used by ko tests, which doesn't really require dom manipulation, but does require these things to be defined.
exports.initDummyBrowserEnvironment = () => {
	window = {};
	document = {
		createElement: () => { return { getElementsByTagName: () => [] } },
		createComment: () => { return {} }
	};
	navigator = {};
}

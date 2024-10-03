const expect = require('expect.js');
const path = require('path');
const restGit = require('../source/git-api');

exports.makeRequest = (method, req, path, payload) => {
  let r;
  if (method === 'GET' || method === 'PNG') {
    r = req.get(`${restGit.pathPrefix}${path}`);
  } else if (method === 'POST') {
    r = req.post(`${restGit.pathPrefix}${path}`);
  } else if (method === 'DELETE') {
    r = req.del(`${restGit.pathPrefix}${path}`);
  } else if (method === 'PUT') {
    r = req.put(`${restGit.pathPrefix}${path}`);
  } else {
    throw new Error({ message: `invalid method of ${method}` });
  }

  if (payload) {
    payload.socketId = 'ignore';
    if (method === 'POST' || method === 'PUT') {
      r.send(payload);
    } else {
      r.query(payload);
    }
  }

  return new Promise((resolve, reject) => {
    r.expect('Content-Type', method === 'PNG' ? 'image/png' : /json/).end((err, res) => {
      if (err) {
        console.log(`failed path: ${path}`);
        console.dir(err);
        console.dir(res ? res.body : '');
        reject(err);
      } else {
        let data = (res || {}).body;
        try {
          data = JSON.parse(data);
        } catch {
          /* Ignore error */
        }
        resolve(data);
      }
    });
  });
};

exports.get = this.makeRequest.bind(this, 'GET');
exports.getPng = this.makeRequest.bind(this, 'PNG');
exports.post = this.makeRequest.bind(this, 'POST');
exports.delete = this.makeRequest.bind(this, 'DELETE');
exports.put = this.makeRequest.bind(this, 'PUT');

exports.initRepo = async (req, config) => {
  config = config || {};
  const res = await this.post(req, '/testing/createtempdir', config.path);
  expect(res.path).to.be.ok();
  await this.post(req, '/init', { path: res.path, bare: !!config.bare });
  return res.path;
};

exports.createSmallRepo = (req) => {
  return this.initRepo(req).then((dir) => {
    const testFile = 'smalltestfile.txt';
    return this.post(req, '/testing/createfile', { file: path.join(dir, testFile) })
      .then(() =>
        this.post(req, '/commit', { path: dir, message: 'Init', files: [{ name: testFile }] })
      )
      .then(() => dir);
  });
};

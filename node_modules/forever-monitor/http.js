

var http = require('http');

var randomVal = 'not set yet!';

http.createServer(function (req, res) {
  if (!process.send) {
    res.end('No process.send!');
  }
  else {
    process.send(req.socket.remoteAddress + ' ' + randomVal);
    res.end(randomVal);
  }
}).listen(9090);

process.on('message', function (msg) {
  randomVal = JSON.stringify(msg);
});

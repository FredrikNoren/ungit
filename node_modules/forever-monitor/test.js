

var spawn = require('child_process').spawn,
    utile = require('utile');

var child = spawn('node', ['http.js'], {
  stdio: ['ipc', 'pipe', 'pipe']
});

var int = setInterval(randomizer, 200);

child.on('message', logger);

child.on('disconnect', function () {
  console.log('child disconnected');
  clearInterval(int);
});


function randomizer() {
  child.send(utile.randomString(16));
}

function logger(msg) {
  console.dir(msg);
}

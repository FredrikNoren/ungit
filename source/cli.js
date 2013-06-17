
var forever = require('forever-monitor');
var os = require('os');
var Service = require('node-windows').Service;
var path = require('path');
var child_process = require('child_process');
var config = require('./config')();

var cli = exports;

cli.start = function() {
	
	if (os.type() == 'Windows_NT') {

		cli.startWindowsService();

	} else {

		var child = new (forever.Monitor)('source/testy.js', {
			max: 3,
			silent: false,
			options: []
		});

		child.on('exit', function () {
			console.log('your-filename.js has exited after 3 restarts');
		});

		child.start();
	}
};

cli.startWindowsService = function() {

	var svc = new Service({
		name: 'ungit',
		description: 'Ungit',
		script: path.join(__dirname, 'server.js')
	});

	svc.on('install',function(){
		svc.start();
		console.log('Service started!');
	});

	svc.on('uninstall',function(){
		console.log('Uninstall complete.');
	});

	if (process.argv[2] == 'uninstall') {
		console.log('Uninstalling...');
		svc.uninstall();
	} else if (process.argv[2] == 'install') {
		console.log('Installing...');
		svc.install();
	} else {
		console.log('Opening browser...');
		child_process.exec('start http://localhost:' + config.port + '/#/repository?path=' + encodeURIComponent(process.cwd()));
	}
}
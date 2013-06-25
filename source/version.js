var fs = require('fs');
var child_process = require('child_process');

var cachedVersion;

exports.getVersion = function(callback) {
	if (cachedVersion) callback(cachedVersion);
	if (fs.existsSync(__dirname + '/../.git')) {
		child_process.exec('git rev-parse --short HEAD', { cwd: __dirname + '/../' }, function(err, revision) {
			revision.replace('\n', ' ');
			revision = revision.trim();
			cachedVersion = 'dev-' + revision;
			callback(cachedVersion);
		});
	} else {
		var packageJson = fs.readFileSync(__dirname + '/../package.json');
		packageJson = JSON.parse(packageJson);
		cachedVersion = packageJson.version;
		callback(cachedVersion);
	}
}
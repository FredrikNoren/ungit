
function browseTo(path) {
  crossroads.parse(path);
}

var testDir;

var waitFor = function(property, value, callback) {
	if ((typeof(value) == 'function' && value(property())) ||
				property() == value) {
		callback();
	} else {
		var sub = property.subscribe(function(newValue) {
			if ((typeof(value) == 'function' && value(newValue)) ||
				newValue == value) {
				sub.dispose();
				callback();
			}
		});
	}
}

var mock = true;

describe('Repository', function(){

	if (mock) {
		api.initSimpleMockServer();
	} else {
		before(function(done) {
			api('POST', '/testing/createdir', undefined, function(err, res) {
				testDir = res.path;
				// For some reason you can't watch very newly created dirs, so wait a short while here
				setTimeout(done, 500);
			});
		});

		after(function(done) {
			api('POST', '/testing/removedir', undefined, function() { done(); });
		});

		beforeEach(function(done) { setTimeout(done, 200); });
		this.timeout(6000);
	}

	it('should become ready', function(done) {
		browseTo('repository?path=' + testDir);
		expect(viewModel.content()).to.be.a(RepositoryViewModel);
		expect(viewModel.content().status()).to.be('loading');
		waitFor(viewModel.content().watcherReady, true, done);
	});

	it('should be uninited', function(done) {
		waitFor(viewModel.content().status, 'uninited', done);
	});

	it('should be initable', function(done) {
		waitFor(viewModel.content().status, 'inited', done);
		viewModel.content().initRepository();
	});

	var testFile = 'somefile';

	it('files should show up', function(done) {
		expect(viewModel.content().files().length).to.be(0);
		waitFor(viewModel.content().files, function(files) { return files.length == 1; }, done);
		api.query('POST', '/testing/createfile', { file: testFile });
	});

	it('should be possible to commit', function(done) {
		waitFor(viewModel.content().files, function(files) { return files.length == 0; }, done);
		viewModel.content().commitMessage('Test');
		viewModel.content().commit();
	});

	it('should show commit in log', function(done) {
		waitFor(viewModel.content().logEntries, function(logEntries) {
			if (logEntries.length == 0) return false;
			if (logEntries[0].title == 'Test') return true;
		}, done);
	});

	it('modifying a file should make it show in staged files', function(done) {
		waitFor(viewModel.content().files, function(files) { return files.length == 1; }, done);
		api.query('POST', '/testing/changefile', { file: testFile });
	});

	it('discarding changes should make it disapear from staged files', function(done) {
		waitFor(viewModel.content().files, function(files) { return files.length == 0; }, done);
		viewModel.content().files()[0].discardChanges();
	});


})

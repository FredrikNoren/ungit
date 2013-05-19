
function browseTo(path) {
  crossroads.parse(path);
}

options.watcherSafeMode = false;

var testDir;

describe('Common', function(){
	this.timeout(6000);

	before(function(done) {
		api('POST', '/testing/createdir', undefined, function(res) {
			testDir = res.body.path;
			// For some reason you can't watch very newly created dirs, so wait a short while here
			setTimeout(done, 500);
		});
	});

	after(function(done) {
		api('POST', '/testing/removedir', undefined, function() { done(); });
	});

	it('should be uninited', function(done) {
		browseTo('repository?path=' + testDir);
		expect(viewModel.content()).to.be.a(RepositoryViewModel);
		expect(viewModel.content().status()).to.be('loading');
		var sub = viewModel.content().status.subscribe(function(newValue) {
			if (newValue == 'uninited') {
				sub.dispose();
				done();
			}
		});
	});

	it('should be initable', function(done) {
		var sub = viewModel.content().status.subscribe(function(newValue) {
			console.log(newValue);
			if (newValue == 'inited') {
				sub.dispose();
				done();
			}
		});
		viewModel.content().initRepository();
	});
/*
	var testFile = 'somefile';

	it('stageable files should show up', function(done) {
		expect(viewModel.content().files().length).to.be(0);
		var sub = viewModel.content().files.subscribe(function(newValue) {
			console.log(newValue);
			if (newValue.length == 1) {
				sub.dispose();
				done();
			}
		});
		api('POST', '/testing/createfile', { file: testFile });
	});

	it('should be possible to commit', function(done) {
		var sub = viewModel.content().files.subscribe(function(newValue) {
			if (newValue.length == 0) {
				sub.dispose();
				done();
			}
		});
		viewModel.content().commit();
	});*/

})
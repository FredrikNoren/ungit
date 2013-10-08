
var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var _ = require('underscore');
var async = require('async');
var fs = require('fs');
var path = require('path');
var restGit = require('../source/git-api');
var common = require('./common.js');

var app = express();

restGit.registerApi(app, null, null, { dev: true });

var req = request(app);

describe('git-api: test ignorefile call', function() {
	it('Add a file to .gitignore file through api call', function(done) {
		common.createSmallRepo(req, done, function(dir) {
			var testFile = 'test.txt';
			async.series([
				function(done) { common.post(req, '/testing/createfile', { file: path.join(dir, testFile) }, done); },
				function(done) { common.post(req, '/ignorefile', { path: dir, file: testFile }, done); },
				function(done) { common.get(req, '/status', { path: dir }, function(err, res) {
					if (err) return done(err);
					expect(Object.keys(res.body.files).toString()).to.be('.gitignore');
					fs.readFile(dir + '/.gitignore', function (err, data) {
						if (data.toString().indexOf(testFile) > 0) {
							done();
						} else {
							throw('Test file is not added to the .gitignore file.');
						}
					});
				}); }
			], done);
		});
	});

	it('Add a file to .gitignore file through api call when .gitignore is missing', function(done) {
		common.createSmallRepo(req, done, function(dir) {
                        var testFile = 'test.txt';
	
			// Ensure .gitignore is deleted
			fs.unlink(dir + '/.gitignore', function (err, data) {
			});

                        async.series([
                                function(done) { common.post(req, '/testing/createfile', { file: path.join(dir, testFile) }, done); },
                                function(done) { common.post(req, '/ignorefile', { path: dir, file: testFile }, done); },
                                function(done) { common.get(req, '/status', { path: dir }, function(err, res) {
                                        if (err) return done(err);
                                        expect(Object.keys(res.body.files).toString()).to.be('.gitignore');
                                        fs.readFile(dir + '/.gitignore', function (err, data) {
                                                if (data.toString().indexOf(testFile) > 0) {
                                                        done();
                                                } else {
                                                        throw('Test file is not added to the .gitignore file.');
                                                }
                                        });
                                }); }
                        ], done);
                });
        });

        it('Attempt to add existing file to .gitignore through api call', function(done) {
                common.createSmallRepo(req, done, function(dir) {
                        var testFile = 'test.txt';

                        // Ensure .gitignore is deleted
                        fs.appendFileSync(dir + '/.gitignore', testFile);

                        async.series([
                                function(done) { common.post(req, '/testing/createfile', { file: path.join(dir, testFile) }, done); },
                                function(done) { common.post(req, '/ignorefile', { path: dir, file: testFile }, function(err, res) {
					if(err) {
						done();
					} else {
						throw('Did not errored when already existing file has been added');
					}
}); }
                        ], done);
                });
        });

        it('Attempt to add a file where similar name alread exist in .gitignore through api call', function(done) {
                common.createSmallRepo(req, done, function(dir) {
                        var testFile = 'test.txt';

                        // Ensure .gitignore is deleted
                        fs.appendFile(dir + '/.gitignore', testFile.split('.')[0], function () {

                        });
			async.series([
                                function(done) { common.post(req, '/testing/createfile', { file: path.join(dir, testFile) }, done); },
                                function(done) { common.post(req, '/ignorefile', { path: dir, file: testFile }, done); },
                                function(done) { common.get(req, '/status', { path: dir }, function(err, res) {
                                        if (err) return done(err);
                                        expect(Object.keys(res.body.files).toString()).to.be('.gitignore');
                                        fs.readFile(dir + '/.gitignore', function (err, data) {
                                                if (data.toString().indexOf(testFile) > 0) {
                                                        done();
                                                } else {
                                                        throw('Test file is not added to the .gitignore file.');
                                                }
                                        });
                                }); }
                        ], done);
                });
        });
});

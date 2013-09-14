
var expect = require('expect.js');
var common = require('./common');
common.initDummyBrowserEnvironment();
var GitGraphViewModel = require('../public/source/git-graph.js').GitGraphViewModel;


describe('GitGraph', function() {

	describe('markBranches', function() {

		var getHead = function(nodes) { return _.find(nodes, function(node) { return node.refs && node.refs.indexOf('HEAD') != -1 }) };
		var nodesById = function(nodes) {
			var m = {};
			nodes.forEach(function(node) { m[node.sha1] = node; });
			return m;
		}


		it('should work on a simple example', function() {
			var nodes = [
				{"sha1":"6d706ae597d56bb64fc8def5b3c9f0a91909af8b","parents":["ae03f555da711c045a6848d27483f9d79d7f57c2"],"refs":["HEAD","refs/heads/testing"],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","commitDate":"Thu May 23 21:03:54 2013 +0200","title":"Some test","message":"Some test"},
				{"sha1":"81c6e0156c0ecdd3e14c3d9dd01e0c1ac61966df","parents":["ae03f555da711c045a6848d27483f9d79d7f57c2"],"refs":["refs/heads/master"],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","commitDate":"Thu May 23 21:03:01 2013 +0200","title":"Main","message":"Main"},
				{"sha1":"ae03f555da711c045a6848d27483f9d79d7f57c2","parents":[],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","commitDate":"Thu May 23 21:02:37 2013 +0200","title":"Init","message":"Init"}];
			var graph = new GitGraphViewModel({});
			graph.setNodesFromLog(nodes);
			expect(graph.nodes()[0].ideologicalBranch.name).to.be('refs/heads/testing');
			expect(graph.nodes()[1].ideologicalBranch.name).to.be('refs/heads/master');
			expect(graph.nodes()[2].ideologicalBranch.name).to.be('refs/heads/master');
		});

		it('should make sure the HEAD branch is highlighted', function() {
			var nodes = [
				{"sha1":"81c6e0156c0ecdd3e14c3d9dd01e0c1ac61966df","parents":["ae03f555da711c045a6848d27483f9d79d7f57c2"],"refs":["refs/heads/master"],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","commitDate":"Thu May 23 21:03:54 2013 +0200","title":"Main","message":"Main"},
				{"sha1":"6d706ae597d56bb64fc8def5b3c9f0a91909af8b","parents":["ae03f555da711c045a6848d27483f9d79d7f57c2"],"refs":["HEAD","refs/heads/testing"],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","commitDate":"Thu May 23 21:03:01 2013 +0200","title":"Some test","message":"Some test"},
				{"sha1":"ae03f555da711c045a6848d27483f9d79d7f57c2","parents":[],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","commitDate":"Thu May 23 21:02:37 2013 +0200","title":"Init","message":"Init"}];
			var graph = new GitGraphViewModel({});
			graph.setNodesFromLog(nodes);
			expect(graph.nodes()[0].ideologicalBranch.name).to.be('refs/heads/master');
			expect(graph.nodes()[1].ideologicalBranch.name).to.be('refs/heads/testing');
			expect(graph.nodes()[2].ideologicalBranch.name).to.be('refs/heads/master');
		});

		it('should show a remote and local ref as in the same ideological branch', function() {
			var nodes = [
			  { "sha1": "c72e57c486a7c67a512c5d4ff7d1a442b6d244ba", "parents": [ "2232ad0a5652109450f1a22dd3a327e505f0bce3" ], "refs": [ "refs/remotes/origin/master", "refs/remotes/origin/HEAD" ], "authorName": "Fredrik Noren", "authorEmail": "fredrik.noren@keldyn.com", "authorDate": "Sat Jun 29 11:24:18 2013 +0200", "committerName": "Fredrik Noren", "committerEmail": "fredrik.noren@keldyn.com", "commitDate": "Sat Jun 29 11:24:18 2013 +0200", "message": "test2" },
			  { "sha1": "2232ad0a5652109450f1a22dd3a327e505f0bce3", "parents": ["c0ed39b12f4475a3c3d236fde8bbec56c257a11a"], "refs": ["refs/heads/master"], "authorName": "Fredrik Noren", "authorEmail": "fredrik.noren@keldyn.com", "authorDate": "Sat Jun 29 11:22:56 2013 +0200", "committerName": "Fredrik Noren", "committerEmail": "fredrik.noren@keldyn.com", "commitDate": "Sat Jun 29 11:22:56 2013 +0200", "message": "test"},
			  { "sha1": "c0ed39b12f4475a3c3d236fde8bbec56c257a11a", "parents": [], "refs": ["HEAD", "refs/remotes/origin/dev", "refs/heads/dev"], "authorName": "Fredrik Noren", "authorEmail": "fredrik.noren@keldyn.com", "authorDate": "Sat Jun 29 11:18:11 2013 +0200", "committerName": "Fredrik Noren", "committerEmail": "fredrik.noren@keldyn.com", "commitDate": "Sat Jun 29 11:18:11 2013 +0200", "message": "Init"} ]
			var graph = new GitGraphViewModel({});
			graph.setNodesFromLog(nodes);
			expect(graph.nodes()[0].ideologicalBranch.name).to.be('refs/heads/master');
			expect(graph.nodes()[1].ideologicalBranch.name).to.be('refs/heads/master');
			expect(graph.nodes()[2].ideologicalBranch.name).to.be('refs/heads/master');
		});

	});
});



var expect = require('expect.js');
var common = require('./common');
common.initDummyBrowserEnvironment();
var GitGraphViewModel = require('../public/scripts/git-graph.js').GitGraphViewModel;


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
				{"sha1":"6d706ae597d56bb64fc8def5b3c9f0a91909af8b","parents":["ae03f555da711c045a6848d27483f9d79d7f57c2"],"refs":["HEAD","refs/heads/testing"],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","date":"Thu May 23 21:03:54 2013 +0200","title":"Some test","message":"Some test"},
				{"sha1":"81c6e0156c0ecdd3e14c3d9dd01e0c1ac61966df","parents":["ae03f555da711c045a6848d27483f9d79d7f57c2"],"refs":["refs/heads/master"],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","date":"Thu May 23 21:03:01 2013 +0200","title":"Main","message":"Main"},
				{"sha1":"ae03f555da711c045a6848d27483f9d79d7f57c2","parents":[],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","date":"Thu May 23 21:02:37 2013 +0200","title":"Init","message":"Init"}];
			var graph = new GitGraphViewModel({});
			graph.setNodesFromLog(nodes);
			expect(graph.nodes()[0].idealogicalBranch.name).to.be('refs/heads/testing');
			expect(graph.nodes()[1].idealogicalBranch.name).to.be('refs/heads/master');
			expect(graph.nodes()[2].idealogicalBranch.name).to.be('refs/heads/master');
		});

		it('should make sure the HEAD branch is highlighted', function() {
			var nodes = [
				{"sha1":"81c6e0156c0ecdd3e14c3d9dd01e0c1ac61966df","parents":["ae03f555da711c045a6848d27483f9d79d7f57c2"],"refs":["refs/heads/master"],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","date":"Thu May 23 21:03:54 2013 +0200","title":"Main","message":"Main"},
				{"sha1":"6d706ae597d56bb64fc8def5b3c9f0a91909af8b","parents":["ae03f555da711c045a6848d27483f9d79d7f57c2"],"refs":["HEAD","refs/heads/testing"],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","date":"Thu May 23 21:03:01 2013 +0200","title":"Some test","message":"Some test"},
				{"sha1":"ae03f555da711c045a6848d27483f9d79d7f57c2","parents":[],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","date":"Thu May 23 21:02:37 2013 +0200","title":"Init","message":"Init"}];
			var graph = new GitGraphViewModel({});
			graph.setNodesFromLog(nodes);
			expect(graph.nodes()[0].idealogicalBranch.name).to.be('refs/heads/master');
			expect(graph.nodes()[1].idealogicalBranch.name).to.be('refs/heads/testing');
			expect(graph.nodes()[2].idealogicalBranch.name).to.be('refs/heads/master');
		});

		it('should make sure the HEAD branch is highlighted even when other branches are in front', function() {
			var nodes = [
				{"sha1":"2374ac09ecce05e28dacfd2cea2fcf071c0c9b6e","parents":["81c6e0156c0ecdd3e14c3d9dd01e0c1ac61966df"],"refs":["refs/heads/master"],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","title":"What will happen now?","message":"What will happen now?"},
				{"sha1":"5a529bb8bd8b53458776823d79ec35b2285b635f","parents":["6d706ae597d56bb64fc8def5b3c9f0a91909af8b"],"refs":["refs/heads/testing"],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","title":"hm","message":"hm"},
				{"sha1":"6d706ae597d56bb64fc8def5b3c9f0a91909af8b","parents":["ae03f555da711c045a6848d27483f9d79d7f57c2"],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","title":"Some test","message":"Some test"},
				{"sha1":"81c6e0156c0ecdd3e14c3d9dd01e0c1ac61966df","parents":["ae03f555da711c045a6848d27483f9d79d7f57c2"],"refs":["HEAD","refs/heads/develop"],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","title":"Main","message":"Main"},
				{"sha1":"ae03f555da711c045a6848d27483f9d79d7f57c2","parents":[],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","title":"Init","message":"Init"}] 
			var graph = new GitGraphViewModel({});
			graph.setNodesFromLog(nodes);
			expect(graph.nodes()[0].idealogicalBranch.name).to.be('refs/heads/master');
			expect(graph.nodes()[1].idealogicalBranch.name).to.be('refs/heads/testing');
			expect(graph.nodes()[2].idealogicalBranch.name).to.be('refs/heads/testing');
			expect(graph.nodes()[3].idealogicalBranch.name).to.be('refs/heads/master');
			expect(graph.nodes()[4].idealogicalBranch.name).to.be('refs/heads/master');
		});

	});
});


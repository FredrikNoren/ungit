

var log1 = [
	{"sha1":"6d706ae597d56bb64fc8def5b3c9f0a91909af8b","parents":["ae03f555da711c045a6848d27483f9d79d7f57c2"],"refs":["HEAD","refs/heads/testing"],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","date":"Thu May 23 21:03:54 2013 +0200","title":"Some test","message":"Some test"},
	{"sha1":"81c6e0156c0ecdd3e14c3d9dd01e0c1ac61966df","parents":["ae03f555da711c045a6848d27483f9d79d7f57c2"],"refs":["refs/heads/master"],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","date":"Thu May 23 21:03:01 2013 +0200","title":"Main","message":"Main"},
	{"sha1":"ae03f555da711c045a6848d27483f9d79d7f57c2","parents":[],"authorName":"Fredrik Noren","authorEmail":"fredrik.noren@keldyn.com","date":"Thu May 23 21:02:37 2013 +0200","title":"Init","message":"Init"}];

test('markBranches', function() {
	markBranches(log, getLogGraph(log));
	expect(log[0].branch).to.be('refs/heads/testing');
	expect(log[1].branch).to.be('refs/heads/master');
	expect(log[2].branch).to.be('refs/heads/testing');
});

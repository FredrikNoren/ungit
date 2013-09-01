var _ = require('underscore');
var moment = require('moment');

exports.parseGitStatus = function(text) {
	var result = {};
	var lines = text.split('\n');
	result.branch = _.last(lines[0].split(' '));
	result.inited = true;
	result.files = {};
	lines.slice(1).forEach(function(line) {
		if (line == '') return;
		var status = line.slice(0, 2);
		var filename = line.slice(3).trim();
		if (filename[0] == '"' && _.last(filename) == '"')
			filename = filename.slice(1, filename.length - 1);
		var file = {};
		file.staged = status[0] == 'A' || status[0] == 'M';
		file.isNew = status[0] == '?' || status[0] == 'A';
		file.removed = status[1] == 'D';
		file.conflict = status[0] == 'U' || status[1] == 'U';
		result.files[filename] = file;
	});
	return result;
};

exports.parseGitDiff = function(text) {
	
	var lines = text.split("\n");
	var diffs = [];
    
	while(lines.length && lines[0]) {
		var diff = {};
		var path = /^diff\s--git\sa\/(.+?)\sb\/(.+)$/.exec(lines.shift());
		diff.aPath = path[1];
		diff.bPath = path[2];
      
		if(/^old mode/.test(lines[0])) {
			diff.aMode = /^old mode (\d+)/.exec(lines.shift());
			diff.bMode = /^new mode (\d+)/.exec(lines.shift());
		}
      
		if(!lines.length || /^diff --git/.test(lines[0])) {
			diffs.push(diff);
			continue;
		}
      
		diff.simIndex = 0;
		diff.newFile = false;
		diff.deletedFile = false;
		diff.renamedFile = false;
		var m;

		if(/^new file/.test(lines[0])) {
			diff.bMode = /^new file mode (.+)$/.exec(lines.shift())[1];
			diff.aMode = null;
			diff.newFile = true;
		} else if(/^deleted file/.test(lines[0])) {
			diff.aMode= /^deleted file mode (.+)$/.exec(lines.shift())[1];
			diff.bMode = null;
			diff.deletedFile = true;
		} else if(m = /^similarity index (\d+)\%/.exec(lines[0])) {
			diff.simIndex = m[1].to_i();
			diff.renamedFile = true;
			//shift away the 2 `rename from/to ...` lines
			lines.shift();
			lines.shift();
		}
      	      	
      	// Shift away index, ---, +++ and @@ stuff
      	if (lines.shift().indexOf('index ') == 0) lines.shift();
      	lines.shift();
		var diff_lines = [];
		var originalLine, newLine;
		while(lines[0] && !/^diff/.test(lines[0])) {
			var line = lines.shift();
			if (line.indexOf('@@ ') == 0) {
				var changeGroup = /@@ -(\d+)(,\d+)? [+](\d+)(,\d+)?/.exec(line);
				originalLine = changeGroup[1];
				newLine = changeGroup[3];
				diff_lines.push([null, null, line]);
			} else {
				if (line[0] == '+') {
					diff_lines.push([null, newLine++, line]);
				} else if (line[0] == '-') {
					diff_lines.push([originalLine++, null, line]);
				} else {
					diff_lines.push([originalLine++, newLine++, line]);
				}
			}
		}
		diff.lines = diff_lines;

		diffs.push(diff);
	}
	return diffs;
}

exports.parseGitLog = function(data) {
	var commits = [];
	var currentCommmit;
	var parseCommitLine = function(row) {
		currentCommmit = { refs: [] };
		var ss = row.split('(');
		var sha1s = ss[0].split(' ').slice(1).filter(function(sha1) { return sha1 && sha1.length; });
		currentCommmit.sha1 = sha1s[0];
		currentCommmit.parents = sha1s.slice(1);
		if (ss[1]) {
			var refs = ss[1].slice(0, ss[1].length - 1);
			currentCommmit.refs = refs.split(', ');
		}
		commits.push(currentCommmit);
		parser = parseHeaderLine;
	}
	var parseHeaderLine = function(row) {
		if (row.indexOf('Author: ') == 0) {
			var author = row.split(' ').slice(1).join(' ');
			var capture = (/([^<]+)<([^>]+)>/g).exec(author);
			if (capture) {
				currentCommmit.authorName = capture[1].trim();
				currentCommmit.authorEmail = capture[2].trim();
			} else {
				currentCommmit.authorName = author;
			}
		} else if (row.indexOf('Commit: ') == 0) {
			var author = row.split(' ').slice(1).join(' ');
			var capture = (/([^<]+)<([^>]+)>/g).exec(author);
			currentCommmit.committerName = capture[1].trim();
			currentCommmit.committerEmail = capture[2].trim();
		} else if (row.indexOf('AuthorDate: ') == 0) {
			currentCommmit.authorDate = row.slice('AuthorDate: '.length).trim();
		} else if (row.indexOf('CommitDate: ') == 0) {
			currentCommmit.commitDate = row.slice('CommitDate: '.length).trim();
		} else if (row.trim() == '') {
			parser = parseCommitMessage;
		} else {
			// Ignore other headers
		}
	}
	var parseCommitMessage = function(row, index) {
		if (rows[index + 1] && rows[index + 1].indexOf('commit ') == 0) {
			parser = parseCommitLine;
			return;
		}
		if (currentCommmit.message) currentCommmit.message += '\n';
		else currentCommmit.message = '';
		currentCommmit.message += row.trim();
	}
	var parser = parseCommitLine;
	var rows = data.split('\n');
	rows.forEach(function(row, index) {
		parser(row, index);
	});
	commits.forEach(function(commit) { commit.message = (typeof commit.message) === 'string' ? commit.message.trim() : ''; });
	return commits;
};


exports.parseGitConfig = function(text) {
	var conf = {};
	text.split('\n').forEach(function(row) {
		var ss = row.split('=');
		conf[ss[0]] = ss[1];
	});
	return conf;
}

exports.parseGitBranches = function(text) {
	var branches = [];
	text.split('\n').forEach(function(row) {
		if (row.trim() == '') return;
		var branch = { name: row.slice(2) };
		if(row[0] == '*') branch.current = true;
		branches.push(branch);
	});
	return branches;
}

exports.parseGitTags = function(text) {
	return text.split('\n').filter(function(tag) {
		return tag != '';
	});
}

exports.parseGitRemotes = function(text) {
	return text.split('\n').filter(function(remote) {
		return remote != '';
	});
}

exports.parseGitLsRemote = function(text) {
	return text.split('\n').filter(function(item) {
		return item && item.indexOf('From ') != 0;
	}).map(function(line) {
		var sha1 = line.slice(0, 40);
		var name = line.slice(41).trim();
		return { sha1: sha1, name: name };
	});
}


var gerritAddressSshWithPortRegexp = /ssh:\/\/(.*):(\d*)\/(.*)/;
var gerritAddressSshWithoutPortRegexp = /ssh:\/\/([^\/]*)\/(.*)/;
var gerritAddressGitWithoutPortWithUsernamePortRegexp = /([^@]*)@([^:]*):([^.]*)(\.git)?$/;
var gerritAddressGitWithoutPortWithoutUsernameRegexp = /([^:]*):([^.]*)(\.git)?$/;
var gerritAddressHttpsRegexp = /https:\/\/([^\/]*)\/(.*)/;

exports.parseRemoteAddress = function(remote) {
  var match = gerritAddressSshWithPortRegexp.exec(remote);
  if (match) return { address: remote, host: match[1], port: match[2], project: match[3] };
  
  match = gerritAddressSshWithoutPortRegexp.exec(remote);
  if (match) return { address: remote, host: match[1], project: match[2] };
  
  match = gerritAddressGitWithoutPortWithUsernamePortRegexp.exec(remote);
  if (match) return { address: remote, username: match[1], host: match[2], project: match[3] };

  match = gerritAddressGitWithoutPortWithoutUsernameRegexp.exec(remote);
  if (match) return { address: remote, host: match[1], project: match[2] };

  match = gerritAddressHttpsRegexp.exec(remote);
  if (match) return { address: remote, host: match[1], project: match[2] };
  
  return { address: remote };
}


exports.parseGitRemoteShow = function(text) {
	var lines = text.split('\n');
	return {
		fetch: exports.parseRemoteAddress(lines[1].slice('  Fetch URL: '.length)),
		push: exports.parseRemoteAddress(lines[1].slice('  Push  URL: '.length))
	};
}

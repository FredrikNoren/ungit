var _ = require('underscore');

exports.parseGitStatus = function(text) {
	var result = {};
	var lines = text.split('\n');
	result.branch = _.last(lines[0].split(' '));
	result.inited = true;
	result.files = [];
	lines.slice(1).forEach(function(line) {
		if (line == '') return;
		var status = line.slice(0, 2);
		var filename = line.slice(3).trim();
		if (filename[0] == '"' && _.last(filename) == '"')
			filename = filename.slice(1, filename.length - 1);
		var file = { name: filename };
		file.staged = status[0] == 'A' || status[0] == 'M';
		file.isNew = status[0] == '?' || status[0] == 'A';
		result.files.push(file);
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
      	
      	var blob = /^index\s([0-9A-Fa-f]+)\.\.([0-9A-Fa-f]+)\s?(.+)?$/.exec(lines.shift());
      	diff.aBlob = blob[1];
      	diff.bBlob = blob[2];
      	diff.bMode = blob[3] ? blob[3].trim() : diff.bMode;
      	
      	// Shift away ---, +++ and @@ stuff
      	lines.shift(); lines.shift(); lines.shift();
		var diff_lines = [];
		while(lines[0] && !/^diff/.test(lines[0])) {
			diff_lines.push(lines.shift());
		}
		diff.lines = diff_lines;

		diffs.push(diff);
	}
	return diffs;
}

exports.parseGitLog = function(data) {
	var commits = [];
	var currentCommmit;
	var inCommitIndex = 0;
	data.split('\n').forEach(function(row) {
		if (row.indexOf('commit ') == 0) {
			currentCommmit = { message: '' };
			commits.push(currentCommmit);
			inCommitIndex = 0;
		}
		if (inCommitIndex == 0)
			currentCommmit.sha1 = _.last(row.split(' '));
		else if (inCommitIndex == 1) {
			var author = row.split(' ').slice(1).join(' ');
			var capture = (/([^<]+)<([^>]+)>/g).exec(author);
			currentCommmit.authorName = capture[1].trim();
			currentCommmit.authorEmail = capture[2].trim();
		} else if (inCommitIndex == 2)
			currentCommmit.date = row.split(' ').slice(1).join(' ');
		else
			currentCommmit.message = (currentCommmit.message + '\n' + row).trim();
		if (inCommitIndex == 4)
			currentCommmit.title = row.trim();
		inCommitIndex++;
	});
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
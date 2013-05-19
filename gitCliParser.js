

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
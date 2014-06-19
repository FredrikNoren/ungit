var moment = require('moment');

exports.parseGitStatus = function(text) {
  var result = {};
  var lines = text.split('\n');
  result.branch = lines[0].split(' ').pop();
  result.inited = true;
  result.files = {};
  lines.slice(1).forEach(function(line) {
    if (line == '') return;
    var status = line.slice(0, 2);
    var filename = line.slice(3).trim();
    if (filename[0] == '"' && filename[filename.length - 1] == '"')
      filename = filename.slice(1, filename.length - 1);
    var file = {};
    file.staged = status[0] == 'A' || status[0] == 'M';
    file.removed = status[0] == 'D' || status[1] == 'D';
    file.isNew = (status[0] == '?' || status[0] == 'A') && !file.removed;
    file.conflict = (status[0] == 'A' && status[1] == 'A') || status[0] == 'U' || status[1] == 'U';
    result.files[filename] = file;
  });
  return result;
};

exports.parseGitDiff = function(text, args) {
  var lines = text.split("\n");
  var diffs = [];
  args = args || {};

  while(lines.length && lines[0]) {
    if (args.maxNLines) {
      var nLines = diffs.length > 0 ? diffs[diffs.length - 1].lines.length : 0;
      if (nLines >= args.maxNLines) break;
    }
    var diff = {};
    var path = /^diff\s--git\s\w\/(.+?)\s\w\/(.+)$/.exec(lines.shift());
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
    } else {
      m = /^similarity index (\d+)\%/.exec(lines[0]);
      if(m) {
        diff.simIndex = m[1].to_i();
        diff.renamedFile = true;
        //shift away the 2 `rename from/to ...` lines
        lines.shift();
        lines.shift();
      }
    }

    // Shift away index, ---, +++ and @@ stuff
    if (lines.shift().indexOf('index ') == 0) lines.shift();
    lines.shift();
    var diff_lines = [];
    var originalLine, newLine;
    while(lines[0] && !/^diff/.test(lines[0])) {
      if (args.maxNLines) {
        if (diff_lines.length >= args.maxNLines) break;
      }
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

    var unparsedLines = 0;
    while(lines[0] && !/^diff/.test(lines[0])) {
      unparsedLines++;
      lines.shift();
    }

    diff.lines = diff_lines.length > 0 ? diff_lines : [[0, 0, "<There are no changes>"]];
    diff.totalNumberOfLines = diff.lines.length + unparsedLines;

    diffs.push(diff);
  }

  return diffs;
}

var authorRegexp = /([^<]+)<([^>]+)>/;
var gitLogHeaders = {
  'Author': function(currentCommmit, author) {
    var capture = authorRegexp.exec(author);
    if (capture) {
      currentCommmit.authorName = capture[1].trim();
      currentCommmit.authorEmail = capture[2].trim();
    } else {
      currentCommmit.authorName = author;
    }
  },
  'Commit': function(currentCommmit, author) {
    var capture = authorRegexp.exec(author);
    if (capture) {
      currentCommmit.committerName = capture[1].trim();
      currentCommmit.committerEmail = capture[2].trim();
    } else {
      currentCommmit.committerName = author;
    }
  },
  'AuthorDate': function(currentCommmit, date) {
    currentCommmit.authorDate = date;
  },
  'CommitDate': function(currentCommmit, date) {
    currentCommmit.commitDate = date;
  },
  'Reflog': function(currentCommmit, data) {
    currentCommmit.reflogName = data.substring(0, data.indexOf(' '));
    var author = data.substring(data.indexOf(' ') + 2, data.length - 1);
    var capture = authorRegexp.exec(author);
    if (capture) {
      currentCommmit.reflogAuthorName = capture[1].trim();
      currentCommmit.reflogAuthorEmail = capture[2].trim();
    } else {
      currentCommmit.reflogAuthorName = author;
    }
  },
};
exports.parseGitLog = function(data) {
  var commits = [];
  var currentCommmit;
  var parseCommitLine = function(row) {
    if (!row.trim()) return;
    currentCommmit = { refs: [], fileLineDiffs: [] };
    var refStartIndex = row.indexOf('(');
    var sha1s = row.substring(0, refStartIndex < 0 ? row.length : refStartIndex).split(' ').slice(1).filter(function(sha1) { return sha1 && sha1.length; });
    currentCommmit.sha1 = sha1s[0];
    currentCommmit.parents = sha1s.slice(1);
    if (refStartIndex > 0) {
      var refs = row.substring(refStartIndex + 1, row.length - 1);
      currentCommmit.refs = refs.split(', ');
    }
    commits.push(currentCommmit);
    parser = parseHeaderLine;
  }
  var parseHeaderLine = function(row) {
    if (row.trim() == '') {
      parser = parseCommitMessage;
    } else {
      for (var key in gitLogHeaders) {
        if (row.indexOf(key + ': ') == 0) {
          gitLogHeaders[key](currentCommmit, row.slice((key + ': ').length).trim());
          return;
        }
      }
    }
  }
  var parseCommitMessage = function(row, index) {
    if (/[\d-]+\t[\d-]+\t.+/g.test(rows[index + 1])) {
      parser = parseFileChanges;
      return;
    }
    if (rows[index + 1] && rows[index + 1].indexOf('commit ') == 0) {
      parser = parseCommitLine;
      return;
    }
    if (currentCommmit.message) currentCommmit.message += '\n';
    else currentCommmit.message = '';
    currentCommmit.message += row.trim();
  }
  var parseFileChanges = function(row, index) {
    if (rows.length === index + 1 || rows[index + 1] && rows[index + 1].indexOf('commit ') === 0) {
      var total = [0, 0, 'Total'];
      for (var n = 0; n < currentCommmit.fileLineDiffs.length; n++) {
        var fileLineDiff = currentCommmit.fileLineDiffs[n];
        if (!isNaN(parseInt(fileLineDiff[0], 10))) {
          total[0] += fileLineDiff[0] = parseInt(fileLineDiff[0], 10);
        }
        if (!isNaN(parseInt(fileLineDiff[1], 10))) {
          total[1] += fileLineDiff[1] = parseInt(fileLineDiff[1], 10);
        }
      }
      currentCommmit.fileLineDiffs.splice(0,0, total);
      parser = parseCommitLine;
      return;
    }
    currentCommmit.fileLineDiffs.push(row.split('\t'));
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

exports.parseGitStashShow = function(text) {
  var lines = text.split('\n').filter(function(item) {
    return item;
  });
  return lines.slice(0, lines.length - 1).map(function(line) {
    var split = line.indexOf('|');
    return {
      filename: line.substring(0, split).trim()
    }
  });
}

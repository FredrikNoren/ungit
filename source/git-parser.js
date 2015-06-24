var moment = require('moment');
var fs = require('fs');
var fileType = require('./utils/file-type.js');

exports.parseGitStatus = function(text, args) {
  var result = { isMoreToLoad: false };
  var lines = text.split('\n');
  result.branch = lines[0].split(' ').pop();
  result.inited = true;
  result.files = {};

  // skipping first line...
  for(var i = 1; i < lines.length; i++) {
    var line = lines[i];
    if (line == '') continue;
    var status = line.slice(0, 2);
    var filename = line.slice(3).trim();
    if (filename[0] == '"' && filename[filename.length - 1] == '"')
      filename = filename.slice(1, filename.length - 1);
    var file = {};
    file.displayName = filename;
    file.staged = status[0] == 'A' || status[0] == 'M';
    file.removed = status[0] == 'D' || status[1] == 'D';
    file.isNew = (status[0] == '?' || status[0] == 'A') && !file.removed;
    file.conflict = (status[0] == 'A' && status[1] == 'A') || status[0] == 'U' || status[1] == 'U';
    file.renamed = status[0] == 'R';
    if (file.renamed)
      filename = filename.slice(filename.indexOf('>') + 2);
    file.type = fileType(filename);
    result.files[filename] = file;
  }

  return result;
};

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
      currentCommmit.refs = refs.split(/ -> |, /g);
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

exports.parseGitSubmodule = function(text, args) {
  if (!text) {
    return {};
  }

  var lines = text.trim().split('\n').filter(function(line) {
    return line;
  });

  var submodule = {};
  var submodules = [];

  var getSubmoduleName = function(line) {
    submodule.name = line.match(/"(.*?)"/)[1];
    parser = getPath;
  };

  var getPath = function(line) {
    submodule.path = line.substr(line.indexOf("= ") + 1).trim();
    parser = getUrl;
  };

  var getUrl = function(line) {
    var url = line.substr(line.indexOf("= ") + 1).trim();

    // keep a reference to the raw url
    submodule.rawUrl = url;

    // When a repo is checkout with ssh or git instead of an url
    if (url.indexOf('http') != 0) {
      if (url.indexOf('git:') == 0) { // git
        url = 'http' + url.substr(url.indexOf(':'));
      } else { // ssh
        url = 'http://' + url.substr(url.indexOf('@') + 1).replace(':', '/');
      }
    }

    submodule.url = url;

    parser = getSubmoduleName;

    submodules.push(submodule);
    submodule = {};
  };

  var parser = getSubmoduleName;

  lines.forEach(function(line) {
    parser(line);
  });

  return submodules;
}

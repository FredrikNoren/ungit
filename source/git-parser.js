const moment = require('moment');
const fs = require('fs');
const path = require('path');
const fileType = require('./utils/file-type.js');
const _ = require('lodash')

exports.parseGitStatus = (text, args) => {
  const lines = text.split('\n');
  const files = {};
  // skipping first line...
  lines.slice(1).forEach((line) => {
    if (line == '') return;
    const status = line.slice(0, 2);
    const filename = line.slice(3).trim().replace(/^"(.*)"$/, '$1'); // may contain old and renamed file name.
    const finalFilename = status[0] == 'R' ? filename.slice(filename.indexOf('>') + 2) : filename;
    files[finalFilename] = {
      displayName: filename,
      staged: status[0] == 'A' || status[0] == 'M',
      removed: status[0] == 'D' || status[1] == 'D',
      isNew: (status[0] == '?' || status[0] == 'A') && !(status[0] == 'D' || status[1] == 'D'),
      conflict: (status[0] == 'A' && status[1] == 'A') || status[0] == 'U' || status[1] == 'U',
      renamed: status[0] == 'R',
      type: fileType(finalFilename)
    };
  });

  return {
    isMoreToLoad: false,
    branch: lines[0].split(' ').pop(),
    inited: true,
    files: files
  };
};

exports.parseGitStatusNumstat = (text) => {
  const result = {};
  text.split('\n').forEach((line) => {
    if (line == '') return;
    const parts = line.split('\t');
    result[parts[2]] = {
      additions: parts[0],
      deletions: parts[1]
    };
  });
  return result;
};

const authorRegexp = /([^<]+)<([^>]+)>/;
const gitLogHeaders = {
  'Author': (currentCommmit, author) => {
    const capture = authorRegexp.exec(author);
    if (capture) {
      currentCommmit.authorName = capture[1].trim();
      currentCommmit.authorEmail = capture[2].trim();
    } else {
      currentCommmit.authorName = author;
    }
  },
  'Commit': (currentCommmit, author) => {
    const capture = authorRegexp.exec(author);
    if (capture) {
      currentCommmit.committerName = capture[1].trim();
      currentCommmit.committerEmail = capture[2].trim();
    } else {
      currentCommmit.committerName = author;
    }
  },
  'AuthorDate': (currentCommmit, date) => {
    currentCommmit.authorDate = date;
  },
  'CommitDate': (currentCommmit, date) => {
    currentCommmit.commitDate = date;
  },
  'Reflog': (currentCommmit, data) => {
    currentCommmit.reflogId = /\{(.*?)\}/.exec(data)[1];
    currentCommmit.reflogName = data.substring(0, data.indexOf(' ')).replace("refs/", "");
    const author = data.substring(data.indexOf(' ') + 2, data.length - 1);
    const capture = authorRegexp.exec(author);
    if (capture) {
      currentCommmit.reflogAuthorName = capture[1].trim();
      currentCommmit.reflogAuthorEmail = capture[2].trim();
    } else {
      currentCommmit.reflogAuthorName = author;
    }
  },
};
exports.parseGitLog = (data) => {
  const commits = [];
  let currentCommmit;
  const parseCommitLine = (row) => {
    if (!row.trim()) return;
    currentCommmit = { refs: [], fileLineDiffs: [] };
    const refStartIndex = row.indexOf('(');
    const sha1s = row.substring(0, refStartIndex < 0 ? row.length : refStartIndex).split(' ').slice(1).filter((sha1) => { return sha1 && sha1.length; });
    currentCommmit.sha1 = sha1s[0];
    currentCommmit.parents = sha1s.slice(1);
    if (refStartIndex > 0) {
      const refs = row.substring(refStartIndex + 1, row.length - 1);
      currentCommmit.refs = refs.split(/ -> |, /g);
    }
    currentCommmit.isHead = !!_.find(currentCommmit.refs, (item) => { return item.trim() === 'HEAD' });
    commits.isHeadExist = commits.isHeadExist || currentCommmit.isHead;
    commits.push(currentCommmit);
    parser = parseHeaderLine;
  }
  const parseHeaderLine = (row) => {
    if (row.trim() == '') {
      parser = parseCommitMessage;
    } else {
      for (const key in gitLogHeaders) {
        if (row.indexOf(`${key}: `) == 0) {
          gitLogHeaders[key](currentCommmit, row.slice((`${key}: `).length).trim());
          return;
        }
      }
    }
  }
  const parseCommitMessage = (row, index) => {
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
  const parseFileChanges = (row, index) => {
    if (rows.length === index + 1 || rows[index + 1] && rows[index + 1].indexOf('commit ') === 0) {
      const total = [0, 0, 'Total'];
      for (let n = 0; n < currentCommmit.fileLineDiffs.length; n++) {
        const fileLineDiff = currentCommmit.fileLineDiffs[n];
        if (!isNaN(parseInt(fileLineDiff[0], 10))) {
          total[0] += fileLineDiff[0] = parseInt(fileLineDiff[0], 10);
        }
        if (!isNaN(parseInt(fileLineDiff[1], 10))) {
          total[1] += fileLineDiff[1] = parseInt(fileLineDiff[1], 10);
        }
      }
      currentCommmit.fileLineDiffs.splice(0, 0, total);
      parser = parseCommitLine;
      return;
    }
    const splitted = row.split('\t');
    splitted.push(fileType(splitted[2]));
    currentCommmit.fileLineDiffs.push(splitted);
  }
  let parser = parseCommitLine;
  const rows = data.split('\n');
  rows.forEach((row, index) => {
    parser(row, index);
  });

  commits.forEach((commit) => { commit.message = (typeof commit.message) === 'string' ? commit.message.trim() : ''; });
  return commits;
};


exports.parseGitConfig = (text) => {
  const conf = {};
  text.split('\n').forEach((row) => {
    const ss = row.split('=');
    conf[ss[0]] = ss[1];
  });
  return conf;
}

exports.parseGitBranches = (text) => {
  const branches = [];
  text.split('\n').forEach((row) => {
    if (row.trim() == '') return;
    const branch = { name: row.slice(2) };
    if(row[0] == '*') branch.current = true;
    branches.push(branch);
  });
  return branches;
}

exports.parseGitTags = (text) => {
  return text.split('\n')
    .filter((tag) => { return tag != '' });
}

exports.parseGitRemotes = (text) => {
  return text.split('\n')
    .filter((remote) => { return remote != '' });
}

exports.parseGitLsRemote = (text) => {
  return text.split('\n').filter((item) => {
    return item && item.indexOf('From ') != 0;
  }).map((line) => {
    const sha1 = line.slice(0, 40);
    const name = line.slice(41).trim();
    return { sha1: sha1, name: name };
  });
}

exports.parseGitStashShow = (text) => {
  const lines = text.split('\n').filter((item) =>  item );
  return lines.slice(0, lines.length - 1).map((line) => {
    return { filename: line.substring(0, line.indexOf('|')).trim() }
  });
}

exports.parseGitSubmodule = (text, args) => {
  if (!text) {
    return {};
  }

  let submodule;
  const submodules = [];

  text.trim().split('\n').filter((line) => line)
  .forEach((line) => {
    if (line.indexOf("[submodule") === 0) {
      submodule = { name: line.match(/"(.*?)"/)[1] };
      submodules.push(submodule);
    } else {
      const parts = line.split("=");
      const key = parts[0].trim();
      let value = parts.slice(1).join("=").trim();

      if (key == "path") {
        value = path.normalize(value);
      } else if (key == "url") {
        // keep a reference to the raw url
        let url = submodule.rawUrl = value;

        // When a repo is checkout with ssh or git instead of an url
        if (url.indexOf('http') != 0) {
          if (url.indexOf('git:') == 0) { // git
            url = `http${url.substr(url.indexOf(':'))}`;
          } else { // ssh
            url = `http://${url.substr(url.indexOf('@') + 1).replace(':', '/')}`;
          }
        }

        value = url;
      }

      submodule[key] = value;
    }
  });

  return submodules;
}

const updatePatchHeader = (result, lastHeaderIndex, ignoredDiffCountTotal, ignoredDiffCountCurrent) => {
  const splitedHeader = result[lastHeaderIndex].split(' ');
  const start = splitedHeader[1].split(','); // start of block
  const end = splitedHeader[2].split(',');   // end of block
  const startLeft = Math.abs(start[0]);
  const startRight = Math.abs(start[1]);
  const endLeft = end[0];
  const endRight = end[1];

  splitedHeader[1] = `-${startLeft - ignoredDiffCountTotal},${startRight}`;
  splitedHeader[2] = `+${endLeft - ignoredDiffCountTotal},${endRight - ignoredDiffCountCurrent}`;

  let allSpace = true;
  for (let i = lastHeaderIndex + 1; i < result.length; i++) {
    if (result[i][0] != ' ') {
      allSpace = false;
      break;
    }
  }
  if (allSpace)
    result.splice(lastHeaderIndex, result.length - lastHeaderIndex);
  else
    result[lastHeaderIndex] = splitedHeader.join(' ');
}

exports.parsePatchDiffResult = (patchLineList, text) => {
  if (!text) return {};

  const lines = text.trim().split('\n');
  const result = [];
  let ignoredDiffCountTotal = 0;
  let ignoredDiffCountCurrent = 0;
  let headerIndex = null;
  let lastHeaderIndex = -1;
  let n = 0;
  let selectedLines = 0;

  // first add all lines until diff block header is found
  while (!/@@ -[0-9]+,[0-9]+ \+[0-9]+,[0-9]+ @@/.test(lines[n])) {
    result.push(lines[n]);
    n++;
  }

  // per rest of the lines
  while (n < lines.length) {
    const line = lines[n];

    if (/^[\-\+]/.test(line)) {
      // Modified line
      if (patchLineList.shift()) {
        selectedLines++;
        // diff is selected to be committed
        result.push(line);
      } else if (line[0] === '+') {
        // added line diff is selected to be ignored
        ignoredDiffCountCurrent++;
      } else { // lines[0] === '-'
        // deleted line diff is selected to be ignored
        ignoredDiffCountCurrent--;
        result.push(` ${line.slice(1)}`);
      }
    } else {
      // none modified line or diff block header
      if (/@@ -[0-9]+,[0-9]+ \+[0-9]+,[0-9]+ @@/.test(line)) {
        // update previous header to match line numbers
        if (lastHeaderIndex > -1) {
          updatePatchHeader(result, lastHeaderIndex, ignoredDiffCountTotal, ignoredDiffCountCurrent);
        }
        // diff block header
        ignoredDiffCountTotal += ignoredDiffCountCurrent;
        ignoredDiffCountCurrent = 0;
        lastHeaderIndex = result.length;
      }
      result.push(line);
    }
    n++;
  }

  // We don't want to leave out last diff block header...
  updatePatchHeader(result, lastHeaderIndex, ignoredDiffCountTotal, ignoredDiffCountCurrent);

  if (selectedLines > 0) {
    return result.join('\n');
  } else {
    return null;
  }
}

const path = require('path');
const fileType = require('./utils/file-type.js');
const _ = require('lodash');

exports.parseGitStatus = (text, args) => {
  let lines = text.split('\x00');
  const branch = lines[0].split(' ').pop();
  // skipping first line...
  lines = lines.slice(1);
  const files = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line == '') continue;
    const status = line.slice(0, 2);
    const newFileName = line.slice(3).trim();
    let oldFileName;
    let displayName;
    if (status[0] == 'R') {
      oldFileName = lines[++i];
      displayName = `${oldFileName} → ${newFileName}`;
    } else {
      oldFileName = newFileName;
      displayName = newFileName;
    }
    files[newFileName] = {
      fileName: newFileName,
      oldFileName: oldFileName,
      displayName: displayName,
      staged: status[0] == 'A' || status[0] == 'M',
      removed: status[0] == 'D' || status[1] == 'D',
      isNew: (status[0] == '?' || status[0] == 'A') && status[1] != 'D',
      conflict: (status[0] == 'A' && status[1] == 'A') || status[0] == 'U' || status[1] == 'U',
      renamed: status[0] == 'R',
      type: fileType(newFileName),
    };
  }

  return {
    branch: branch,
    files: files,
  };
};

const fileChangeRegex =
  /(?<additions>[\d-]+)\t(?<deletions>[\d-]+)\t((?<fileName>[^\x00]+?)\x00|\x00(?<oldFileName>[^\x00]+?)\x00(?<newFileName>[^\x00]+?)\x00)/g;

exports.parseGitStatusNumstat = (text) => {
  const result = {};
  fileChangeRegex.lastIndex = 0;
  let match = fileChangeRegex.exec(text);
  while (match !== null) {
    result[match.groups.fileName || match.groups.newFileName] = {
      additions: match.groups.additions,
      deletions: match.groups.deletions,
    };
    match = fileChangeRegex.exec(text);
  }
  return result;
};

const authorRegexp = /([^<]+)<([^>]+)>/;
const gitLogHeaders = {
  Author: (currentCommmit, author) => {
    const capture = authorRegexp.exec(author);
    if (capture) {
      currentCommmit.authorName = capture[1].trim();
      currentCommmit.authorEmail = capture[2].trim();
    } else {
      currentCommmit.authorName = author;
    }
  },
  Commit: (currentCommmit, author) => {
    const capture = authorRegexp.exec(author);
    if (capture) {
      currentCommmit.committerName = capture[1].trim();
      currentCommmit.committerEmail = capture[2].trim();
    } else {
      currentCommmit.committerName = author;
    }
  },
  AuthorDate: (currentCommmit, date) => {
    currentCommmit.authorDate = date;
  },
  CommitDate: (currentCommmit, date) => {
    currentCommmit.commitDate = date;
  },
  Reflog: (currentCommmit, data) => {
    currentCommmit.reflogId = /\{(.*?)\}/.exec(data)[1];
    currentCommmit.reflogName = data.substring(0, data.indexOf(' ')).replace('refs/', '');
    const author = data.substring(data.indexOf('(') + 1, data.length - 1);
    const capture = authorRegexp.exec(author);
    if (capture) {
      currentCommmit.reflogAuthorName = capture[1].trim();
      currentCommmit.reflogAuthorEmail = capture[2].trim();
    } else {
      currentCommmit.reflogAuthorName = author;
    }
  },
  gpg: (currentCommit, data) => {
    if (data.startsWith('Signature made')) {
      // extract sign date
      currentCommit.signatureDate = data.slice('Signature made '.length);
    } else if (data.indexOf('Good signature from') > -1) {
      // fully verified.
      currentCommit.signatureMade = data
        .slice('Good signature from '.length)
        .replace('[ultimate]', '')
        .trim();
    } else if (data.indexOf("Can't check signature") > -1) {
      // pgp signature attempt is made but failed to verify
      delete currentCommit.signatureDate;
    }
  },
};
exports.parseGitLog = (data) => {
  const commits = [];
  let currentCommmit;
  const parseCommitLine = (row) => {
    if (!row.trim()) return;
    currentCommmit = { refs: [], fileLineDiffs: [], additions: 0, deletions: 0 };
    const refStartIndex = row.indexOf('(');
    const sha1s = row
      .substring(0, refStartIndex < 0 ? row.length : refStartIndex)
      .split(' ')
      .slice(1)
      .filter((sha1) => {
        return sha1 && sha1.length;
      });
    currentCommmit.sha1 = sha1s[0];
    currentCommmit.parents = sha1s.slice(1);
    if (refStartIndex > 0) {
      const refs = row.substring(refStartIndex + 1, row.length - 1);
      currentCommmit.refs = refs.split(/ -> |, /g);
    }
    currentCommmit.isHead = !!_.find(currentCommmit.refs, (item) => {
      return item.trim() === 'HEAD';
    });
    commits.isHeadExist = commits.isHeadExist || currentCommmit.isHead;
    commits.push(currentCommmit);
    parser = parseHeaderLine;
  };
  const parseHeaderLine = (row) => {
    if (row.trim() == '') {
      parser = parseCommitMessage;
    } else {
      for (const key in gitLogHeaders) {
        if (row.indexOf(`${key}: `) == 0) {
          gitLogHeaders[key](currentCommmit, row.slice(`${key}: `.length).trim());
          return;
        }
      }
    }
  };
  const parseCommitMessage = (row, index) => {
    if (currentCommmit.message) currentCommmit.message += '\n';
    else currentCommmit.message = '';
    currentCommmit.message += row.trim();
    if (/[\d-]+\t[\d-]+\t.+/g.test(rows[index + 1])) {
      parser = parseFileChanges;
      return;
    }
    if (rows[index + 1] && /^\u0000+commit/.test(rows[index + 1])) {
      parser = parseCommitLine;
      return;
    }
  };
  const parseFileChanges = (row, index) => {
    // git log is using -z so all the file changes are on one line
    // merge commits start the file changes with a null
    if (row[0] === '\x00') {
      row = row.slice(1);
    }
    fileChangeRegex.lastIndex = 0;
    while (row[fileChangeRegex.lastIndex] && row[fileChangeRegex.lastIndex] !== '\x00') {
      const match = fileChangeRegex.exec(row);
      const fileName = match.groups.fileName || match.groups.newFileName;
      const oldFileName = match.groups.oldFileName || match.groups.fileName;
      let displayName;
      if (match.groups.oldFileName) {
        displayName = `${match.groups.oldFileName} → ${match.groups.newFileName}`;
      } else {
        displayName = fileName;
      }
      currentCommmit.fileLineDiffs.push({
        additions: match.groups.additions,
        deletions: match.groups.deletions,
        fileName: fileName,
        oldFileName: oldFileName,
        displayName: displayName,
        type: fileType(fileName),
      });
    }
    const nextRow = row.slice(fileChangeRegex.lastIndex + 1);
    for (const fileLineDiff of currentCommmit.fileLineDiffs) {
      if (!isNaN(parseInt(fileLineDiff.additions, 10))) {
        currentCommmit.additions += fileLineDiff.additions = parseInt(fileLineDiff.additions, 10);
      }
      if (!isNaN(parseInt(fileLineDiff.deletions, 10))) {
        currentCommmit.deletions += fileLineDiff.deletions = parseInt(fileLineDiff.deletions, 10);
      }
    }
    parser = parseCommitLine;
    if (nextRow) {
      parser(nextRow, index);
    }
    return;
  };
  let parser = parseCommitLine;
  const rows = data.split('\n');
  rows.forEach((row, index) => {
    parser(row, index);
  });

  commits.forEach((commit) => {
    commit.message = typeof commit.message === 'string' ? commit.message.trim() : '';
  });
  return commits;
};

exports.parseGitConfig = (text) => {
  const conf = {};
  text.split('\n').forEach((row) => {
    const ss = row.split('=');
    conf[ss[0]] = ss[1];
  });
  return conf;
};

exports.parseGitBranches = (text) => {
  const branches = [];
  text.split('\n').forEach((row) => {
    if (row.trim() == '') return;
    const branch = { name: row.slice(2) };
    if (row[0] == '*') branch.current = true;
    branches.push(branch);
  });
  return branches;
};

exports.parseGitTags = (text) => {
  return text.split('\n').filter((tag) => {
    return tag != '';
  });
};

exports.parseGitRemotes = (text) => {
  return text.split('\n').filter((remote) => {
    return remote != '';
  });
};

exports.parseGitLsRemote = (text) => {
  return text
    .split('\n')
    .filter((item) => {
      return item && item.indexOf('From ') != 0;
    })
    .map((line) => {
      const sha1 = line.slice(0, 40);
      const name = line.slice(41).trim();
      return { sha1: sha1, name: name };
    });
};

exports.parseGitStashShow = (text) => {
  const lines = text.split('\n').filter((item) => item);
  return lines.slice(0, lines.length - 1).map((line) => {
    return { filename: line.substring(0, line.indexOf('|')).trim() };
  });
};

exports.parseGitSubmodule = (text) => {
  if (!text) {
    return [];
  }

  let submodule;
  const submodules = [];

  text
    .trim()
    .split('\n')
    .filter((line) => line)
    .forEach((line) => {
      if (line.indexOf('[submodule') === 0) {
        submodule = { name: line.match(/"(.*?)"/)[1] };
        submodules.push(submodule);
      } else {
        const parts = line.split('=');
        const key = parts[0].trim();
        let value = parts.slice(1).join('=').trim();

        if (key == 'path') {
          value = path.normalize(value);
        } else if (key == 'url') {
          // keep a reference to the raw url
          let url = (submodule.rawUrl = value);

          // When a repo is checkout with ssh or git instead of an url
          if (url.indexOf('http') != 0) {
            if (url.indexOf('git:') == 0) {
              // git
              url = `http${url.substr(url.indexOf(':'))}`;
            } else {
              // ssh
              url = `http://${url.substr(url.indexOf('@') + 1).replace(':', '/')}`;
            }
          }

          value = url;
        }

        submodule[key] = value;
      }
    });

  const sorted_submodules = submodules.sort((a, b) => a.name.localeCompare(b.name));

  return sorted_submodules;
};

const updatePatchHeader = (
  result,
  lastHeaderIndex,
  ignoredDiffCountTotal,
  ignoredDiffCountCurrent
) => {
  const splitedHeader = result[lastHeaderIndex].split(' ');
  const start = splitedHeader[1].split(','); // start of block
  const end = splitedHeader[2].split(','); // end of block
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
  if (allSpace) result.splice(lastHeaderIndex, result.length - lastHeaderIndex);
  else result[lastHeaderIndex] = splitedHeader.join(' ');
};

exports.parsePatchDiffResult = (patchLineList, text) => {
  if (!text) return null;

  const lines = text.trim().split('\n');
  const result = [];
  let ignoredDiffCountTotal = 0;
  let ignoredDiffCountCurrent = 0;
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

    if (/^[-+]/.test(line)) {
      // Modified line
      if (patchLineList.shift()) {
        selectedLines++;
        // diff is selected to be committed
        result.push(line);
      } else if (line[0] === '+') {
        // added line diff is selected to be ignored
        ignoredDiffCountCurrent++;
      } else {
        // lines[0] === '-'
        // deleted line diff is selected to be ignored
        ignoredDiffCountCurrent--;
        result.push(` ${line.slice(1)}`);
      }
    } else {
      // none modified line or diff block header
      if (/@@ -[0-9]+,[0-9]+ \+[0-9]+,[0-9]+ @@/.test(line)) {
        // update previous header to match line numbers
        if (lastHeaderIndex > -1) {
          updatePatchHeader(
            result,
            lastHeaderIndex,
            ignoredDiffCountTotal,
            ignoredDiffCountCurrent
          );
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
};

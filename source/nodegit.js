const fs = require('fs').promises;
const sysPath = require('path');
const nodegit = require('nodegit');
const fileType = require('./utils/file-type.js');

// from libgit2/include/git2/errors.h
const nodegitErrors = {
  '-1': 'GIT_ERROR', // Generic error
  '-3': 'no-such-path', // was 'GIT_ENOTFOUND', // Requested object could not be found
  '-4': 'GIT_EEXISTS', // Object exists preventing operation
  '-5': 'GIT_EAMBIGUOUS', // More than one object matches
  '-6': 'GIT_EBUFS', // Output buffer too short to hold data
  /*
   * GIT_EUSER is a special error that is never generated by libgit2
   * code.  You can return it from a callback (e.g to stop an iteration)
   * to know that it was generated by the callback and not by libgit2.
   */
  '-7': 'GIT_EUSER',

  '-8': 'GIT_EBAREREPO', // Operation not allowed on bare repository
  '-9': 'GIT_EUNBORNBRANCH', // HEAD refers to branch with no commits
  '-10': 'GIT_EUNMERGED', // Merge in progress prevented operation
  '-11': 'GIT_ENONFASTFORWARD', // Reference was not fast-forwardable
  '-12': 'GIT_EINVALIDSPEC', // Name/ref spec was not in a valid format
  '-13': 'GIT_ECONFLICT', // Checkout conflicts prevented operation
  '-14': 'GIT_ELOCKED', // Lock file prevented operation
  '-15': 'GIT_EMODIFIED', // Reference value does not match expected
  '-16': 'GIT_EAUTH', // Authentication error
  '-17': 'GIT_ECERTIFICATE', // Server certificate is invalid
  '-18': 'GIT_EAPPLIED', // Patch/merge has already been applied
  '-19': 'GIT_EPEEL', // The requested peel operation is not possible
  '-20': 'GIT_EEOF', // Unexpected EOF
  '-21': 'GIT_EINVALID', // Invalid operation or input
  '-22': 'GIT_EUNCOMMITTED', // Uncommitted changes in index prevented operation
  '-23': 'GIT_EDIRECTORY', // The operation is not valid for a directory
  '-24': 'GIT_EMERGECONFLICT', // A merge conflict exists and cannot continue

  '-30': 'GIT_PASSTHROUGH', // A user-configured callback refused to act
  '-31': 'GIT_ITEROVER', // Signals end of iteration with iterator
  '-32': 'GIT_RETRY', // Internal only
  '-33': 'GIT_EMISMATCH', // Hashsum mismatch in object
  '-34': 'GIT_EINDEXDIRTY', // Unsaved changes in the index would be overwritten
  '-35': 'GIT_EAPPLYFAIL', // Patch application failed
};
const normalizeError = (err) => {
  console.error('normalizing', err);
  if (!err.errorCode && err.errno) err.errorCode = nodegitErrors[err.errno];
  throw err;
};

const splitMail = (signature) => {
  if (!signature) return [];
  const match = /^([^<]*)<?([^>]*)>?$/.exec(signature);
  return match ? [match[1].trim(), match[2].trim()] : [];
};

/**
 * @param {nodegit.Commit} c
 * @param {nodegit.Oid}    hId
 */
const formatCommit = (c, hId) => {
  const [authorName, authorEmail] = splitMail(c.author().toString());
  const [committerName, committerEmail] = splitMail(c.author().toString());
  /** @type {Commit} */
  const out = {
    sha1: c.sha(),
    parents: c.parents().map(String),
    refs: hId && hId.equal(c.id()) ? ['HEAD'] : [], // TODO cached refs on client, don't include here
    message: c.message(),
    // TODO find out how to extract from rawHeader()
    authorDate: c.date().toJSON(),
    commitDate: c.date().toJSON(),
    authorName,
    authorEmail,
    committerName,
    committerEmail,
  };
  return out;
};

/** @param {nodegit.Commit} c */
const getFileStats = async (c, isStash) => {
  const out = { additions: 0, deletions: 0, fileLineDiffs: [] };
  const diffs = await c.getDiff();
  // One diff per parent
  for (const diff of diffs) {
    const stat = await diff.getStats();
    // Stashes have 0-change diffs with the whole repo as a patch
    if (stat.filesChanged() === 0) continue;
    out.additions += stat.insertions();
    out.deletions += stat.deletions();

    const patches = await diff.patches();
    // TODO probably need to aggregate by file path
    out.fileLineDiffs.push(
      ...patches.map((p) => {
        const fileName = p.isDeleted() ? p.oldFile().path() : p.newFile().path();
        const oldFileName = p.isAdded() ? fileName : p.oldFile().path();
        const displayName = p.isRenamed() ? `${oldFileName} → ${fileName}` : fileName;
        const { total_additions, total_deletions } = p.lineStats();
        /** @type{DiffStat} */
        const fileStat = {
          oldFileName,
          fileName,
          displayName,
          additions: total_additions,
          deletions: total_deletions,
          type: fileType(fileName || oldFileName),
        };
        return fileStat;
      })
    );
  }
  return out;
};

class NGWrap {
  constructor(ngRepo) {
    /** @type {nodegit.Repository} */
    this.r = ngRepo;
  }

  async addStash(message) {
    /** @type {Hash} */
    const oid = await nodegit.Stash.save(
      this.r,
      await this.r.defaultSignature(),
      message,
      nodegit.Stash.FLAGS.INCLUDE_UNTRACKED
    ).catch((err) => {
      // no changes
      if (err.errno === -3) return null;
      normalizeError(err);
    });
    return oid;
  }

  async deleteStash(index) {
    return nodegit.Stash.drop(this.r, index).catch(normalizeError);
  }

  async applyStash(index) {
    return nodegit.Stash.apply(this.r, index).catch(normalizeError);
  }

  async popStash(oid) {
    if (!oid) return;
    let index;
    await nodegit.Stash.foreach(this.r, (i, _msg, stashOid) => {
      if (stashOid.equal(oid)) index = i;
    }).catch(normalizeError);
    if (index != null) {
      await nodegit.Stash.pop(this.r, index, {
        flags: nodegit.Stash.APPLY_FLAGS.APPLY_REINSTATE_INDEX,
      }).catch(normalizeError);
    }
  }

  async getTags() {
    return nodegit.Tag.list(this.r).catch(normalizeError);
  }

  async deleteTag(name) {
    return nodegit.Tag.delete(this.r, name).catch(normalizeError);
  }

  async getRemotes() {
    return nodegit.Remote.list(this.r).catch(normalizeError);
  }

  async addRemote(name, url) {
    return nodegit.Remote.create(this.r, name, url).catch(normalizeError);
  }

  async deleteRemote(name) {
    return nodegit.Remote.delete(this.r, name).catch(normalizeError);
  }

  async getStashes() {
    const oids = [];
    await nodegit.Stash.foreach(this.r, (index, message, oid) => {
      oids.push(oid);
    }).catch(normalizeError);
    const stashes = await Promise.all(oids.map((oid) => this.r.getCommit(oid)));
    /** @type {Commit[]} */
    return Promise.all(
      stashes.map(async (stash, index) => ({
        ...(await getFileStats(stash)),
        ...formatCommit(stash),
        reflogId: `${index}`,
        reflogName: `stash@{${index}}`,
      }))
    );
  }

  rootPath() {
    return this.r.isBare() ? this.r.path().slice(0, -1) : this.r.workdir().slice(0, -1);
  }

  async status() {
    const { r } = this;
    const branch = await r.getCurrentBranch();
    const index = await r.index();
    const inCherry = r.isCherrypicking();
    const inMerge = r.isMerging();
    const inRebase = r.isRebasing();
    const inConflict = index.hasConflicts();
    /** @type {Record<string, FileStatus>} */
    const files = {};
    for (const f of await r.getStatusExt()) {
      const fileName = f.path();
      let oldFileName;
      if (!f.isNew()) {
        const diff = f.indexToWorkdir() || f.headToIndex();
        oldFileName = diff.oldFile().path();
      } else {
        oldFileName = fileName;
      }
      const displayName = f.isRenamed() ? `${oldFileName} → ${fileName}` : fileName;
      files[fileName] = {
        fileName,
        oldFileName,
        displayName,
        staged: f.inIndex(),
        removed: f.isDeleted(),
        isNew: f.isNew(),
        conflict: f.isConflicted(),
        renamed: f.isRenamed(),
        type: fileType(fileName),
      };
    }

    /** @type {GitStatus} */
    return {
      branch: branch && branch.shorthand(),
      inCherry,
      inMerge,
      inRebase,
      inConflict,
      files,
    };
  }

  // TODO accept SHAs to walk
  async log(limit = 500, skip) {
    const walker = this.r.createRevWalk();
    walker.sorting(nodegit.Revwalk.SORT.TIME);
    const head = await this.r.getHeadCommit();
    if (skip) await walker.fastWalk(skip).catch(normalizeError);
    else {
      if (head) walker.push(head.id());
      walker.pushGlob('*');
    }
    const commits = await walker.getCommits(limit).catch(normalizeError);
    // TODO detect head client-side
    const headId = head && head.id();
    // TODO only keep formatCommit, the stats are for a details call
    /** @type {Commit[]} */
    const result = await Promise.all(
      commits.map(async (c) => ({ ...(await getFileStats(c)), ...formatCommit(c, headId) }))
    );
    return result;
  }
}

const repoPs = {};
/**
 * Memoize nodegit opened repos.
 *
 * @param {string} path  The path to the repository.
 * @returns {Promise<NGWrap>}
 */
const getRepo = async (path) => {
  if (!repoPs[path]) {
    repoPs[path] =
      /** @type {Promise<NGWrap>} */
      (
        nodegit.Repository.open(path)
          .then((repo) => new NGWrap(repo))
          .catch((err) => {
            repoPs[path] = null;
            normalizeError(err);
          })
      );
  }
  return repoPs[path];
};

/** @returns {Promise<QuickStatus>} */
const quickStatus = async (path) => {
  try {
    const repo = await getRepo(path);
    return { gitRootPath: repo.rootPath(), type: repo.r.isBare() ? 'bare' : 'inited' };
  } catch (err) {
    if (err.errno !== -3) throw err;
    if (/failed to resolve/.test(err.message)) return { gitRootPath: path, type: 'no-such-path' };

    // for uninited directory, let's check if it's any immediate directories are
    // git repository so we can display them.
    const filePaths = (await fs.readdir(path))
      .filter((filePath) => !filePath.startsWith('.'))
      .map((filePath) => sysPath.join(path, filePath));
    const subRepos = [];
    await Promise.all(
      filePaths.map(async (subPath) => {
        const subRepo = await getRepo(subPath).catch(() => {});
        if (subRepo) subRepos.push(subPath);
      })
    );
    return { type: 'uninited', gitRootPath: path, subRepos };
  }
};

const initGit = (path, isBare) =>
  // nodegit requires a number https://github.com/nodegit/nodegit/issues/538
  nodegit.Repository.init(path, isBare ? 1 : 0).catch(normalizeError);

module.exports = {
  NGWrap,
  getRepo,
  initGit,
  quickStatus,
};

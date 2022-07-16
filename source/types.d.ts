type RefName = string;
type Hash = string;
type FileName = string;
type DiffStat = {
  idx: number;
  additions: number | null;
  deletions: number | null;
  hasConflict?: boolean;
  fileName?: string;
  oldFileName?: string;
  type: string;
};
type Commit = {
  sha1: Hash;
  parents: Hash[];
  refs?: RefName[];
  isHead?: boolean;
  message: string;
  authorName?: string;
  authorEmail?: string;
  committerName?: string;
  committerEmail?: string;
  authorDate?: string;
  commitDate?: string;
  reflogId?: string;
  reflogName?: string;
  reflogAuthorName?: string;
  reflogAuthorEmail?: string;
  signatureDate?: string;
  signatureMade?: string;
  fileLineDiffs?: DiffStat[];
  additions?: number;
  deletions?: number;
  diffKey?: string;
  // For stashes
  newFiles?: { sha1: string; fileLineDiffs: DiffStat[] };
};
type FileStatus = {
  fileName?: string;
  oldFileName?: string;
  staged?: boolean;
  removed?: boolean;
  isNew?: boolean;
  conflict?: boolean;
  renamed?: boolean;
  type: 'text' | 'image';
  additions?: number;
  deletions?: number;
};
type Ref = { name: RefName; current?: boolean; sha1?: Hash; remote?: string; date?: Date | string };
type QuickStatus = {
  gitRootPath: string;
  type: 'inited' | 'uninited' | 'bare' | 'no-such-path';
  subRepos?: string[];
};
type GitStatus = {
  branch: string;
  inCherry?: boolean;
  inConflict?: boolean;
  inMerge?: boolean;
  inRebase?: boolean;
  commitMessage?: string;
  worktree: {
    fileLineDiffs?: DiffStat[];
    additions?: number;
    deletions?: number;
    diffKey?: string;
  };
};
type SubModule = { name: string; path?: string; url?: string; rawUrl?: string };

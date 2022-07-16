# TODO

## bugs

- conflicts don't always have a diff
- diff sometimes includes multiple deletions of the same file
- new file shows as modified, with 0 additions and an oldFileName but not newFileName
- new adds [new]
- remote-tags-updated does not fetch new remote refs and update the tree
- move watcher to repo class

## ideas

- staging: show staged files inline with checkboxes
  - [x] useStaging mode when index is populated
  - [ ] when clicking checkbox in useStaging, stage/unstage
  - [ ] when selecting text in diff let patch button add selected range to staged and switch to useStaging
- [ ] Allow sorting branches by local first or just by date
- [ ] alias all commits with numeric ids to limit mem use on client
- [ ] load commit existence and parents separately from metadata
- [ ] possibly cache them in a db so the entire tree, if loading commit tree from git is slow
- [ ] conflict diffs should be shown better, like in vscode
- [ ] be able to expand diff context, like on github

- [ ] CRDT sync between TODO file and github issue :drool:

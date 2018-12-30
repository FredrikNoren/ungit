const shell  = require('shelljs')

let TEST_REPO_WORKING_DIRECTORY = './testrepo'

exports.testRepoWorkingDirectory = () => TEST_REPO_WORKING_DIRECTORY

exports.initTestRepo = (commands) => {
  var cwd = TEST_REPO_WORKING_DIRECTORY
  shell.exec(`mkdir ${cwd}`)
  shell.exec('git init', { cwd })
  shell.exec('echo "Test repo from ungit test suite" > README', { cwd })
  shell.exec('git add README', { cwd })
  shell.exec('git commit -m "initial commit"', { cwd })
  commands.split('\n').forEach(function(command) {
    command = command.trim()
    if (command != "") {
      shell.exec(command, { cwd })
    }
  })
}

exports.removeTestRepo = () => {
  shell.exec(`rm -rf ${TEST_REPO_WORKING_DIRECTORY}`)
}

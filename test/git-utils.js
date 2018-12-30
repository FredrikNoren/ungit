const { execSync } = require('child_process')

let TEST_REPO_WORKING_DIRECTORY = './testrepo'

exports.testRepoWorkingDirectory = () => TEST_REPO_WORKING_DIRECTORY

exports.initTestRepo = (commands) => {
  var cwd = TEST_REPO_WORKING_DIRECTORY
  execSync(`mkdir ${cwd}`)
  execSync('git init', { cwd })
  execSync('echo "Test repo from ungit test suite" > README', { cwd })
  execSync('git add README', { cwd })
  execSync('git commit -m "initial commit"', { cwd })
  commands.split('\n').forEach(function(command) {
    command = command.trim()
    if (command != "") {
      execSync(command, { cwd })
    }
  })
}

exports.removeTestRepo = () => {
  execSync(`rm -rf ${TEST_REPO_WORKING_DIRECTORY}`)
}

module.exports = (grunt) => {
  const packageJson = grunt.file.readJSON('package.json');

  grunt.initConfig({
    pkg: packageJson,
    release: {
      options: {
        commitMessage: 'Release <%= version %>',
      },
    },
  });

  grunt.loadNpmTasks('grunt-release');
};

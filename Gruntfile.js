module.exports = (grunt) => {
  const packageJson = grunt.file.readJSON('package.json');

  grunt.initConfig({
    pkg: packageJson,
    watch: {
      scripts: {
        files: ['public/source/**/*.js', 'source/**/*.js', 'components/**/*.js'],
        tasks: ['browserify-common', 'browserify-components'],
        options: {
          spawn: false,
        },
      },
      less: {
        files: ['public/less/*.less', 'public/styles/*.less', 'components/**/*.less'],
        tasks: ['less:production'],
        options: {
          spawn: false,
        },
      },
    },
    release: {
      options: {
        commitMessage: 'Release <%= version %>',
      },
    },
  });

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-release');
};

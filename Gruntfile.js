module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    less: {
      development: {
        files: {
          "public/css/styles.css": ["public/less/styles.less"]
        }
      },
      production: {
        options: {
          yuicompress: true
        },
        files: {
          "public/css/styles.css": "public/less/styles.less"
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-less');

  grunt.registerTask('default', ['less:development']);

};
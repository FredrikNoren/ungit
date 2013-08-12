module.exports = function(grunt) {

  var jsSources = [
    'public/vendor/js/knockout-2.2.1.js',
    'public/vendor/js/jquery-2.0.0.min.js',
    'public/vendor/js/jquery.dnd_page_scroll.js',
    'public/vendor/js/google.ui.fastbutton.js',
    'public/vendor/js/superagent.js',
    'public/vendor/js/signals.js',
    'public/vendor/js/hasher.js',
    'public/vendor/js/crossroads.js',
    'public/vendor/js/uuid.js',
    'public/vendor/js/moment.js',
    'public/vendor/js/underscore.js',
    'public/vendor/js/bootstrap/modal.js',
    'public/vendor/js/bootstrap/alert.js',
    'public/source/utils.js',
    'public/source/api.js',
    'public/source/git-graph-actions.js',
    'public/source/git-graph.js',
    'public/source/vector2.js',
    'public/source/logrenderer.js',
    'public/source/gerrit.js',
    'public/source/repository.js',
    'public/source/controls.js',
    'public/source/app.js',
    'public/source/main.js'
  ];

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    less: {
      development: {
        files: {
          "public/css/styles.css": ["public/less/styles.less", "public/styles/styles.less", "public/styles/animate.css"]
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
    },
    concat: {
      options: {
        separator: ';'
      },
      dist: {
        src: jsSources,
        dest: 'public/js/ungit.js',
        nonull: true
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-concat');

  grunt.registerTask('default', ['less:development', 'concat']);

};
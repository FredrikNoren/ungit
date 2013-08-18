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
    'public/source/node.js',
    'public/source/ref.js',
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
      production: {
        files: {
          "public/css/styles.css": ["public/less/styles.less", "public/vendor/css/animate.css"]
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
    },
    watch: {
      scripts: {
        files: ['public/source/*.js'],
        tasks: ['concat'],
        options: {
          spawn: false,
        },
      },
      less: {
        files: ['public/less/*.less', 'public/styles/*.less'],
        tasks: ['less:production'],
        options: {
          spawn: false,
        },
      },
    },
    lineending: {
      // Debian won't accept bin files with the wrong line ending
      production: {
        '/bin/ungit': ['/bin/ungit'],
        '/bin/credentials-helper': ['/bin/credentials-helper']
      },
    },
    release: {
      options: {
        commitMessage: 'Release <%= version %>',
      }
    },
    // Run mocha tests
    simplemocha: {
      options: {
        reporter: 'spec'
      },

      all: { src: 'test/*.js' }
    },
    // Plato code analysis
    plato: {
      all: {
        files: {
          'report': ['source/**/*.js', 'public/source/**/*.js'],
        }
      },
    },
  });

  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-lineending');
  grunt.loadNpmTasks('grunt-release');
  grunt.loadNpmTasks('grunt-simple-mocha');
  grunt.loadNpmTasks('grunt-plato');

  // Default task, builds everything needed
  grunt.registerTask('default', ['less:production', 'concat', 'lineending:production']);

  // Run tests
  grunt.registerTask('test', ['simplemocha']);

  // Builds, and then creates a release (bump patch version, create a commit & tag, publish to npm)
  grunt.registerTask('publish', ['default', 'test', 'release:patch']);

};

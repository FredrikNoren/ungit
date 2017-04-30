var childProcess = require('child_process');
var phantomjs = require('phantomjs-prebuilt');
var path = require('path');
var fs = require('./source/utils/fs-async');
var npm = require('npm');
var semver = require('semver');
var browserify = require('browserify');
var electronPackager = require('electron-packager');
var Bluebird = require('bluebird');
var cliColor = require('ansi-color');

module.exports = function(grunt) {
  var packageJson = grunt.file.readJSON('package.json');

  grunt.initConfig({
    pkg: packageJson,
    less: {
      production: {
        files: {
          "public/css/styles.css": ["public/less/styles.less", "public/vendor/css/animate.css", "public/less/d2h.less"],
          "components/commit/commit.css": ["components/commit/commit.less"],
          "components/commitdiff/commitdiff.css": ["components/commitdiff/commitdiff.less"],
          "components/graph/graph.css": ["components/graph/graph.less"],
          "components/header/header.css": ["components/header/header.less"],
          "components/home/home.css": ["components/home/home.less"],
          "components/imagediff/imagediff.css": ["components/imagediff/imagediff.less"],
          "components/repository/repository.css": ["components/repository/repository.less"],
          "components/staging/staging.css": ["components/staging/staging.less"],
          "components/stash/stash.css": ["components/stash/stash.less"],
          "components/refreshbutton/refreshbutton.css": ["components/refreshbutton/refreshbutton.less"],
        }
      }
    },
    watch: {
      scripts: {
        files: ['public/source/**/*.js', 'source/**/*.js', 'components/**/*.js'],
        tasks: ['browserify-common', 'browserify-components', 'babel:prod'],
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
      }
    },
    lineending: {
      // Debian won't accept bin files with the wrong line ending
      production: {
        options: {
          eol: 'lf'
        },
        files: {
          './bin/ungit': ['./bin/ungit'],
          './bin/credentials-helper': ['./bin/credentials-helper']
        }
      },
    },
    release: {
      options: {
        commitMessage: 'Release <%= version %>',
      }
    },
    // Run mocha tests
    mochaTest: {
      options: {
        reporter: 'spec'
      },
      src: 'test/*.js'
    },
    // Plato code analysis
    plato: {
      all: {
        files: {
          'report': ['source/**/*.js', 'public/source/**/*.js'],
        }
      },
    },

    // Minify images (basically just lossless compression)
    imagemin: {
      default: {
        options: {
          optimizationLevel: 3
        },
        files: [{
          expand: true,
          cwd: 'assets/client/images/',
          src: ['**/*.png'],
          dest: 'public/images/'
        }]
      }
    },

    // Embed images in css
    imageEmbed: {
      default: {
        files: {
          "public/css/styles.css": [ "public/css/styles.css" ],
          "components/graph/graph.css": ["components/graph/graph.css"],
          "components/header/header.css": ["components/header/header.css"],
          "components/staging/staging.css": ["components/staging/staging.css"],
        },
        options: {
          deleteAfterEncoding: false
        }
      }
    },
    jshint: {
      options: {
        undef: true, // check for usage of undefined variables
        indent: 2,
        '-W033': true, // ignore Missing semicolon
        '-W041': true, // ignore Use '===' to compare with '0'
        '-W065': true, // ignore Missing radix parameter
        '-W069': true, // ignore ['HEAD'] is better written in dot notation
      },
      web: {
        options: {
          node: true,
          browser: true,
          globals: {
            'ungit': true,
            'io': true,
            'keen': true,
            'Raven': true
          }
        },
        files: [
          {
            src: ['public/source/**/*.js', 'components/**/*.js'],
            // Filter out the "compiled" components files; see the browserify task for components
            filter: function(src) { return src.indexOf('bundle.js') == -1; }
          }
        ]
      },
      phantomjs: {
        options: {
          phantom: true,
          browser: true,
          globals: {
            '$': true,
            'module': true,
            'ungit': true
          }
        },
        src: ['clicktests/**/*.js']
      },
      node: {
        options: {
          node: true,
          esnext: true
        },
        src: ['source/**/*.js']
      },
      bin: {
        options: {
          node: true,
        },
        src: [
          'Gruntfile.js',
          'bin/*'
        ]
      },
      mocha: {
        options: {
          node: true,
          globals: {
            'it': true,
            'describe': true,
            'before': true,
            'after': true,
            'window': true,
            'document': true,
            'navigator': true
          }
        },
        src: [
          'test/**/*.js',
        ]
      }
    },
    copy: {
      main: {
        files: [
          // includes files within path
          { expand: true, flatten: true, src: ['node_modules/octicons/octicons/octicons.ttf'], dest: 'public/css/' },
          { expand: true, flatten: true, src: ['node_modules/octicons/octicons/octicons.woff'], dest: 'public/css/' }
        ]
      },
      electron: {
        files: [
          { expand: true, src: ['public/**'], dest: 'build/resource/' },
          { expand: true, src: ['src/**'], dest: 'build/resource/' },
          { expand: true, src: ['components/**'], dest: 'build/resource/' },
          { expand: true, src: ['assets/**'], dest: 'build/resource/' },
          { expand: true, src: ['node_modules/**'], dest: 'build/resource/' },
          { expand: true, src: ['package.json'], dest: 'build/resource/'}
        ]
      }
    },
    clean: {
      electron: ['./build'],
      coverage: ['./coverage'],
      'coverage-unit': ['./coverage/coverage-unit'],
      babel: ['./src']
    },
    electron: {
      package: {
        options: {
          name: 'ungit',
          dir: './build/resource',
          out: './build',
          icon: './icon.ico',
          version: '0.31.1',
          platform: 'all',
          arch: 'all',
          asar: true,
          prune: true,
          'version-string': {
            FileDescription : 'ungit',
            OriginalFilename : 'ungit.exe',
            FileVersion : '<%= version %>',
            ProductVersion : '<%= version %>',
            ProductName : 'ungit',
            InternalName : 'ungit.exe'
          }
        }
      }
    },
    mocha_istanbul: {
      unit: {
        src: './test',
        options: {
          coverageFolder: './coverage/coverage-unit',
          mask: 'spec.*.js'
        }
      }
    },
    babel: {
      prod: {
        options: {
          presets: ['es2015', 'stage-0']
        },
        files: [{
            expand: true,
            cwd: 'source',
            src: ['**/*.js'],
            dest: 'src',
            ext: '.js'
        }]
      },
      electron: {
        options: {
          presets: ['es2015', 'stage-0']
        },
        files: [{
            expand: true,
            cwd: 'source',
            src: ['**/*.js'],
            dest: 'src',
            ext: '.js'
        }]
      }
    }
  });

  grunt.registerTask('browserify-common', '', function() {
    var done = this.async();
    var b = browserify({
      noParse: ['public/vendor/js/superagent.js'],
      debug: true
    });
    b.add('./public/source/main.js');
    b.require('./public/source/main.js', { expose: 'ungit-main' });
    b.require('./public/source/components.js', { expose: 'ungit-components' });
    b.require('./public/source/program-events.js', { expose: 'ungit-program-events' });
    b.require('./public/source/navigation.js', { expose: 'ungit-navigation' });
    b.require('./public/source/main.js', { expose: 'ungit-main' });
    b.require('./source/address-parser.js', { expose: 'ungit-address-parser' });
    b.require('knockout', { expose: 'knockout' });
    b.require('lodash', { expose: 'lodash' });
    b.require('hasher', { expose: 'hasher' });
    b.require('crossroads', { expose: 'crossroads' });
    b.require('async', { expose: 'async' });
    b.require('moment', { expose: 'moment' });
    b.require('blueimp-md5', { expose: 'blueimp-md5' });
    b.require('color', { expose: 'color' });
    b.require('signals', { expose: 'signals' });
    b.require('util', { expose: 'util' });
    b.require('path', { expose: 'path' });
    b.require('diff2html', { expose: 'diff2html' });
    b.require('bluebird', { expose: 'bluebird' });
    b.require('just-detect-adblock', { expose: 'just-detect-adblock' });
    b.require('./node_modules/snapsvg/src/mina.js', { expose: 'mina' });
    var outFile = fs.createWriteStream('./public/js/ungit.js');
    outFile.on('close', function() {
      done();
    });
    b.bundle().pipe(outFile);
  });

  grunt.registerTask('browserify-components', '',  function() {
    Bluebird.each(fs.readdirSync('components'), function(component) {
      return new Bluebird(function(resolve, reject) {
        var b = browserify({
          bundleExternal: false,
          debug: true
        });
        var src = './components/' + component + '/' + component + '.js';
        if (!fs.existsSync(src)) {
          grunt.log.error(src + ' does not exist. If this component is obsolete, ' +
            'please remove that directory or perform a clean build.');
          return;
        }
        b.add(src);
        b.external(['ungit-components',
                'ungit-program-events',
                'ungit-navigation',
                'ungit-main',
                'ungit-address-parser',
                'knockout',
                'lodash',
                'hasher',
                'crossroads',
                'async',
                'moment',
                'blueimp-md5']);

        var outFile = fs.createWriteStream('./components/' + component + '/' + component + '.bundle.js');
        outFile.on('close', function() {
          resolve();
        });
        b.bundle().pipe(outFile);
      });
    }).then(this.async());
  });

  var getClickTestFiles = function() {
    return fs.readdirAsync('clicktests')
      .then(function(files) {
        return files.filter(function(file) {
          return file.startsWith("test.");
        });
      });
  }

  var clickExecute = function(file, onOut, onErr) {
    return new Bluebird(function(resolve, reject) {
      var child = childProcess.execFile(phantomjs.path, [path.join(__dirname, 'clicktests', file)], { maxBuffer: 10*1024*1024 });
      child.stdout.on('data', onOut);
      child.stderr.on('data', onErr);
      child.on('exit', function(code) {
        if (code == 0) resolve(file);
        else reject();
      });
    });
  }

  var running = 0;
  var maxConcurrency = 5;
  var acquireLock = function() {
    if (running < maxConcurrency) {
      running++;
      return Bluebird.resolve();
    }

    return new Bluebird(function(resolve, reject) {
      return Bluebird.resolve()
        .delay(1000)
        .then(acquireLock)
        .then(resolve)
    });
  }
  var releaseLock = function(result) {
    --running;
    return result;
  }

  grunt.registerTask('clicktest', 'Run clicktests.', function() {
    var done = this.async();
    grunt.log.writeln('Running clicktests...');

    getClickTestFiles().then(function(clickTestFiles) {
      var onOut = function(data) { grunt.log.write(data); }
      var onErr = function(data) { grunt.log.error(data); }
      var onFinish = function(file) {
        grunt.log.writeln(file + ' Clicktest success!');
        if (clickTestFiles.length > 0) return clickExecute(clickTestFiles.shift(), onOut, onErr).then(onFinish)
        else done(true);
      }

      clickExecute(clickTestFiles.shift(), onOut, onErr)
        .then(onFinish)
        .catch(done.bind(null, false))
    }).catch(done)
  });

  // This is purely for devs for faster churn of clicktest result
  // Each individual click test files will be excuted in it's own threads.
  // TODO: need to even out test loads of each tests and better spread clicktest loads.
  grunt.registerTask('clickParallel', 'Run clicktests in parallel for faster code dev churn.', function() {
    var done = this.async();

    getClickTestFiles().then(function(clickTestFiles) {
      grunt.log.writeln('Running click tests in parallel... (this will take a while...) \t');
      Bluebird.all(clickTestFiles.map(function(file) {
        var output = "";
        var outStream = function(data) { output += data; }
        return acquireLock().then(function() {
          grunt.log.writeln(cliColor.set('Clicktest started! \t' + file, 'blue'));
          return clickExecute(file, outStream, outStream)
            .then(function() {
              grunt.log.writeln(cliColor.set('Clicktest success! \t' + file, 'green'));
              return { name: file, output: output, isSuccess: true };
            }).catch(function() {
              grunt.log.writeln(cliColor.set('Clicktest fail! \t' + file, 'red'));
              return { name: file, output: output, isSuccess: false };
            });
          }).then(releaseLock);
      })).then(function(results) {
        var isSuccess = true;
        results.forEach(function(result) {
          if (!result.isSuccess) {
            grunt.log.writeln("---- start of " + result.name + " log ----")
            grunt.log.writeln(result.output);
            grunt.log.writeln("---- end of " + result.name + " log ----")
            isSuccess = false;
          }
        });
        done(isSuccess);
      });
    }).catch(done);
  });

  function bumpDependency(packageJson, packageName) {
    return new Bluebird(function(resolve, reject) {
      var dependencyType = packageJson['dependencies'][packageName] ? 'dependencies' : 'devDependencies'
      var currentVersion = packageJson[dependencyType][packageName];
      if (currentVersion[0] == '~' || currentVersion[0] == '^') currentVersion = currentVersion.slice(1);
      npm.commands.show([packageName, 'versions'], true, function(err, data) {
        if(err) reject(err);
        var versions = data[Object.keys(data)[0]].versions.filter(function(v) {
          return v.indexOf('alpha') == -1;
        });
        var latestVersion = versions[versions.length - 1];
        if (semver.gt(latestVersion, currentVersion)) {
          packageJson[dependencyType][packageName] = '~' + latestVersion;
        }
        resolve();
      });
    });
  }

  function getGitLastCommitHash(callback) {
    childProcess.exec("git rev-parse --short HEAD", function(err, stdout, stderr) {
      callback(stdout.trim());
    });
  }
  function updatePackageJsonBuildVersion(commitHash) {
    var packageJson = JSON.parse(fs.readFileSync('package.json'));
    packageJson.version += '+' + commitHash;
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
  }
  grunt.registerTask('travisnpmpublish', 'Automatically publish to NPM via travis.', function() {
    var done = this.async();
    if (process.env.TRAVIS_BRANCH != 'master' || (process.env.TRAVIS_PULL_REQUEST && process.env.TRAVIS_PULL_REQUEST != 'false')) {
      console.log('Skipping travis npm publish');
      return done();
    }
    getGitLastCommitHash(function(hash) {
      updatePackageJsonBuildVersion(hash);
      fs.writeFileSync('.npmrc', '//registry.npmjs.org/:_authToken=' + process.env.NPM_TOKEN);
      childProcess.exec("npm publish", function() { done(); });
    })
  });

  grunt.registerTask('bumpdependencies', 'Bump dependencies to their latest versions.', function() {
    var done = this.async();
    grunt.log.writeln('Bumping dependencies...');
    npm.load(function() {
      var tempPackageJson = JSON.parse(JSON.stringify(packageJson));
      var keys = Object.keys(tempPackageJson.dependencies).concat(Object.keys(tempPackageJson.devDependencies))

      var bumps = Bluebird.map(keys, function(dep) {
        if (dep == 'forever-monitor') return;
        // Superagent 1.x has a new api, need to upgrade to that if we want to bump
        if (dep == 'superagent') return
        // Octicon moved to SCSS instead of less
        if (dep == 'octicons') return;

        return bumpDependency(tempPackageJson, dep);
      });

      Bluebird.all(bumps).then(function() {
        fs.writeFileSync('package.json', JSON.stringify(tempPackageJson, null, 2) + '\n');
        grunt.log.writeln('Dependencies bumped, run npm install to install latest versions.');
      }).then(function() { done(); }).catch(done);
    });
  });

  grunt.registerMultiTask('electron', 'Package Electron apps', function () {
    electronPackager(this.options(), this.async());
  });

  grunt.event.on('coverage', function(lcovFileContents, done){
    // Check below on the section "The coverage event"
    console.log(lcovFileContents);
    console.log('\n\n=== html report: ./coverage/coverage-unit/lcove-report/index.html ===\n\n');
    done();
  });

  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-lineending');
  grunt.loadNpmTasks('grunt-release');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-plato');
  grunt.loadNpmTasks('grunt-contrib-imagemin');
  grunt.loadNpmTasks('grunt-image-embed');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-mocha-istanbul');
  grunt.loadNpmTasks('grunt-babel');

  // Default task, builds everything needed
  grunt.registerTask('default', ['clean:babel', 'less:production', 'jshint', 'babel:prod', 'browserify-common', 'browserify-components', 'lineending:production', 'imageEmbed:default', 'copy:main', 'imagemin:default']);

  // Run tests without compile (use watcher or manually build)
  grunt.registerTask('unittest', ['mochaTest']);
  grunt.registerTask('test', ['unittest', 'clicktest']);

  // Builds, and then creates a release (bump patch version, create a commit & tag, publish to npm)
  grunt.registerTask('publish', ['default', 'test', 'release:patch']);

  // Same as publish but for minor version
  grunt.registerTask('publishminor', ['default', 'test', 'release:minor']);

  // Create electron package
  grunt.registerTask('package', ['clean:electron', 'clean:babel', 'babel:electron', 'copy:electron', 'electron']);

  // run unit test coverage, assumes project is compiled
  grunt.registerTask('coverage-unit', ['clean:coverage-unit', 'mocha_istanbul:unit']);
};

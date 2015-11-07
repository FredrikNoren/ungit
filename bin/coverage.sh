node ./node_modules/istanbul/lib/cli.js cover --dir ${COVERAGE_DIR:-coverage} ./node_modules/.bin/_mocha -- --reporter tap --ui exports `find test -name "spec.*.js"`

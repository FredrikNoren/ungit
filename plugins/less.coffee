less = require 'less'

exports.settings =
  file_type: 'less'
  target: 'css'

exports.compile = (file, cb) ->
  options =
    filename: file.path
  
  less.render(file.contents, options, (e, css) ->
    console.log(e)
    cb(e, css)
  )


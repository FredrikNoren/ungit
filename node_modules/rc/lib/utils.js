var fs   = require('fs')
var ini  = require('ini')
var path = require('path')

var parse = exports.parse = function (content, file) {

  //if it ends in .json or starts with { then it must be json.
  //must be done this way, because ini accepts everything.
  //can't just try and parse it and let it throw if it's not ini.
  //everything is ini. even json with a systax error.

  if((file && /\.json$/.test(file)) || /^\s*{/.test(content)) 
    return JSON.parse(content)
  return ini.parse(content)

}

var json = exports.json = function () {
  var args = [].slice.call(arguments).filter(function (arg) { return arg != null })
  var file = path.join.apply(null, args)
  var content
  try {
    content = fs.readFileSync(file,'utf-8')
  } catch (err) {
    return
  }
  return parse(content)
}

var env = exports.env = function (prefix, env) {
  env = env || process.env
  var obj = {}
  var l = prefix.length
  for(var k in env) {
    if((i =k.indexOf(prefix)) === 0)
      obj[k.substring(l)] = env[k]
  }

  return obj
}

var find = exports.find = function () {
  var rel = path.join.apply(null, [].slice.call(arguments))

  function find(start, rel) {
    var file = path.join(start, rel)
    try {
      fs.statSync(file)
      return file
    } catch (err) {
      if(path.dirname(start) !== start) // root
        return find(path.dirname(start), rel)
    }
  }
  return find(process.cwd(), rel)
}


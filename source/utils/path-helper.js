var config = require('../config');
var util = require('util');

var PathHelper = {
  'getRestrictedDirectory': function()
  {
    var restrictToDirectory = config.restrictToDirectory;
    //ensure path to directory
    if (restrictToDirectory.substr(restrictToDirectory.length-1,1) != "/")
    {
      restrictToDirectory+="/";
    }
    return(restrictToDirectory);
  },
  'restrict': function(path)
  {
    if (config.restrictToDirectory)
    {
      var restrictToDirectory = PathHelper.getRestrictedDirectory();

      //restrict path if not allready done
      if (path.indexOf(restrictToDirectory) != 0)
      {
        //ensure path is relative
        if (path.substr(0,1) == "/")
        {
          path = path.substr(1);
        }
        path = restrictToDirectory+path;
      }
    }
    return(path);
  },
  'strip_restriction': function(filteredFiles)
  {
    if (config.restrictToDirectory)
    {
      var restrictToDirectory = PathHelper.getRestrictedDirectory();

      if (util.isArray(filteredFiles))
      {
        filteredFiles.forEach(function(path,index){
          if (path.indexOf(restrictToDirectory) == 0)
          {
            filteredFiles[index] = "/"+path.substr(restrictToDirectory.length);
          }
        });
      }
      else if (typeof filteredFiles == "string")
      {
        if (filteredFiles.indexOf(restrictToDirectory) == 0)
        {
          filteredFiles = "/"+filteredFiles.substr(restrictToDirectory.length);
        }
      }
    }
    return(filteredFiles);
  },
  'foo': 'bar'
};
module.exports = PathHelper;
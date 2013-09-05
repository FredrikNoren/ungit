
var addressWindowsLocalRegexp = /[a-zA-Z]:\\([^\\]+\\?)*/;
var addressSshWithPortRegexp = /ssh:\/\/(.*):(\d*)\/(.*)/;
var addressSshWithoutPortRegexp = /ssh:\/\/([^\/]*)\/(.*)/;
var addressGitWithoutPortWithUsernamePortRegexp = /([^@]*)@([^:]*):([^.]*)(\.git)?$/;
var addressGitWithoutPortWithoutUsernameRegexp = /([^:]*):([^.]*)(\.git)?$/;
var addressHttpsRegexp = /https:\/\/([^\/]*)\/(.*)/;
var addressUnixLocalRegexp = /.*\/([^\/]+)/;

exports.parseAddress = function(remote) {

  match = addressWindowsLocalRegexp.exec(remote);
  if (match) return { address: remote, host: 'localhost', project: match[1] };

  var match = addressSshWithPortRegexp.exec(remote);
  if (match) return { address: remote, host: match[1], port: match[2], project: match[3] };
  
  match = addressSshWithoutPortRegexp.exec(remote);
  if (match) return { address: remote, host: match[1], project: match[2] };
  
  match = addressGitWithoutPortWithUsernamePortRegexp.exec(remote);
  if (match) return { address: remote, username: match[1], host: match[2], project: match[3] };

  match = addressGitWithoutPortWithoutUsernameRegexp.exec(remote);
  if (match) return { address: remote, host: match[1], project: match[2] };

  match = addressHttpsRegexp.exec(remote);
  if (match) return { address: remote, host: match[1], project: match[2] };

  match = addressUnixLocalRegexp.exec(remote);
  if (match) return { address: remote, host: 'localhost', project: match[1] };

  return { address: remote };
}

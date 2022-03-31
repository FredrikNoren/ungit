'use strict';

// USED BY FRONT END
// DO NOT GO ES6
const addressWindowsLocalRegexp = /[a-zA-Z]:\\([^\\]+\\?)*/;
const addressSshWithPortRegexp = /ssh:\/\/(.*):(\d*)\/(.*)/;
const addressSshWithoutPortRegexp = /ssh:\/\/([^/]*)\/(.*)/;
const addressGitWithoutPortWithUsernamePortRegexp = /([^@]*)@([^:]*):([^.]*)(\.git)?$/;
const addressGitWithoutPortWithoutUsernameRegexp = /([^:]*):([^.]*)(\.git)?$/;
const addressHttpsRegexp = /https:\/\/([^/]*)\/([^.]*)(\.git)?$/;
const addressUnixLocalRegexp = /.*\/([^/]+)/;

/**
 * Show slashes in path parameter.
 *
 * @param {string} path
 */
exports.encodePath = (path) => encodeURIComponent(path).replace(/%2F/g, '/');

exports.parseAddress = (remote) => {
  let match = addressWindowsLocalRegexp.exec(remote);
  if (match) {
    let project = match[1];
    if (project[project.length - 1] == '\\') project = project.slice(0, project.length - 1);
    return { address: remote, host: 'localhost', project: project, shortProject: project };
  }

  match = addressSshWithPortRegexp.exec(remote);
  if (match)
    return {
      address: remote,
      host: match[1],
      port: match[2],
      project: match[3],
      shortProject: match[3].split('/').pop(),
    };

  match = addressSshWithoutPortRegexp.exec(remote);
  if (match)
    return {
      address: remote,
      host: match[1],
      project: match[2],
      shortProject: match[2].split('/').pop(),
    };

  match = addressGitWithoutPortWithUsernamePortRegexp.exec(remote);
  if (match)
    return {
      address: remote,
      username: match[1],
      host: match[2],
      project: match[3],
      shortProject: match[3].split('/').pop(),
    };

  match = addressGitWithoutPortWithoutUsernameRegexp.exec(remote);
  if (match)
    return {
      address: remote,
      host: match[1],
      project: match[2],
      shortProject: match[2].split('/').pop(),
    };

  match = addressHttpsRegexp.exec(remote);
  if (match)
    return {
      address: remote,
      host: match[1],
      project: match[2],
      shortProject: match[2].split('/').pop(),
    };

  match = addressUnixLocalRegexp.exec(remote);
  if (match)
    return { address: remote, host: 'localhost', project: match[1], shortProject: match[1] };

  return { address: remote };
};

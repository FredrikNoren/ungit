
var helpers = require('./helpers');
var Bluebird = require('bluebird');
var uiInteractions = {};

module.exports = uiInteractions;

uiInteractions.refAction = function(page, ref, local, action) {
  helpers.click(page, '[data-ta-clickable="branch"][data-ta-name="' + ref + '"][data-ta-local="' + local + '"]');
  helpers.mousemove(page, '[data-ta-action="' + action + '"][data-ta-visible="true"]');

  return Bluebird.resolve()
    .delay(200)
    .then(function() {
      helpers.click(page, '[data-ta-action="' + action + '"][data-ta-visible="true"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-action="' + action + '"][data-ta-visible="true"]');
    }).delay(500)
}

uiInteractions.createRef = function(page, name, type) {
  helpers.log('Createing branch ' + name);
  helpers.click(page, '[data-ta-clickable="show-new-branch-form"]');
  helpers.click(page, '[data-ta-input="new-branch-name"]');
  helpers.write(page, name);
  return Bluebird.resolve()
    .delay(100)
    .then(function() {
      helpers.click(page, '[data-ta-clickable="create-' + type + '"]');
      return helpers.waitForElementVisible(page, '[data-ta-clickable="' + type + '"][data-ta-name="' + name + '"]');
    }).delay(300);
}
uiInteractions.createBranch = function(page, name) {
  return uiInteractions.createRef(page, name, 'branch');
}
uiInteractions.createTag = function(page, name) {
  return uiInteractions.createRef(page, name, 'tag');
}

uiInteractions.moveRef = function(page, ref, targetNodeCommitTitle) {
  helpers.click(page, '[data-ta-clickable="branch"][data-ta-name="' + ref + '"]');
  return helpers.waitForElementVisible(page, '[data-ta-node-title="' + targetNodeCommitTitle + '"] [data-ta-action="move"][data-ta-visible="true"]')
    .then(function() {
      helpers.click(page, '[data-ta-node-title="' + targetNodeCommitTitle + '"] [data-ta-action="move"][data-ta-visible="true"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-action="move"][data-ta-visible="true"]')
    }).delay(500);
}

uiInteractions.commit = function(page, commitMessage) {
  return helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]')
    .then(function() {
      helpers.click(page, '[data-ta-input="staging-commit-title"]');
      helpers.write(page, commitMessage);
    }).delay(100)
    .then(function() {
      helpers.click(page, '[data-ta-clickable="commit"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]');
    }).delay(1000);
}

uiInteractions.amendCommit = function(page) {
  return helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]')
    .then(function() {
      helpers.click(page, '[data-bind="click: toggleAmend"]');
    }).delay(100)
    .then(function() {
      helpers.click(page, '[data-ta-clickable="commit"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]');
    }).then(1000);
}


uiInteractions.checkout = function(page, branch) {
  return helpers.waitForElementVisible(page, '[data-ta-clickable="branch"][data-ta-name="' + branch + '"]').then(function() {
    helpers.click(page, '[data-ta-clickable="branch"][data-ta-name="' + branch + '"]');
    helpers.click(page, '[data-ta-action="checkout"][data-ta-visible="true"]');
    return helpers.waitForElementVisible(page, '[data-ta-clickable="branch"][data-ta-name="' + branch + '"][data-ta-current="true"]');
  });
}

uiInteractions.patch = function(page, commitMessage) {
  return helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]').then(function() {
    helpers.click(page, '[data-ta-clickable="show-stage-diffs"]');
    return helpers.waitForElementVisible(page, '[data-ta-clickable="patch-file"]');
  }).then(function() {
    helpers.click(page, '[data-ta-clickable="patch-file"]');
    return helpers.waitForElementVisible(page, '[data-ta-clickable="patch-line-input"]');
  }).then(function() {
    return uiInteractions.commit(page, commitMessage);
  });
}

uiInteractions.open = function(page, url) {
  console.log("opening...", url)
  return new Bluebird(function(resolve) {
    page.open(url, function(res) { resolve(res); });
  });
}

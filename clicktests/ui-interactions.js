
var helpers = require('./helpers');

var uiInteractions = {};

module.exports = uiInteractions;

uiInteractions.refAction = function(page, ref, local, action, callback) {
  helpers.click(page, '[data-ta-clickable="branch"][data-ta-name="' + ref + '"][data-ta-local="' + local + '"]');
  helpers.mousemove(page, '[data-ta-action="' + action + '"][data-ta-visible="true"]');
  setTimeout(function() { // Wait for next animation frame
    helpers.click(page, '[data-ta-action="' + action + '"][data-ta-visible="true"]');
    helpers.waitForElementNotVisible(page, '[data-ta-action="' + action + '"][data-ta-visible="true"]', function() {
      setTimeout(function() {
        callback();
      }, 500);
    })
  }, 200);
}

uiInteractions.createRef = function(page, name, type, callback) {
  helpers.log('Createing branch ' + name);
  helpers.click(page, '[data-ta-clickable="show-new-branch-form"]');
  helpers.click(page, '[data-ta-input="new-branch-name"]');
  helpers.write(page, name);
  setTimeout(function() {
    helpers.click(page, '[data-ta-clickable="create-' + type + '"]');
    helpers.waitForElementVisible(page, '[data-ta-clickable="' + type + '"][data-ta-name="' + name + '"]', function() {
      callback();
    });
  }, 100);
}
uiInteractions.createBranch = function(page, name, callback) {
  uiInteractions.createRef(page, name, 'branch', callback);
}
uiInteractions.createTag = function(page, name, callback) {
  uiInteractions.createRef(page, name, 'tag', callback);
}


uiInteractions.moveRef = function(page, ref, targetNodeCommitTitle, callback) {
  helpers.click(page, '[data-ta-clickable="branch"][data-ta-name="' + ref + '"]');
  helpers.waitForElementVisible(page, '[data-ta-node-title="' + targetNodeCommitTitle + '"] [data-ta-action="move"][data-ta-visible="true"]', function() {
    helpers.click(page, '[data-ta-node-title="' + targetNodeCommitTitle + '"] [data-ta-action="move"][data-ta-visible="true"]');
    helpers.waitForElementNotVisible(page, '[data-ta-action="move"][data-ta-visible="true"]', function() {
      setTimeout(function() {
        callback();
      }, 500);
    });
  });
}


uiInteractions.commit = function(page, commitMessage, callback) {
  helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]', function() {
    helpers.click(page, '[data-ta-input="staging-commit-title"]');
    helpers.write(page, commitMessage);
    setTimeout(function() {
      helpers.click(page, '[data-ta-clickable="commit"]');
      helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]', function() {
        setTimeout(function() { // let the animation finish
          callback();
        }, 1000);
      });
    }, 100);
  });
}

uiInteractions.amendCommit = function(page, callback) {
  helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]', function() {
    helpers.click(page, '[data-bind="click: toggleAmend"]');
    setTimeout(function() {
      helpers.click(page, '[data-ta-clickable="commit"]');
      helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]', function() {
        setTimeout(function() { // let the animation finish
          callback();
        }, 1000);
      });
    }, 100);
  });
}


uiInteractions.checkout = function(page, branch, callback) {
  helpers.waitForElementVisible(page, '[data-ta-clickable="branch"][data-ta-name="' + branch + '"]', function() {
    helpers.click(page, '[data-ta-clickable="branch"][data-ta-name="' + branch + '"]');
    helpers.click(page, '[data-ta-action="checkout"][data-ta-visible="true"]');
    helpers.waitForElementVisible(page, '[data-ta-clickable="branch"][data-ta-name="' + branch + '"][data-ta-current="true"]', function() {
      callback();
    });
  });
}

uiInteractions.patch = function(page, commitMessage, callback) {
  helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]', function() {
    helpers.click(page, '[data-ta-clickable="show-stage-diffs"]');
    helpers.waitForElementVisible(page, '[data-ta-clickable="patch-file"]', function() {
      helpers.click(page, '[data-ta-clickable="patch-file"]');
      helpers.waitForElementVisible(page, '[data-ta-clickable="patch-line-input"]', function() {
        uiInteractions.commit(page, commitMessage, callback);
      });
    });
  });
}

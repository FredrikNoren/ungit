
// Can temporarily block a method from executing
var blockable = function(fn) {
  var blocks = 0;
  var pendingCall = null;
  var b = function() {
    if (blocks > 0) {
      if (!pendingCall)
        pendingCall = fn.bind(null, arguments);
    } else {
      fn.apply(null, arguments);
    }
  }
  b.block = function() {
    blocks++;
  }
  b.unblock = function() {
    blocks--;
    if (blocks == 0) {
      if (pendingCall) {
        pendingCall();
        pendingCall = null;
      }
    }
  }
  return b;
}
module.exports = blockable;
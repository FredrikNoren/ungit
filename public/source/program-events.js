
var signals = require('signals');

var programEvents = new signals.Signal();
module.exports = programEvents;

programEvents.add(function(event) {
  console.log('Event:', event);
});

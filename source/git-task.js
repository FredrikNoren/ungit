var signals = require('signals');

var GitTask = function() {
  var self = this;
  this._completed = false;
  this._started = false;
  this.onDone = new signals.Signal();
  this.onFail = new signals.Signal();
  this.onStarted = new signals.Signal();
  this.always = function(callback) {
    if (self._completed) callback(self.error, self.result);
    else {
      self.onDone.add(callback.bind(null, null));
      self.onFail.add(callback);
    }
    return self;
  }
  this.done = function(callback) {
    if (self._completed) {
      if (!self.error) callback(self.result);
    }
    else self.onDone.add(callback);
    return self;
  }
  this.fail = function(callback) {
    if (self._completed) {
      if (self.error) callback(self.error, self.result);
    }
    else self.onFail.add(callback);
    return self;
  }
  this.started = function(callback) {
    if (self._started) callback.call(this);
    else self.onStarted.add(callback.bind(this));
    return self;
  }
  this.setStarted = function() {
    self._started = true;
    self.onStarted.dispatch();
    return self;
  }
  this.start = function() {
    self.setStarted();
  }
  this.setResult = function(err, result) {
    self.error = err;
    self.result = result;
    self._completed = true;
    if (err)
      self.onFail.dispatch(err, result);
    else
      self.onDone.dispatch(result);
    return self;
  }
}

module.exports = GitTask;


var ko = require('knockout');

var ProgressBarViewModel = function(predictionMemoryKey, defaultTimeMs, showTime) {
  var self = this;
  if (defaultTimeMs === undefined) defaultTimeMs = 1000;
  if (showTime === undefined) showTime = 200;
  this.progress = ko.observable();
  this.running = ko.observable(false);
  this.predictionMemoryKey = 'predict-' + predictionMemoryKey;
  this.predictionMs = ko.observable();
  this.isFirstRun = ko.observable(false);
  this.defaultTimeMs = defaultTimeMs;
  this.elapsedMs = ko.observable(0);
  this.paused = ko.observable(false);
  this.show = ko.computed(function() {
    if (self.isFirstRun()) return self.elapsedMs() > showTime;
    else return self.predictionMs() > showTime;
  });
  this.style = ko.computed(function() {
    if (self.isFirstRun()) {
      if (self.elapsedMs() > showTime) return 'animated fadeIn';
      else return '';
    }
    else if (self.predictionMs() > showTime) return 'animated fadeIn';
  });
}
exports.ProgressBarViewModel = ProgressBarViewModel;
ProgressBarViewModel.prototype.start = function() {
  if (this.running()) return;
  this.running(true);
  this.progress(0);
  this.paused(false);
  this.elapsedMs(0);
  this.lastUpdate = Date.now();
  var predictionMs = localStorage.getItem(this.predictionMemoryKey);
  if (!predictionMs || isNaN(predictionMs)) {
    this.isFirstRun(true);
    predictionMs = this.defaultTimeMs;
  } else {
    predictionMs = parseInt(predictionMs);
  }
  this.predictionMs(predictionMs);
  this.update();
}
ProgressBarViewModel.prototype.update = function() {
  if (!this.running()) return;
  if (!this.paused()) {
    var time = Date.now();
    var delta = time - this.lastUpdate;
    this.lastUpdate = time;
    this.elapsedMs(this.elapsedMs() + delta);
    var value = this.elapsedMs() / this.predictionMs();
    value = Math.min(1, value);
    this.progress(value);
  }
  window.requestAnimationFrame(this.update.bind(this));
}
ProgressBarViewModel.prototype.pause = function() {
  this.paused(true);
}
ProgressBarViewModel.prototype.unpause = function() {
  this.paused(false);
  this.lastUpdate = Date.now();
}
ProgressBarViewModel.prototype.stop = function() {
  if (!this.running()) return;
  this.running(false);
  this.lastRealTime = this.elapsedMs();
  if (this.isFirstRun()) {
    this.isFirstRun(false);
    this.predictionMs(this.lastRealTime);
  } else {
    this.predictionMs(this.lastRealTime * 0.1 + this.predictionMs() * 0.9);
  }
  localStorage.setItem(this.predictionMemoryKey, this.predictionMs().toString());
}
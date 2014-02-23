
var ko = require('knockout');
var components = require('ungit-components');

components.register('progressBar', function(args) {
  return new ProgressBarViewModel(args.predictionMemoryKey, args.fallbackPredictedTimeMs, args.temporary);
});

var ProgressBarViewModel = function(predictionMemoryKey, fallbackPredictedTimeMs, temporary) {
  var self = this;
  if (fallbackPredictedTimeMs === undefined) fallbackPredictedTimeMs = 1000;
  this.temporary = temporary;
  this.style = ko.observable();
  this.running = ko.observable(false);
  self._width = ko.observable(0);
  self._opacity = ko.observable(1);
  self._widthSpeed = ko.observable(0);
  self._opacitySpeed = ko.observable(0);
  self._animationState = ko.observable('running');
  this.style = ko.computed(function() {
    return 'width: ' + self._width() + '%; ' + 
      'opacity: ' + self._opacity() + '; ' +
      '-webkit-transition: width ' + self._widthSpeed() + 'ms, opacity ' + self._opacitySpeed() + 'ms;' +
      'transition: width ' + self._widthSpeed() + 'ms, opacity ' + self._opacitySpeed() + 'ms; ' +
      'animation-play-state: ' + self._animationState();
  });
  this.predictionMemoryKey = 'predict-' + predictionMemoryKey;
  this.isFirstRun = ko.observable(false);
  this.fallbackPredictedTimeMs = fallbackPredictedTimeMs;
}
ProgressBarViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate(this.temporary ? 'temporaryProgressBar' : 'progressBar', this, {}, parentElement);
}
ProgressBarViewModel.prototype.start = function() {
  if (this.running()) return;
  var self = this;
  var predictionMs = localStorage.getItem(this.predictionMemoryKey);
  if (!predictionMs || isNaN(predictionMs)) {
    this.isFirstRun(true);
    predictionMs = this.fallbackPredictedTimeMs;
  } else {
    predictionMs = parseInt(predictionMs);
  }
  this.predictionMs = predictionMs;
  this._width(0);
  this._opacity(1);
  this._opacitySpeed(0);
  this._widthSpeed(0);
  this._animationState('running');
  this.running(true);
  this.startMs = Date.now();
  this.pausedMs = 0;
  setTimeout(function(){
    predictionMs = Math.max(500, predictionMs);
    self._width(80);
    self._widthSpeed(predictionMs);
  }, 1);
}

ProgressBarViewModel.prototype.pause = function() {
  this._animationState('paused');
  this.pauseStartMs = Date.now();
}
ProgressBarViewModel.prototype.unpause = function() {
  this._animationState('running');
  this.pausedMs += Date.now() - this.pauseStartMs;
}
ProgressBarViewModel.prototype.stop = function() {
  var self = this;
  var elapsedMs = Date.now() - this.startMs - this.pausedMs;
  var newPrediction;
  if (self.isFirstRun()) {
    self.isFirstRun(false);
    newPrediction = elapsedMs;
  } else {
    newPrediction = elapsedMs * 0.1 + self.predictionMs * 0.9;
  }
  localStorage.setItem(self.predictionMemoryKey, newPrediction.toString());

  self._width(100);
  self._widthSpeed(300);
  setTimeout(function() {
    self._opacity(0);
    self._opacitySpeed(300);
    setTimeout(function() {
      self.running(false);
    }, 310);
  }, 400);
}

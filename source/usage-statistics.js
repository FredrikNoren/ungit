
var config = require('./config');
var cache = require('./utils/cache');
var sysinfo = require('./sysinfo');
var getmac = require('getmac');
var async = require('async');
var winston = require('winston');

function UsageStatistics() {
  if (!config.sendUsageStatistics) return;
  this.keen = require('keen.io').configure({
    projectId: '5240b1d436bf5a753800000c',
    writeKey: 'da0303fb058149813443f1321a139f23420323887b6a4940e82d47d02df451a4a132b938d2e8200a17914e06aa2767dc1a6fa0891db41942918db91a8daa61784d7af2495b934a05111605e4aa4e5c3d92b0b7f8be4d146e05586701894dc35d619443ae234dbc608a36de9ee97e0e1a'
  });

  this.getDefaultData = cache(function(callback) {
    async.parallel({
      userHash: sysinfo.getUserHash.bind(sysinfo),
      version: sysinfo.getUngitVersion.bind(sysinfo)
    }, function(err, data) {
      callback(err, data);
    });
  });

}

UsageStatistics.prototype._mergeDataWithDefaultData = function(data, callback) {
  this.getDefaultData(function(err, defaultData) {
    data = data || {};
    for(var k in defaultData)
      data[k] = defaultData[k];
    callback(data);
  });
}

UsageStatistics.prototype.addEvent = function(event, data, callback) {
  if (!config.sendUsageStatistics) return;
  var self = this;
  this._mergeDataWithDefaultData(data, function(data) {
    winston.info('Sending to keen.io: ' + event + ' ' + JSON.stringify(data));
    self.keen.addEvent(event, data, callback);  
  });
}

module.exports = new UsageStatistics();
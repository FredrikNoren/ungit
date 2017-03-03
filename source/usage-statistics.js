const config = require('./config');
const cache = require('./utils/cache');
const sysinfo = require('./sysinfo');
const getmac = require('getmac');
const winston = require('winston');
const keenio = require('keen.io');
const Bluebird = require('bluebird');

const _PROJECT_ID = '5240b1d436bf5a753800000c';
const _WRITE_KEY = 'da0303fb058149813443f1321a139f23420323887b6a4940e82d47d02df451a4a132b938d2e8200a17914e06aa2767dc1a6fa0891db41942918db91a8daa61784d7af2495b934a05111605e4aa4e5c3d92b0b7f8be4d146e05586701894dc35d619443ae234dbc608a36de9ee97e0e1a';

class UsageStatistics {
  constructor() {
    if (!config.sendUsageStatistics) return;
    this.keen = keenio.configure({ projectId: _PROJECT_ID, writeKey: _WRITE_KEY });
    this.getDefaultDataKey = cache.registerFunc(() => {
      return sysinfo.getUserHash().then((hash) => {
          return { version: config.ungitDevVersion, userHash: hash };
        });
    });
  }

  _mergeDataWithDefaultData(data) {
    return new Bluebird((resolve, reject) => {
      cache.resolveFunc(this.getDefaultDataKey).then((defaultData) => {
        data = data || {};
        for(const k in defaultData) {
          data[k] = defaultData[k];
        }
        resolve(data);
      });
    });
  }

  addEvent(event, data, callback) {
    if (!config.sendUsageStatistics) return;
    return this._mergeDataWithDefaultData(data).then((data) => {
      winston.info(`Sending to keen.io: event ${JSON.stringify(data)}`);
      return new Bluebird((resolve, reject) => {
        this.keen.addEvent(event, data, (err, result) => {
          if (err) {
            reject(err)
          } else {
            resolve(result)
          }
        });
      })
    });
  }
}

module.exports = new UsageStatistics();

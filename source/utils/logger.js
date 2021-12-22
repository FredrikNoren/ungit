const winston = require('winston');
const path = require('path');
const config = require('../config');

const transports = [new winston.transports.Console()];
if (config.logDirectory) {
  console.log('Added log file at ' + config.logLevel);
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logDirectory, 'server.log'),
      maxsize: 100 * 1024,
      maxFiles: 2,
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    })
  );
}

console.log('Setting log level to ' + config.logLevel);
const logger = winston.createLogger({
  level: config.logLevel || 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf((info) => {
      const splat = info[Symbol.for('splat')];
      if (splat) {
        const splatStr = splat.map((arg) => JSON.stringify(arg)).join('\n');
        return `${info.timestamp} - ${info.level}: ${info.message} ${splatStr}`;
      }
      return `${info.timestamp} - ${info.level}: ${info.message}`;
    })
  ),
  transports: transports,
});

module.exports = logger;

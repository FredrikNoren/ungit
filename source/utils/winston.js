const winston = require('winston');

const consoleTransport = winston.default.transports.find((transport) => {
  return transport instanceof winston.transports.Console;
});
if (!consoleTransport) {
  winston.add(new winston.transports.Console({
    level: "error",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.colorize(),
      winston.format.printf((info) => {
        const splat = info[Symbol.for("splat")];
        if (splat) {
          const splatStr = splat.map((arg) => JSON.stringify(arg)).join("\n");
          return `${info.timestamp} - ${info.level}: ${info.message} ${splatStr}`;
        }
        return `${info.timestamp} - ${info.level}: ${info.message}`;
      })
    )
  }));
}

module.exports = winston;
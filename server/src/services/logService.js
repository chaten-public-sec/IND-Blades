const crypto = require('crypto');
const { LOGS_PATH } = require('../config/env');
const { readJson, writeJson } = require('../utils/files');

class LogService {
  ensure() {
    const current = readJson(LOGS_PATH, []);
    if (!Array.isArray(current)) {
      writeJson(LOGS_PATH, []);
    }
  }

  getLogs() {
    const logs = readJson(LOGS_PATH, []);
    return Array.isArray(logs) ? logs : [];
  }

  appendLog(message, level = 'info', source = 'server', meta = {}) {
    const logs = this.getLogs();
    logs.unshift({
      id: crypto.randomUUID(),
      message: String(message),
      level,
      source,
      meta,
      timestamp: new Date().toISOString()
    });
    writeJson(LOGS_PATH, logs.slice(0, 500));
  }

  clearLogs() {
    writeJson(LOGS_PATH, []);
  }
}

module.exports = {
  LogService
};

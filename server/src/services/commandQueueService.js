const crypto = require('crypto');
const { COMMANDS_PATH } = require('../config/env');
const { readJson, writeJson } = require('../utils/files');

class CommandQueueService {
  ensure() {
    const current = readJson(COMMANDS_PATH, []);
    if (!Array.isArray(current)) {
      writeJson(COMMANDS_PATH, []);
    }
  }

  getCommands() {
    const commands = readJson(COMMANDS_PATH, []);
    return Array.isArray(commands) ? commands : [];
  }

  enqueueCommand(type, payload = {}) {
    const commands = this.getCommands();
    const command = {
      id: crypto.randomUUID(),
      type,
      payload,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    commands.push(command);
    writeJson(COMMANDS_PATH, commands.slice(-100));
    return command;
  }
}

module.exports = {
  CommandQueueService
};

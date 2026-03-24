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
    const maxAttempts = Number(payload.max_attempts || 5);
    const command = {
      id: crypto.randomUUID(),
      type,
      payload,
      status: 'pending',
      attempts: 0,
      max_attempts: Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 5,
      available_at: new Date().toISOString(),
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

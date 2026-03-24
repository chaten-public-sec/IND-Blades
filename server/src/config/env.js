const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SERVER_DATA_DIR = path.join(ROOT_DIR, 'server', 'data');
const REMINDERS_PATH = path.join(DATA_DIR, 'reminders.json');
const LOGS_PATH = path.join(DATA_DIR, 'logs.json');
const COMMANDS_PATH = path.join(DATA_DIR, 'commands.json');
const LEGACY_WELCOME_PATH = path.join(ROOT_DIR, 'welcome.json');
const APP_STATE_PATH = path.join(DATA_DIR, 'app-state.json');
const ENV_PATH = path.join(ROOT_DIR, '.env');

function parseEnvFile() {
  const values = {};

  try {
    const raw = fs.readFileSync(ENV_PATH, 'utf8');

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/);
      if (!match) {
        continue;
      }

      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      values[match[1]] = value;
    }
  } catch {}

  return values;
}

const fileEnv = parseEnvFile();

function getEnv(name, fallback = '') {
  if (process.env[name] !== undefined) {
    return process.env[name];
  }
  if (fileEnv[name] !== undefined) {
    return fileEnv[name];
  }
  return fallback;
}

function getListEnv(name) {
  return String(getEnv(name, ''))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getNumberEnv(name, fallback = 0) {
  const value = Number(getEnv(name, fallback));
  return Number.isFinite(value) ? value : fallback;
}

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  SERVER_DATA_DIR,
  REMINDERS_PATH,
  LOGS_PATH,
  COMMANDS_PATH,
  LEGACY_WELCOME_PATH,
  APP_STATE_PATH,
  ENV_PATH,
  getEnv,
  getListEnv,
  getNumberEnv
};

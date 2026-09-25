const fs = require('node:fs');
const path = require('node:path');

// Project-specific context stays out of the public repository: everything in private/ except its README is gitignored.
const PRIVATE_DIR = path.resolve(__dirname, '..', 'private');

function privateConfig(dir = PRIVATE_DIR) {
  const file = path.join(dir, 'config.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

function privateNotes(dir = PRIVATE_DIR) {
  if (!fs.existsSync(dir)) return '';
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort()
    .map((name) => fs.readFileSync(path.join(dir, name), 'utf8').trim())
    .join('\n\n');
}

module.exports = { privateConfig, privateNotes };

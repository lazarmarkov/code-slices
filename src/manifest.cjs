const fs = require('node:fs');
const path = require('node:path');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

// Reads a report manifest. Source snapshots and referenced JSON files resolve relative to it.
function loadManifest(manifestFile) {
  const manifestPath = path.resolve(manifestFile);
  const directory = path.dirname(manifestPath);
  const manifest = readJson(manifestPath);

  function sourcePath(revision, file) {
    const root = path.resolve(directory, manifest.sources[revision]);
    const target = path.resolve(root, file);
    if (!target.startsWith(`${root}${path.sep}`)) throw new Error(`Source path escapes snapshot: ${file}`);
    return target;
  }

  function readSource(revision, file) {
    const target = sourcePath(revision, file);
    return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  }

  // Each entry is an inline object or a JSON file path. Either may hold one item or { [key]: [...] }.
  function loadEntries(entries, key) {
    return (entries || []).flatMap((entry) => {
      const value = typeof entry === 'string' ? readJson(path.resolve(directory, entry)) : entry;
      return value[key] || [value];
    });
  }

  return { manifest, sourcePath, readSource, loadEntries };
}

function writeReport(outputFile, html) {
  const output = path.resolve(outputFile);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, html);
  return output;
}

module.exports = { loadManifest, writeReport };

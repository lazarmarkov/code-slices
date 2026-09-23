// Tests, evals, fixtures and helpers never reach a report, a packet or a coverage count.
const excludedPathPattern =
  /(^|\/)(tests?|__tests__|evals?|__fixtures__|fixtures|helpers|test-helpers)(\/|$)|\.(test|spec|eval)\.|testHelpers/i;

const isExcludedPath = (file) => excludedPathPattern.test(file);

module.exports = { isExcludedPath };

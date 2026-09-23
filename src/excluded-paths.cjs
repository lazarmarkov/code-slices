// Tests, evals and fixtures never reach a report, a packet or a coverage count.
const testPathPattern = /(^|\/)(tests?|__tests__|evals?|__fixtures__|fixtures)(\/|$)|\.(test|spec|eval)\.|testHelpers/i;
// PR mode and PR preparation also leave out helper directories.
const helperPathPattern = /(^|\/)(helpers|test-helpers)(\/|$)/i;

const isTestPath = (file) => testPathPattern.test(file);
const isExcludedPrPath = (file) => isTestPath(file) || helperPathPattern.test(file);

module.exports = { isExcludedPrPath, isTestPath };

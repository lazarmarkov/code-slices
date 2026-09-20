const isExcludedReviewPath = (file) =>
  /(^|\/)(tests?|__tests__|evals?|__fixtures__|fixtures|helpers|test-helpers)(\/|$)|\.(test|spec|eval)\.|testHelpers/i.test(
    file,
  );

module.exports = { isExcludedReviewPath };

module.exports = {
  overrides: [
    {
      files: ['hrCoreExpansionService.ts'],
      rules: {
        // These values are deliberately kept as mutable import-resolution slots:
        // later resolver extensions may stamp scoped IDs before validation.
        'prefer-const': 'off',
      },
    },
  ],
}

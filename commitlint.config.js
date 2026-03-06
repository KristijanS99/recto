export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['api', 'mcp', 'web', 'root']],
    'scope-empty': [1, 'never'],
  },
};

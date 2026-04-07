import { n8nCommunityNodesPlugin } from '@n8n/eslint-plugin-community-nodes';

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  n8nCommunityNodesPlugin.configs.recommended,
  {
    rules: {
      '@n8n/community-nodes/node-param-description-missing-for-return-type': 'off',
    },
  },
];
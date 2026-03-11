import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://kristijans99.github.io',
  base: '/recto',
  integrations: [
    starlight({
      title: 'Recto',
      logo: {
        src: './src/assets/logo.png',
      },
      components: {
        ThemeProvider: './src/components/ThemeProvider.astro',
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/KristijanS99/recto',
        },
      ],
      customCss: ['./src/styles/global.css'],
      sidebar: [
        {
          label: 'Documentation',
          items: [
            { label: 'Getting Started', slug: 'getting-started' },
            { label: 'Configuration', slug: 'configuration' },
            { label: 'Deployment', slug: 'deployment' },
            { label: 'MCP Setup', slug: 'mcp-setup' },
            { label: 'Instructions & Prompts', slug: 'instructions-and-prompts' },
            { label: 'Troubleshooting', slug: 'troubleshooting' },
          ],
        },
      ],
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});

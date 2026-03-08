import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	site: "https://kristijans99.github.io",
	base: "/recto",
	integrations: [
		starlight({
			title: "Recto",
			logo: {
				src: "./src/assets/logo.png",
			},
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/KristijanS99/recto",
				},
			],
			customCss: ["./src/styles/global.css"],
			sidebar: [
				{
					label: "Documentation",
					items: [
						{ label: "Getting Started", slug: "getting-started" },
						{ label: "Configuration", slug: "configuration" },
						{ label: "MCP Setup", slug: "mcp-setup" },
					],
				},
			],
		}),
	],
	vite: { plugins: [tailwindcss()] },
});

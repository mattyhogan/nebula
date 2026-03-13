import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		proxy: {
			'/nero': {
				target: process.env.NERO_URL || 'http://localhost:4848',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/nero/, '/api'),
				secure: false
			},
			'/gcal': {
				target: process.env.GCAL_URL || 'http://localhost:4860',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/gcal/, ''),
				secure: false
			},
			'/spotify': {
				target: process.env.SPOTIFY_URL || 'http://localhost:4870',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/spotify/, ''),
				secure: false
			}
		}
	}
});

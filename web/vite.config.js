import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
	base: './',
	server: {
		port: 5174,
		strictPort: true,
	},
	build: {
		outDir: 'build',
		// One file each — NUI loads from disk, so splitting only adds requests.
		assetsInlineLimit: 0,
		chunkSizeWarningLimit: 1500,
	},
});

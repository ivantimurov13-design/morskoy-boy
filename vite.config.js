import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], base: process.env.VITE_BASE_PATH || '/', build: { outDir: process.env.VITE_BUILD_DIR || 'dist' } });

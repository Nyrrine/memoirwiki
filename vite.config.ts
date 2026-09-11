import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-slate': ['slate', 'slate-react', 'slate-history'],
                    'vendor-supabase': ['@supabase/supabase-js'],
                },
            },
        },
    },
});

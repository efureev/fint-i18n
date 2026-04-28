import process from 'node:process'
import {fileURLToPath, URL} from 'node:url'
import {defineConfig, loadEnv, type PluginOption} from 'vite'
import vue from '@vitejs/plugin-vue'
import {visualizer} from 'rollup-plugin-visualizer'
import {codecovVitePlugin} from "@codecov/vite-plugin";

export default defineConfig(({mode}) => {
    const env = loadEnv(mode, process.cwd(), '')
    const isAnalyze = env.ANALYZE === 'true' || process.env.ANALYZE === 'true'
    const codecovToken = env.CODECOV_TOKEN || process.env.CODECOV_TOKEN

    return {
        plugins: [
            vue(),
            ...(isAnalyze
                ? [
                    visualizer({
                        emitFile: true,
                        filename: 'analysis/stats.html',
                        title: '@feugene/fint-i18n bundle report',
                        template: 'treemap',
                        gzipSize: true,
                        brotliSize: true,
                        projectRoot: fileURLToPath(new URL('./', import.meta.url)),
                    }) as PluginOption,
                    visualizer({
                        emitFile: true,
                        filename: 'analysis/stats.json',
                        template: 'raw-data',
                        projectRoot: fileURLToPath(new URL('./', import.meta.url)),
                    }) as PluginOption,
                    visualizer({
                        emitFile: true,
                        filename: 'analysis/stats.md',
                        title: '@feugene/fint-i18n bundle report',
                        template: 'markdown',
                        gzipSize: true,
                        brotliSize: true,
                        projectRoot: fileURLToPath(new URL('./', import.meta.url)),
                    }) as PluginOption,
                ]
                : []),
            codecovVitePlugin({
                enableBundleAnalysis: Boolean(codecovToken),
                bundleName: "@feugene/fint-i18n",
                uploadToken: codecovToken,
            }),
        ],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
            },
        },
        build: {
            target: 'esnext',
            minify: 'oxc',
            lib: {
                entry: {
                    index: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
                    core: fileURLToPath(new URL('./src/core/index.ts', import.meta.url)),
                    vue: fileURLToPath(new URL('./src/vue/index.ts', import.meta.url)),
                    plugins: fileURLToPath(new URL('./src/plugins/index.ts', import.meta.url)),
                },
                formats: ['es'],
            },
            rolldownOptions: {
                external: [
                    'vue',
                ],
                output: {
                    entryFileNames: '[name].js',
                    chunkFileNames: 'chunks/[name]-[hash].js',
                },
            },
        },
    }
})

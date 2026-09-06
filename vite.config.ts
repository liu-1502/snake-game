import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


// Figma Make emits imports with a version suffix (e.g. "@radix-ui/react-slot@1.1.2").
// Strip the suffix so the packages resolve from node_modules.
function versionedImportResolver() {
  const versioned = /^(@[^/@]+\/[^/@]+|[^@][^/@]*)@\d[^/]*(\/.*)?$/
  return {
    name: 'versioned-import-resolver',
    enforce: 'pre' as const,
    async resolveId(id: string, importer: string | undefined) {
      const m = versioned.exec(id)
      if (!m) return
      const resolved = await this.resolve(m[1] + (m[2] || ''), importer, { skipSelf: true })
      return resolved?.id
    },
  }
}

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    versionedImportResolver(),
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/app'),
    },
  },
})

import type { Plugin } from 'vite';
import type { OutputBundle, NormalizedOutputOptions } from 'rollup';
import sharp from 'sharp';

export interface WebpOptions {
  quality?: number;
  alphaQuality?: number;
  smartSubsample?: boolean;
}

export default function webpPlugin(userOpts: WebpOptions = {}): Plugin {
  const defaults: Required<WebpOptions> = {
    quality: 88,
    alphaQuality: 90,
    smartSubsample: true,
  };

  const opts = { ...defaults, ...userOpts };

  const rasterExtRE = /\.(png|jpe?g)$/i;
  const textExts = ['.html', '.css', '.js', '.mjs', '.ts'];

  return {
    name: 'webp-transform',
    apply: 'build',
    enforce: 'post',

    async generateBundle(_options: NormalizedOutputOptions, bundle: OutputBundle): Promise<void> {
      const renameMap = new Map<string, string>();

      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type !== 'asset' || !rasterExtRE.test(fileName)) continue;

        const newName = fileName.replace(rasterExtRE, '.webp');

        if (bundle[newName]) continue;

        const inputBuffer: Buffer =
          typeof asset.source === 'string' ? Buffer.from(asset.source) : Buffer.from(asset.source);

        const webpBuffer: Buffer = await sharp(inputBuffer).webp(opts).toBuffer();

        this.emitFile({ type: 'asset', fileName: newName, source: webpBuffer });

        renameMap.set(fileName, newName);

        delete bundle[fileName];
      }

      if (renameMap.size === 0) return;

      for (const asset of Object.values(bundle)) {
        if (asset.type !== 'asset') continue;
        if (!textExts.some((ext) => asset.fileName.endsWith(ext))) continue;

        let code = asset.source.toString();

        for (const [oldName, newName] of renameMap) {
          const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

          code = code.replace(new RegExp(`([./]*)${escaped}`, 'g'), (_m, p1) => `${p1}${newName}`);
        }

        asset.source = code;
      }
    },
  };
}

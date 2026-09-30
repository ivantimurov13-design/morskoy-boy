import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
await mkdir('public/icons', { recursive: true });
await sharp('docs/ocean-original.png').webp({ quality: 88 }).toFile('public/assets/ocean.webp');
for (const [name,size] of [['icon-192',192],['icon-512',512],['maskable-512',512],['apple-touch-icon',180]]) await sharp('public/icon.svg').resize(size,size).png().toFile(`public/icons/${name}.png`);
console.log('Local artwork and app icons ready');

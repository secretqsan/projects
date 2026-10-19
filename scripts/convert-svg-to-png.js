import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import toIco from 'to-ico';

// usage: node convert-svg-to-png.js <svg-file>
const svgPath = process.argv[2];

const outputDir = process.cwd();

const icoSizes = [128, 256];

async function convertSVGToICO() {
  const svgBuffer = fs.readFileSync(svgPath);
  const pngBuffers = [];

  for (const size of icoSizes) {
    const pngBuffer = await sharp(svgBuffer, { density: 600 })
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: sharp.kernel.lanczos3
      })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    pngBuffers.push(pngBuffer);
  }

  const icoBuffer = await toIco(pngBuffers);
  fs.writeFileSync(path.join(outputDir, 'icon.ico'), icoBuffer);
  console.log('Generated icon.ico');
}

convertSVGToICO().catch(console.error);

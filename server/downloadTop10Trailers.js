import { Ytdl } from '@distube/ytdl-core';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRAILERS = [
  { id: 'JwaruTPKq9I', title: 'Saga of Tanya the Evil' },
  { id: 'ax5YUmkWf_Y', title: 'Cyberpunk: Edgerunners' },
  { id: 'd6kBeJjTGnY', title: 'Hunter x Hunter' },
  { id: 'v4yLeNt-kCU', title: 'Chainsaw Man' },
  { id: 'tR8YH0G67Rk', title: 'Frieren: Beyond Journeys End' },
  { id: 'IwpJJiQkZzI', title: 'Kaguya-sama: Love Is War' },
  { id: 'RIyb52EMx8c', title: 'Jujutsu Kaisen' },
  { id: 'LHtdKWJdif4', title: 'Attack on Titan' },
  { id: 'HkIKAnwLZCw', title: 'Solo Leveling' },
  { id: '6vMuWuWlW4I', title: 'Demon Slayer' }
];

const outDir = path.resolve(__dirname, 'data/trailers');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function processTrailer(item) {
  const outFile = path.join(outDir, `${item.id}.mp4`);
  if (fs.existsSync(outFile) && fs.statSync(outFile).size > 1024 * 1024) {
    console.log(`[Cache hit] ${item.title} (${item.id}.mp4 already exists)`);
    return;
  }

  console.log(`[Downloading] ${item.title} (${item.id})...`);
  const ytdl = new Ytdl();
  
  try {
    const info = await ytdl.getInfo(item.id);
    
    // Select best mp4 video (1080p or 720p)
    const videoFormats = info.formats
      .filter(f => f.hasVideo && !f.hasAudio && (f.container === 'mp4' || f.mimeType?.includes('video/mp4')))
      .sort((a, b) => (b.height || 0) - (a.height || 0));
    
    let bestVideo = videoFormats[0];
    if (!bestVideo) {
      bestVideo = info.formats
        .filter(f => f.hasVideo)
        .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
    }

    // Select best audio
    const audioFormats = info.formats
      .filter(f => f.hasAudio && !f.hasVideo)
      .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
    const bestAudio = audioFormats[0];

    if (!bestVideo?.url || !bestAudio?.url) {
      console.warn(`[Skip] Missing stream URL for ${item.id}`);
      return;
    }

    console.log(`  -> Video: ${bestVideo.qualityLabel || bestVideo.height + 'p'}, Audio: ${bestAudio.audioBitrate}kbps`);

    const tempFile = path.join(outDir, `${item.id}.tmp.mp4`);

    await new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-y',
        '-ss', '0',
        '-t', '50',
        '-i', bestVideo.url,
        '-ss', '0',
        '-t', '50',
        '-i', bestAudio.url,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        tempFile
      ];

      const proc = spawn('ffmpeg', ffmpegArgs);
      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(tempFile)) {
          fs.renameSync(tempFile, outFile);
          const sizeMb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(2);
          console.log(`  -> Done: ${item.title} (${sizeMb} MB)`);
          resolve();
        } else {
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
      proc.on('error', reject);
    });
  } catch (err) {
    console.error(`  -> Failed for ${item.title}:`, err.message);
  }
}

async function run() {
  console.log(`Starting download of Top 10 trailers...`);
  for (const item of TRAILERS) {
    await processTrailer(item);
  }
  console.log('All Top 10 trailers processed!');
}

run();

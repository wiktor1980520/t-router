import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(__dirname, '../build_info.json');

try {
  let config = { build: 0, timestamp: '' };
  
  if (fs.existsSync(configPath)) {
    const data = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(data);
  }

  config.build = (config.build || 0) + 1;
  config.timestamp = new Date().toISOString();

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  console.log(`Updated build number to ${config.build}`);
} catch (error) {
  console.error('Error updating build version:', error);
  process.exit(1);
}
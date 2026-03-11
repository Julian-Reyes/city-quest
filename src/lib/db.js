const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const CHECKINS_FILE = path.join(DATA_DIR, 'checkins.json');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function readCheckins() {
  ensureDataDir();
  if (!fs.existsSync(CHECKINS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(CHECKINS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeCheckins(checkins) {
  ensureDataDir();
  fs.writeFileSync(CHECKINS_FILE, JSON.stringify(checkins, null, 2), 'utf-8');
}

function addCheckin(checkin) {
  const checkins = readCheckins();
  checkins.push(checkin);
  writeCheckins(checkins);
  return checkin;
}

module.exports = { readCheckins, writeCheckins, addCheckin };

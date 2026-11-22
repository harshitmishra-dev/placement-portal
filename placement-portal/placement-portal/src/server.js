// Plain Node.js server (no external dependencies) - serves the UI and a small REST API.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { matchSkills, normalize } = require('./match');
const internships = require('./internships');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const STATUSES = ['Applied', 'Shortlisted', 'Interview', 'Offer', 'Rejected'];

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function loadDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { profile: { name: '', email: '', branch: '', skills: [], resume: null }, applications: [] }; }
}
function saveDb(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 8e6) { reject(new Error('Too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
  });
}

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.ico': 'image/x-icon' };

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const db = loadDb();

  if (p === '/health') return send(res, 200, { status: 'ok' });

  if (p === '/api/profile' && req.method === 'GET') return send(res, 200, db.profile);
  if (p === '/api/profile' && req.method === 'PUT') {
    const b = await readBody(req);
    if (!b.name || !/^\S+@\S+\.\S+$/.test(b.email || '')) return send(res, 400, { error: 'Name and a valid email are required' });
    db.profile = { ...db.profile, name: b.name.trim(), email: b.email.trim(), branch: (b.branch || '').trim(), skills: normalize(b.skills) };
    saveDb(db);
    return send(res, 200, db.profile);
  }

  if (p === '/api/resume' && req.method === 'POST') {
    const b = await readBody(req);
    const ext = path.extname(b.filename || '').toLowerCase();
    if (!['.pdf', '.doc', '.docx'].includes(ext) || !b.data) return send(res, 400, { error: 'Upload a PDF or Word file' });
    const saved = 'resume' + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, saved), Buffer.from(b.data, 'base64'));
    db.profile.resume = { name: b.filename, savedAs: saved, uploadedAt: new Date().toISOString() };
    saveDb(db);
    return send(res, 200, db.profile.resume);
  }

  if (p === '/api/internships' && req.method === 'GET') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const list = internships
      .filter(i => !q || (i.title + i.company + i.location + i.skills.join(' ')).toLowerCase().includes(q))
      .map(i => ({ ...i, match: matchSkills(db.profile.skills, i.skills), applied: db.applications.some(a => a.internshipId === i.id) }))
      .sort((a, b) => b.match.score - a.match.score);
    return send(res, 200, list);
  }

  if (p === '/api/applications' && req.method === 'GET') {
    return send(res, 200, db.applications.map(a => ({ ...a, internship: internships.find(i => i.id === a.internshipId) })));
  }
  if (p === '/api/applications' && req.method === 'POST') {
    const b = await readBody(req);
    if (!internships.some(i => i.id === b.internshipId)) return send(res, 404, { error: 'Internship not found' });
    if (db.applications.some(a => a.internshipId === b.internshipId)) return send(res, 409, { error: 'Already applied' });
    const app = { id: Date.now(), internshipId: b.internshipId, status: 'Applied', appliedOn: new Date().toISOString().slice(0, 10) };
    db.applications.push(app);
    saveDb(db);
    return send(res, 201, app);
  }
  const m = p.match(/^\/api\/applications\/(\d+)$/);
  if (m && req.method === 'PATCH') {
    const b = await readBody(req);
    const app = db.applications.find(a => a.id === Number(m[1]));
    if (!app) return send(res, 404, { error: 'Not found' });
    if (!STATUSES.includes(b.status)) return send(res, 400, { error: 'Invalid status' });
    app.status = b.status;
    saveDb(db);
    return send(res, 200, app);
  }
  if (m && req.method === 'DELETE') {
    db.applications = db.applications.filter(a => a.id !== Number(m[1]));
    saveDb(db);
    return send(res, 200, { ok: true });
  }

  // static files
  const file = path.join(PUBLIC_DIR, p === '/' ? 'index.html' : path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (file.startsWith(PUBLIC_DIR + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    return send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
  }
  send(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(err => send(res, 400, { error: err.message }));
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Placement portal running on http://localhost:${PORT}`));
}
module.exports = server;

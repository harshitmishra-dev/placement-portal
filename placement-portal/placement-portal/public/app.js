const $ = s => document.querySelector(s);
const STATUSES = ['Applied', 'Shortlisted', 'Interview', 'Offer', 'Rejected'];
let profile = {};

async function api(url, method = 'GET', body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---- tabs ----
document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab, .panel').forEach(e => e.classList.remove('active'));
  btn.classList.add('active');
  $('#' + btn.dataset.tab).classList.add('active');
  if (btn.dataset.tab === 'applications') loadApplications();
  if (btn.dataset.tab === 'internships') loadInternships();
}));

// ---- profile ----
async function loadProfile() {
  profile = await api('/api/profile');
  const f = $('#profileForm');
  f.name.value = profile.name || '';
  f.email.value = profile.email || '';
  f.branch.value = profile.branch || '';
  f.skills.value = (profile.skills || []).join(', ');
  $('#resumeInfo').textContent = profile.resume
    ? `Uploaded: ${profile.resume.name} (${new Date(profile.resume.uploadedAt).toLocaleDateString()})`
    : 'No resume uploaded yet.';
}

$('#profileForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  try {
    await api('/api/profile', 'PUT', { name: f.name.value, email: f.email.value, branch: f.branch.value, skills: f.skills.value });
    toast('Profile saved');
    await loadProfile();
  } catch (err) { toast(err.message); }
});

$('#resumeBtn').addEventListener('click', () => {
  const file = $('#resumeFile').files[0];
  if (!file) return toast('Choose a file first');
  if (file.size > 5 * 1024 * 1024) return toast('File must be under 5 MB');
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await api('/api/resume', 'POST', { filename: file.name, data: reader.result.split(',')[1] });
      toast('Resume uploaded');
      loadProfile();
    } catch (err) { toast(err.message); }
  };
  reader.readAsDataURL(file);
});

// ---- internships ----
async function loadInternships() {
  const list = await api('/api/internships?q=' + encodeURIComponent($('#search').value));
  $('#skillHint').textContent = (profile.skills || []).length
    ? 'Sorted by how well your skills match.'
    : 'Add skills in your profile to see match scores.';
  $('#internshipList').innerHTML = list.map(i => `
    <article class="card">
      <h3>${esc(i.title)}</h3>
      <div class="meta">${esc(i.company)} &middot; ${esc(i.location)} &middot; &#8377;${i.stipend.toLocaleString('en-IN')}/month</div>
      <div class="score">${i.match.score}% skill match</div>
      <div class="bar ${i.match.score < 50 ? 'low' : ''}"><span style="width:${i.match.score}%"></span></div>
      <div class="chips">
        ${i.match.matched.map(s => `<span class="chip ok">${esc(s)}</span>`).join('')}
        ${i.match.missing.map(s => `<span class="chip">${esc(s)}</span>`).join('')}
      </div>
      <button class="primary" data-apply="${i.id}" ${i.applied ? 'disabled' : ''}>${i.applied ? 'Applied' : 'Apply now'}</button>
    </article>`).join('') || '<p class="hint">No internships match your search.</p>';
}

$('#internshipList').addEventListener('click', async e => {
  const id = e.target.dataset.apply;
  if (!id) return;
  try { await api('/api/applications', 'POST', { internshipId: Number(id) }); toast('Application submitted'); loadInternships(); }
  catch (err) { toast(err.message); }
});
let timer;
$('#search').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(loadInternships, 250); });

// ---- applications ----
async function loadApplications() {
  const apps = await api('/api/applications');
  $('#stats').innerHTML = ['Total', ...STATUSES].map(s =>
    `<div class="stat"><b>${s === 'Total' ? apps.length : apps.filter(a => a.status === s).length}</b>${s}</div>`).join('');
  $('#appRows').innerHTML = apps.map(a => `
    <tr>
      <td>${esc(a.internship.title)}</td><td>${esc(a.internship.company)}</td><td>${a.appliedOn}</td>
      <td><select data-status="${a.id}" aria-label="Status">${STATUSES.map(s => `<option ${s === a.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
      <td><button class="link" data-remove="${a.id}">Withdraw</button></td>
    </tr>`).join('');
  $('#appEmpty').textContent = apps.length ? '' : 'You have not applied anywhere yet. Open the Internships tab to start.';
}

$('#appRows').addEventListener('change', async e => {
  if (e.target.dataset.status) { await api('/api/applications/' + e.target.dataset.status, 'PATCH', { status: e.target.value }); toast('Status updated'); loadApplications(); }
});
$('#appRows').addEventListener('click', async e => {
  if (e.target.dataset.remove) { await api('/api/applications/' + e.target.dataset.remove, 'DELETE'); toast('Application withdrawn'); loadApplications(); }
});

(async () => { await loadProfile(); loadInternships(); })();

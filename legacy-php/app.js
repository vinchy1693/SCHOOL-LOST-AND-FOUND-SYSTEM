'use strict';
const S = { user: null, meta: {}, claims: [] };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isStaff = () => S.user && S.user.role_id <= 2;
const isAdmin = () => S.user && S.user.role_id === 1;
const day = d => (d || '').slice(0, 10);
const when = d => (d || '').slice(0, 16);
const today = () => new Date().toISOString().slice(0, 10);
const badge = s => `<span class="badge b-${esc(s)}">${esc(String(s).replace('_', ' '))}</span>`;
const opts = (list, id, name, sel, blank) => (blank !== undefined ? `<option value="">${esc(blank)}</option>` : '') +
  list.map(o => `<option value="${o[id]}"${String(o[id]) === String(sel) ? ' selected' : ''}>${esc(o[name])}</option>`).join('');
const debounce = (fn, ms) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };

async function api(a, body, query = {}) {
  const opt = {};
  if (body instanceof FormData) { opt.method = 'POST'; opt.body = body; }
  else if (body) { opt.method = 'POST'; opt.headers = { 'Content-Type': 'application/json' }; opt.body = JSON.stringify(body); }
  const r = await fetch('api.php?' + new URLSearchParams({ a, ...query }), opt);
  let d;
  try { d = await r.json(); } catch { throw new Error('Server error. Check that PHP and MySQL are running and config.php is correct.'); }
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}
function toast(m) { const t = $('#toast'); t.textContent = m; t.className = 'show'; clearTimeout(toast.t); toast.t = setTimeout(() => t.className = '', 2800); }
function modal(h) { $('#dlg').innerHTML = h; if (!$('#dlg').open) $('#dlg').showModal(); }
const closeBtn = '<button class="x sm" data-do="close">✕</button>';

// ---------- shell ----------
async function boot() {
  try { S.meta = await api('meta'); S.user = (await api('me')).user; } catch (e) { $('#app').innerHTML = `<div class="auth"><div class="card"><h2>Can't reach the server</h2><p class="muted">${esc(e.message)}</p></div></div>`; return; }
  render();
}
function render() {
  if (!S.user) {
    $('#app').innerHTML = `<div class="auth"><h1>🔎 Campus Lost &amp; Found</h1><p class="muted">Report what you lost, find what you're missing.</p>
    <div class="card"><div class="tabs"><button class="on" data-do="tab" data-t="login">Log in</button><button data-do="tab" data-t="register">Register</button></div>
    <form id="t-login" data-form="login"><label>Email</label><input name="email" type="email" required><label>Password</label><input name="password" type="password" required>
      <p class="err"></p><button class="pri" style="width:100%">Log in</button></form>
    <form id="t-register" data-form="register" hidden><label>Full name</label><input name="full_name" required>
      <div class="two"><div><label>Email</label><input name="email" type="email" required></div><div><label>Password</label><input name="password" type="password" minlength="6" required></div>
      <div><label>I am a</label><select name="user_type"><option>student</option><option>faculty</option><option>staff</option><option>guest</option></select></div>
      <div><label>ID number</label><input name="id_number"></div>
      <div><label>Department</label><select name="department_id">${opts(S.meta.departments, 'department_id', 'department_name', '', '— none —')}</select></div>
      <div><label>Year level</label><input name="year_level"></div></div>
      <label>Phone</label><input name="phone"><p class="err"></p><button class="pri" style="width:100%">Create account</button></form></div></div>`;
    return;
  }
  const nav = (r, t) => `<a href="#/${r}" data-r="${r}">${t}${r === 'notifs' ? '<span class="badge" id="nb" hidden></span>' : ''}</a>`;
  const links = isStaff()
    ? nav('dash', '📊 Dashboard') + nav('items', '📦 Items') + nav('sclaims', '✅ Claims') + nav('reports', '📝 Lost reports') + nav('notifs', '🔔 Notifications') +
      (isAdmin() ? '<div class="sep">Admin</div>' + nav('users', '👥 Users') + nav('settings', '⚙️ Settings') : '')
    : nav('browse', '📦 Found items') + nav('lost', '📝 My lost reports') + nav('claims', '✅ My claims') + nav('notifs', '🔔 Notifications');
  $('#app').innerHTML = `<div class="shell"><nav><div class="logo">🔎 Lost &amp; Found</div>${links}
    <div class="who"><b>${esc(S.user.full_name)}</b><small>${['', 'Admin', 'Staff', 'User'][S.user.role_id]} · ${esc(S.user.email)}</small><button class="sm" data-do="logout" style="margin-top:.4rem">Log out</button></div></nav>
    <main id="view"></main></div>`;
  route();
}
async function route() {
  if (!S.user) return;
  const def = isStaff() ? 'dash' : 'browse';
  const r = location.hash.slice(2) || def;
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.r === r));
  try { await (views[r] || views[def])(); } catch (e) { $('#view').innerHTML = `<div class="card">${esc(e.message)}</div>`; }
  api('notifs').then(d => { const b = $('#nb'); if (b) { b.hidden = !d.unread; b.textContent = d.unread; } }).catch(() => {});
}
window.addEventListener('hashchange', route);

// ---------- views ----------
const itemCard = i => `<div class="card item" data-do="item" data-id="${i.item_id}"><div class="ph">${i.image ? `<img src="${esc(i.image)}" alt="">` : '📦'}</div>
  <div class="tx"><h3>${esc(i.title)}</h3><p>${esc(i.category_name)} · ${esc(i.found_location)}</p><p>Found ${day(i.date_found)} ${isStaff() ? badge(i.status) : ''}</p></div></div>`;

async function itemsView() {
  const staff = isStaff();
  const statuses = ['found', 'in_storage', 'claimed', 'returned', 'disposed'];
  $('#view').innerHTML = `<div class="bar"><h1 class="grow">${staff ? 'Manage items' : 'Found items'}</h1>${staff ? '<button class="pri" data-do="newitem">+ Log found item</button>' : ''}</div>
    ${staff ? '' : '<p class="muted">Items turned in to the office. Some details of valuable items are hidden — you\'ll describe them when you claim.</p>'}
    <div class="bar"><input id="fq" placeholder="Search title, brand, color…"><select id="fc">${opts(S.meta.categories, 'category_id', 'category_name', '', 'All categories')}</select>
    ${staff ? `<select id="fs"><option value="">All statuses</option>${statuses.map(s => `<option>${s}</option>`).join('')}</select>` : ''}</div><div id="list" class="grid"></div>`;
  const load = async () => {
    const r = await api('items', null, { q: $('#fq').value, category: $('#fc').value, status: staff ? $('#fs').value : '' });
    $('#list').innerHTML = r.items.map(itemCard).join('') || '<p class="muted">No items found.</p>';
  };
  ['fq', 'fc', 'fs'].forEach(id => $('#' + id)?.addEventListener('input', debounce(() => load().catch(e => toast(e.message)), 250)));
  await load();
}

async function showItem(id) {
  const { item: i } = await api('item_get', null, { id });
  const staff = isStaff(), open = ['found', 'in_storage'].includes(i.status);
  let h = `${closeBtn}<h2>${esc(i.title)}</h2><p class="muted">${esc(i.item_code)} · ${badge(i.status)}${i.is_valuable ? ' · ⭐ valuable' : ''}</p>
    ${i.image ? `<img src="${esc(i.image)}" alt="" style="width:100%;max-height:260px;object-fit:cover;border-radius:10px">` : ''}
    <p><b>Category:</b> ${esc(i.category_name)}<br><b>Found at:</b> ${esc(i.found_location)} on ${day(i.date_found)}<br>
    <b>Kept at:</b> ${esc(i.storage_location || 'Not yet stored')}
    ${staff || !i.is_valuable ? `<br><b>Brand:</b> ${esc(i.brand || '—')}<br><b>Color:</b> ${esc(i.color || '—')}<br><b>Details:</b> ${esc(i.description || '—')}` : ''}
    ${staff && i.found_id_number ? `<br><b>ID number on item:</b> ${esc(i.found_id_number)}` : ''}</p>`;
  if (!staff && i.is_valuable) h += '<div class="note">Details of valuable items are hidden. Describe the item in your claim; staff will verify it.</div>';
  if (!staff) {
    const lr = (await api('lost_mine')).reports.filter(r => r.status !== 'closed');
    h += `<hr><h3>Is this yours? Submit a claim</h3><form data-form="claim"><input type="hidden" name="item_id" value="${i.item_id}">
      <label>Describe the item (marks, contents, anything only the owner knows)</label><textarea name="description_provided" rows="3" required></textarea>
      <div class="two"><div><label>Proof type</label><select name="evidence_type"><option value="other">Other</option><option value="serial_number">Serial number</option><option value="receipt">Receipt</option><option value="id">ID</option><option value="photo">Photo</option></select></div>
      <div><label>Proof details</label><input name="evidence_details" placeholder="e.g. serial no., photo link"></div></div>
      <label>Link to one of my lost reports (optional)</label><select name="lost_report_id">${opts(lr, 'lost_report_id', 'title', '', '— none —')}</select>
      <p class="err"></p><button class="pri">Submit claim</button></form>`;
  } else {
    h += `<hr><h3>History</h3><div class="muted">${i.history.map(x => `${when(x.changed_at)} — ${esc(x.old_status || 'new')} → <b>${esc(x.new_status)}</b> by ${esc(x.full_name)}${x.remarks ? ' (' + esc(x.remarks) + ')' : ''}`).join('<br>')}</div>`;
    if (open) h += `<hr><h3>Storage</h3><form data-form="relocate" class="bar"><input type="hidden" name="item_id" value="${i.item_id}">
      <select name="storage_location_id" style="flex:1">${opts(S.meta.locations.filter(l => l.location_type === 'storage'), 'location_id', 'location_name', i.storage_location_id, '— not stored —')}</select><button>Update</button></form>
      <h3>Dispose (unclaimed)</h3><form data-form="dispose"><input type="hidden" name="item_id" value="${i.item_id}">
      <div class="two"><select name="disposal_method"><option>donated</option><option>recycled</option><option>discarded</option></select><input name="donated_to" placeholder="Donated to (if donated)"></div>
      <input name="remarks" placeholder="Remarks" style="margin-top:.5rem"><p class="err"></p><button class="bad">Mark as disposed</button></form>`;
  }
  modal(h);
}

function newItemModal() {
  const L = S.meta.locations;
  modal(`${closeBtn}<h2>Log found item</h2><form data-form="newitem">
    <label>Title</label><input name="title" placeholder="e.g. Black umbrella" required>
    <div class="two"><div><label>Category</label><select name="category_id" required>${opts(S.meta.categories, 'category_id', 'category_name')}</select></div>
    <div><label>Date found</label><input type="date" name="date_found" value="${today()}" max="${today()}" required></div>
    <div><label>Found at</label><select name="found_location_id" required>${opts(L.filter(l => l.location_type === 'found_spot'), 'location_id', 'location_name')}</select></div>
    <div><label>Store at</label><select name="storage_location_id">${opts(L.filter(l => l.location_type === 'storage'), 'location_id', 'location_name', '', '— not stored —')}</select></div>
    <div><label>Brand</label><input name="brand"></div><div><label>Color</label><input name="color"></div></div>
    <label>Description</label><textarea name="description" rows="2"></textarea>
    <label>ID number printed on item (for IDs/cards)</label><input name="found_id_number">
    <label>Photo</label><input type="file" name="image" accept="image/*">
    <label style="font-weight:400"><input type="checkbox" name="is_valuable" value="1" style="width:auto"> Valuable item (hide details from public)</label>
    <p class="err"></p><button class="pri">Save item</button></form>`);
}

const views = {
  browse: itemsView, items: itemsView,

  async lost() {
    const { reports } = await api('lost_mine');
    $('#view').innerHTML = `<h1>My lost reports</h1><div class="card"><h3>Report a lost item</h3><form data-form="lost">
      <div class="two"><div><label>What did you lose?</label><input name="title" required></div>
      <div><label>Category</label><select name="category_id" required>${opts(S.meta.categories, 'category_id', 'category_name')}</select></div>
      <div><label>Brand</label><input name="brand"></div><div><label>Color</label><input name="color"></div>
      <div><label>Last seen at</label><input name="last_seen_location"></div><div><label>Date lost</label><input type="date" name="date_lost" value="${today()}" max="${today()}" required></div></div>
      <label>Description</label><textarea name="description" rows="2"></textarea><p class="err"></p><button class="pri">Submit report</button></form></div><br>
      <div class="list">${reports.map(r => `<div class="card row"><div><h3>${esc(r.title)} ${badge(r.status)}</h3>
        <p class="muted">${esc(r.category_name)} · lost ${day(r.date_lost)}${r.last_seen_location ? ' near ' + esc(r.last_seen_location) : ''}</p></div>
        ${r.status !== 'closed' ? `<button class="sm" data-do="lostclose" data-id="${r.lost_report_id}">Mark as found / close</button>` : ''}</div>`).join('') || '<p class="muted">No reports yet.</p>'}</div>`;
  },

  async claims() {
    const { claims } = await api('claims');
    $('#view').innerHTML = `<h1>My claims</h1><div class="list">${claims.map(c => `<div class="card"><h3>${esc(c.item_title)} ${badge(c.claim_status)}</h3>
      <p class="muted">${esc(c.item_code)} · submitted ${when(c.created_at)}</p><p>${esc(c.description_provided)}</p>
      ${c.remarks ? `<p class="muted">Staff note: ${esc(c.remarks)}</p>` : ''}
      ${c.claim_status === 'approved' && !c.returned_at ? '<div class="note">Approved. Bring a valid ID to the Lost &amp; Found office to receive your item.</div>' : ''}
      ${c.returned_at ? `<p class="muted">✔ Released to ${esc(c.received_by_name)} on ${when(c.returned_at)}</p>` : ''}</div>`).join('') || '<p class="muted">You have no claims yet. Browse found items to claim one.</p>'}</div>`;
  },

  async notifs() {
    const { notifications: n } = await api('notifs');
    $('#view').innerHTML = `<div class="bar"><h1 class="grow">Notifications</h1><button data-do="readall">Mark all read</button></div>
      <div class="list">${n.map(x => `<div class="card ${x.is_read == 0 ? 'unread' : ''}"><p style="margin:0">${esc(x.message)}</p><p class="muted" style="margin:.2rem 0 0">${when(x.sent_at)}</p></div>`).join('') || '<p class="muted">Nothing yet.</p>'}</div>`;
  },

  async dash() {
    const s = await api('stats'), it = s.items;
    const stat = (n, l) => `<div class="card stat"><b>${n ?? 0}</b><span>${l}</span></div>`;
    $('#view').innerHTML = `<h1>Dashboard</h1><div class="stats">${stat(s.pending_claims, 'Claims to review')}${stat(s.awaiting_release, 'Approved, awaiting release')}${stat(s.open_reports, 'Open lost reports')}
      ${stat((+it.found || 0) + (+it.in_storage || 0), 'Unclaimed items')}${stat(it.returned, 'Returned to owners')}${isAdmin() ? stat(s.users, 'Users') : ''}</div>
      <div class="card"><h3>Recent activity</h3><div class="list">${s.recent.map(r => `<div class="muted">${when(r.changed_at)} — <b>${esc(r.title)}</b> (${esc(r.item_code)}) → ${badge(r.new_status)} by ${esc(r.full_name)}</div>`).join('') || '<span class="muted">No activity yet.</span>'}</div></div>`;
  },

  async sclaims() {
    const st = $('#cs')?.value ?? 'pending';
    const { claims } = await api('claims', null, { status: st });
    S.claims = claims;
    $('#view').innerHTML = `<div class="bar"><h1 class="grow">Claims</h1><select id="cs">${['pending', 'approved', 'rejected', ''].map(s => `<option value="${s}"${s === st ? ' selected' : ''}>${s || 'All'}</option>`).join('')}</select></div>
      <div class="list">${claims.map(c => `<div class="card"><div class="row"><div><h3>${esc(c.item_title)} ${badge(c.claim_status)}</h3>
        <p class="muted">${esc(c.item_code)} · by ${esc(c.claimant_name)} (${esc(c.claimant_email)}) · ${when(c.created_at)}</p></div>
        <div>${c.claim_status === 'pending' ? `<button class="pri sm" data-do="review" data-id="${c.claim_id}">Review</button>` : ''}
        ${c.claim_status === 'approved' && !c.returned_at ? `<button class="pri sm" data-do="release" data-id="${c.claim_id}">Release item</button>` : ''}</div></div>
        <p>${esc(c.description_provided)}</p>${c.evidence.map(e => `<p class="muted">Proof (${esc(e.evidence_type)}): ${esc(e.details)}</p>`).join('')}
        ${c.found_id_number ? `<p class="muted">ID on item: <b>${esc(c.found_id_number)}</b> · Claimant ID: <b>${esc(c.claimant_id_number || 'n/a')}</b></p>` : ''}
        ${c.returned_at ? `<p class="muted">✔ Released to ${esc(c.received_by_name)} on ${when(c.returned_at)}</p>` : ''}</div>`).join('') || '<p class="muted">No claims here.</p>'}</div>`;
    $('#cs').onchange = () => views.sclaims();
  },

  async reports() {
    const { reports } = await api('lost_all');
    $('#view').innerHTML = `<h1>Lost reports</h1><div class="list">${reports.map(r => `<div class="card row"><div><h3>${esc(r.title)} ${badge(r.status)}</h3>
      <p class="muted">${esc(r.category_name)} · ${esc(r.color || '')} ${esc(r.brand || '')} · lost ${day(r.date_lost)}${r.last_seen_location ? ' near ' + esc(r.last_seen_location) : ''}<br>Reported by ${esc(r.full_name)} (${esc(r.email)})</p>
      ${r.description ? `<p>${esc(r.description)}</p>` : ''}</div>
      ${r.status !== 'closed' ? `<button class="sm" data-do="matches" data-id="${r.lost_report_id}">Find matches</button>` : ''}</div>`).join('') || '<p class="muted">No reports.</p>'}</div>`;
  },

  async users() {
    const { users } = await api('users');
    $('#view').innerHTML = `<h1>Users</h1><div class="card tablewrap"><table><tr><th>Name</th><th>Email</th><th>ID no.</th><th>Role</th><th>Active</th><th></th></tr>
      ${users.map(u => `<tr data-uid="${u.user_id}"><td>${esc(u.full_name)}<br><span class="muted">${esc(u.user_type)} ${esc(u.department_code || '')}</span></td><td>${esc(u.email)}</td><td>${esc(u.id_number || '')}</td>
      <td><select class="r"${u.user_id == S.user.user_id ? ' disabled' : ''}><option value="1"${u.role_id == 1 ? ' selected' : ''}>admin</option><option value="2"${u.role_id == 2 ? ' selected' : ''}>staff</option><option value="3"${u.role_id == 3 ? ' selected' : ''}>user</option></select></td>
      <td><input type="checkbox" class="a" style="width:auto"${u.is_active == 1 ? ' checked' : ''}${u.user_id == S.user.user_id ? ' disabled' : ''}></td>
      <td>${u.user_id == S.user.user_id ? '' : `<button class="sm" data-do="saveuser" data-id="${u.user_id}">Save</button>`}</td></tr>`).join('')}</table></div>`;
  },

  async settings() {
    const lf = (t, rec = {}) => {
      const f = {
        category: [['category_name', 'Name'], ['description', 'Description']],
        location: [['location_name', 'Name'], ['building', 'Building'], ['room', 'Room']],
        department: [['department_name', 'Name'], ['department_code', 'Code']],
      }[t];
      const id = { category: 'category_id', location: 'location_id', department: 'department_id' }[t];
      return `<form class="bar" data-form="lookup" style="margin-bottom:.4rem"><input type="hidden" name="table" value="${t}"><input type="hidden" name="id" value="${rec[id] || ''}">
        ${f.map(([k, p]) => `<input name="${k}" placeholder="${p}" value="${esc(rec[k] || '')}" style="flex:1;min-width:110px"${k.endsWith('_name') ? ' required' : ''}>`).join('')}
        ${t === 'location' ? `<select name="location_type" style="width:auto"><option value="found_spot"${rec.location_type !== 'storage' ? ' selected' : ''}>found spot</option><option value="storage"${rec.location_type === 'storage' ? ' selected' : ''}>storage</option></select>` : ''}
        <button class="sm">${rec[id] ? 'Save' : 'Add'}</button>${rec[id] ? `<button type="button" class="sm bad" data-do="lookupdel" data-t="${t}" data-id="${rec[id]}">Delete</button>` : ''}</form>`;
    };
    S.meta = await api('meta');
    const sec = (t, title, list) => `<div class="card" style="margin-bottom:1rem"><h2>${title}</h2>${list.map(r => lf(t, r)).join('')}<h3 style="margin-top:.8rem">Add new</h3>${lf(t)}</div>`;
    $('#view').innerHTML = `<h1>Settings</h1>${sec('category', 'Categories', S.meta.categories)}${sec('location', 'Locations', S.meta.locations)}${sec('department', 'Departments', S.meta.departments)}`;
  },
};

// ---------- click actions ----------
const acts = {
  close: () => $('#dlg').close(),
  tab(t) {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b === t));
    $('#t-login').hidden = t.dataset.t !== 'login'; $('#t-register').hidden = t.dataset.t !== 'register';
  },
  async logout() { await api('logout', {}); S.user = null; location.hash = ''; render(); },
  item: (t, d) => showItem(d.id),
  newitem: newItemModal,
  async lostclose(t, d) { await api('lost_close', { id: d.id }); toast('Report closed'); views.lost(); },
  async readall() { await api('notif_read', {}); route(); },
  async saveuser(t, d) {
    const tr = t.closest('tr');
    await api('user_update', { user_id: d.id, role_id: tr.querySelector('.r').value, is_active: tr.querySelector('.a').checked ? 1 : 0 });
    toast('User updated');
  },
  async lookupdel(t, d) { if (!confirm('Delete this entry?')) return; await api('lookup_delete', { table: d.t, id: d.id }); toast('Deleted'); views.settings(); },
  review(t, d) {
    const c = S.claims.find(x => x.claim_id == d.id);
    modal(`${closeBtn}<h2>Review claim</h2><p><b>${esc(c.item_title)}</b> (${esc(c.item_code)})<br>Claimant: ${esc(c.claimant_name)}</p><div class="note">${esc(c.description_provided)}</div>
      <p class="muted">Compare this with the item before approving. Valuable item details are only visible to staff in the item view.</p>
      <form data-form="review"><input type="hidden" name="claim_id" value="${c.claim_id}"><label>Remarks (shown to claimant)</label><input name="remarks"><p class="err"></p>
      <div class="bar" style="margin-top:.8rem"><button class="pri" name="decision" value="approved">Approve</button><button class="bad" name="decision" value="rejected">Reject</button></div></form>`);
  },
  release(t, d) {
    const c = S.claims.find(x => x.claim_id == d.id);
    modal(`${closeBtn}<h2>Release item</h2><p><b>${esc(c.item_title)}</b> → ${esc(c.claimant_name)}</p><form data-form="release"><input type="hidden" name="claim_id" value="${c.claim_id}">
      <label>Received by (full name)</label><input name="received_by_name" value="${esc(c.claimant_name)}" required>
      <label>ID presented</label><input name="id_presented" placeholder="e.g. School ID 2024-0001" required><p class="err"></p><button class="pri">Confirm release</button></form>`);
  },
  async matches(t, d) {
    const { matches } = await api('match_suggest', null, { id: d.id });
    modal(`${closeBtn}<h2>Possible matches</h2>${matches.map(m => `<div class="card row" style="margin-bottom:.6rem"><div><h3>${esc(m.title)} <span class="badge">${m.score}%</span></h3>
      <p class="muted">${esc(m.item_code)} · ${esc(m.category_name)} · ${esc(m.color || '')} ${esc(m.brand || '')} · found ${day(m.date_found)}</p></div>
      ${m.match_status === 'confirmed' ? badge('confirmed') : `<button class="pri sm" data-do="confirmmatch" data-r="${d.id}" data-i="${m.item_id}" data-s="${m.score}">Confirm match</button>`}</div>`).join('') || '<p class="muted">No similar unclaimed items found yet.</p>'}`);
  },
  async confirmmatch(t, d) { await api('match_confirm', { lost_report_id: d.r, item_id: d.i, score: d.s }); toast('Match confirmed — owner notified'); $('#dlg').close(); views.reports(); },
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-do]');
  if (t && acts[t.dataset.do]) Promise.resolve(acts[t.dataset.do](t, t.dataset)).catch(x => toast(x.message));
});

// ---------- form handlers ----------
const obj = fd => Object.fromEntries(fd);
const done = (msg, fn) => { toast(msg); $('#dlg').open && $('#dlg').close(); fn && fn(); };
const forms = {
  async login(f, fd) { S.user = (await api('login', obj(fd))).user; render(); },
  async register(f, fd) { S.user = (await api('register', obj(fd))).user; render(); },
  async claim(f, fd) { await api('claim_create', obj(fd)); done('Claim submitted. Staff will review it.', () => location.hash = '#/claims'); },
  async lost(f, fd) { await api('lost_create', obj(fd)); toast('Report submitted'); views.lost(); },
  async newitem(f, fd) { await api('item_create', fd); done('Item logged', route); },
  async relocate(f, fd) { await api('item_update', obj(fd)); done('Storage updated', route); },
  async dispose(f, fd) { if (!confirm('Mark this item as disposed? This cannot be undone.')) return; await api('disposal_create', obj(fd)); done('Item disposed', route); },
  async review(f, fd, e) { await api('claim_review', { ...obj(fd), decision: e.submitter.value }); done('Claim ' + e.submitter.value, views.sclaims); },
  async release(f, fd) { await api('claim_release', obj(fd)); done('Item released', views.sclaims); },
  async lookup(f, fd) { await api('lookup_save', obj(fd)); toast('Saved'); views.settings(); },
};
document.addEventListener('submit', async e => {
  const f = e.target, h = forms[f.dataset.form];
  if (!h) return;
  e.preventDefault();
  const err = f.querySelector('.err'); if (err) err.textContent = '';
  try { await h(f, new FormData(f), e); } catch (x) { err ? err.textContent = x.message : toast(x.message); }
});

boot();

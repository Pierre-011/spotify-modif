const API_ENDPOINT = '.github/update-artiste';
const state = { data: {}, original: {}, selectedId: null };
const $ = id => document.getElementById(id);

function deepClone(v) { return JSON.parse(JSON.stringify(v)); }

function normalizeValue(key, value) {
  if (key === 'followers' || key === 'popularity') return value === '' ? null : (value === 'null' ? null : Number(value));
  if (key === 'monthly_listeners') return value === '' ? null : Number(value);
  if (key === 'genres') return value.split(',').map(s => s.trim()).filter(Boolean);
  if (key === 'images' || key === 'external_urls') {
    try {
      return value.trim() ? JSON.parse(value) : (key === 'images' ? [] : {});
    } catch {
      return key === 'images' ? [] : {};
    }
  }
  return value;
}

function isModified(id) {
  return JSON.stringify(state.data[id]) !== JSON.stringify(state.original[id]);
}

function getModifiedIds() {
  return Object.keys(state.data).filter(isModified);
}

function fillForm(a) {
  $('idField').value = a.id || '';
  $('nameField').value = a.name || '';
  $('urlField').value = a.url || '';
  $('uriField').value = a.uri || '';
  $('followersField').value = a.followers ?? 'null';
  $('listenersField').value = a.monthly_listeners ?? '';
  $('popularityField').value = a.popularity ?? 'null';
  $('genresField').value = (a.genres || []).join(', ');
  $('imagesField').value = JSON.stringify(a.images || [], null, 2);
  $('externalUrlsField').value = JSON.stringify(a.external_urls || {}, null, 2);
  $('firstSeenField').value = a.first_seen || '';
  $('lastSeenField').value = a.last_seen || '';
}

function readForm() {
  return {
    id: $('idField').value,
    name: $('nameField').value,
    url: $('urlField').value,
    uri: $('uriField').value,
    followers: normalizeValue('followers', $('followersField').value),
    monthly_listeners: normalizeValue('monthly_listeners', $('listenersField').value),
    popularity: normalizeValue('popularity', $('popularityField').value),
    genres: normalizeValue('genres', $('genresField').value),
    images: normalizeValue('images', $('imagesField').value),
    external_urls: normalizeValue('external_urls', $('externalUrlsField').value),
    first_seen: $('firstSeenField').value,
    last_seen: $('lastSeenField').value
  };
}

function diffText(id) {
  const a = state.data[id], b = state.original[id];
  if (!a || !b) return 'Aucun diff.';
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  const lines = [];
  keys.forEach(k => {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
      lines.push(`${k}: ${JSON.stringify(b[k])} -> ${JSON.stringify(a[k])}`);
    }
  });
  return lines.length ? lines.join('\n') : 'Aucun changement local.';
}

function updateStatus() {
  const n = getModifiedIds().length;
  $('dirtyLabel').textContent = n ? `${n} modifié${n > 1 ? 's' : ''}` : 'Aucune modification';
  $('dirtyLabel').className = 'badge ' + (n ? '' : 'muted');
}

function renderList(filter = '') {
  const list = $('artistList');
  list.innerHTML = '';
  const entries = Object.values(state.data).filter(a =>
    !filter || `${a.name || ''} ${a.id || ''}`.toLowerCase().includes(filter.toLowerCase())
  );

  $('countLabel').textContent = `${entries.length} artiste${entries.length > 1 ? 's' : ''}`;

  entries.forEach(a => {
    const li = document.createElement('li');
    li.className = 'artistItem' + (state.selectedId === a.id ? ' active' : '') + (isModified(a.id) ? ' modified' : '');
    li.innerHTML = `<strong>${a.name || '(sans nom)'}</strong><div class="small">${a.id}</div><div class="small">${isModified(a.id) ? 'Modifié' : 'Original'}</div>`;
    li.onclick = () => selectArtist(a.id);
    list.appendChild(li);
  });

  updateStatus();
}

function selectArtist(id) {
  state.selectedId = id;
  fillForm(state.data[id]);
  $('editorTitle').textContent = state.data[id].name || id;
  $('diffOutput').textContent = diffText(id);
  renderList($('searchInput').value);
}

function applyCurrentToArtist() {
  if (!state.selectedId) return;
  state.data[state.selectedId] = readForm();
  $('diffOutput').textContent = diffText(state.selectedId);
  renderList($('searchInput').value);
}

function revertCurrent() {
  if (!state.selectedId) return;
  state.data[state.selectedId] = deepClone(state.original[state.selectedId]);
  fillForm(state.data[state.selectedId]);
  $('diffOutput').textContent = diffText(state.selectedId);
  renderList($('searchInput').value);
}

function setData(data) {
  state.data = deepClone(data);
  state.original = deepClone(data);
  state.selectedId = Object.keys(data)[0] || null;
  renderList();
  if (state.selectedId) selectArtist(state.selectedId);
}

async function loadData() {
  const res = await fetch('artistes.json', { cache: 'no-store' });
  const data = await res.json();
  setData(data);
}

async function saveToGitHub() {
  const modifiedIds = getModifiedIds();
  const payload = {
    updated_json: state.data,
    modified_ids: modifiedIds,
    timestamp: new Date().toISOString()
  };

  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const txt = await res.text();
    alert(`Erreur sauvegarde: ${txt}`);
    return;
  }

  const result = await res.json();
  state.original = deepClone(state.data);
  renderList($('searchInput').value);
  $('diffOutput').textContent = 'Enregistré sur GitHub.\n' + JSON.stringify(result, null, 2);
  alert('Artistes.json mis à jour et commit effectué.');
}

$('reloadBtn').onclick = loadData;
$('saveBtn').onclick = saveToGitHub;
$('applyBtn').onclick = applyCurrentToArtist;
$('revertBtn').onclick = revertCurrent;
$('searchInput').oninput = e => renderList(e.target.value);

['nameField','urlField','uriField','followersField','listenersField','popularityField','genresField','imagesField','externalUrlsField','firstSeenField','lastSeenField']
  .forEach(id => $(id).addEventListener('input', () => {
    if (!state.selectedId) return;
    state.data[state.selectedId] = readForm();
    $('diffOutput').textContent = diffText(state.selectedId);
    renderList($('searchInput').value);
  }));

loadData();

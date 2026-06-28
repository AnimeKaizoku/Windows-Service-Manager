import './style.css';
import {
    ListServices, StartServices, StopServices, RestartServices,
    SetStartType, GetConfig, SaveConfig,
} from '../wailsjs/go/main/App';
import { BrowserOpenURL } from '../wailsjs/runtime/runtime';

const VERSION = 'v0.1.0';
const GITHUB_URL = 'https://github.com/AnimeKaizoku/Windows-Service-Manager';

// ---------- state ----------
const state = {
    services: [],
    config: { views: [], favorites: [], theme: 'mocha' },
    view: { type: 'builtin', id: 'all' },   // builtin|custom|account
    selection: new Set(),
    search: '',
    sort: { key: 'displayName', dir: 1 },
    lastIndex: -1,
    rendered: [],   // currently rendered (filtered+sorted) services
};

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const BUILTINS = [
    { id: 'all', label: 'All Services', dot: 'var(--blue)' },
    { id: 'running', label: 'Running', dot: 'var(--green)' },
    { id: 'stopped', label: 'Stopped', dot: 'var(--red)' },
    { id: 'favorites', label: 'Favorites', dot: 'var(--yellow)' },
];

// ---------- data ----------
async function refresh() {
    setStatus('Loading services…', 'busy');
    try {
        state.services = await ListServices();
        setStatus(`Loaded ${state.services.length} services.`);
    } catch (err) {
        setStatus('Failed to load services: ' + err, 'error');
    }
    pruneSelection();
    renderAll();
}

function accountLabel(a) {
    return (a && a.trim()) ? a : 'LocalSystem';
}

// Friendly, shortened account for display: drops the domain/authority prefix
// (e.g. "NT AUTHORITY\LocalService" -> "LocalService", ".\kaizoku" -> "kaizoku").
function shortAccount(a) {
    const full = accountLabel(a);
    const i = full.lastIndexOf('\\');
    return i >= 0 ? full.slice(i + 1) : full;
}

function accountCounts() {
    const map = new Map();
    for (const s of state.services) {
        const k = accountLabel(s.account);
        map.set(k, (map.get(k) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// ---------- view / filter ----------
function currentView() {
    if (state.view.type === 'builtin')
        return BUILTINS.find((b) => b.id === state.view.id) || BUILTINS[0];
    if (state.view.type === 'custom')
        return state.config.views.find((v) => v.id === state.view.id);
    if (state.view.type === 'account')
        return { id: state.view.id, label: shortAccount(state.view.id) };
    return BUILTINS[0];
}

function inView(s) {
    const v = state.view;
    if (v.type === 'builtin') {
        if (v.id === 'all') return true;
        if (v.id === 'running') return s.state === 'Running';
        if (v.id === 'stopped') return s.state === 'Stopped';
        if (v.id === 'favorites') return state.config.favorites.includes(s.name);
    } else if (v.type === 'account') {
        return accountLabel(s.account) === v.id;
    } else if (v.type === 'custom') {
        const cv = state.config.views.find((x) => x.id === v.id);
        if (!cv) return true;
        const byAcct = cv.account && cv.account.trim()
            ? accountLabel(s.account).toLowerCase().includes(cv.account.toLowerCase())
            : false;
        const byList = (cv.services || []).includes(s.name);
        if (!cv.account?.trim() && !(cv.services || []).length) return true;
        return byAcct || byList;
    }
    return true;
}

function matchesSearch(s) {
    const q = state.search.trim().toLowerCase();
    if (!q) return true;
    return [s.name, s.displayName, s.account, s.state, s.startType, String(s.pid || '')]
        .some((f) => String(f || '').toLowerCase().includes(q));
}

function computeRendered() {
    const { key, dir } = state.sort;
    const list = state.services.filter((s) => inView(s) && matchesSearch(s));
    list.sort((a, b) => {
        let av = a[key], bv = b[key];
        if (key === 'pid') { av = a.pid || 0; bv = b.pid || 0; return (av - bv) * dir; }
        av = String(av || '').toLowerCase();
        bv = String(bv || '').toLowerCase();
        return av < bv ? -dir : av > bv ? dir : 0;
    });
    state.rendered = list;
    return list;
}

// ---------- rendering ----------
function renderAll() {
    renderSidebar();
    renderTable();
}

function sideItem({ active, dotColor, label, badge, onClick, onEdit }) {
    const item = el('div', 'side-item' + (active ? ' active' : ''));
    if (dotColor) {
        const d = el('span', 'dot');
        d.style.background = dotColor;
        item.appendChild(d);
    }
    item.appendChild(el('span', 'label', esc(label)));
    if (onEdit) {
        const e = el('button', 'edit', '✎');
        e.title = 'Edit view';
        e.onclick = (ev) => { ev.stopPropagation(); onEdit(); };
        item.appendChild(e);
    }
    if (badge != null) item.appendChild(el('span', 'badge', String(badge)));
    item.onclick = onClick;
    return item;
}

function countFor(predicate) {
    return state.services.filter(predicate).length;
}

function renderSidebar() {
    const bv = $('#builtin-views');
    bv.innerHTML = '';
    for (const b of BUILTINS) {
        const badge = b.id === 'all' ? state.services.length
            : b.id === 'running' ? countFor((s) => s.state === 'Running')
            : b.id === 'stopped' ? countFor((s) => s.state === 'Stopped')
            : state.config.favorites.length;
        bv.appendChild(sideItem({
            active: state.view.type === 'builtin' && state.view.id === b.id,
            dotColor: b.dot, label: b.label, badge,
            onClick: () => selectView({ type: 'builtin', id: b.id }),
        }));
    }

    const cv = $('#custom-views');
    cv.innerHTML = '';
    if (!state.config.views.length) {
        cv.appendChild(el('div', 'side-item', '<span class="label" style="color:var(--overlay0)">No views yet</span>'));
    }
    for (const v of state.config.views) {
        const count = state.services.filter((s) => {
            const a = v.account?.trim() ? accountLabel(s.account).toLowerCase().includes(v.account.toLowerCase()) : false;
            const l = (v.services || []).includes(s.name);
            return a || l;
        }).length;
        cv.appendChild(sideItem({
            active: state.view.type === 'custom' && state.view.id === v.id,
            dotColor: 'var(--mauve)', label: v.name, badge: count,
            onClick: () => selectView({ type: 'custom', id: v.id }),
            onEdit: () => openViewModal(v),
        }));
    }

    const al = $('#account-list');
    al.innerHTML = '';
    for (const [acct, n] of accountCounts()) {
        const item = sideItem({
            active: state.view.type === 'account' && state.view.id === acct,
            dotColor: 'var(--teal)', label: shortAccount(acct), badge: n,
            onClick: () => selectView({ type: 'account', id: acct }),
        });
        item.title = acct;
        al.appendChild(item);
    }
}

function statePill(s) {
    const st = s.state;
    let cls = 'pending';
    if (st === 'Running') cls = 'running';
    else if (st === 'Stopped') cls = 'stopped';
    return `<span class="pill ${cls}"><span class="dot"></span>${esc(st)}</span>`;
}

function renderTable() {
    const list = computeRendered();
    const tbody = $('#rows');
    tbody.innerHTML = '';

    const view = currentView();
    $('#view-title').textContent = view ? (view.label || view.name) : 'Services';
    const acctNote = state.view.type === 'account' ? ` · account "${state.view.id}"` : '';
    $('#view-meta').textContent = `${list.length} shown${acctNote}`;

    const running = list.filter((s) => s.state === 'Running').length;
    const stopped = list.filter((s) => s.state === 'Stopped').length;
    $('#counts').innerHTML =
        `<span class="count-pill run"><span class="dot"></span>${running} running</span>` +
        `<span class="count-pill stop"><span class="dot"></span>${stopped} stopped</span>`;

    $('#empty').classList.toggle('hidden', list.length > 0);

    list.forEach((s, i) => {
        const tr = el('tr');
        if (state.selection.has(s.name)) tr.classList.add('selected');
        const fav = state.config.favorites.includes(s.name);
        tr.innerHTML = `
            <td class="col-check"><input type="checkbox" ${state.selection.has(s.name) ? 'checked' : ''}/></td>
            <td>
              <div class="svc-name">
                <span class="svc-display">${fav ? '★ ' : ''}${esc(s.displayName || s.name)}</span>
                <span class="svc-id">${esc(s.name)}</span>
              </div>
            </td>
            <td>${statePill(s)}</td>
            <td class="cell-start">${esc(s.startType)}</td>
            <td class="cell-pid">${s.pid ? s.pid : '-'}</td>
            <td class="cell-acct" title="${esc(accountLabel(s.account))}">${esc(shortAccount(s.account))}</td>`;

        const cb = tr.querySelector('input');
        cb.onclick = (ev) => { ev.stopPropagation(); toggle(s.name, i, ev.shiftKey); };
        tr.onclick = (ev) => { selectRow(s.name, i, ev); };
        tr.oncontextmenu = (ev) => { ev.preventDefault(); openContextMenu(ev, s, i); };
        tbody.appendChild(tr);
    });

    updateSortHeaders();
    updateSelCount();
}

function updateSortHeaders() {
    document.querySelectorAll('#grid th.sortable').forEach((th) => {
        th.classList.remove('sorted', 'asc');
        if (th.dataset.sort === state.sort.key) {
            th.classList.add('sorted');
            if (state.sort.dir === 1) th.classList.add('asc');
        }
    });
}

// ---------- selection ----------
function toggle(name, index, shift) {
    if (shift && state.lastIndex >= 0) {
        const [a, b] = [state.lastIndex, index].sort((x, y) => x - y);
        for (let i = a; i <= b; i++) state.selection.add(state.rendered[i].name);
    } else {
        if (state.selection.has(name)) state.selection.delete(name);
        else state.selection.add(name);
    }
    state.lastIndex = index;
    renderTable();
}

function selectRow(name, index, ev) {
    if (ev.shiftKey && state.lastIndex >= 0) {
        const [a, b] = [state.lastIndex, index].sort((x, y) => x - y);
        if (!ev.ctrlKey) state.selection.clear();
        for (let i = a; i <= b; i++) state.selection.add(state.rendered[i].name);
    } else if (ev.ctrlKey) {
        if (state.selection.has(name)) state.selection.delete(name);
        else state.selection.add(name);
    } else {
        state.selection.clear();
        state.selection.add(name);
    }
    state.lastIndex = index;
    renderTable();
}

function pruneSelection() {
    const names = new Set(state.services.map((s) => s.name));
    for (const n of [...state.selection]) if (!names.has(n)) state.selection.delete(n);
}

function selectedNames() { return [...state.selection]; }

function updateSelCount() {
    const n = state.selection.size;
    $('#selcount').textContent = n ? `${n} selected` : '';
    $('#check-all').checked = state.rendered.length > 0 && state.rendered.every((s) => state.selection.has(s.name));
}

function toggleFavorite(name) {
    const f = state.config.favorites;
    const i = f.indexOf(name);
    if (i >= 0) f.splice(i, 1); else f.push(name);
    persist();
    renderAll();
}

// ---------- actions ----------
async function runAction(label, fn) {
    const names = selectedNames();
    if (!names.length) { toast('Select one or more services first.', 'err'); return; }
    setStatus(`${label} ${names.length} service(s)…`, 'busy');
    try {
        const results = await fn(names);
        const ok = results.filter((r) => r.ok).length;
        const fail = results.filter((r) => !r.ok);
        if (fail.length) {
            toast(`${label}: ${ok} ok, ${fail.length} failed. ${esc(fail[0].error)}`, 'err');
            setStatus(`${label}: ${ok} succeeded, ${fail.length} failed.`, 'error');
        } else {
            toast(`${label} ${ok} service(s).`, 'ok');
            setStatus(`${label} ${ok} service(s).`);
        }
    } catch (err) {
        toast(`${label} failed: ${esc(String(err))}`, 'err');
        setStatus(`${label} failed: ${err}`, 'error');
    }
    await refresh();
}

function startAllAuto() {
    const names = state.rendered
        .filter((s) => s.state === 'Stopped' && s.startType.startsWith('Automatic'))
        .map((s) => s.name);
    if (!names.length) { toast('No stopped Automatic services in this view.', 'err'); return; }
    setStatus(`Starting ${names.length} Automatic service(s)…`, 'busy');
    StartServices(names).then((res) => {
        const ok = res.filter((r) => r.ok).length;
        toast(`Started ${ok}/${names.length} Automatic service(s).`, ok === names.length ? 'ok' : 'err');
        refresh();
    });
}

// ---------- context menu ----------
function closeContextMenu() {
    const m = document.getElementById('ctx-menu');
    if (m) m.remove();
}

function openContextMenu(ev, svc, index) {
    closeContextMenu();
    // If the right-clicked row isn't part of the selection, select just it.
    if (!state.selection.has(svc.name)) {
        state.selection.clear();
        state.selection.add(svc.name);
        state.lastIndex = index;
        renderTable();
    }
    const n = state.selection.size;
    const fav = state.config.favorites.includes(svc.name);

    const menu = el('div', 'ctx-menu');
    menu.id = 'ctx-menu';
    const target = n > 1 ? `${n} services` : (svc.displayName || svc.name);
    menu.appendChild(el('div', 'ctx-title', esc(target)));

    const add = (ico, label, fn, cls) => {
        const it = el('div', 'ctx-item' + (cls ? ' ' + cls : ''));
        it.innerHTML = `<span class="ico">${ico}</span><span>${esc(label)}</span>`;
        it.onclick = () => { closeContextMenu(); fn(); };
        menu.appendChild(it);
    };
    const sep = () => menu.appendChild(el('div', 'ctx-sep'));

    add('▶', 'Start', () => runAction('Started', StartServices));
    add('⏹', 'Stop', () => runAction('Stopped', StopServices), 'danger');
    add('↻', 'Restart', () => runAction('Restarted', RestartServices));
    sep();
    add('A', 'Set Automatic', () => runAction('Set auto', (ns) => SetStartType(ns, 'auto')));
    add('M', 'Set Manual', () => runAction('Set manual', (ns) => SetStartType(ns, 'manual')));
    add('D', 'Set Disabled', () => runAction('Set disabled', (ns) => SetStartType(ns, 'disabled')), 'danger');
    sep();
    add('★', fav ? 'Remove from Favorites' : 'Add to Favorites', () => toggleFavorite(svc.name));
    add('⧉', 'Copy service name', () => copyText(svc.name));

    // position, keeping the menu on-screen
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    let x = ev.clientX, y = ev.clientY;
    if (x + r.width > window.innerWidth) x = window.innerWidth - r.width - 6;
    if (y + r.height > window.innerHeight) y = window.innerHeight - r.height - 6;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        toast('Copied: ' + text, 'ok');
    } catch {
        toast('Copy failed.', 'err');
    }
}

// ---------- export ----------
function exportData() {
    const rows = state.rendered;
    const view = currentView();
    const name = view ? (view.label || view.name) : 'services';
    const root = $('#modal-root');
    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal" style="width:420px;">
          <div class="modal-head">Export view</div>
          <div class="modal-body">
            <p style="color:var(--subtext1);">Export <b>${rows.length}</b> service(s) from
            “${esc(name)}”. Choose a format:</p>
          </div>
          <div class="modal-foot">
            <button class="btn ghost" id="x-cancel">Cancel</button>
            <div style="display:flex;gap:8px;">
              <button class="btn ghost" id="x-json">Export JSON</button>
              <button class="btn" style="background:var(--mauve)" id="x-csv">Export CSV</button>
            </div>
          </div>
        </div>
      </div>`;
    const close = () => { root.innerHTML = ''; };
    $('#x-cancel').onclick = close;
    $('.modal-backdrop').onclick = (e) => { if (e.target.classList.contains('modal-backdrop')) close(); };
    $('#x-csv').onclick = () => { close(); doExport('csv'); };
    $('#x-json').onclick = () => { close(); doExport('json'); };
}

function doExport(fmt) {
    const rows = state.rendered;
    let blob, fname;
    if (fmt === 'csv') {
        const head = ['Name', 'DisplayName', 'State', 'StartType', 'PID', 'Account'];
        const lines = [head.join(',')].concat(rows.map((s) =>
            [s.name, s.displayName, s.state, s.startType, s.pid || '', accountLabel(s.account)]
                .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')));
        blob = new Blob([lines.join('\r\n')], { type: 'text/csv' });
        fname = 'services.csv';
    } else {
        blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
        fname = 'services.json';
    }
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url; a.download = fname; a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${rows.length} services.`, 'ok');
}

// ---------- custom views modal ----------
function openViewModal(existing) {
    const view = existing || { id: '', name: '', account: '', services: [] };
    const isEdit = !!existing;
    const root = $('#modal-root');

    const picked = new Set(view.services || []);
    const accounts = accountCounts();

    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal">
          <div class="modal-head">${isEdit ? 'Edit view' : 'New view'}</div>
          <div class="modal-body">
            <div class="field">
              <label>View name</label>
              <input type="text" id="m-name" value="${esc(view.name)}" placeholder="e.g. Bots, Web stack, SQL…"/>
            </div>
            <div class="field">
              <label>Filter by logon account (optional)</label>
              <input type="text" id="m-acct" value="${esc(view.account || '')}" placeholder="substring, e.g. svc-bots"/>
              <span class="hint">Any service whose “Log On As” account contains this text is included.</span>
            </div>
            <div class="field">
              <label>Pick specific services (optional)</label>
              <input type="text" id="m-filter" placeholder="filter list…"/>
              <div class="svc-picker" id="m-picker"></div>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn ghost" id="m-delete" style="${isEdit ? '' : 'visibility:hidden'}">Delete</button>
            <div style="display:flex;gap:8px;">
              <button class="btn ghost" id="m-cancel">Cancel</button>
              <button class="btn" style="background:var(--mauve)" id="m-save">Save</button>
            </div>
          </div>
        </div>
      </div>`;

    const picker = $('#m-picker');
    const drawPicker = (filter = '') => {
        picker.innerHTML = '';
        const f = filter.toLowerCase();
        state.services
            .filter((s) => !f || s.name.toLowerCase().includes(f) || (s.displayName || '').toLowerCase().includes(f))
            .slice(0, 400)
            .forEach((s) => {
                const lab = el('label');
                lab.innerHTML = `<input type="checkbox" ${picked.has(s.name) ? 'checked' : ''}/>
                    <span>${esc(s.displayName || s.name)} <span style="color:var(--overlay1)">· ${esc(s.name)}</span></span>`;
                lab.querySelector('input').onchange = (e) => {
                    if (e.target.checked) picked.add(s.name); else picked.delete(s.name);
                };
                picker.appendChild(lab);
            });
    };
    drawPicker();
    $('#m-filter').oninput = (e) => drawPicker(e.target.value);

    const close = () => { root.innerHTML = ''; };
    $('#m-cancel').onclick = close;
    $('.modal-backdrop').onclick = (e) => { if (e.target.classList.contains('modal-backdrop')) close(); };
    $('#m-save').onclick = () => {
        const name = $('#m-name').value.trim();
        if (!name) { toast('Give the view a name.', 'err'); return; }
        const data = {
            id: view.id || ('v' + Date.now().toString(36)),
            name,
            account: $('#m-acct').value.trim(),
            services: [...picked],
        };
        if (isEdit) {
            const idx = state.config.views.findIndex((v) => v.id === view.id);
            state.config.views[idx] = data;
        } else {
            state.config.views.push(data);
        }
        persist();
        state.view = { type: 'custom', id: data.id };
        close();
        renderAll();
        toast(`View “${name}” saved.`, 'ok');
    };
    $('#m-delete').onclick = () => {
        state.config.views = state.config.views.filter((v) => v.id !== view.id);
        if (state.view.type === 'custom' && state.view.id === view.id)
            state.view = { type: 'builtin', id: 'all' };
        persist();
        close();
        renderAll();
        toast('View deleted.', 'ok');
    };
}

// ---------- about ----------
function openAbout() {
    const root = $('#modal-root');
    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal" style="width:440px;">
          <div class="modal-head">About</div>
          <div class="modal-body">
            <div class="about-row">
              <img class="about-logo" src="/logo.png" alt="Kaizoku"/>
              <div>
                <div style="font-size:17px;font-weight:700;">Kaizoku Service Manager</div>
                <div style="color:var(--subtext0);margin-top:2px;">${VERSION}</div>
                <div style="color:var(--overlay1);font-size:12px;margin-top:6px;">AGPL-3.0 &copy; 2026 TsunayoshiSawada</div>
              </div>
            </div>
            <p style="color:var(--subtext1);">Manage Windows services grouped by logon account and your own custom views.</p>
          </div>
          <div class="modal-foot">
            <button class="btn ghost" id="a-close">Close</button>
            <button class="btn" style="background:var(--mauve)" id="a-github">View on GitHub</button>
          </div>
        </div>
      </div>`;
    const close = () => { root.innerHTML = ''; };
    $('#a-close').onclick = close;
    $('.modal-backdrop').onclick = (e) => { if (e.target.classList.contains('modal-backdrop')) close(); };
    $('#a-github').onclick = () => { BrowserOpenURL(GITHUB_URL); };
}

// ---------- misc ----------
function selectView(v) {
    state.view = v;
    state.selection.clear();
    state.lastIndex = -1;
    renderAll();
}

function setStatus(msg, cls) {
    const s = $('#status');
    s.textContent = msg;
    s.className = cls || '';
}

let toastTimer = [];
function toast(msg, kind) {
    const t = el('div', 'toast ' + (kind || ''), msg);
    $('#toast-root').appendChild(t);
    const id = setTimeout(() => t.remove(), 4200);
    toastTimer.push(id);
}

async function persist() {
    try { await SaveConfig(state.config); }
    catch (err) { console.error('save config', err); }
}

// ---------- wiring ----------
function wire() {
    $('#refresh-btn').onclick = refresh;
    $('#new-view-btn').onclick = () => openViewModal(null);
    $('#about-btn').onclick = openAbout;
    $('#start-all-auto').onclick = startAllAuto;
    $('#export-btn').onclick = exportData;

    document.querySelectorAll('[data-act]').forEach((b) => {
        b.onclick = () => {
            const act = b.dataset.act;
            if (act === 'start') runAction('Started', StartServices);
            if (act === 'stop') runAction('Stopped', StopServices);
            if (act === 'restart') runAction('Restarted', RestartServices);
        };
    });
    document.querySelectorAll('[data-startmode]').forEach((b) => {
        b.onclick = () => runAction('Set ' + b.dataset.startmode,
            (names) => SetStartType(names, b.dataset.startmode));
    });

    $('#search').oninput = (e) => { state.search = e.target.value; renderTable(); };

    $('#check-all').onclick = (e) => {
        if (e.target.checked) state.rendered.forEach((s) => state.selection.add(s.name));
        else state.rendered.forEach((s) => state.selection.delete(s.name));
        renderTable();
    };

    document.querySelectorAll('#grid th.sortable').forEach((th) => {
        th.onclick = () => {
            const k = th.dataset.sort;
            if (state.sort.key === k) state.sort.dir *= -1;
            else state.sort = { key: k, dir: 1 };
            renderTable();
        };
    });

    document.addEventListener('mousedown', (e) => {
        const m = document.getElementById('ctx-menu');
        if (m && !m.contains(e.target)) closeContextMenu();
    });
    document.addEventListener('scroll', closeContextMenu, true);
    window.addEventListener('blur', closeContextMenu);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeContextMenu();
        if (e.key === 'F5') { e.preventDefault(); refresh(); }
        if (e.key === '/' && document.activeElement !== $('#search')) { e.preventDefault(); $('#search').focus(); }
        if (e.ctrlKey && e.key.toLowerCase() === 'a' && document.activeElement !== $('#search')) {
            e.preventDefault();
            state.rendered.forEach((s) => state.selection.add(s.name));
            renderTable();
        }
    });
}

async function init() {
    wire();
    try { state.config = await GetConfig(); }
    catch (err) { console.error('load config', err); }
    if (!state.config.views) state.config.views = [];
    if (!state.config.favorites) state.config.favorites = [];
    await refresh();
}

init();

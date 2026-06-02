import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

// ── 状態 ──
let records = [];
let selectedId = null;
let editingId = null;
let searchQuery = '';

// ── DB操作 ──
async function fetchAll() {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchAll:', error); return []; }
  return data;
}

async function dbInsert(payload) {
  const { data, error } = await supabase
    .from('expenses')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function dbUpdate(id, payload) {
  const { error } = await supabase
    .from('expenses')
    .update(payload)
    .eq('id', id);
  if (error) throw error;
}

async function dbDelete(id) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── ユーティリティ ──
function formatAmount(n) {
  return '¥' + Number(n).toLocaleString('ja-JP');
}

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${y}年${m}月${d}日`;
}

function statusLabel(status) {
  return status === 'settled' ? '精算済' : '申請中';
}

function statusBadgeClass(status) {
  return status === 'settled'
    ? 'bg-green-100 text-green-700'
    : 'bg-amber-100 text-amber-700';
}

// ── 画面切替 ──
function switchPane(mode) {
  document.getElementById('pane-empty').classList.toggle('hidden', mode !== 'empty');
  document.getElementById('pane-detail').classList.toggle('hidden', mode !== 'detail');
  document.getElementById('pane-form').classList.toggle('hidden', mode !== 'form');
}

// ── サマリ更新 ──
function updateSummary() {
  const total = records.reduce((s, r) => s + r.amount, 0);
  const pending = records.filter(r => r.status === 'pending').length;
  const settled = records.filter(r => r.status === 'settled').length;
  document.getElementById('summary-total').textContent = formatAmount(total);
  document.getElementById('summary-pending').textContent = `${pending}件`;
  document.getElementById('summary-settled').textContent = `${settled}件`;
}

// ── カードリスト描画 ──
function renderList() {
  const list = document.getElementById('expense-list');
  const q = searchQuery.toLowerCase();
  const filtered = records.filter(
    r => !q || r.memo.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
  );

  list.innerHTML = '';
  if (filtered.length === 0) {
    list.innerHTML = '<p class="text-center text-gray-400 text-sm py-8">該当する経費がありません</p>';
    return;
  }
  filtered.forEach(r => list.appendChild(buildCard(r)));
}

function buildCard(r) {
  const div = document.createElement('div');
  div.id = `card-${r.id}`;
  const isSelected = r.id === selectedId;
  div.className = [
    'rounded-lg p-3 cursor-pointer shadow-sm border transition-colors',
    isSelected
      ? 'border-orange-300 bg-orange-50'
      : 'border-gray-200 bg-white hover:bg-gray-50',
  ].join(' ');
  if (isSelected) {
    div.style.borderLeftWidth = '4px';
    div.style.borderLeftColor = '#c15f3c';
  }
  div.innerHTML = `
    <div class="flex items-start justify-between mb-1">
      <span class="text-xs text-gray-500">${formatDate(r.date)}</span>
      <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(r.status)}">${statusLabel(r.status)}</span>
    </div>
    <div class="flex items-center justify-between mb-1">
      <span class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">${r.category}</span>
      <span class="text-base font-bold" style="color: #c15f3c;">${formatAmount(r.amount)}</span>
    </div>
    ${r.memo ? `<p class="text-xs text-gray-500 truncate">${r.memo}</p>` : ''}
  `;
  div.addEventListener('click', () => selectRecord(r.id));
  return div;
}

// ── 詳細表示 ──
function selectRecord(id) {
  selectedId = id;
  const r = records.find(rec => rec.id === id);
  if (!r) return;

  document.getElementById('detail-date').textContent = formatDate(r.date);
  document.getElementById('detail-category').textContent = r.category;
  document.getElementById('detail-amount').textContent = formatAmount(r.amount);
  document.getElementById('detail-memo').textContent = r.memo || '（なし）';
  const statusEl = document.getElementById('detail-status');
  statusEl.textContent = statusLabel(r.status);
  statusEl.className = `px-3 py-1 rounded-full text-sm font-medium ${statusBadgeClass(r.status)}`;
  document.getElementById('btn-toggle-status').textContent =
    r.status === 'pending' ? '精算済にする' : '申請中に戻す';

  switchPane('detail');
  renderList();
}

// ── フォーム表示 ──
function openForm(id = null) {
  editingId = id;
  document.getElementById('form-title').textContent = id ? '編集' : '新規登録';
  document.getElementById('form-error').classList.add('hidden');

  if (id) {
    const r = records.find(rec => rec.id === id);
    document.getElementById('form-date').value = r.date;
    document.getElementById('form-category').value = r.category;
    document.getElementById('form-amount').value = r.amount;
    document.getElementById('form-memo').value = r.memo;
  } else {
    document.getElementById('form-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('form-category').value = '';
    document.getElementById('form-amount').value = '';
    document.getElementById('form-memo').value = '';
  }
  switchPane('form');
}

// ── フォームバリデーション ──
function validateForm() {
  const date = document.getElementById('form-date').value.trim();
  const category = document.getElementById('form-category').value;
  const amount = parseInt(document.getElementById('form-amount').value, 10);

  if (!date) return '日付を入力してください。';
  if (!category) return 'カテゴリを選択してください。';
  if (!amount || amount < 1) return '金額は1円以上の整数で入力してください。';
  return null;
}

// ── 保存 ──
async function saveForm() {
  const errorMsg = validateForm();
  if (errorMsg) {
    const el = document.getElementById('form-error');
    el.textContent = errorMsg;
    el.classList.remove('hidden');
    return;
  }

  const date     = document.getElementById('form-date').value.trim();
  const category = document.getElementById('form-category').value;
  const amount   = parseInt(document.getElementById('form-amount').value, 10);
  const memo     = document.getElementById('form-memo').value.trim();

  try {
    if (editingId) {
      await dbUpdate(editingId, { date, category, amount, memo });
      selectedId = editingId;
    } else {
      const newRecord = await dbInsert({ date, category, amount, memo, status: 'pending' });
      selectedId = newRecord.id;
    }
    records = await fetchAll();
    updateSummary();
    renderList();
    selectRecord(selectedId);
  } catch (e) {
    console.error('saveForm:', e);
    const el = document.getElementById('form-error');
    el.textContent = '保存に失敗しました。もう一度お試しください。';
    el.classList.remove('hidden');
  }
}

// ── 削除 ──
async function deleteRecord() {
  if (!selectedId) return;
  if (!confirm('この経費を削除しますか？')) return;
  try {
    await dbDelete(selectedId);
    selectedId = null;
    records = await fetchAll();
    updateSummary();
    renderList();
    switchPane('empty');
  } catch (e) {
    console.error('deleteRecord:', e);
    alert('削除に失敗しました。');
  }
}

// ── ステータス切替 ──
async function toggleStatus() {
  if (!selectedId) return;
  const r = records.find(rec => rec.id === selectedId);
  const newStatus = r.status === 'pending' ? 'settled' : 'pending';
  try {
    await dbUpdate(selectedId, { status: newStatus });
    records = await fetchAll();
    updateSummary();
    renderList();
    selectRecord(selectedId);
  } catch (e) {
    console.error('toggleStatus:', e);
    alert('ステータスの更新に失敗しました。');
  }
}

// ── 集計モーダル ──
async function openStatsModal() {
  document.getElementById('modal-stats').classList.remove('hidden');
  document.getElementById('modal-category-totals').innerHTML = '<p class="text-sm text-gray-400">読み込み中...</p>';
  document.getElementById('modal-status-counts').innerHTML = '<p class="text-sm text-gray-400">読み込み中...</p>';

  const [catResult, statusResult] = await Promise.all([
    supabase.rpc('get_category_totals'),
    supabase.rpc('get_status_counts'),
  ]);

  if (catResult.error) {
    console.error('get_category_totals:', catResult.error);
  } else {
    const catEl = document.getElementById('modal-category-totals');
    catEl.innerHTML = catResult.data.length === 0
      ? '<p class="text-sm text-gray-400">データがありません</p>'
      : catResult.data.map(row => `
          <div class="flex items-center justify-between py-1 border-b border-gray-50">
            <span class="text-sm text-gray-600">${row.category}</span>
            <span class="text-sm font-semibold text-gray-800">${formatAmount(row.total)}</span>
          </div>
        `).join('');
  }

  if (statusResult.error) {
    console.error('get_status_counts:', statusResult.error);
  } else {
    const statusEl = document.getElementById('modal-status-counts');
    statusEl.innerHTML = statusResult.data.length === 0
      ? '<p class="text-sm text-gray-400">データがありません</p>'
      : statusResult.data.map(row => `
          <div class="flex items-center justify-between py-1">
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(row.status)}">${statusLabel(row.status)}</span>
            <span class="text-sm font-semibold text-gray-800">${row.count}件</span>
          </div>
        `).join('');
  }
}

function closeStatsModal() {
  document.getElementById('modal-stats').classList.add('hidden');
}

// ── イベント登録 ──
function bindEvents() {
  document.getElementById('btn-new').addEventListener('click', () => {
    selectedId = null;
    renderList();
    openForm(null);
  });
  document.getElementById('search-input').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderList();
  });
  document.getElementById('btn-edit').addEventListener('click', () => openForm(selectedId));
  document.getElementById('btn-delete').addEventListener('click', deleteRecord);
  document.getElementById('btn-toggle-status').addEventListener('click', toggleStatus);
  document.getElementById('btn-save').addEventListener('click', saveForm);
  document.getElementById('btn-cancel').addEventListener('click', () => {
    if (selectedId) { selectRecord(selectedId); } else { switchPane('empty'); }
  });
  document.getElementById('btn-stats').addEventListener('click', openStatsModal);
  document.getElementById('btn-close-modal').addEventListener('click', closeStatsModal);
  document.getElementById('modal-stats').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeStatsModal();
  });
}

// ── 初期化 ──
async function init() {
  records = await fetchAll();
  bindEvents();
  updateSummary();
  renderList();
  switchPane('empty');
}

init();

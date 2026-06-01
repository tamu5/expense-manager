(function () {
  'use strict';

  // ── 定数 ──
  const STORAGE_KEY = 'expense-records';

  // ── 状態 ──
  let records = [];
  let selectedId = null;
  let editingId = null; // null = 新規、文字列 = 編集中のID
  let searchQuery = '';

  // ── localStorage ──
  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveRecords() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  // ── 初期データ投入 ──
  function seedIfEmpty() {
    if (records.length > 0) return;
    const now = new Date();
    const daysAgo = (n) => {
      const d = new Date(now);
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10);
    };
    const seeds = [
      { date: daysAgo(2),  category: '交通費', amount: 1240,  memo: '東京〜新宿 往復',          status: 'pending'  },
      { date: daysAgo(5),  category: '会議費', amount: 3800,  memo: '社内MTG コーヒー代',        status: 'settled'  },
      { date: daysAgo(9),  category: '接待費', amount: 12600, memo: '〇〇社様 会食',            status: 'settled'  },
      { date: daysAgo(15), category: '消耗品', amount: 550,   memo: 'ボールペン・ノート',         status: 'pending'  },
      { date: daysAgo(22), category: '通信費', amount: 2200,  memo: 'モバイルWi-Fi 追加チャージ', status: 'pending'  },
    ];
    seeds.forEach((s, i) => {
      records.push({
        id: String(Date.now() + i),
        date: s.date,
        category: s.category,
        amount: s.amount,
        memo: s.memo,
        status: s.status,
        createdAt: new Date(now.getTime() - i * 1000).toISOString(),
      });
    });
    saveRecords();
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
    const filtered = records
      .filter(r => !q || r.memo.toLowerCase().includes(q) || r.category.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    list.innerHTML = '';
    if (filtered.length === 0) {
      list.innerHTML = '<p class="text-center text-gray-400 text-sm py-8">該当する経費がありません</p>';
      return;
    }
    filtered.forEach(r => {
      const card = buildCard(r);
      list.appendChild(card);
    });
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
    renderList(); // カードのハイライト更新
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
  function saveForm() {
    const error = validateForm();
    if (error) {
      const el = document.getElementById('form-error');
      el.textContent = error;
      el.classList.remove('hidden');
      return;
    }
    const date = document.getElementById('form-date').value.trim();
    const category = document.getElementById('form-category').value;
    const amount = parseInt(document.getElementById('form-amount').value, 10);
    const memo = document.getElementById('form-memo').value.trim();

    if (editingId) {
      const idx = records.findIndex(r => r.id === editingId);
      records[idx] = { ...records[idx], date, category, amount, memo };
      selectedId = editingId;
    } else {
      const newRecord = {
        id: String(Date.now()),
        date, category, amount, memo,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      records.unshift(newRecord);
      selectedId = newRecord.id;
    }
    saveRecords();
    updateSummary();
    renderList();
    selectRecord(selectedId);
  }

  // ── 削除 ──
  function deleteRecord() {
    if (!selectedId) return;
    if (!confirm('この経費を削除しますか？')) return;
    records = records.filter(r => r.id !== selectedId);
    selectedId = null;
    saveRecords();
    updateSummary();
    renderList();
    switchPane('empty');
  }

  // ── ステータス切替 ──
  function toggleStatus() {
    if (!selectedId) return;
    const r = records.find(rec => rec.id === selectedId);
    r.status = r.status === 'pending' ? 'settled' : 'pending';
    saveRecords();
    updateSummary();
    renderList();
    selectRecord(selectedId);
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
      if (selectedId) {
        selectRecord(selectedId);
      } else {
        switchPane('empty');
      }
    });
  }

  // ── 初期化 ──
  function init() {
    records = loadRecords();
    seedIfEmpty();
    bindEvents();
    updateSummary();
    renderList();
    switchPane('empty');
  }

  init();

})();

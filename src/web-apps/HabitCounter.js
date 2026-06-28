export default `<!DOCTYPE html>
<html lang="ja">

<head>

<script>
(function() {
  // 1. 未キャッチのエラーをReactNativeに通知、およびconsole.errorに出力
  window.onerror = function(message, source, lineno, colno, error) {
    const errorMsg = "[JS Error] " + message + " at " + source + ":" + lineno + ":" + colno;
    console.error(errorMsg);
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'WEB_ERROR',
          message: errorMsg
        }));
      }
    } catch (e) {}
    return false;
  };

  // 2. Service Worker登録の無効化（エラー防止）
  if ('serviceWorker' in navigator) {
    Object.defineProperty(navigator, 'serviceWorker', {
      get: function() { return undefined; },
      configurable: true
    });
  }

  // 3. Android WebViewのセキュリティ制限対策：localStorageをインメモリのモック（ポリフィル）に差し替え
  const storageStore = {};
  const mockLocalStorage = {
    getItem: function(key) {
      return storageStore.hasOwnProperty(key) ? storageStore[key] : null;
    },
    setItem: function(key, value) {
      storageStore[key] = String(value);
      if (window.isInitialSync) return;
      try {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'LOCAL_STORAGE_SET',
            key: key,
            value: String(value)
          }));
        }
      } catch (e) {
        console.error("Failed to post setItem message", e);
      }
    },
    removeItem: function(key) {
      delete storageStore[key];
      if (window.isInitialSync) return;
      try {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'LOCAL_STORAGE_REMOVE',
            key: key
          }));
        }
      } catch (e) {
        console.error("Failed to post removeItem message", e);
      }
    },
    clear: function() {
      for (const key in storageStore) {
        delete storageStore[key];
      }
      if (window.isInitialSync) return;
      try {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'LOCAL_STORAGE_CLEAR'
          }));
        }
      } catch (e) {
        console.error("Failed to post clear message", e);
      }
    },
    key: function(index) {
      const keys = Object.keys(storageStore);
      return keys[index] || null;
    },
    get length() {
      return Object.keys(storageStore).length;
    }
  };

  // window.localStorageをモックで上書き
  try {
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true
    });
  } catch (e) {
    console.error("Failed to override window.localStorage", e);
  }
})();
</script>

    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>習慣カウンター</title>
    
    <style>
:root {
    --bg-color: #121212;
    --text-color: #ffffff;
    --card-bg: rgba(255, 255, 255, 0.05);
    --glass-border: rgba(255, 255, 255, 0.1);
    --primary-gradient: linear-gradient(135deg, #6C5CE7, #a29bfe);
    --danger-color: #ff6b6b;
    --font-main: 'Outfit', sans-serif;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
}

body {
    background-color: var(--bg-color);
    color: var(--text-color);
    font-family: var(--font-main);
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.app-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 20px;
    max-width: 600px;
    /* Tablet limit */
    margin: 0 auto;
    width: 100%;
}

header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

h1 {
    font-weight: 700;
    font-size: 1.5rem;
    letter-spacing: 0.5px;
}

.icon-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 10px;
    border-radius: 50%;
    transition: background 0.2s;
}

.icon-btn:active {
    background: rgba(255, 255, 255, 0.1);
}

.grid-container {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    overflow-y: auto;
    padding-bottom: 20px;
    flex: 1;
}

.grid-container.grid-3-cols {
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
}

/* Card Styles */
.habit-card,
.add-card {
    background: var(--card-bg);
    border: 1px solid var(--glass-border);
    border-radius: 20px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    aspect-ratio: 1 / 1;
    cursor: pointer;
    transition: transform 0.1s, background 0.2s;
    user-select: none;
    position: relative;
    overflow: hidden;
}

.habit-card:active {
    transform: scale(0.95);
    background: rgba(255, 255, 255, 0.1);
}

.add-card {
    border: 2px dashed var(--glass-border);
    justify-content: center;
}

.add-card span {
    font-size: 3rem;
    color: rgba(255, 255, 255, 0.5);
}

.habit-count {
    font-size: 3.5rem;
    font-weight: 700;
}

.habit-name {
    font-size: 1rem;
    font-weight: 300;
    opacity: 0.8;
}

/* Ripple Animation */
.ripple {
    position: absolute;
    border-radius: 50%;
    transform: scale(0);
    animation: ripple-effect 0.6s linear;
    background-color: rgba(255, 255, 255, 0.3);
    pointer-events: none;
}

@keyframes ripple-effect {
    to {
        transform: scale(4);
        opacity: 0;
    }
}

/* Modal Styles */
.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100;
    opacity: 1;
    transition: opacity 0.3s;
    backdrop-filter: blur(5px);
}

.modal.hidden {
    opacity: 0;
    pointer-events: none;
}

.modal-content.glass {
    background: rgba(30, 30, 30, 0.9);
    border: 1px solid var(--glass-border);
    padding: 30px;
    border-radius: 24px;
    width: 85%;
    max-width: 350px;
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    text-align: center;
}

.modal-content h2 {
    margin-bottom: 20px;
    font-size: 1.2rem;
}

input {
    width: 100%;
    padding: 12px;
    margin-bottom: 20px;
    border-radius: 12px;
    border: 1px solid var(--glass-border);
    background: rgba(255, 255, 255, 0.05);
    color: white;
    font-size: 1rem;
    outline: none;
}

input:focus {
    border-color: #a29bfe;
}

/* Color Picker */
.color-picker {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-bottom: 25px;
}

.color-btn {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 2px solid transparent;
    background: var(--bg);
    cursor: pointer;
}

.color-btn.selected {
    border-color: white;
    transform: scale(1.2);
}

/* Buttons */
.modal-actions {
    display: flex;
    justify-content: space-around;
    gap: 10px;
}

.text-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    padding: 10px 20px;
    font-size: 1rem;
    cursor: pointer;
}

.text-btn:active {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
}

.primary-btn {
    background: white;
    color: black;
    border: none;
    padding: 10px 30px;
    border-radius: 20px;
    font-weight: 500;
    font-size: 1rem;
    cursor: pointer;
}

/* Stats List */
.stats-list {
    list-style: none;
    text-align: left;
    max-height: 50vh;
    overflow-y: auto;
    margin-bottom: 20px;
}

.stats-item {
    display: flex;
    justify-content: space-between;
    padding: 15px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    transition: background 0.2s;
    border-radius: 8px;
}

.stats-item:active {
    background: rgba(255, 255, 255, 0.1);
}

.stats-count {
    font-weight: 700;
    color: #a29bfe;
}

.date-label {
    margin-bottom: 15px;
    opacity: 0.6;
    font-size: 0.9rem;
}

/* Stats Navigation */
.date-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.icon-btn-small {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 0.8rem;
}

/* Detail View */
.detail-header {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 20px;
}

.text-btn-small {
    background: none;
    border: none;
    color: #a29bfe;
    cursor: pointer;
    font-size: 0.9rem;
}

/* Trend Chart */
.trend-chart {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    height: 150px;
    margin-bottom: 30px;
    padding-top: 20px;
    gap: 5px;
}

.chart-bar-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
}

.chart-bar {
    width: 80%;
    background: var(--primary-gradient);
    border-radius: 4px 4px 0 0;
    transition: height 0.5s ease;
    min-height: 4px;
}

.chart-label {
    font-size: 0.7rem;
    margin-top: 5px;
    opacity: 0.6;
}

.chart-value {
    font-size: 0.7rem;
    margin-bottom: 2px;
    font-weight: bold;
}

/* Edit Modal Controls */
.counter-control {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 20px;
    margin: 30px 0;
}

.circle-btn {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.2);
    background: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
}

.circle-btn:active {
    background: rgba(255, 255, 255, 0.1);
    border-color: white;
}

.count-display {
    font-size: 3rem;
    font-weight: 700;
    min-width: 80px;
}
</style>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;700&display=swap" rel="stylesheet">
    <meta name="theme-color" content="#121212">
</head>

<body>
    <div class="app-container">
        <header>
            <h1>習慣カウンター</h1>
            <button id="stats-btn" class="icon-btn" aria-label="統計">
                📊
            </button>
        </header>

        <main id="grid-container" class="grid-container">
            <!-- Items will be injected here -->
            <button id="add-btn" class="add-card" aria-label="項目を追加">
                <span>+</span>
            </button>
        </main>
    </div>

    <!-- Add Item Modal -->
    <div id="add-modal" class="modal hidden">
        <div class="modal-content glass">
            <h2>新しい習慣を追加</h2>
            <input type="text" id="new-item-name" placeholder="例: 水を飲む" autocomplete="off">
            <div class="color-picker">
                <button class="color-btn" style="--bg: linear-gradient(135deg, #FF6B6B, #EE5253)"
                    data-color="red"></button>
                <button class="color-btn" style="--bg: linear-gradient(135deg, #48DBFB, #0ABDE3)"
                    data-color="blue"></button>
                <button class="color-btn" style="--bg: linear-gradient(135deg, #1DD1A1, #10AC84)"
                    data-color="green"></button>
                <button class="color-btn" style="--bg: linear-gradient(135deg, #FECA57, #FF9F43)"
                    data-color="yellow"></button>
                <button class="color-btn" style="--bg: linear-gradient(135deg, #A29BFE, #6C5CE7)"
                    data-color="purple"></button>
            </div>
            <div class="modal-actions">
                <button id="cancel-add" class="text-btn">キャンセル</button>
                <button id="confirm-add" class="primary-btn">追加</button>
            </div>
        </div>
    </div>

    <!-- Stats Modal -->
    <div id="stats-modal" class="modal hidden">
        <div class="modal-content glass" style="max-width: 400px;">
            <h2>記録の統計</h2>

            <!-- Date Navigation -->
            <div class="date-nav">
                <button id="prev-day" class="icon-btn-small">◀</button>
                <p id="current-date" class="date-label">2026年X月X日</p>
                <button id="next-day" class="icon-btn-small">▶</button>
            </div>

            <!-- Main Stats List -->
            <div id="stats-view-main">
                <ul id="stats-list" class="stats-list">
                    <!-- Stats will be injected here -->
                </ul>
            </div>

            <!-- Detail/Trend View (Hidden by default) -->
            <div id="stats-view-detail" class="hidden">
                <div class="detail-header">
                    <button id="back-to-stats" class="text-btn-small">← 戻る</button>
                    <h3 id="detail-item-name">項目名</h3>
                </div>

                <!-- Trend Navigation -->
                <div class="date-nav" style="margin-bottom: 10px;">
                    <button id="trend-prev" class="icon-btn-small">◀</button>
                    <span id="trend-date-range" class="date-label" style="margin:0; font-size: 0.8rem;">期間</span>
                    <button id="trend-next" class="icon-btn-small">▶</button>
                </div>

                <!-- Simple CSS Bar Chart -->
                <div id="trend-chart" class="trend-chart">
                    <!-- Bars will be injected here -->
                </div>
            </div>

            <button id="close-stats" class="text-btn">閉じる</button>
        </div>
    </div>

    <!-- Edit Count Modal -->
    <div id="edit-modal" class="modal hidden">
        <div class="modal-content glass">
            <h2>回数の修正</h2>
            <p id="edit-item-name" class="date-label">項目名</p>
            <div class="counter-control">
                <button id="decrease-count" class="circle-btn">-</button>
                <span id="edit-count-value" class="count-display">0</span>
                <button id="increase-count" class="circle-btn">+</button>
            </div>
            <div class="modal-actions">
                <button id="delete-item" class="text-btn" style="color: var(--danger-color);">削除</button>
                <button id="cancel-edit" class="text-btn">キャンセル</button>
                <button id="save-edit" class="primary-btn">保存</button>
            </div>
        </div>
    </div>

    <script>
// State
let items = [];
let logs = [];
let currentStatsDate = new Date();
let longPressTimer;
let isLongPress = false;
let editingItemId = null;
let editingDate = null;

// Trend View State
let currentTrendItemId = null;
let currentTrendEndDate = new Date();

// DOM Elements
const gridContainer = document.getElementById('grid-container');
const addBtn = document.getElementById('add-btn');
const addModal = document.getElementById('add-modal');
const confirmAddBtn = document.getElementById('confirm-add');
const cancelAddBtn = document.getElementById('cancel-add');
const newItemInput = document.getElementById('new-item-name');
const colorBtns = document.querySelectorAll('.color-btn');

const statsBtn = document.getElementById('stats-btn');
const statsModal = document.getElementById('stats-modal');
const closeStatsBtn = document.getElementById('close-stats');
const statsList = document.getElementById('stats-list');
const currentDateEl = document.getElementById('current-date');
const prevDayBtn = document.getElementById('prev-day');
const nextDayBtn = document.getElementById('next-day');
const statsViewMain = document.getElementById('stats-view-main');
const statsViewDetail = document.getElementById('stats-view-detail');
const detailItemName = document.getElementById('detail-item-name');
const trendChart = document.getElementById('trend-chart');
const backToStatsBtn = document.getElementById('back-to-stats');
// Trend Nav Elements
const trendPrevBtn = document.getElementById('trend-prev');
const trendNextBtn = document.getElementById('trend-next');
const trendDateRangeEl = document.getElementById('trend-date-range');


// Edit Modal Elements
const editModal = document.getElementById('edit-modal');
const editItemName = document.getElementById('edit-item-name');
const editCountValue = document.getElementById('edit-count-value');
const decreaseCountBtn = document.getElementById('decrease-count');
const increaseCountBtn = document.getElementById('increase-count');
const cancelEditBtn = document.getElementById('cancel-edit');
const saveEditBtn = document.getElementById('save-edit');
const deleteBtn = document.getElementById('delete-item');


// Selected Color State
let selectedColor = 'linear-gradient(135deg, #FF6B6B, #EE5253)'; // default

// Initialization
function init() {
    loadData();
    render();
    setupEventListeners();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function loadData() {
    const savedItems = localStorage.getItem('habit-items');
    const savedLogs = localStorage.getItem('habit-logs');

    if (savedItems) items = JSON.parse(savedItems);
    if (savedLogs) logs = JSON.parse(savedLogs);
}

function saveData() {
    localStorage.setItem('habit-items', JSON.stringify(items));
    localStorage.setItem('habit-logs', JSON.stringify(logs));
}

function setupEventListeners() {
    // Modals
    addBtn.addEventListener('click', () => {
        newItemInput.value = '';
        addModal.classList.remove('hidden');
        newItemInput.focus();
    });

    cancelAddBtn.addEventListener('click', () => {
        addModal.classList.add('hidden');
    });

    // Color Picker
    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            colorBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedColor = btn.style.getPropertyValue('--bg');
        });
    });
    // Set first color as default selected
    if (colorBtns.length > 0) colorBtns[0].click();

    // Add Item Confirm
    confirmAddBtn.addEventListener('click', addItem);

    // Stats
    statsBtn.addEventListener('click', () => {
        currentStatsDate = new Date(); // Reset to today
        showStats();
    });
    closeStatsBtn.addEventListener('click', () => {
        statsModal.classList.add('hidden');
        statsViewMain.classList.remove('hidden');
        statsViewDetail.classList.add('hidden');
    });

    // Date Navigation
    prevDayBtn.addEventListener('click', () => {
        currentStatsDate.setDate(currentStatsDate.getDate() - 1);
        showStats();
    });
    nextDayBtn.addEventListener('click', () => {
        currentStatsDate.setDate(currentStatsDate.getDate() + 1);
        showStats();
    });

    // Detail View Navigation
    backToStatsBtn.addEventListener('click', () => {
        statsViewDetail.classList.add('hidden');
        statsViewMain.classList.remove('hidden');
    });

    // Trend View Navigation
    trendPrevBtn.addEventListener('click', () => {
        currentTrendEndDate.setDate(currentTrendEndDate.getDate() - 7);
        renderTrendChart(currentTrendItemId);
    });

    trendNextBtn.addEventListener('click', () => {
        currentTrendEndDate.setDate(currentTrendEndDate.getDate() + 7);
        renderTrendChart(currentTrendItemId);
    });

    // Edit Modal Buttons
    cancelEditBtn.addEventListener('click', () => {
        editModal.classList.add('hidden');
    });

    decreaseCountBtn.addEventListener('click', () => {
        let val = parseInt(editCountValue.textContent);
        if (val > 0) editCountValue.textContent = val - 1;
    });

    increaseCountBtn.addEventListener('click', () => {
        let val = parseInt(editCountValue.textContent);
        editCountValue.textContent = val + 1;
    });

    saveEditBtn.addEventListener('click', saveEditCount);
    deleteBtn.addEventListener('click', deleteItem);

    // Close modals on outside click
    window.addEventListener('click', (e) => {
        if (e.target === addModal) addModal.classList.add('hidden');
        if (e.target === statsModal) statsModal.classList.add('hidden');
        if (e.target === editModal) editModal.classList.add('hidden');
    });
}

function addItem() {
    const name = newItemInput.value.trim();
    if (!name) return;

    const newItem = {
        id: Date.now().toString(),
        name: name,
        color: selectedColor,
        createdAt: Date.now()
    };

    items.push(newItem);
    saveData();
    render();
    addModal.classList.add('hidden');
}

function track(id, event) {
    if (isLongPress) return; // Prevent track after long press

    logs.push({
        itemId: id,
        timestamp: Date.now()
    });
    saveData();

    // Trigger Ripple
    if (event) {
        createRipple(event);
    }

    render(); // Update counts
}

// Long Press Handling
function handleTouchStart(id) {
    isLongPress = false;
    longPressTimer = setTimeout(() => {
        isLongPress = true;
        openEditModal(id);
        navigator.vibrate(50); // Haptic feedback
    }, 800); // 800ms for long press
}

function handleTouchEnd() {
    clearTimeout(longPressTimer);
}

function openEditModal(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    editingItemId = id;
    editingDate = new Date(); // Default edit for today

    const count = getCountForDate(id, editingDate);

    editItemName.textContent = \`\${item.name} (今日)\`;
    editCountValue.textContent = count;

    editModal.classList.remove('hidden');
}

function saveEditCount() {
    if (!editingItemId) return;

    const targetCount = parseInt(editCountValue.textContent);
    const itemLogs = logs.filter(log => log.itemId === editingItemId);
    const dayStart = new Date(editingDate.getFullYear(), editingDate.getMonth(), editingDate.getDate()).getTime();
    const dayEnd = dayStart + 86400000;

    const todayLogs = itemLogs.filter(log => log.timestamp >= dayStart && log.timestamp < dayEnd);
    const currentCount = todayLogs.length;

    if (targetCount > currentCount) {
        // Add logs
        for (let i = 0; i < targetCount - currentCount; i++) {
            logs.push({
                itemId: editingItemId,
                timestamp: dayStart + 43200000 // Noon of that day
            });
        }
    } else if (targetCount < currentCount) {
        // Remove logs but keep others
        logs = logs.filter(log => !(log.itemId === editingItemId && log.timestamp >= dayStart && log.timestamp < dayEnd));
        for (let i = 0; i < targetCount; i++) {
            logs.push({
                itemId: editingItemId,
                timestamp: dayStart + 43200000
            });
        }
    }

    saveData();
    render();
    editModal.classList.add('hidden');
}

function deleteItem() {
    if (!editingItemId) return;

    if (confirm('この習慣とこれまでの記録をすべて削除しますか？\\nこの操作は取り消せません。')) {
        items = items.filter(item => item.id !== editingItemId);
        logs = logs.filter(log => log.itemId !== editingItemId);
        saveData();
        render();
        editModal.classList.add('hidden');
    }
}


function createRipple(event) {
    const card = event.currentTarget;
    const ripple = document.createElement('span');
    const rect = card.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = \`\${size}px\`;
    ripple.style.left = \`\${x}px\`;
    ripple.style.top = \`\${y}px\`;
    ripple.classList.add('ripple');

    card.appendChild(ripple);

    setTimeout(() => {
        ripple.remove();
    }, 600);
}

function getCountForDate(itemId, date) {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const endOfDay = startOfDay + 86400000;

    return logs.filter(log =>
        log.itemId === itemId && log.timestamp >= startOfDay && log.timestamp < endOfDay
    ).length;
}

function render() {
    gridContainer.innerHTML = '';

    // Dynamic Grid Sizing
    if (items.length >= 7) {
        gridContainer.classList.add('grid-3-cols');
    } else {
        gridContainer.classList.remove('grid-3-cols');
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'habit-card';
        card.style.background = item.color;

        const count = getCountForDate(item.id, new Date());

        card.innerHTML = \`
            <div class="habit-name">\${item.name}</div>
            <div class="habit-count">\${count}</div>
        \`;

        // Touch events for long press
        card.addEventListener('mousedown', () => handleTouchStart(item.id));
        card.addEventListener('touchstart', () => handleTouchStart(item.id), { passive: true });

        card.addEventListener('mouseup', handleTouchEnd);
        card.addEventListener('touchend', handleTouchEnd);

        card.addEventListener('click', (e) => track(item.id, e));

        gridContainer.appendChild(card);
    });

    gridContainer.appendChild(addBtn);
}

function showStats() {
    // Update Date Display
    currentDateEl.textContent = \`\${currentStatsDate.getFullYear()}年\${currentStatsDate.getMonth() + 1}月\${currentStatsDate.getDate()}日\`;

    statsList.innerHTML = '';

    if (items.length === 0) {
        statsList.innerHTML = '<li class="stats-item" style="justify-content:center; opacity:0.5;">項目がありません</li>';
        statsModal.classList.remove('hidden');
        return;
    }

    items.forEach(item => {
        const count = getCountForDate(item.id, currentStatsDate);
        const li = document.createElement('li');
        li.className = 'stats-item';
        li.innerHTML = \`
            <span>\${item.name}</span>
            <span class="stats-count">\${count}回</span>
        \`;
        li.addEventListener('click', () => showTrend(item.id));
        statsList.appendChild(li);
    });

    statsModal.classList.remove('hidden');
}

function showTrend(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    currentTrendItemId = itemId;
    currentTrendEndDate = new Date(); // Reset to today initially

    detailItemName.textContent = \`\${item.name} の推移\`;
    statsViewMain.classList.add('hidden');
    statsViewDetail.classList.remove('hidden');

    renderTrendChart(itemId);
}

function renderTrendChart(itemId) {
    trendChart.innerHTML = '';
    const days = 7;
    const endDate = currentTrendEndDate;

    // Update labels to show range
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (days - 1));
    trendDateRangeEl.textContent = \`\${startDate.getMonth() + 1}/\${startDate.getDate()} - \${endDate.getMonth() + 1}/\${endDate.getDate()}\`;

    let maxCount = 0;
    const data = [];

    // Calculate last 7 days ending at endDate
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(endDate);
        d.setDate(endDate.getDate() - i);
        const count = getCountForDate(itemId, d);
        if (count > maxCount) maxCount = count;
        data.push({ date: d, count: count });
    }

    // Render bars
    data.forEach(d => {
        const container = document.createElement('div');
        container.className = 'chart-bar-container';

        const heightPercent = maxCount > 0 ? (d.count / maxCount) * 100 : 0;

        // Date Label (e.g., "2/7")
        const dateLabel = document.createElement('div');
        dateLabel.className = 'chart-label';
        dateLabel.textContent = \`\${d.date.getMonth() + 1}/\${d.date.getDate()}\`;

        // Value Label
        const valLabel = document.createElement('div');
        valLabel.className = 'chart-value';
        valLabel.textContent = d.count;

        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.height = \`\${Math.max(heightPercent, 1)}%\`; // Ensure at least a tiny bit visible

        container.appendChild(valLabel);
        container.appendChild(bar);
        container.appendChild(dateLabel);

        trendChart.appendChild(container);
    });
}

</script>
    <script>
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js');
        }
    </script>
</body>

</html>`;

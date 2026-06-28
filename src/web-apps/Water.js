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
    <title>水分補給トラッカー</title>
    <style>
:root {
    --primary-color: #00bcd4;
    --primary-gradient: linear-gradient(135deg, #00bcd4, #0097a7);
    --secondary-color: #f5f5f5;
    --text-color: #333333;
    --text-muted: #888888;
    --bg-color: #f0f4f8;
    --card-bg: #ffffff;
    --header-text: #ffffff;
    --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);
    --radius-lg: 24px;
    --radius-md: 16px;
    --radius-sm: 8px;
    --font-family: 'Noto Sans JP', sans-serif;
}

/* Reset & Base */
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: var(--font-family);
    background-color: var(--bg-color);
    color: var(--text-color);
    -webkit-font-smoothing: antialiased;
}

button {
    font-family: inherit;
    border: none;
    cursor: pointer;
    background: none;
    outline: none;
}

input {
    font-family: inherit;
}

/* Layout */
.app-container {
    max-width: 480px;
    margin: 0 auto;
    background-color: var(--bg-color);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

/* Header Section */
.header-section {
    background: var(--primary-gradient);
    padding: 40px 20px 60px;
    border-bottom-left-radius: 40px;
    border-bottom-right-radius: 40px;
    color: var(--header-text);
    position: relative;
    display: flex;
    justify-content: center;
    box-shadow: var(--shadow-md);
    z-index: 10;
}

.settings-button {
    position: absolute;
    top: 20px;
    right: 20px;
    color: white;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.3s;
}

.settings-button:active {
    background: rgba(255, 255, 255, 0.3);
}

.progress-container {
    position: relative;
    width: 220px;
    height: 220px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.progress-ring {
    transform: rotate(-90deg);
}

.progress-ring__circle {
    stroke-dasharray: 565;
    /* 2 * PI * 90 */
    stroke-dashoffset: 565;
    transition: stroke-dashoffset 0.5s ease-out;
}

.progress-text {
    position: absolute;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.current-amount {
    font-size: 3rem;
    font-weight: 700;
    line-height: 1;
}

.current-amount .unit {
    font-size: 1rem;
    font-weight: 500;
    margin-left: 2px;
}

.goal-amount {
    font-size: 0.9rem;
    opacity: 0.9;
    margin-top: 4px;
}

.percentage {
    font-size: 0.8rem;
    background: rgba(255, 255, 255, 0.2);
    padding: 2px 8px;
    border-radius: 12px;
    margin-top: 8px;
}

/* Main Content */
.main-content {
    flex: 1;
    padding: 0 20px 40px;
    margin-top: -30px;
    /* Overlap header */
    z-index: 20;
}

/* Controls Section */
.controls-section {
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    padding: 24px;
    box-shadow: var(--shadow-sm);
    margin-bottom: 24px;
}

.quick-add-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 16px;
}

.presets-container {
    display: contents;
}

.quick-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    background-color: #e0f7fa;
    color: #006064;
    border-radius: var(--radius-md);
    transition: transform 0.1s, background-color 0.2s;
    font-weight: 700;
}

.quick-btn:active {
    transform: scale(0.95);
    background-color: #b2ebf2;
}

.quick-btn .icon {
    font-size: 24px;
    margin-bottom: 4px;
}

.action-button.secondary {
    width: 100%;
    padding: 12px;
    border-radius: var(--radius-md);
    border: 2px dashed #b2ebf2;
    color: #006064;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.2s;
}

.action-button.secondary:active {
    background-color: #e0f7fa;
}

/* History Section */
.history-section {
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    padding: 24px;
    box-shadow: var(--shadow-sm);
    min-height: 200px;
}

.tabs {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
    border-bottom: 1px solid #eee;
    padding-bottom: 8px;
}

.tab-btn {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-muted);
    padding: 8px 4px;
    position: relative;
    transition: color 0.3s;
}

.tab-btn.active {
    color: var(--primary-color);
}

.tab-btn.active::after {
    content: '';
    position: absolute;
    bottom: -9px;
    left: 0;
    width: 100%;
    height: 3px;
    background-color: var(--primary-color);
    border-radius: 3px 3px 0 0;
}

.tab-content {
    display: none;
}

.tab-content.active {
    display: block;
    animation: fadeIn 0.3s;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Lists */
.log-list {
    list-style: none;
}

.log-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f0;
}

.log-item:last-child {
    border-bottom: none;
}

.log-item .time {
    color: var(--text-muted);
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 6px;
}

.log-item .amount {
    font-weight: 600;
    color: var(--primary-color);
}

.empty-state {
    text-align: center;
    padding: 40px 0;
    color: var(--text-muted);
    font-size: 0.9rem;
}

.delete-btn {
    color: #ef5350;
    padding: 8px;
    border-radius: 50%;
    display: flex;
}

.delete-btn:active {
    background-color: #ffebee;
}

/* Modal */
.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s;
}

.modal.visible {
    opacity: 1;
    pointer-events: auto;
}

.modal-content {
    background: var(--card-bg);
    width: 90%;
    max-width: 320px;
    border-radius: var(--radius-lg);
    padding: 24px;
    box-shadow: var(--shadow-md);
    transform: scale(0.9);
    transition: transform 0.3s;
}

.modal.visible .modal-content {
    transform: scale(1);
}

.modal h3 {
    margin-bottom: 20px;
    text-align: center;
}

.input-group {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24px;
    background: #f5f5f5;
    border-radius: var(--radius-md);
    padding: 12px;
}

.input-group input {
    border: none;
    background: none;
    font-size: 2rem;
    width: 120px;
    text-align: right;
    outline: none;
    color: var(--text-color);
}

.input-group .unit-label {
    font-size: 1.2rem;
    color: var(--text-muted);
    margin-left: 8px;
    font-weight: 500;
}

.setting-item {
    margin-bottom: 24px;
}

.setting-item label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: var(--text-muted);
}

.setting-item input {
    width: 100%;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: var(--radius-sm);
    font-size: 1.1rem;
    outline: none;
}

.setting-item input:focus {
    border-color: var(--primary-color);
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 16px;
}

.text-button {
    color: var(--text-muted);
    font-weight: 500;
}

.primary-button {
    background-color: var(--primary-color);
    color: white;
    padding: 10px 24px;
    border-radius: 20px;
    font-weight: 600;
    box-shadow: 0 4px 10px rgba(0, 188, 212, 0.3);
}

.primary-button:active {
    transform: translateY(1px);
    box-shadow: 0 2px 5px rgba(0, 188, 212, 0.3);
}

/* Weekly Chart Styles */
.week-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding: 0 8px;
}

.week-label {
    font-weight: 500;
    font-size: 0.95rem;
    color: var(--text-color);
}

.icon-button.small {
    padding: 4px;
    color: var(--text-muted);
}

.icon-button.small:active {
    background-color: #f5f5f5;
    border-radius: 50%;
}

.bar-chart {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    height: 180px;
    /* Increased height for labels */
    padding-top: 10px;
}

.bar-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 13%;
    font-size: 0.75rem;
    color: var(--text-muted);
    gap: 4px;
    cursor: pointer;
    transition: opacity 0.2s;
}

.bar-col:active {
    opacity: 0.7;
}

.bar-value {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--primary-color);
    margin-bottom: 2px;
}

.bar-bg {
    width: 100%;
    height: 100%;
    background: #f0f4f8;
    border-radius: 4px;
    position: relative;
    overflow: hidden;
    height: 120px;
}

.bar-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    background-color: var(--primary-color);
    border-radius: 4px;
    transition: height 0.5s ease-out;
}

.bar-date {
    font-size: 0.7rem;
}
</style>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet">
    
</head>

<body>
    <div class="app-container">
        <!-- Header / Progress Section -->
        <header class="header-section">
            <div class="progress-container">
                <svg class="progress-ring" width="220" height="220">
                    <circle class="progress-ring__circle-bg" stroke="rgba(255,255,255,0.2)" stroke-width="12"
                        fill="transparent" r="90" cx="110" cy="110" />
                    <circle class="progress-ring__circle" stroke="#ffffff" stroke-width="12" stroke-linecap="round"
                        fill="transparent" r="90" cx="110" cy="110" />
                </svg>
                <div class="progress-text">
                    <div class="current-amount"><span id="currentAmount">0</span><span class="unit">ml</span></div>
                    <div class="goal-amount">目標: <span id="goalAmount">2000</span>ml</div>
                    <div class="percentage" id="percentage">0%</div>
                </div>
            </div>
            <button id="settingsBtn" class="icon-button settings-button" aria-label="設定">
                <span class="material-icons-round">settings</span>
            </button>
        </header>

        <!-- Main Content -->
        <main class="main-content">
            <!-- Quick Add Controls -->
            <section class="controls-section">
                <div class="quick-add-grid" id="quickAddButtons">
                    <!-- Buttons injected by JS -->
                </div>
                <button id="customAddBtn" class="action-button secondary">
                    <span class="material-icons-round">add</span>
                    <span>任意入力</span>
                </button>
            </section>

            <!-- History Tabs -->
            <section class="history-section">
                <div class="tabs">
                    <button class="tab-btn active" data-tab="today">今日の記録</button>
                    <button class="tab-btn" data-tab="weekly">過去1週間</button>
                </div>

                <div id="todayView" class="tab-content active">
                    <ul class="log-list" id="todayLogList">
                        <!-- Log items injected by JS -->
                        <li class="empty-state">まだ記録がありません</li>
                    </ul>
                </div>

                <div id="weeklyView" class="tab-content">
                    <div class="week-nav">
                        <button id="prevWeekBtn" class="icon-button small">
                            <span class="material-icons-round">chevron_left</span>
                        </button>
                        <span id="weekRangeLabel" class="week-label"></span>
                        <button id="nextWeekBtn" class="icon-button small">
                            <span class="material-icons-round">chevron_right</span>
                        </button>
                    </div>
                    <div class="chart-container" id="weeklyChart">
                        <!-- Chart injected by JS -->
                        <div class="empty-state">データがありません</div>
                    </div>
                </div>
            </section>
        </main>
    </div>

    <!-- Custom Amount Modal -->
    <div id="customModal" class="modal hidden">
        <div class="modal-content">
            <h3>水分量を追加</h3>
            <div class="input-group">
                <input type="number" id="customAmountInput" placeholder="200" inputmode="numeric">
                <span class="unit-label">ml</span>
            </div>
            <div class="modal-actions">
                <button id="closeCustomModal" class="text-button">キャンセル</button>
                <button id="confirmCustomAdd" class="primary-button">追加</button>
            </div>
        </div>
    </div>

    <!-- Settings Modal -->
    <div id="settingsModal" class="modal hidden">
        <div class="modal-content">
            <h3>設定</h3>
            <div class="setting-item">
                <label for="goalInput">1日の目標 (ml)</label>
                <input type="number" id="goalInput" value="2000" inputmode="numeric">
            </div>
            <div class="setting-item">
                <label>クイック追加ボタン (ml)</label>
                <div class="preset-inputs" style="display: flex; gap: 8px;">
                    <input type="number" id="preset1" class="preset-input" inputmode="numeric">
                    <input type="number" id="preset2" class="preset-input" inputmode="numeric">
                    <input type="number" id="preset3" class="preset-input" inputmode="numeric">
                </div>
            </div>
            <div class="modal-actions">
                <button id="closeSettingsModal" class="text-button">キャンセル</button>
                <button id="saveSettings" class="primary-button">保存</button>
            </div>
        </div>
    </div>

    <!-- Daily Detail Modal -->
    <div id="dailyDetailModal" class="modal hidden">
        <div class="modal-content">
            <h3 id="dailyDetailDate">2026/01/01</h3>
            <ul class="log-list" id="dailyLogList" style="max-height: 200px; overflow-y: auto; margin-bottom: 20px;">
                <!-- Log items injected by JS -->
            </ul>

            <div class="input-group" style="margin-bottom: 16px;">
                <input type="number" id="manualAddInput" placeholder="200" inputmode="numeric">
                <span class="unit-label">ml</span>
            </div>

            <div class="modal-actions">
                <button id="closeDailyDetail" class="text-button">閉じる</button>
                <button id="manualAddBtn" class="primary-button">追加</button>
            </div>
        </div>
    </div>

    <script>
/**
 * Hydration Tracker PWA
 * Core Logic
 */

// --- Constants & Config ---
const DEFAULT_GOAL = 2000;
const DEFAULT_PRESETS = [150, 250, 500];
const STORAGE_KEY = 'hydration_data_v1';
const SETTINGS_KEY = 'hydration_settings_v1';

// --- State ---
let state = {
    intakeHistory: [], // Array of { id, timestamp, amount }
    weekOffset: 0 // 0 = current week, -1 = previous week
};

let settings = {
    goal: DEFAULT_GOAL,
    presets: [...DEFAULT_PRESETS]
};

// --- DOM Elements ---
const els = {
    currentAmount: document.getElementById('currentAmount'),
    goalAmount: document.getElementById('goalAmount'),
    percentage: document.getElementById('percentage'),
    progressCircle: document.querySelector('.progress-ring__circle'),
    quickAddContainer: document.getElementById('quickAddButtons'),
    customAddBtn: document.getElementById('customAddBtn'),
    settingsBtn: document.getElementById('settingsBtn'),

    // Tabs
    tabs: document.querySelectorAll('.tab-btn'),
    todayView: document.getElementById('todayView'),
    weeklyView: document.getElementById('weeklyView'),
    todayLogList: document.getElementById('todayLogList'),
    weeklyChart: document.getElementById('weeklyChart'),

    // Week Nav
    prevWeekBtn: document.getElementById('prevWeekBtn'),
    nextWeekBtn: document.getElementById('nextWeekBtn'),
    weekRangeLabel: document.getElementById('weekRangeLabel'),

    // Modals
    customModal: document.getElementById('customModal'),
    settingsModal: document.getElementById('settingsModal'),

    // Inputs
    customInput: document.getElementById('customAmountInput'),
    goalInput: document.getElementById('goalInput'),
    presetInputs: [
        document.getElementById('preset1'),
        document.getElementById('preset2'),
        document.getElementById('preset3')
    ],

    // Modal Actions
    closeCustom: document.getElementById('closeCustomModal'),
    confirmCustom: document.getElementById('confirmCustomAdd'),
    closeSettings: document.getElementById('closeSettingsModal'),
    saveSettings: document.getElementById('saveSettings'),
};

// --- Initialization ---
function init() {
    loadData();
    renderControlButtons(); // Render presets
    updateUI();
    setupEventListeners();
}

// --- Data Management ---
function loadData() {
    // Load Settings
    try {
        const savedSettings = localStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            settings = {
                ...settings,
                ...parsed,
                // Ensure presets exist if merging from old data
                presets: (parsed && parsed.presets) || [...DEFAULT_PRESETS]
            };
        }
    } catch (e) {
        console.error("Failed to load settings:", e);
    }

    // Load History
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            state.intakeHistory = JSON.parse(savedData) || [];
        }
    } catch (e) {
        console.error("Failed to load intake history:", e);
        state.intakeHistory = [];
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.intakeHistory));
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// --- Logic ---
function addIntake(amount, dateOverride = null) {
    if (!amount || amount <= 0) return;

    // Use provided date or current time
    const timestamp = dateOverride ? dateOverride.toISOString() : new Date().toISOString();

    const entry = {
        id: Date.now(),
        timestamp: timestamp,
        amount: parseInt(amount)
    };

    state.intakeHistory.push(entry);
    saveData();
    updateUI();

    // If we added to a specific past date, re-render that detail view
    if (dateOverride) {
        openDailyDetail(dateOverride);
    }
}

function deleteIntake(id) {
    state.intakeHistory = state.intakeHistory.filter(item => item.id !== id);
    saveData();
    updateUI();
}

function getTodayIntake() {
    const today = new Date().toDateString();
    return state.intakeHistory
        .filter(item => new Date(item.timestamp).toDateString() === today);
}

function getTotalToday() {
    const todayEntries = getTodayIntake();
    return todayEntries.reduce((sum, item) => sum + item.amount, 0);
}

function getWeeklyData(offset = 0) {
    // Determine the "end date" of the requested week.
    // Logic: Current date + (offset * 7 days)
    const anchorDate = new Date();
    anchorDate.setDate(anchorDate.getDate() + (offset * 7));

    const days = [];
    // Just iterate 6 days back from the anchor date
    // Note: If user wants "Standard Week" (Mon-Sun), logic differs.
    // User asked for "Any 1 week selection". "Last 7 days" style shifted by week is easiest to understand
    // BUT standard calendar weeks are often better for "history".
    // Let's stick to "7 days ending at Anchor" for simplest continuity, OR fixed 7-day blocks.
    // Fixed blocks (Sunday to Saturday) are usually clearer for "Previous Week".

    // Let's implement Sunday-Saturday logic based on offset.
    // 1. Find current week's Last Day (Saturday)
    const current = new Date();
    const dayOfWeek = current.getDay(); // 0(Sun) - 6(Sat)
    const diffToSat = 6 - dayOfWeek;

    const endOfWeek = new Date(current);
    endOfWeek.setDate(current.getDate() + diffToSat + (offset * 7));

    // Now generate 7 days ending on that Saturday
    for (let i = 6; i >= 0; i--) {
        const d = new Date(endOfWeek);
        d.setDate(endOfWeek.getDate() - i);

        const dayString = d.toDateString();
        const total = state.intakeHistory
            .filter(item => new Date(item.timestamp).toDateString() === dayString)
            .reduce((sum, item) => sum + item.amount, 0);

        days.push({
            date: d,
            total: total,
            label: \`\${d.getMonth() + 1}/\${d.getDate()}\`,
            dayName: ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
        });
    }
    return days;
}

// --- UI Rendering ---
function renderControlButtons() {
    els.quickAddContainer.innerHTML = '';
    settings.presets.forEach(amount => {
        const btn = document.createElement('button');
        btn.className = 'quick-btn';
        btn.innerHTML = \`
            <span class="material-icons-round icon">water_drop</span>
            <span>\${amount}ml</span>
        \`;
        btn.onclick = () => addIntake(amount);
        els.quickAddContainer.appendChild(btn);
    });
}

function updateUI() {
    const total = getTotalToday();
    const percent = Math.min(100, Math.round((total / settings.goal) * 100));

    // Update Header
    els.currentAmount.innerText = total.toLocaleString();
    els.goalAmount.innerText = settings.goal.toLocaleString();
    els.percentage.innerText = \`\${percent}%\`;

    // Progress Ring
    const radius = els.progressCircle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percent / 100) * circumference;
    els.progressCircle.style.strokeDashoffset = offset;

    // Render Lists based on active tab
    if (els.todayView.classList.contains('active')) {
        renderTodayLog();
    } else {
        renderWeeklyChart();
    }
}

function renderTodayLog() {
    const entries = getTodayIntake().sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Newest first

    if (entries.length === 0) {
        els.todayLogList.innerHTML = '<li class="empty-state">まだ記録がありません</li>';
        return;
    }

    els.todayLogList.innerHTML = '';
    entries.forEach(item => {
        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

        const li = document.createElement('li');
        li.className = 'log-item';
        li.innerHTML = \`
            <div class="time">
                <span class="material-icons-round" style="font-size: 16px;">schedule</span>
                \${timeStr}
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
                <span class="amount">\${item.amount}ml</span>
                <button class="delete-btn" onclick="deleteIntake(\${item.id})">
                    <span class="material-icons-round" style="font-size: 20px;">close</span>
                </button>
            </div>
        \`;
        els.todayLogList.appendChild(li);
    });
}

function renderWeeklyChart() {
    const data = getWeeklyData(state.weekOffset);

    // Update Range Label
    const start = data[0].date;
    const end = data[6].date;
    const fmt = d => \`\${d.getFullYear()}/\${d.getMonth() + 1}/\${d.getDate()}\`;
    els.weekRangeLabel.innerText = \`\${fmt(start)} - \${fmt(end)}\`;

    const maxVal = Math.max(...data.map(d => d.total), settings.goal);

    let chartHTML = '<div class="bar-chart">';
    data.forEach(day => {
        const heightPercent = Math.min(100, Math.round((day.total / maxVal) * 100));
        const isToday = new Date().toDateString() === day.date.toDateString();
        const color = isToday ? 'var(--primary-color)' : '#90a4ae';

        // Pass ISO string to avoid issues, we'll parse it back
        const dateParam = day.date.toISOString();

        chartHTML += \`
            <div class="bar-col" onclick="openDailyDetail(new Date('\${dateParam}'))">
                <div class="bar-value">\${day.total}</div>
                <div class="bar-bg">
                    <div class="bar-fill" style="height: \${heightPercent}%; background-color: \${color};"></div>
                </div>
                <div class="bar-date" style="\${isToday ? 'font-weight:bold; color:var(--primary-color)' : ''}">
                    \${day.label}<br>\${day.dayName}
                </div>
            </div>
        \`;
    });
    chartHTML += '</div>';

    els.weeklyChart.innerHTML = chartHTML;
}

// --- Event Listeners ---

// Helper to toggle modal
const toggleModal = (modal, show) => {
    if (show) {
        modal.classList.remove('hidden');
        // small timeout to allow display:block to apply before opacity transition
        setTimeout(() => modal.classList.add('visible'), 10);
    } else {
        modal.classList.remove('visible');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
};

function setupEventListeners() {
    // Week Nav
    els.prevWeekBtn.addEventListener('click', () => {
        state.weekOffset--;
        renderWeeklyChart();
    });

    els.nextWeekBtn.addEventListener('click', () => {
        state.weekOffset++;
        renderWeeklyChart();
    });

    // Daily Detail Modal state
    const detailEls = {
        modal: document.getElementById('dailyDetailModal'),
        dateTitle: document.getElementById('dailyDetailDate'),
        list: document.getElementById('dailyLogList'),
        input: document.getElementById('manualAddInput'),
        addBtn: document.getElementById('manualAddBtn'),
        closeBtn: document.getElementById('closeDailyDetail')
    };

    let currentDetailDate = null;

    window.openDailyDetail = (date) => {
        currentDetailDate = date;
        detailEls.dateTitle.innerText = \`\${date.getFullYear()}/\${date.getMonth() + 1}/\${date.getDate()}\`;

        // Filter logs for this date
        const dayStr = date.toDateString();
        const logs = state.intakeHistory.filter(item => new Date(item.timestamp).toDateString() === dayStr);
        logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        detailEls.list.innerHTML = '';
        if (logs.length === 0) {
            detailEls.list.innerHTML = '<li class="empty-state">記録がありません</li>';
        } else {
            logs.forEach(item => {
                const li = document.createElement('li');
                li.className = 'log-item';
                li.innerHTML = \`
                    <div style="font-weight:bold;">\${item.amount}ml</div>
                    <button class="delete-btn" onclick="deleteHistoryItem(\${item.id})">
                        <span class="material-icons-round" style="font-size: 20px;">close</span>
                    </button>
                \`;
                detailEls.list.appendChild(li);
            });
        }

        detailEls.input.value = '';
        toggleModal(detailEls.modal, true);
    };

    window.deleteHistoryItem = (id) => {
        deleteIntake(id);
        // Refresh detail view if open
        if (currentDetailDate && !detailEls.modal.classList.contains('hidden')) {
            openDailyDetail(currentDetailDate);
        }
    };

    detailEls.closeBtn.addEventListener('click', () => toggleModal(detailEls.modal, false));

    detailEls.addBtn.addEventListener('click', () => {
        const val = parseInt(detailEls.input.value);
        if (val > 0 && currentDetailDate) {
            // Set time to current time but date to selected date
            // OR just set to noon to avoid timezone trickiness, but let's try to keep it simple
            // We'll create a new Date object based on currentDetailDate
            const newDate = new Date(currentDetailDate);
            const now = new Date();
            newDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

            addIntake(val, newDate);
        }
    });

    // Custom Add Modal
    els.customAddBtn.addEventListener('click', () => {
        els.customInput.value = '';
        toggleModal(els.customModal, true);
        els.customInput.focus();
    });

    els.closeCustom.addEventListener('click', () => toggleModal(els.customModal, false));

    els.confirmCustom.addEventListener('click', () => {
        const val = parseInt(els.customInput.value);
        if (val > 0) {
            addIntake(val);
            toggleModal(els.customModal, false);
        }
    });

    // Settings Modal
    els.settingsBtn.addEventListener('click', () => {
        els.goalInput.value = settings.goal;
        // Populate preset inputs
        settings.presets.forEach((val, idx) => {
            if (els.presetInputs[idx]) els.presetInputs[idx].value = val;
        });
        toggleModal(els.settingsModal, true);
    });

    els.closeSettings.addEventListener('click', () => toggleModal(els.settingsModal, false));

    els.saveSettings.addEventListener('click', () => {
        const newGoal = parseInt(els.goalInput.value);

        // Get new presets
        const newPresets = els.presetInputs.map(input => parseInt(input.value)).filter(v => v > 0);

        if (newGoal > 0 && newPresets.length === 3) {
            settings.goal = newGoal;
            settings.presets = newPresets;
            saveSettings();
            renderControlButtons(); // Re-render buttons with new values
            updateUI();
            toggleModal(els.settingsModal, false);
        }
    });

    // Tabs
    els.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs & contents
            els.tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Add to click target
            tab.classList.add('active');
            const targetId = tab.dataset.tab === 'today' ? 'todayView' : 'weeklyView';
            document.getElementById(targetId).classList.add('active');

            // Re-render to ensure fresh data
            updateUI();
        });
    });

    // Expose delete to global scope for HTML onclick
    window.deleteIntake = deleteIntake;
}

// Run
init();

</script>
    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(reg => console.log('Service Worker: Registered (Scope: ' + reg.scope + ')'))
                    .catch(err => console.log('Service Worker: Error: ' + err));
            });
        }
    </script>
</body>

</html>`;

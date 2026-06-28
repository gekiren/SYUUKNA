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
            label: `${d.getMonth() + 1}/${d.getDate()}`,
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
        btn.innerHTML = `
            <span class="material-icons-round icon">water_drop</span>
            <span>${amount}ml</span>
        `;
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
    els.percentage.innerText = `${percent}%`;

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
        li.innerHTML = `
            <div class="time">
                <span class="material-icons-round" style="font-size: 16px;">schedule</span>
                ${timeStr}
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
                <span class="amount">${item.amount}ml</span>
                <button class="delete-btn" onclick="deleteIntake(${item.id})">
                    <span class="material-icons-round" style="font-size: 20px;">close</span>
                </button>
            </div>
        `;
        els.todayLogList.appendChild(li);
    });
}

function renderWeeklyChart() {
    const data = getWeeklyData(state.weekOffset);

    // Update Range Label
    const start = data[0].date;
    const end = data[6].date;
    const fmt = d => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    els.weekRangeLabel.innerText = `${fmt(start)} - ${fmt(end)}`;

    const maxVal = Math.max(...data.map(d => d.total), settings.goal);

    let chartHTML = '<div class="bar-chart">';
    data.forEach(day => {
        const heightPercent = Math.min(100, Math.round((day.total / maxVal) * 100));
        const isToday = new Date().toDateString() === day.date.toDateString();
        const color = isToday ? 'var(--primary-color)' : '#90a4ae';

        // Pass ISO string to avoid issues, we'll parse it back
        const dateParam = day.date.toISOString();

        chartHTML += `
            <div class="bar-col" onclick="openDailyDetail(new Date('${dateParam}'))">
                <div class="bar-value">${day.total}</div>
                <div class="bar-bg">
                    <div class="bar-fill" style="height: ${heightPercent}%; background-color: ${color};"></div>
                </div>
                <div class="bar-date" style="${isToday ? 'font-weight:bold; color:var(--primary-color)' : ''}">
                    ${day.label}<br>${day.dayName}
                </div>
            </div>
        `;
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
        detailEls.dateTitle.innerText = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

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
                li.innerHTML = `
                    <div style="font-weight:bold;">${item.amount}ml</div>
                    <button class="delete-btn" onclick="deleteHistoryItem(${item.id})">
                        <span class="material-icons-round" style="font-size: 20px;">close</span>
                    </button>
                `;
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

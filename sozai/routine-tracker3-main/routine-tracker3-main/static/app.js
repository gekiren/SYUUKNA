const API_URL = "";

// 状態管理
let currentRoutine = null;
let currentTaskIndex = 0;
let taskStartTime = null;
let taskTimerInterval = null;
let taskLogs = [];
let chartInstance = null;
let confirmCallback = null;

// DOM要素の取得は DOMContentLoaded 後に行うのが安全だが、
// body最下部で読み込んでいるため直接実行しても通常は問題ない。
// ただし、変数のスコープ問題を避けるため、関数内で取得するか、
// 明示的にグローバルで確保する。

const homeScreen = document.getElementById('home-screen');
const activeScreen = document.getElementById('active-screen');
const resultScreen = document.getElementById('result-screen');
const routineList = document.getElementById('routine-list');
const currentTaskNameEl = document.getElementById('current-task-name');
const timerEl = document.getElementById('timer');
const nextBtn = document.getElementById('next-btn');
const resultList = document.getElementById('result-list');

// モーダル要素
const modal = document.getElementById('create-modal');
const createBtn = document.getElementById('create-routine-btn');
const newTaskList = document.getElementById('new-task-list');
const modalTitle = document.getElementById('modal-title');
const editRoutineIdInput = document.getElementById('edit-routine-id');
const routineNameInput = document.getElementById('new-routine-name');

// 汎用モーダル要素
const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');


// --- 汎用モーダル機能 ---
function showConfirm(title, message, onOk, isAlert = false) {
    if (!confirmModal) return alert(message); // 安全策

    confirmTitle.innerText = title;
    confirmMessage.innerText = message;
    confirmModal.classList.remove('hidden');
    confirmCallback = onOk;

    if (isAlert) {
        confirmOkBtn.innerText = "OK";
        confirmOkBtn.style.background = "#2563eb";
        confirmCancelBtn.style.display = "none";
    } else {
        confirmOkBtn.innerText = "Delete";
        confirmOkBtn.style.background = "#c92a2a";
        confirmCancelBtn.style.display = "block";
    }
}

function hideConfirm() {
    confirmModal.classList.add('hidden');
    confirmCallback = null;
}

if (confirmOkBtn) {
    confirmOkBtn.onclick = () => {
        if (confirmCallback) confirmCallback();
        hideConfirm();
    };
}

if (confirmCancelBtn) {
    confirmCancelBtn.onclick = () => {
        hideConfirm();
    };
}

function showAlert(title, message) {
    showConfirm(title, message, null, true);
}


// --- 初期化 & ルーティン一覧表示 ---
async function loadRoutines() {
    console.log("Loading routines...");
    try {
        const res = await fetch(`${API_URL}/routines/`);
        if (!res.ok) throw new Error("Failed to fetch routines");
        const routines = await res.json();
        routineList.innerHTML = '';
        routines.forEach(r => {
            const bg = document.createElement('div');
            bg.className = 'routine-card';
            bg.style.display = 'flex';
            bg.style.justifyContent = 'space-between';
            bg.style.alignItems = 'center';

            const nameSpan = document.createElement('span');
            nameSpan.innerText = r.name;
            nameSpan.style.flexGrow = '1';
            nameSpan.addEventListener('click', () => startRoutine(r.id));

            // 編集ボタン
            const editBtn = document.createElement('button');
            editBtn.innerText = '✎';
            editBtn.className = 'icon-btn';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditModal(r.id);
            });

            // 削除ボタン
            const delBtn = document.createElement('button');
            delBtn.innerText = '🗑';
            delBtn.className = 'icon-btn delete-btn';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log("Delete button clicked for id:", r.id);
                // カスタムモーダルを表示
                showConfirm(
                    "Delete Routine",
                    `Are you sure you want to delete "${r.name}"?`,
                    () => { deleteRoutine(r.id); }
                );
            });

            const btnGroup = document.createElement('div');
            btnGroup.style.display = 'flex';
            btnGroup.style.gap = '5px';
            btnGroup.appendChild(editBtn);
            btnGroup.appendChild(delBtn);

            bg.appendChild(nameSpan);
            bg.appendChild(btnGroup);
            routineList.appendChild(bg);
        });
    } catch (e) {
        console.error("Error loading routines:", e);
        showAlert("System Error", "Error loading routines: " + e.message);
    }
}

// --- ルーティン実行関連 ---
async function startRoutine(id) {
    console.log("startRoutine called for id:", id);
    try {
        const res = await fetch(`${API_URL}/routines/${id}`);
        if (!res.ok) throw new Error("Failed to fetch routine details");
        currentRoutine = await res.json();

        if (!currentRoutine.tasks || currentRoutine.tasks.length === 0) {
            showAlert("No Tasks", "このルーティンにはタスクがありません。");
            return;
        }

        currentTaskIndex = 0;
        taskLogs = [];
        showScreen(activeScreen);
        startTask();
    } catch (e) {
        console.error("Error starting routine:", e);
        showAlert("Error", "Error starting routine: " + e.message);
    }
}

function startTask() {
    const task = currentRoutine.tasks[currentTaskIndex];
    currentTaskNameEl.innerText = `${task.name} (予定: ${formatTime(task.estimated_seconds)})`;
    taskStartTime = Date.now();

    if (taskTimerInterval) clearInterval(taskTimerInterval);
    taskTimerInterval = setInterval(updateTimer, 1000);
    updateTimer();
}

function updateTimer() {
    const elapsedSec = Math.floor((Date.now() - taskStartTime) / 1000);
    const task = currentRoutine.tasks[currentTaskIndex];
    const remaining = task.estimated_seconds - elapsedSec;

    timerEl.innerText = formatTime(remaining > 0 ? remaining : 0);

    if (remaining < 0) {
        timerEl.style.color = '#ff6b6b';
        timerEl.innerText = `+ ${formatTime(Math.abs(elapsedSec - task.estimated_seconds))}`;
    } else {
        timerEl.style.color = '#51cf66';
    }
}

if (nextBtn) {
    nextBtn.onclick = () => {
        const elapsedSec = Math.floor((Date.now() - taskStartTime) / 1000);
        const task = currentRoutine.tasks[currentTaskIndex];

        taskLogs.push({
            task_id: task.id,
            actual_seconds: elapsedSec
        });

        currentTaskIndex++;
        if (currentTaskIndex < currentRoutine.tasks.length) {
            startTask();
        } else {
            finishRoutine();
        }
    };
}

async function finishRoutine() {
    clearInterval(taskTimerInterval);

    try {
        const res = await fetch(`${API_URL}/routines/${currentRoutine.id}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task_logs: taskLogs })
        });
        if (!res.ok) throw new Error("Failed to complete routine");
        const result = await res.json();

        showScreen(resultScreen);
        renderResult(result.updates);
        renderChart(result.updates);
    } catch (e) {
        console.error("Error completing routine:", e);
        showAlert("Error", "Error saving results: " + e.message);
    }
}

function renderResult(updates) {
    resultList.innerHTML = '';
    updates.forEach(u => {
        const div = document.createElement('div');
        div.className = 'result-item';
        div.innerHTML = `
            <strong>${u.task_name}</strong><br>
            実績: ${formatTime(u.actual)} <br>
            <span style="color:#888;">次回目安: ${formatTime(u.old_est)} → ${formatTime(u.new_est)}</span>
        `;
        resultList.appendChild(div);
    });
}

function renderChart(updates) {
    const ctx = document.getElementById('resultChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const labels = updates.map(u => u.task_name);
    const estimatedData = updates.map(u => u.old_est);
    const actualData = updates.map(u => u.actual);

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '予定 (Estimated)',
                    data: estimatedData,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                },
                {
                    label: '実績 (Actual)',
                    data: actualData,
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: 'white' }
                },
                x: {
                    ticks: { color: 'white' }
                }
            },
            plugins: {
                legend: { labels: { color: 'white' } }
            }
        }
    });
}

// --- モーダル (作成・編集) ---
if (createBtn) {
    createBtn.onclick = () => {
        openModal();
    };
}

function openModal(isEdit = false) {
    modal.classList.remove('hidden');
    if (!isEdit) {
        modalTitle.innerText = "Create Routine";
        editRoutineIdInput.value = "";
        routineNameInput.value = "";
        newTaskList.innerHTML = "";
        addTaskInput(); // デフォルト1行
    }
}

async function openEditModal(id) {
    console.log("Opening edit modal for id:", id);
    try {
        const res = await fetch(`${API_URL}/routines/${id}`);
        if (!res.ok) throw new Error("Failed to fetch routine");
        const routine = await res.json();

        openModal(true);
        modalTitle.innerText = "Edit Routine";
        editRoutineIdInput.value = routine.id;
        routineNameInput.value = routine.name;
        newTaskList.innerHTML = "";

        routine.tasks.forEach(t => {
            addTaskInput(t.name, t.estimated_seconds);
        });
    } catch (e) {
        console.error("Error opening edit modal:", e);
        showAlert("Error", e.message);
    }
}

function closeModal() {
    modal.classList.add('hidden');
}

function addTaskInput(name = "", seconds = 300) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;

    const div = document.createElement('div');
    div.className = 'task-input-row';
    div.innerHTML = `
        <input type="text" class="task-name-input" placeholder="Task Name" value="${name}">
        <input type="number" class="task-time-input-min" placeholder="Min" value="${min}">
        <span>:</span>
        <input type="number" class="task-time-input-sec" placeholder="Sec" value="${sec}">
        <button class="remove-task-btn" type="button" onclick="this.parentElement.remove()">×</button>
    `;
    newTaskList.appendChild(div);
}

async function saveNewRoutine() {
    console.log("saveNewRoutine called");
    const name = routineNameInput.value;
    const editId = editRoutineIdInput.value;
    console.log("Name:", name, "EditID:", editId);

    if (!name) return showAlert("Validation Error", "Routine Name is required");

    const taskRows = newTaskList.querySelectorAll('.task-input-row');
    const tasks = [];

    let order = 1;
    taskRows.forEach(row => {
        const tName = row.querySelector('.task-name-input').value;
        const tMin = parseInt(row.querySelector('.task-time-input-min').value) || 0;
        const tSec = parseInt(row.querySelector('.task-time-input-sec').value) || 0;
        const totalSeconds = tMin * 60 + tSec;

        console.log("Row parsed:", tName, tMin, tSec, totalSeconds);

        if (tName) {
            tasks.push({
                name: tName,
                estimated_seconds: totalSeconds > 0 ? totalSeconds : 60,
                order: order++
            });
        }
    });

    console.log("Tasks collected:", tasks);

    if (tasks.length === 0) return showAlert("Validation Error", "At least one task is required");

    const payload = { name: name, tasks: tasks };
    console.log("Payload:", payload);

    try {
        let url = `${API_URL}/routines/with-tasks/`;
        let method = 'POST';

        if (editId) {
            url = `${API_URL}/routines/${editId}`;
            method = 'PUT';
        }

        console.log("Fetching:", url, method);

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log("Response status:", res.status);

        if (res.ok) {
            closeModal();
            loadRoutines();
        } else {
            let errorMsg = "Unknown Error";
            try {
                const errorData = await res.json();
                errorMsg = JSON.stringify(errorData, null, 2);
            } catch (e) {
                errorMsg = await res.text();
            }
            console.error("Save failed:", errorMsg);
            showAlert("Save Failed", errorMsg);
        }
    } catch (e) {
        console.error("Network error during save:", e);
        showAlert("Network Error", e.message);
    }
}

async function deleteRoutine(id) {
    console.log("deleteRoutine called for id:", id);
    // 確認ダイアログは loadRoutines で処理済みのため、ここは実行のみ
    try {
        const res = await fetch(`${API_URL}/routines/${id}`, { method: 'DELETE' });
        console.log("Delete response:", res.status);
        if (!res.ok) throw new Error("Failed to delete");
        loadRoutines();
    } catch (e) {
        console.error("Delete error:", e);
        showAlert("Error", "Error deleting routine: " + e.message);
    }
}

// 画面切り替えヘルパー
function showScreen(screen) {
    [homeScreen, activeScreen, resultScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// 初期実行
console.log("App initialized");
loadRoutines();

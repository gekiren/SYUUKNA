// Chart.jsがロードできなかった場合のフォールバック定義
if (typeof Chart === 'undefined') {
    window.Chart = function() {
        this.destroy = function() {};
    };
}

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker Registered'))
            .catch(err => console.log('Service Worker Failed', err));
    });
}

// --- Data Management (LocalStorage) ---
const STORAGE_KEY = 'routine_tracker_data';

function getRoutines() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error("Storage access failed:", e);
        return [];
    }
}

function saveRoutines(routines) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(routines));
    } catch (e) {
        alert("Failed to save data. " + e.message);
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// --- Core Logic (Weighted Average) ---
function updateRoutineEstimates(routineId, taskLogs) {
    const routines = getRoutines();
    const routineIndex = routines.findIndex(r => r.id === routineId);
    if (routineIndex === -1) return null;

    const routine = routines[routineIndex];
    const updates = [];

    taskLogs.forEach(log => {
        const taskIndex = routine.tasks.findIndex(t => t.id === log.task_id);
        if (taskIndex !== -1) {
            const task = routine.tasks[taskIndex];
            const oldEst = task.estimated_seconds;
            const actual = log.actual_seconds;

            // Weighted Average: 70% history, 30% recent
            // If auto_update_estimates is explicitly false, keep the old estimate.
            // (Default to true if undefined for backward compatibility)
            const shouldUpdate = (routine.auto_update_estimates !== false);

            const newEst = shouldUpdate
                ? Math.round((oldEst * 0.7) + (actual * 0.3))
                : oldEst;

            routine.tasks[taskIndex].estimated_seconds = newEst;

            updates.push({
                task_name: task.name,
                old_est: oldEst,
                new_est: newEst,
                actual: actual
            });
        }
    });

    // --- Save History ---
    if (!routine.history) routine.history = [];

    // Create history entry
    const historyEntry = {
        timestamp: Date.now(),
        total_actual_seconds: taskLogs.reduce((sum, log) => sum + log.actual_seconds, 0),
        logs: updates.map(u => ({
            task_name: u.task_name,
            actual_seconds: u.actual,
            estimated_seconds: u.old_est // Store what the estimate was AT THAT TIME
        }))
    };

    // Add to beginning
    routine.history.unshift(historyEntry);

    // Limit to 50 items
    if (routine.history.length > 50) {
        routine.history = routine.history.slice(0, 50);
    }

    saveRoutines(routines);
    return { updates, routine };
}

// --- App State ---
let currentRoutine = null;
let currentTaskIndex = 0;
let taskStartTime = null;
let taskTimerInterval = null;
let taskLogs = [];
let chartInstance = null;
let confirmCallback = null;

// --- DOM Elements ---
const screens = {
    home: document.getElementById('home-screen'),
    active: document.getElementById('active-screen'),
    result: document.getElementById('result-screen'),
    history: document.getElementById('history-screen')
};

const components = {
    list: document.getElementById('routine-list'),
    timer: document.getElementById('timer'),
    taskName: document.getElementById('current-task-name'),
    nextBtn: document.getElementById('next-btn'),
    resultList: document.getElementById('result-list'),
    chartEntry: document.getElementById('resultChart')
};

// --- Navigation ---
function showScreen(screenName) {
    Object.values(screens).forEach(el => el.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
    window.scrollTo(0, 0);
}

function goHome() {
    showScreen('home');
    loadRoutines();
}

// --- Routine List & Management ---
// --- Routine List & Management ---
function loadRoutines() {
    const routines = getRoutines();
    const list = components.list;
    list.innerHTML = '';

    if (routines.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">ルーティンがありません。<br>"+ New" を押して作成してください。</div>';
        return;
    }

    routines.forEach(r => {
        const card = document.createElement('div');
        card.className = 'routine-card';

        // Image handling
        if (r.image) {
            card.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.7)), url(${r.image})`;
            card.style.backgroundSize = 'cover';
            card.style.backgroundPosition = 'center';
            card.style.textShadow = '0 1px 3px rgba(0,0,0,0.8)';
        }

        card.innerHTML = `
            <span style="font-weight:bold; flex-grow:1; font-size:18px;">${r.name}</span>
            <div style="display:flex;">
                <button class="icon-btn" onclick="event.stopPropagation(); showHistory('${r.id}')">🕒</button>
                <button class="icon-btn" onclick="event.stopPropagation(); openEditModal('${r.id}')">✎</button>
                <button class="icon-btn delete-btn" onclick="event.stopPropagation(); confirmDelete('${r.id}')">🗑</button>
            </div>
        `;
        card.onclick = () => startRoutine(r.id);
        list.appendChild(card);
    });
}

// --- Create/Edit Modal ---
const modal = document.getElementById('create-modal');
const newTaskList = document.getElementById('new-task-list');
// Reuse resizeImage, but specialized for task inputs
async function handleTaskImageInput(input, imgPreview) {
    if (input.files && input.files[0]) {
        try {
            const resized = await resizeImage(input.files[0]);
            imgPreview.src = resized;
            imgPreview.style.display = 'block';
            input.setAttribute('data-base64', resized); // Store in DOM temporarily
        } catch (err) {
            console.error(err);
            alert("画像処理エラー");
        }
    }
}

document.getElementById('create-routine-btn').onclick = () => openModal();

// --- Image Handling ---
let currentImageBase64 = null;

function handleImagePreview(base64) {
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('image-preview');

    if (base64) {
        currentImageBase64 = base64;
        previewImg.src = base64;
        previewContainer.style.display = 'block';
    } else {
        clearImage();
    }
}

function clearImage() {
    currentImageBase64 = null;
    document.getElementById('routine-image-input').value = ""; // Reset file input
    document.getElementById('image-preview').src = "";
    document.getElementById('image-preview-container').style.display = 'none';
}

function resizeImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const maxWidth = 800;
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compress to JPEG 0.7
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Add event listener for file input
document.getElementById('routine-image-input').addEventListener('change', async function (e) {
    if (e.target.files && e.target.files[0]) {
        try {
            const resized = await resizeImage(e.target.files[0]);
            handleImagePreview(resized);
        } catch (err) {
            alert("画像の読み込みに失敗しました");
            console.error(err);
        }
    }
});


function openModal(isEdit = false) {
    modal.classList.remove('hidden');
    // Clear image state
    clearImage();

    if (!isEdit) {
        document.getElementById('modal-title').innerText = "ルーティン作成";
        document.getElementById('edit-routine-id').value = "";
        document.getElementById('new-routine-name').value = "";
        document.getElementById('auto-update-estimates').checked = true; // Default ON
        newTaskList.innerHTML = "";
        addTaskInput();
    }
}

function closeModal() {
    modal.classList.add('hidden');
    clearImage();
}

function openEditModal(id) {
    const routines = getRoutines();
    const routine = routines.find(r => r.id === id);
    if (!routine) return;

    openModal(true);
    document.getElementById('modal-title').innerText = "ルーティン編集";
    document.getElementById('edit-routine-id').value = routine.id;
    document.getElementById('new-routine-name').value = routine.name;
    // Default to true if the property doesn't exist
    document.getElementById('auto-update-estimates').checked = (routine.auto_update_estimates !== false);

    // Set existing image
    if (routine.image) {
        handleImagePreview(routine.image);
    }

    newTaskList.innerHTML = "";
    routine.tasks.forEach(t => addTaskInput(t.name, t.estimated_seconds, t.image));
}

function addTaskInput(name = "", seconds = 300, imageBase64 = null) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;

    const div = document.createElement('div');
    div.className = 'task-input-row';
    div.innerHTML = `
        <div style="width:100%;">
            <input type="text" class="task-name-input full-width" placeholder="タスク名" value="${name}" style="margin-bottom:0;">
        </div>
        
        <div class="task-options-row">
            <div style="display:flex; align-items:center; gap:8px;">
                <button type="button" class="icon-btn" onclick="this.nextElementSibling.click()" style="padding:6px 10px; font-size:16px;">📷</button>
                <input type="file" accept="image/*" style="display:none;" onchange="handleTaskImageInput(this, this.parentNode.nextElementSibling)">
                <img src="${imageBase64 || ''}" style="height:35px; width:35px; object-fit:cover; border-radius:4px; display:${imageBase64 ? 'block' : 'none'}; cursor:pointer;" onclick="this.src=''; this.style.display='none'; this.previousElementSibling.previousElementSibling.setAttribute('data-base64', '');">
            </div>

            <div style="display:flex; align-items:center; gap:5px;">
                <input type="tel" class="task-time-input-min" placeholder="分" value="${min}">
                <span>:</span>
                <input type="tel" class="task-time-input-sec" placeholder="秒" value="${sec}">
                <button class="remove-task-btn" onclick="this.closest('.task-input-row').remove()">×</button>
            </div>
        </div>
    `;

    // Initialize data attribute if existing image
    if (imageBase64) {
        const fileInput = div.querySelector('input[type="file"]');
        fileInput.setAttribute('data-base64', imageBase64);
    }

    newTaskList.appendChild(div);
}

// Note: saveNewRoutine is now async-like in logic but we handle file input via event listener updating `currentImageBase66`
function saveNewRoutine() {
    const name = document.getElementById('new-routine-name').value;
    const editId = document.getElementById('edit-routine-id').value;
    const autoUpdate = document.getElementById('auto-update-estimates').checked;

    if (!name) return alert("名前は必須です");

    const tasks = [];
    newTaskList.querySelectorAll('.task-input-row').forEach(row => {
        const tName = row.querySelector('.task-name-input').value;
        const tMin = parseInt(row.querySelector('.task-time-input-min').value) || 0;
        const tSec = parseInt(row.querySelector('.task-time-input-sec').value) || 0;

        // Retrieve stored base64 from file input attribute
        const fileInput = row.querySelector('input[type="file"]');
        const tImage = fileInput ? fileInput.getAttribute('data-base64') : null;

        if (tName) {
            tasks.push({
                id: generateId(),
                name: tName,
                estimated_seconds: (tMin * 60) + tSec,
                image: tImage // Save task image
            });
        }
    });

    if (tasks.length === 0) return alert("最低1つのタスクを追加してください");

    const routines = getRoutines();

    if (editId) {
        const index = routines.findIndex(r => r.id === editId);
        if (index !== -1) {
            routines[index].name = name;
            routines[index].tasks = tasks;
            routines[index].auto_update_estimates = autoUpdate;
            routines[index].image = currentImageBase64; // Update image
        }
    } else {
        routines.push({
            id: generateId(),
            name: name,
            tasks: tasks,
            auto_update_estimates: autoUpdate,
            image: currentImageBase64 // Save image
        });
    }

    saveRoutines(routines);
    closeModal();
    loadRoutines();
}

function confirmDelete(id) {
    if (confirm("本当にこのルーティンを削除しますか？")) {
        const routines = getRoutines();
        const filtered = routines.filter(r => r.id !== id);
        saveRoutines(filtered);
        loadRoutines();
    }
}

// --- History ---
function showHistory(id) {
    const routines = getRoutines();
    const routine = routines.find(r => r.id === id);
    if (!routine) return;

    showScreen('history');
    document.getElementById('history-title').innerText = `History: ${routine.name}`;

    const container = document.getElementById('history-list');
    container.innerHTML = '';

    if (!routine.history || routine.history.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">No history yet.</div>';
        return;
    }

    routine.history.forEach((entry, index) => {
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleString('ja-JP', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });

        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-summary" onclick="toggleHistoryDetails(this)">
                <span class="history-date">${dateStr}</span>
                <span class="history-total">Total: ${formatTime(entry.total_actual_seconds)}</span>
                <span class="history-arrow">▼</span>
            </div>
            <div class="history-details hidden">
                ${entry.logs.map(log => `
                    <div class="history-detail-row">
                        <span style="flex-grow:1;">${log.task_name}</span>
                        <span>${formatTime(log.actual_seconds)}</span>
                        <span style="color:#666; font-size:12px; margin-left:8px;">(Est: ${formatTime(log.estimated_seconds || 0)})</span>
                    </div>
                `).join('')}
            </div>
        `;
        container.appendChild(div);
    });
}

function toggleHistoryDetails(el) {
    const details = el.nextElementSibling;
    const arrow = el.querySelector('.history-arrow');

    if (details.classList.contains('hidden')) {
        details.classList.remove('hidden');
        arrow.style.transform = 'rotate(180deg)';
    } else {
        details.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
}

// --- Routine Execution ---
function startRoutine(id) {
    const routines = getRoutines();
    currentRoutine = routines.find(r => r.id === id);
    if (!currentRoutine || !currentRoutine.tasks.length) return alert("Task error");

    currentTaskIndex = 0;
    taskLogs = [];
    showScreen('active');
    startTask();
}

function startTask() {
    const task = currentRoutine.tasks[currentTaskIndex];
    components.taskName.innerText = `${task.name} (${formatTime(task.estimated_seconds)})`;

    // Update Task Image
    const imgEl = document.getElementById('current-task-image');
    if (task.image) {
        imgEl.src = task.image;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
        imgEl.src = "";
    }

    taskStartTime = Date.now();

    clearInterval(taskTimerInterval);
    taskTimerInterval = setInterval(updateTimer, 1000);
    updateTimer();
}

function updateTimer() {
    const elapsed = Math.floor((Date.now() - taskStartTime) / 1000);
    const task = currentRoutine.tasks[currentTaskIndex];
    const remaining = task.estimated_seconds - elapsed;

    components.timer.innerText = formatTime(remaining > 0 ? remaining : 0);

    if (remaining < 0) {
        components.timer.style.color = '#ff6b6b';
        components.timer.innerText = `+ ${formatTime(Math.abs(remaining))}`;
    } else {
        components.timer.style.color = '#51cf66';
    }
}

components.nextBtn.onclick = () => {
    const elapsed = Math.floor((Date.now() - taskStartTime) / 1000);
    taskLogs.push({
        task_id: currentRoutine.tasks[currentTaskIndex].id,
        actual_seconds: elapsed
    });

    currentTaskIndex++;
    if (currentTaskIndex < currentRoutine.tasks.length) {
        startTask();
    } else {
        finishRoutine();
    }
};

function finishRoutine() {
    clearInterval(taskTimerInterval);
    const result = updateRoutineEstimates(currentRoutine.id, taskLogs);

    showScreen('result');
    renderResultList(result.updates);
    renderChart(result.updates);
}

function renderResultList(updates) {
    components.resultList.innerHTML = updates.map(u => `
        <div class="result-item">
            <strong>${u.task_name}</strong><br>
            Act: ${formatTime(u.actual)} <br>
            <span style="color:#888;">Est: ${formatTime(u.old_est)} → ${formatTime(u.new_est)}</span>
        </div>
    `).join('');
}

function renderChart(updates) {
    const ctx = components.chartEntry.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: updates.map(u => u.task_name),
            datasets: [
                {
                    label: 'Est',
                    data: updates.map(u => u.old_est),
                    backgroundColor: 'rgba(75, 192, 192, 0.5)'
                },
                {
                    label: 'Act',
                    data: updates.map(u => u.actual),
                    backgroundColor: 'rgba(255, 99, 132, 0.5)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { color: '#fff' } },
                x: { ticks: { color: '#fff' } }
            },
            plugins: { legend: { labels: { color: '#fff' } } }
        }
    });
}

// --- Utils ---
function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

const confirmModal = document.getElementById('confirm-modal');
function showConfirm(title, msg, onOk) {
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = msg;
    confirmModal.classList.remove('hidden');

    confirmCallback = onOk;
}

document.getElementById('confirm-ok-btn').onclick = () => {
    if (confirmCallback) confirmCallback();
    confirmModal.classList.add('hidden');
    confirmCallback = null;
};
document.getElementById('confirm-cancel-btn').onclick = () => {
    confirmModal.classList.add('hidden');
};

// Start
loadRoutines();

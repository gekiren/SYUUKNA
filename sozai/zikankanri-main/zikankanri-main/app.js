
// DOM Elements
const activityNameInput = document.getElementById('activity-name');
const startTimeInput = document.getElementById('start-time');
const endTimeInput = document.getElementById('end-time');
const saveBtn = document.getElementById('save-btn');
const logList = document.getElementById('log-list');
const quickListNodesContainer = document.getElementById('quick-list');
const toggleSimultaneousBtn = document.getElementById('toggle-simultaneous');
const simultaneousStatusSpan = document.getElementById('simultaneous-status');
const singleModeInputs = document.getElementById('single-mode-inputs');
const simultaneousModeInputs = document.getElementById('simultaneous-mode-inputs');
const simultaneousList = document.getElementById('simultaneous-list');
const addSimultaneousRowBtn = document.getElementById('add-simultaneous-row');
const saveTemplateBtn = document.getElementById('save-template-btn');
const templateList = document.getElementById('template-list');
const clearDayBtn = document.getElementById('clear-day-btn');
const currentDateInput = document.getElementById('current-date');

// State
let isSimultaneousMode = false;
let editingId = null; // Track if we are editing an existing log
let logs = JSON.parse(localStorage.getItem('zikankanri_logs')) || [];
let templates = JSON.parse(localStorage.getItem('zikankanri_templates')) || [];
let defaultTags = JSON.parse(localStorage.getItem('zikankanri_tags')) || ["睡眠", "仕事", "食事", "移動", "休憩", "家事", "運動", "学習"];

// Initialize
function init() {
    currentDateInput.valueAsDate = new Date();
    initTags();
    setDefaultTimes();
    renderLogs();
    renderTemplates();
    registerSW();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Date Change Listener
currentDateInput.addEventListener('change', () => {
    renderLogs();
});

// Init Tags
function initTags() {
    quickListNodesContainer.innerHTML = '';

    // Edit Button
    const editBtn = document.createElement('span');
    editBtn.className = 'tag-chip';
    editBtn.style.borderStyle = 'dashed';
    editBtn.textContent = '+ 編集';
    editBtn.onclick = openTagEditor;
    quickListNodesContainer.appendChild(editBtn);

    defaultTags.forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.dataset.value = tag;
        chip.textContent = tag;
        chip.addEventListener('click', () => {
            document.querySelectorAll('#quick-list .tag-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            activityNameInput.value = tag;
        });
        quickListNodesContainer.insertBefore(chip, editBtn);
    });
}

function openTagEditor() {
    const newTagsStr = prompt("活動リストをカンマ区切りで入力してください:", defaultTags.join(","));
    if (newTagsStr !== null) {
        const newTags = newTagsStr.split(',').map(t => t.trim()).filter(t => t);
        if (newTags.length > 0) {
            defaultTags = newTags;
            localStorage.setItem('zikankanri_tags', JSON.stringify(defaultTags));
            initTags();
        }
    }
}

// Service Worker Registration
function registerSW() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(res => console.log('SW registered'))
            .catch(err => console.log('SW failed', err));
    }
}

// Event Listeners
document.getElementById('set-now-start').addEventListener('click', () => {
    startTimeInput.value = getCurrentTimeStr();
});

document.getElementById('set-now-end').addEventListener('click', () => {
    endTimeInput.value = getCurrentTimeStr();
});


// Toggle Simultaneous Mode
toggleSimultaneousBtn.addEventListener('click', () => {
    setSimultaneousMode(!isSimultaneousMode);
});

function setSimultaneousMode(enabled) {
    isSimultaneousMode = enabled;
    if (isSimultaneousMode) {
        singleModeInputs.classList.add('hidden');
        simultaneousModeInputs.classList.remove('hidden');
        simultaneousStatusSpan.textContent = "ON";
        toggleSimultaneousBtn.classList.replace('btn-primary', 'btn-primary');
    } else {
        singleModeInputs.classList.remove('hidden');
        simultaneousModeInputs.classList.add('hidden');
        simultaneousStatusSpan.textContent = "OFF";
        toggleSimultaneousBtn.classList.replace('btn-primary', 'btn-secondary');
    }
}

// Add Simultaneous Row
addSimultaneousRowBtn.addEventListener('click', () => {
    addSimultaneousRow();
});

function addSimultaneousRow(name = '', percent = 0) {
    const div = document.createElement('div');
    div.className = 'simultaneous-row flex-row';
    div.innerHTML = `
        <input type="text" placeholder="活動名" class="sim-name" value="${name}">
        <input type="number" placeholder="%" class="sim-percent" value="${percent}">
        <button class="btn btn-secondary" style="width: auto; padding: 4px 8px;" onclick="this.parentElement.remove()">×</button>
    `;
    simultaneousList.appendChild(div);
}

// Save Entry
saveBtn.addEventListener('click', () => {
    const start = startTimeInput.value;
    const end = endTimeInput.value;
    const selectedDate = currentDateInput.value.replace(/-/g, '/');

    if (!start || !end) {
        alert('開始時間と終了時間を入力してください。');
        return;
    }

    // Build New Item Object
    let newItems = [];
    if (isSimultaneousMode) {
        const rows = document.querySelectorAll('.simultaneous-row');
        rows.forEach(row => {
            const name = row.querySelector('.sim-name').value;
            const percent = parseInt(row.querySelector('.sim-percent').value) || 0;
            if (name) {
                newItems.push({ name, percent });
            }
        });
        if (newItems.length === 0) {
            alert('活動を入力してください。');
            return;
        }
    } else {
        const name = activityNameInput.value;
        if (!name) {
            alert('活動名を入力してください。');
            return;
        }
        newItems.push({ name, percent: 100 });
    }

    // Check for Overlaps
    const newStartMins = timeToMins(start);
    const newEndMins = timeToMins(end);
    let effectiveEndMins = newEndMins;
    if (effectiveEndMins < newStartMins) effectiveEndMins += 1440;

    // Find overlapping logs
    const dayLogs = logs.filter(l => l.date === selectedDate && l.id !== editingId); // Exclude self if editing
    const overlaps = dayLogs.filter(l => {
        const lS = timeToMins(l.start);
        let lE = timeToMins(l.end);
        if (lE < lS) lE += 1440;

        return Math.max(lS, newStartMins) < Math.min(lE, effectiveEndMins);
    });

    if (overlaps.length > 0) {
        // Handle Overlap
        const targetLog = overlaps[0];

        const confirmMerge = confirm(`「${targetLog.items.map(i => i.name).join('/')}」(${targetLog.start}-${targetLog.end}) と時間が重なっています。\n重なっている部分を同時進行として記録しますか？\n（キャンセルすると通常通り追加・更新します）`);

        if (confirmMerge) {
            // Ask for ratio
            const existingNames = targetLog.items.map(i => i.name).join('/');
            const newNames = newItems.map(i => i.name).join('/');

            const ratioStr = prompt(`重複区間の割合を設定してください。\n既存「${existingNames}」の割合(%):`, "50");
            if (ratioStr === null) return;

            const existingRatio = parseInt(ratioStr) || 50;
            const newRatio = 100 - existingRatio;

            // If editing, we first remove the old entry since we are merging into a new split structure
            if (editingId) {
                logs = logs.filter(l => l.id !== editingId);
            }

            handleOverlapMerge(targetLog, { start, end, items: newItems }, selectedDate, existingRatio, newRatio);

            // Clean up UI
            resetForm(end);
            return;
        }
    }

    if (editingId) {
        // Update Existing
        const index = logs.findIndex(l => l.id === editingId);
        if (index !== -1) {
            logs[index] = {
                ...logs[index],
                date: selectedDate,
                start,
                end,
                items: newItems
            };
        }
    } else {
        // Create New
        const newEntry = {
            id: Date.now(),
            date: selectedDate,
            start,
            end,
            items: newItems
        };
        logs.push(newEntry);
    }

    saveLogs();
    renderLogs();
    resetForm(end);
});

function handleOverlapMerge(existingLog, newLogObj, date, existingWeight, newWeight) {
    // 1. Remove existing log
    logs = logs.filter(l => l.id !== existingLog.id);

    // Convert times to mins
    const eS = timeToMins(existingLog.start);
    let eE = timeToMins(existingLog.end);
    if (eE < eS) eE += 1440;

    const nS = timeToMins(newLogObj.start);
    let nE = timeToMins(newLogObj.end);
    if (nE < nS) nE += 1440;

    const points = [eS, eE, nS, nE].sort((a, b) => a - b);

    // Overlap Range
    const overlapStart = Math.max(eS, nS);
    const overlapEnd = Math.min(eE, nE);

    const segments = [];

    // Before Overlap (Existing)
    if (eS < overlapStart) {
        segments.push({
            start: eS, end: overlapStart, items: existingLog.items
        });
    }
    // Before Overlap (New)
    if (nS < overlapStart) {
        segments.push({
            start: nS, end: overlapStart, items: newLogObj.items
        });
    }

    // Overlap
    if (overlapStart < overlapEnd) {
        let mergedItems = [];
        existingLog.items.forEach(i => {
            mergedItems.push({
                name: i.name,
                percent: Math.round(i.percent * (existingWeight / 100))
            });
        });
        newLogObj.items.forEach(i => {
            mergedItems.push({
                name: i.name,
                percent: Math.round(i.percent * (newWeight / 100))
            });
        });

        segments.push({
            start: overlapStart, end: overlapEnd, items: mergedItems
        });
    }

    // After Overlap (Existing)
    if (eE > overlapEnd) {
        segments.push({
            start: overlapEnd, end: eE, items: existingLog.items
        });
    }
    // After Overlap (New)
    if (nE > overlapEnd) {
        segments.push({
            start: overlapEnd, end: nE, items: newLogObj.items
        });
    }

    // Create Logs from segments
    segments.forEach(seg => {
        if (seg.end > seg.start) {
            logs.push({
                id: Date.now() + Math.random(),
                date: date,
                start: minsToTime(seg.start),
                end: minsToTime(seg.end),
                items: seg.items
            });
        }
    });

    saveLogs();
    renderLogs();
}

function startEdit(id) {
    const log = logs.find(l => l.id === id);
    if (!log) return;

    editingId = id;
    saveBtn.textContent = "更新する";
    saveBtn.classList.replace('btn-primary', 'btn-secondary'); // Visual cue? Or keep primary.
    // Let's add a visual cue.
    saveBtn.style.border = "2px solid #BB86FC";

    startTimeInput.value = log.start;
    endTimeInput.value = log.end;

    // Determine Mode
    if (log.items.length > 1) {
        setSimultaneousMode(true);
        simultaneousList.innerHTML = '';
        log.items.forEach(item => {
            addSimultaneousRow(item.name, item.percent);
        });
    } else {
        setSimultaneousMode(false);
        activityNameInput.value = log.items[0].name;
    }

    // Scroll top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm(nextStart) {
    editingId = null;
    saveBtn.textContent = "記録する";
    saveBtn.style.border = "none";

    startTimeInput.value = nextStart;
    endTimeInput.value = "";
    activityNameInput.value = "";
    simultaneousList.innerHTML = ''; // Clear rows
    document.querySelectorAll('#quick-list .tag-chip').forEach(c => c.classList.remove('selected'));
}

// Clear Data
clearDayBtn.addEventListener('click', () => {
    const selectedDate = currentDateInput.value.replace(/-/g, '/');
    if (confirm(`${selectedDate} のデータを全て消去しますか？`)) {
        logs = logs.filter(log => log.date !== selectedDate);
        saveLogs();
        renderLogs();
    }
});

// Export Markdown
const exportMdBtn = document.getElementById('export-md-btn');
if (exportMdBtn) {
    exportMdBtn.addEventListener('click', () => {
        const selectedDate = currentDateInput.value.replace(/-/g, '/');
        const targetLogs = logs.filter(l => l.date === selectedDate);
        targetLogs.sort((a, b) => a.start.localeCompare(b.start));

        if (targetLogs.length === 0) {
            alert('データがありません。');
            return;
        }

        // Calculate Totals
        const totals = {};
        let totalMins = 0;
        targetLogs.forEach(log => {
            const duration = calculateDuration(log.start, log.end);
            log.items.forEach(item => {
                const minutes = duration * (item.percent / 100);
                if (!totals[item.name]) totals[item.name] = 0;
                totals[item.name] += minutes;
                totalMins += minutes; // Note: totalMins might exceed 1440 if overlapping? No, overlap handling splits them.
            });
        });

        const sortedTotals = Object.entries(totals).sort((a, b) => b[1] - a[1]);

        // Generate MD
        let md = `# ${selectedDate} 活動記録\n\n`;

        md += `## 集計\n`;
        md += `| 活動 | 時間 (分) | 割合 |\n`;
        md += `| :--- | :---: | :---: |\n`;

        sortedTotals.forEach(([name, mins]) => {
            const percent = totalMins > 0 ? Math.round((mins / totalMins) * 100) : 0;
            md += `| ${name} | ${Math.round(mins)} | ${percent}% |\n`;
        });

        md += `\n## 詳細ログ\n`;
        targetLogs.forEach(log => {
            const duration = calculateDuration(log.start, log.end);
            let content = '';
            if (log.items.length === 1) {
                content = log.items[0].name;
            } else {
                content = log.items.map(i => `${i.name}(${i.percent}%)`).join(', ');
            }
            md += `- **${log.start} - ${log.end}** (${duration}分): ${content}\n`;
        });

        // Copy to clipboard
        navigator.clipboard.writeText(md).then(() => {
            alert('クリップボードにコピーしました！\nGeminiなどに貼り付けて分析してください。');
        }).catch(err => {
            console.error('Copy failed', err);
            alert('コピーに失敗しました。');
            console.log(md);
        });
    });
}

// Templates
saveTemplateBtn.addEventListener('click', () => {
    const selectedDate = currentDateInput.value.replace(/-/g, '/');
    const logsForDate = logs.filter(l => l.date === selectedDate);

    if (logsForDate.length === 0) {
        alert("保存する記録がありません。");
        return;
    }

    const name = prompt("テンプレート名を入力してください (例: 平日パターン):");
    if (name) {
        templates.push({
            id: Date.now(),
            name,
            data: logsForDate
        });
        localStorage.setItem('zikankanri_templates', JSON.stringify(templates));
        renderTemplates();
    }
});

function loadTemplate(templateId) {
    const tmpl = templates.find(t => t.id == templateId);
    if (!tmpl) return;

    if (confirm(`テンプレート「${tmpl.name}」を読み込みますか？\n現在選択中の日の記録は上書きされます。`)) {
        const selectedDate = currentDateInput.value.replace(/-/g, '/');

        // Remove existing logs for this date
        logs = logs.filter(l => l.date !== selectedDate);

        // Add template logs with target date
        const newLogs = tmpl.data.map(l => ({
            ...l,
            id: Date.now() + Math.random(), // New IDs
            date: selectedDate
        }));

        logs = logs.concat(newLogs);

        saveLogs();
        renderLogs();
    }
}

// Rendering
function renderLogs() {
    logList.innerHTML = '';
    const selectedDate = currentDateInput.value.replace(/-/g, '/');

    const targetLogs = logs.filter(l => l.date === selectedDate);
    targetLogs.sort((a, b) => a.start.localeCompare(b.start));

    if (targetLogs.length === 0) {
        logList.innerHTML = '<div style="text-align:center; color: var(--text-secondary); padding: 20px;">記録はまだありません</div>';
    }

    targetLogs.forEach(log => {
        const el = document.createElement('div');
        el.className = 'log-item';

        let content = '';
        if (log.items.length === 1) {
            content = `<strong>${log.items[0].name}</strong>`;
        } else {
            content = '<div style="font-size:0.9rem;">' +
                log.items.map(i => `${i.name} (${i.percent}%)`).join(' / ') +
                '</div>';
        }

        const duration = calculateDuration(log.start, log.end);

        // Edit Button Logic
        const isEditing = (log.id === editingId);
        const editClass = isEditing ? 'btn-primary' : 'btn-secondary';
        const editText = isEditing ? '編集中' : '編集';

        el.innerHTML = `
            <div>
                <div class="time-badge">${log.start} - ${log.end} (${duration}分)</div>
                <div style="margin-top: 4px;">${content}</div>
            </div>
            <div class="flex-row">
                <button class="btn ${editClass}" style="width: auto; padding: 4px 8px; font-size: 0.8rem; margin-right: 8px;" onclick="startEdit(${log.id})">${editText}</button>
                <button class="btn btn-secondary" style="width: auto; padding: 4px 8px; font-size: 0.8rem; border-color: #666; color: #888;" onclick="deleteLog(${log.id})">削除</button>
            </div>
        `;
        logList.appendChild(el);
    });

    renderSummary(targetLogs);
}

function renderSummary(targetLogs) {
    const summaryList = document.getElementById('summary-list');
    const pieChartContainer = document.getElementById('summary-pie-chart');
    if (!summaryList || !pieChartContainer) return;

    summaryList.innerHTML = '';

    // --- Aggregation for List ---
    const totals = {};
    targetLogs.forEach(log => {
        const duration = calculateDuration(log.start, log.end);
        log.items.forEach(item => {
            const minutes = duration * (item.percent / 100);
            if (!totals[item.name]) totals[item.name] = 0;
            totals[item.name] += minutes;
        });
    });

    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

    // Render List
    if (sorted.length === 0) {
        summaryList.innerHTML = '<div style="text-align:center; color: var(--text-secondary); padding: 10px;">データなし</div>';
        pieChartContainer.innerHTML = '';
        pieChartContainer.style.background = 'none';
        return;
    }

    const colors = ['#FFCDD2', '#F8BBD0', '#E1BEE7', '#D1C4E9', '#C5CAE9', '#BBDEFB', '#B3E5FC', '#B2EBF2', '#B2DFDB', '#C8E6C9', '#DCEDC8', '#F0F4C3', '#FFF9C4', '#FFECB3', '#FFE0B2', '#FFCCBC'];

    sorted.forEach(([name, mins], index) => {
        const row = document.createElement('div');
        row.className = 'flex-row justify-between';
        row.style.padding = '8px 0';
        row.style.borderBottom = '1px solid #333';
        row.innerHTML = `<span style="display:flex; align-items:center; gap:8px;">${name}</span><span>${Math.round(mins)}分</span>`;
        summaryList.appendChild(row);
    });

    // --- Render SVG Chart (Timeline) ---
    pieChartContainer.style.background = 'none';
    pieChartContainer.innerHTML = '';

    const size = 300;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 100;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "auto");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.style.maxWidth = "300px";
    svg.style.display = "block";
    svg.style.margin = "0 auto";

    // Draw Background Circle (Optional, prevents gaps)
    const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bgCircle.setAttribute("cx", cx);
    bgCircle.setAttribute("cy", cy);
    bgCircle.setAttribute("r", radius);
    bgCircle.setAttribute("fill", "#2C2C2C");
    svg.appendChild(bgCircle);

    // 1. Draw Hour Markers
    for (let i = 0; i < 24; i++) {
        const angle = (i * 15) - 90; // 0h = -90deg
        const rad = angle * (Math.PI / 180);
        const textR = radius + 25; // Outside
        const x = cx + textR * Math.cos(rad);
        const y = cy + textR * Math.sin(rad);

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", x);
        text.setAttribute("y", y);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("fill", "#FF8A65");
        text.setAttribute("font-size", "12");
        text.textContent = i;
        svg.appendChild(text);
    }

    // 2. Draw Sectors
    const activityColorMap = {};
    let colorIdx = 0;

    targetLogs.forEach(log => {
        const primName = log.items[0].name;
        if (!activityColorMap[primName]) {
            activityColorMap[primName] = colors[colorIdx % colors.length];
            colorIdx++;
        }
        const color = activityColorMap[primName];

        const [sh, sm] = log.start.split(':').map(Number);
        const [eh, em] = log.end.split(':').map(Number);

        let startMins = sh * 60 + sm;
        let endMins = eh * 60 + em;
        if (endMins < startMins) endMins += 1440; // Cross midnight

        const startAngle = (startMins / 1440) * 360 - 90;
        const endAngle = (endMins / 1440) * 360 - 90;

        // Path definition
        const x1 = cx + radius * Math.cos(startAngle * Math.PI / 180);
        const y1 = cy + radius * Math.sin(startAngle * Math.PI / 180);
        const x2 = cx + radius * Math.cos(endAngle * Math.PI / 180);
        const y2 = cy + radius * Math.sin(endAngle * Math.PI / 180);

        const largeArcFlag = (endAngle - startAngle) > 180 ? 1 : 0;

        // If full circle? (1440 mins)
        if (endMins - startMins >= 1440) {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", cx);
            circle.setAttribute("cy", cy);
            circle.setAttribute("r", radius);
            circle.setAttribute("fill", color);
            svg.appendChild(circle);
        } else {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const d = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
            path.setAttribute("d", d);
            path.setAttribute("fill", color);
            path.setAttribute("stroke", "#121212"); // Separator color matching bg
            path.setAttribute("stroke-width", "1");
            svg.appendChild(path);
        }

        // Label
        const midAngle = (startAngle + endAngle) / 2;
        const midRad = midAngle * (Math.PI / 180);
        const labelR = radius * 0.6;
        const lx = cx + labelR * Math.cos(midRad);
        const ly = cy + labelR * Math.sin(midRad);

        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", lx);
        label.setAttribute("y", ly);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("dominant-baseline", "middle");
        label.setAttribute("fill", "#333"); // Dark text for pastel colors
        label.setAttribute("font-size", "12");
        label.setAttribute("font-weight", "bold");
        label.setAttribute("pointer-events", "none");

        if ((endMins - startMins) > 15) {
            let textContent = log.items.map(i => i.name).join('/');
            if (textContent.length > 5) textContent = textContent.substring(0, 4) + '..';
            label.textContent = textContent;
            svg.appendChild(label);
        }
    });

    pieChartContainer.appendChild(svg);
}

function renderTemplates() {
    templateList.innerHTML = '';
    templates.forEach(tmpl => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.textContent = tmpl.name;
        chip.onclick = () => loadTemplate(tmpl.id);
        templateList.appendChild(chip);
    });
}

// Helpers
function saveLogs() {
    localStorage.setItem('zikankanri_logs', JSON.stringify(logs));
}

function deleteLog(id) {
    if (confirm('削除しますか？')) {
        // If editing this one, reset form
        if (editingId === id) {
            resetForm(startTimeInput.value);
        }
        logs = logs.filter(l => l.id !== id);
        saveLogs();
        renderLogs();
    }
}

function getCurrentTimeStr() {
    const now = new Date();
    return now.toTimeString().substring(0, 5);
}

function calculateDuration(start, end) {
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    const min1 = h1 * 60 + m1;
    const min2 = h2 * 60 + m2;
    return min2 - min1;
}

function timeToMins(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function minsToTime(mins) {
    // mins usually < 1440, but if wraps, mod 1440
    let m = mins % 1440;
    if (m < 0) m += 1440;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function setDefaultTimes() {
    if (!startTimeInput.value) startTimeInput.value = getCurrentTimeStr();
}

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 習慣記録アプリ統合データ管理ユーティリティ
 */

// 各WebアプリのLocalStorageキーとAsyncStorageキーのマッピング
export const KEYS = {
  HABIT_ITEMS: 'habit-items',
  HABIT_LOGS: 'habit-logs',
  ROUTINE_DATA: 'routine_tracker_data',
  WATER_DATA: 'hydration_data_v1',
  WATER_SETTINGS: 'hydration_settings_v1',
  ZIKAN_LOGS: 'zikankanri_logs',
  ZIKAN_TEMPLATES: 'zikankanri_templates',
  ZIKAN_TAGS: 'zikankanri_tags',
};

/**
 * AsyncStorageから全データをロードする
 */
export async function loadAllData() {
  try {
    const keys = Object.values(KEYS);
    const pairs = await AsyncStorage.multiGet(keys);
    const data = {};
    pairs.forEach(([key, val]) => {
      data[key] = val ? JSON.parse(val) : null;
    });
    return data;
  } catch (e) {
    console.error('Failed to load all data from AsyncStorage:', e);
    return {};
  }
}

/**
 * 指定したキーのデータをAsyncStorageに保存する
 */
export async function saveData(key, value) {
  try {
    await AsyncStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save data for key ${key}:`, e);
  }
}

/**
 * 指定したキーのデータをAsyncStorageから削除する
 */
export async function removeData(key) {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.error(`Failed to remove data for key ${key}:`, e);
  }
}

/**
 * AsyncStorageの全データを初期化する (デバッグ用)
 */
export async function clearAllData() {
  try {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  } catch (e) {
    console.error('Failed to clear AsyncStorage data:', e);
  }
}

/**
 * ユーティリティ：日付を YYYY/MM/DD 形式の文字列にする（タイムゾーン考慮）
 */
export function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

/**
 * 本日の進捗サマリー（ダッシュボード用）を抽出・集計する
 */
export function getTodaySummary(allData) {
  const todayStr = getLocalDateString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();
  const todayEndMs = todayStartMs + 24 * 60 * 60 * 1000;

  // 1. 習慣カウンターの集計
  const habitItems = Array.isArray(allData[KEYS.HABIT_ITEMS]) ? allData[KEYS.HABIT_ITEMS] : [];
  const habitLogs = Array.isArray(allData[KEYS.HABIT_LOGS]) ? allData[KEYS.HABIT_LOGS] : [];
  const todayHabitCounts = {};
  
  // 今日のログをフィルタ
  const todayLogs = habitLogs.filter(log => log && log.timestamp >= todayStartMs && log.timestamp < todayEndMs);
  todayLogs.forEach(log => {
    if (log && log.itemId) {
      todayHabitCounts[log.itemId] = (todayHabitCounts[log.itemId] || 0) + 1;
    }
  });

  const habitsSummary = habitItems.map(item => ({
    id: item ? item.id : null,
    name: item ? item.name : '不明',
    color: item ? item.color : '#CCCCCC',
    count: item ? (todayHabitCounts[item.id] || 0) : 0,
  })).filter(h => h.id !== null);

  // 2. 水分補給の集計
  const waterHistory = Array.isArray(allData[KEYS.WATER_DATA]) ? allData[KEYS.WATER_DATA] : [];
  const waterSettings = (allData[KEYS.WATER_SETTINGS] && typeof allData[KEYS.WATER_SETTINGS] === 'object') ? allData[KEYS.WATER_SETTINGS] : { goal: 2000 };
  const todayWaterLogs = waterHistory.filter(log => log && log.timestamp >= todayStartMs && log.timestamp < todayEndMs);
  const todayWaterAmount = todayWaterLogs.reduce((sum, log) => sum + (log.amount || 0), 0);
  const waterProgress = (waterSettings && waterSettings.goal > 0) ? (todayWaterAmount / waterSettings.goal) : 0;

  const waterSummary = {
    amount: todayWaterAmount,
    goal: (waterSettings && waterSettings.goal) || 2000,
    progress: Math.min(1, waterProgress),
    percentage: Math.round(waterProgress * 100),
  };

  // 3. ルーティン管理の集計
  const routineData = Array.isArray(allData[KEYS.ROUTINE_DATA]) ? allData[KEYS.ROUTINE_DATA] : [];
  let completedRoutinesCount = 0;
  let totalRoutinesCount = routineData.length;

  routineData.forEach(routine => {
    if (routine) {
      const history = Array.isArray(routine.history) ? routine.history : [];
      // 今日完了した履歴があるか確認
      const hasTodayHistory = history.some(h => h && h.timestamp >= todayStartMs && h.timestamp < todayEndMs);
      if (hasTodayHistory) {
        completedRoutinesCount++;
      }
    }
  });

  const routineSummary = {
    completed: completedRoutinesCount,
    total: totalRoutinesCount,
    progress: totalRoutinesCount > 0 ? (completedRoutinesCount / totalRoutinesCount) : 0,
  };

  // 4. 時間管理の集計
  const zikanLogs = Array.isArray(allData[KEYS.ZIKAN_LOGS]) ? allData[KEYS.ZIKAN_LOGS] : [];
  const todayZikanLogs = zikanLogs.filter(log => log.date === todayStr);
  const activityDuration = {}; // 各カテゴリごとの総時間（分）

  todayZikanLogs.forEach(log => {
    const startMins = timeToMins(log.start);
    let endMins = timeToMins(log.end);
    if (endMins < startMins) endMins += 1440; // 日跨ぎ対応

    const duration = endMins - startMins;
    const items = log.items || [{ name: log.activityName || '未分類', percent: 100 }];

    items.forEach(item => {
      const share = duration * (item.percent / 100);
      activityDuration[item.name] = (activityDuration[item.name] || 0) + share;
    });
  });

  // 分から時間（h）に変換し、降順ソート
  const zikanSummary = Object.entries(activityDuration).map(([name, mins]) => ({
    name,
    hours: parseFloat((mins / 60).toFixed(1)),
    minutes: Math.round(mins),
  })).sort((a, b) => b.minutes - a.minutes);

  const totalZikanMinutes = zikanSummary.reduce((sum, item) => sum + item.minutes, 0);

  return {
    habits: habitsSummary,
    water: waterSummary,
    routine: routineSummary,
    zikan: zikanSummary,
    totalZikanMinutes,
    todayStr,
  };
}

// 補助関数: "HH:MM" -> 分数
function timeToMins(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

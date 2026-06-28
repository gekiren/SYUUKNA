/**
 * ダッシュボードの集計データから、Gemini用のプロンプトテキストを生成する
 * 
 * @param {Object} summary - getTodaySummary(allData) で取得した集計オブジェクト
 * @returns {string} Gemini用のプロンプト文字列
 */
export function formatGeminiPrompt(summary) {
  if (!summary) return '';

  const { habits, water, routine, zikan, totalZikanMinutes, todayStr } = summary;

  let text = `【本日の習慣・行動ログのまとめ】\n`;
  text += `日付: ${todayStr}\n`;

  // 総合達成度の計算 (Dashboard.jsと同じロジック)
  const habitCompletionCount = habits.filter(h => h.count > 0).length;
  const habitScore = habits.length > 0 ? (habitCompletionCount / habits.length) * 100 : 0;
  const waterScore = water.percentage || 0;
  const routineScore = routine.progress * 100 || 0;
  
  const overallScore = Math.round(
    (habits.length > 0 ? habitScore : 0) + 
    (routine.total > 0 ? routineScore : 0) + 
    (water.goal > 0 ? Math.min(100, waterScore) : 0)
  ) / ((habits.length > 0 ? 1 : 0) + (routine.total > 0 ? 1 : 0) + (water.goal > 0 ? 1 : 0) || 1);

  text += `総合達成度: ${Math.round(overallScore)}%\n\n`;

  // 1. 水分補給
  text += `■ 水分補給\n`;
  text += `・摂取量: ${water.amount} ml / 目標: ${water.goal} ml (${water.percentage}% 達成)\n\n`;

  // 2. ルーティン
  text += `■ ルーティン完了率\n`;
  const routinePercent = Math.round(routine.progress * 100);
  text += `・完了: ${routine.completed} / 総数: ${routine.total} (${routinePercent}% 完了)\n\n`;

  // 3. 習慣カウンター
  text += `■ 習慣カウンター\n`;
  if (habits.length === 0) {
    text += `・登録された習慣はありません\n`;
  } else {
    habits.forEach(habit => {
      text += `・${habit.name}: ${habit.count} 回\n`;
    });
  }
  text += `\n`;

  // 4. 時間管理
  text += `■ 時間管理\n`;
  const totalHours = parseFloat((totalZikanMinutes / 60).toFixed(1));
  text += `・合計記録時間: ${totalHours} 時間 (${totalZikanMinutes} 分)\n`;
  if (zikan.length === 0) {
    text += `・本日の活動ログはありません\n`;
  } else {
    zikan.forEach(item => {
      text += `  - ${item.name}: ${item.hours}h (${item.minutes}分)\n`;
    });
  }
  text += `\n`;

  // 5. フィードバック要求プロンプト
  text += `---\n`;
  text += `上記の行動ログをもとに、今日の私の行動について、以下の点について具体的な分析とフィードバックをお願いします。\n`;
  text += `1. 今日の良かった点（うまくいっていること）\n`;
  text += `2. 改善できる点やボトルネック（時間の使い方や水分補給など）\n`;
  text += `3. 明日をもっと良くするための具体的なアドバイス（モチベーションが高まるようにお願いします）`;

  return text;
}

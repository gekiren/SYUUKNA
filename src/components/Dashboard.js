import React from 'react';
import { StyleSheet, Text, View, ScrollView, Dimensions } from 'react-native';
import { Droplet, CheckSquare, Activity, Clock, Award } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function Dashboard({ summary, navigation }) {
  if (!summary) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.textSecondary}>読み込み中...</Text>
      </View>
    );
  }

  const { habits, water, routine, zikan, totalZikanMinutes, todayStr } = summary;

  // 全体的な本日の進捗スコア (習慣ログ＋ルーティン＋水分) の平均パーセンテージを計算
  const habitCompletionCount = habits.filter(h => h.count > 0).length;
  const habitScore = habits.length > 0 ? (habitCompletionCount / habits.length) * 100 : 0;
  const waterScore = water.percentage || 0;
  const routineScore = routine.progress * 100 || 0;
  
  const overallScore = Math.round(
    (habits.length > 0 ? habitScore : 0) + 
    (routine.total > 0 ? routineScore : 0) + 
    (water.goal > 0 ? Math.min(100, waterScore) : 0)
  ) / ((habits.length > 0 ? 1 : 0) + (routine.total > 0 ? 1 : 0) + (water.goal > 0 ? 1 : 0) || 1);

  const formattedOverallScore = Math.round(overallScore);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* ヘッダーセクション */}
      <View style={styles.header}>
        <Text style={styles.dateText}>{todayStr} の記録</Text>
        <Text style={styles.greetingText}>今日も良い習慣を！</Text>
      </View>

      {/* 総合進捗カード */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreInfo}>
          <Text style={styles.scoreTitle}>本日の総合達成度</Text>
          <Text style={styles.scoreNumber}>{formattedOverallScore}%</Text>
          <Text style={styles.scoreSub}>
            {formattedOverallScore >= 100 
              ? '完璧です！素晴らしい！🎉' 
              : formattedOverallScore >= 70 
                ? '素晴らしいペースです！💪' 
                : formattedOverallScore >= 30 
                  ? 'その調子で進めましょう！✨' 
                  : '一歩ずつ始めましょう！🌱'}
          </Text>
        </View>
        <View style={styles.scoreBadgeContainer}>
          <Award size={48} color="#FFD700" />
        </View>
      </View>

      {/* 2カラムレイアウト（水分補給 & ルーティン） */}
      <View style={styles.row}>
        {/* 水分補給 */}
        <View style={[styles.card, styles.cardHalf]}>
          <View style={styles.cardHeader}>
            <Droplet size={20} color="#0A84FF" />
            <Text style={styles.cardTitle}>水分補給</Text>
          </View>
          <Text style={styles.cardValue}>
            {water.amount} <Text style={styles.cardUnit}>ml</Text>
          </Text>
          <Text style={styles.cardGoal}>目標: {water.goal}ml</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${water.percentage}%`, backgroundColor: '#0A84FF' }]} />
          </View>
          <Text style={styles.progressPercent}>{water.percentage}% 達成</Text>
        </View>

        {/* ルーティン */}
        <View style={[styles.card, styles.cardHalf]}>
          <View style={styles.cardHeader}>
            <CheckSquare size={20} color="#BF5AF2" />
            <Text style={styles.cardTitle}>ルーティン</Text>
          </View>
          <Text style={styles.cardValue}>
            {routine.completed} <Text style={styles.cardUnit}>/ {routine.total}</Text>
          </Text>
          <Text style={styles.cardGoal}>本日の完了回数</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${routine.progress * 100}%`, backgroundColor: '#BF5AF2' }]} />
          </View>
          <Text style={styles.progressPercent}>{Math.round(routine.progress * 100)}% 完了</Text>
        </View>
      </View>

      {/* 習慣カウンター */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Activity size={20} color="#FF9F0A" />
          <Text style={styles.cardTitle}>習慣カウンター</Text>
        </View>
        
        {habits.length === 0 ? (
          <Text style={styles.emptyText}>習慣が登録されていません</Text>
        ) : (
          <View style={styles.habitList}>
            {habits.map((habit) => (
              <View key={habit.id} style={styles.habitItem}>
                <View style={styles.habitInfo}>
                  <View style={[styles.habitColorDot, { backgroundColor: parseCssColor(habit.color) }]} />
                  <Text style={styles.habitName} numberOfLines={1}>
                    {habit.name}
                  </Text>
                </View>
                <View style={styles.habitCountBadge}>
                  <Text style={styles.habitCountText}>{habit.count} 回</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 時間管理 */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Clock size={20} color="#30D158" />
          <Text style={styles.cardTitle}>時間管理</Text>
        </View>

        {zikan.length === 0 ? (
          <Text style={styles.emptyText}>本日の活動ログはありません</Text>
        ) : (
          <View style={styles.zikanList}>
            <Text style={styles.zikanTotalText}>合計記録時間: {parseFloat((totalZikanMinutes / 60).toFixed(1))} 時間</Text>
            {zikan.map((item, index) => {
              const percentage = totalZikanMinutes > 0 ? (item.minutes / totalZikanMinutes) * 100 : 0;
              return (
                <View key={index} style={styles.zikanItem}>
                  <View style={styles.zikanHeaderRow}>
                    <Text style={styles.zikanName}>{item.name}</Text>
                    <Text style={styles.zikanTime}>
                      {item.hours}h <Text style={styles.zikanMins}>({item.minutes}分)</Text>
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: '#30D158' }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// 簡易的なCSSグラデーション/カラー文字列のパース（ドットの色用）
function parseCssColor(colorStr) {
  if (!colorStr) return '#FF9F0A';
  if (colorStr.startsWith('linear-gradient')) {
    // グラデーションから最初のカラーコードを抜き出す
    const match = colorStr.match(/#(?:[0-9a-fA-F]{3}){1,2}/);
    return match ? match[0] : '#FF9F0A';
  }
  return colorStr;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // 真っ黒を基調とした高級感のある背景
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginTop: 12,
    marginBottom: 20,
  },
  dateText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  greetingText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  scoreCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  scoreInfo: {
    flex: 1,
  },
  scoreTitle: {
    color: '#AEAEB2',
    fontSize: 14,
    fontWeight: '600',
  },
  scoreNumber: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  scoreSub: {
    color: '#30D158',
    fontSize: 13,
    fontWeight: '600',
  },
  scoreBadgeContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  cardHalf: {
    width: (width - 40) / 2,
    marginBottom: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  cardValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  cardUnit: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: 'normal',
  },
  cardGoal: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#2C2C2E',
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressPercent: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'right',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  habitList: {
    marginTop: 4,
  },
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  habitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  habitColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  habitName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  habitCountBadge: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  habitCountText: {
    color: '#FF9F0A',
    fontSize: 13,
    fontWeight: 'bold',
  },
  zikanList: {
    marginTop: 4,
  },
  zikanTotalText: {
    color: '#AEAEB2',
    fontSize: 13,
    marginBottom: 12,
  },
  zikanItem: {
    marginBottom: 14,
  },
  zikanHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  zikanName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  zikanTime: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  zikanMins: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: 'normal',
  },
  textSecondary: {
    color: '#8E8E93',
  },
});

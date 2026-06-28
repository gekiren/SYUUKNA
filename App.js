import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ActivityIndicator, StatusBar, Alert } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import * as Updates from 'expo-updates';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Flame, CheckSquare, Droplet, Clock, LayoutDashboard } from 'lucide-react-native';

// ユーティリティ & コンポーネント
import { loadAllData, KEYS, getTodaySummary } from './src/utils/storage';
import Dashboard from './src/components/Dashboard';

// WebアプリのJSバンドルHTML文字列
import HabitCounterHTML from './src/web-apps/HabitCounter';
import RoutineTrackerHTML from './src/web-apps/RoutineTracker';
import WaterHTML from './src/web-apps/Water';
import ZikanKanriHTML from './src/web-apps/ZikanKanri';

const Tab = createBottomTabNavigator();

// メモ化されたWebViewコンポーネント
// Appが再レンダリングされても、WebViewが不要にアンマウント・再マウントされるのを防ぎます
const WebViewTab = React.memo(({ html, initialData, onMessage }) => {
  const htmlWithData = useMemo(() => {
    const initialStorage = {};
    Object.keys(KEYS).forEach(keyName => {
      const storageKey = KEYS[keyName];
      const val = initialData[storageKey];
      if (val !== undefined && val !== null) {
        initialStorage[storageKey] = typeof val === 'string' ? val : JSON.stringify(val);
      }
    });

    // window.isInitialSync フラグで初期同期中の postMessage をスキップさせ、無限ループを回避します。
    const injectScript = `
      <script>
        (function() {
          window.isInitialSync = true;
          const initialData = ${JSON.stringify(initialStorage)};
          for (const key in initialData) {
            localStorage.setItem(key, initialData[key]);
          }
          window.isInitialSync = false;
        })();
      </script>
    `;
    
    return html.replace('<head>', `<head>\n${injectScript}`);
  }, [html, initialData]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <WebView
        source={{ html: htmlWithData }}
        originWhitelist={['*']}
        domStorageEnabled={true}
        javaScriptEnabled={true}
        allowFileAccess={true}
        onMessage={onMessage}
        onConsoleMessage={(event) => {
          console.log(`[WebView Console]: ${event.nativeEvent.message}`);
        }}
        style={styles.webview}
        backgroundColor="#000000"
      />
    </SafeAreaView>
  );
});

export default function App() {
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState({});
  const [summary, setSummary] = useState(null);
  
  // 起動時の初期ロードデータをキャッシュ（タブ起動時の初期同期専用で、不変）
  const [initialDataCached, setInitialDataCached] = useState(null);

  // EAS Update (OTA) のチェックと通知
  useEffect(() => {
    async function checkUpdates() {
      // 開発モード（__DEV__）の場合はチェックをスキップする
      if (__DEV__) {
        console.log("Skipping update check in development mode.");
        return;
      }

      if (!Updates.isEnabled) {
        console.log("Expo Updates is not enabled.");
        return;
      }

      try {
        console.log("Checking for updates...");
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          Alert.alert(
            "アップデートあり",
            "新しいアップデートが見つかりました。ダウンロードして適用しますか？",
            [
              {
                text: "適用する",
                onPress: async () => {
                  try {
                    await Updates.fetchUpdateAsync();
                    Alert.alert(
                      "適用完了",
                      "アップデートの適用が完了しました。アプリを再起動します。",
                      [{ text: "OK", onPress: () => Updates.reloadAsync() }]
                    );
                  } catch (e) {
                    console.error("Failed to download update:", e);
                    Alert.alert("エラー", "アップデートのダウンロードに失敗しました。");
                  }
                }
              },
              { text: "後で" }
            ]
          );
        } else {
          // 起動時の自動チェックなので、サイレントに完了させます
          console.log("App is up-to-date.");
        }
      } catch (e) {
        // ネットワーク切断やローカルテストによるエラーはサイレントに処理し、ログ出力のみにします
        console.warn("Error checking for updates silently:", e);
      }
    }

    const timer = setTimeout(() => {
      checkUpdates();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // 初回データロード
  useEffect(() => {
    async function init() {
      try {
        const data = await loadAllData();
        setAllData(data);
        setInitialDataCached(data);
        setSummary(getTodaySummary(data));
      } catch (e) {
        console.error('Failed to initialize app data:', e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // WebViewからのLocalStorage変更通知をハンドリングする (useCallbackでメモ化)
  const handleWebViewMessage = useCallback(async (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      if (message.type === 'WEB_ERROR') {
        console.error(`[WebView JS Error]: ${message.message}`);
        return;
      }
      
      if (message.type === 'LOCAL_STORAGE_SET') {
        const { key, value } = message;
        // 1. AsyncStorageに保存
        await AsyncStorage.setItem(key, value);
        
        // 2. React NativeのStateを更新
        setAllData(prev => {
          let parsedVal;
          try {
            parsedVal = JSON.parse(value);
          } catch {
            parsedVal = value;
          }
          const updated = { ...prev, [key]: parsedVal };
          
          // 3. 今日の集計サマリーを再計算
          setSummary(getTodaySummary(updated));
          return updated;
        });
      } else if (message.type === 'LOCAL_STORAGE_REMOVE') {
        const { key } = message;
        await AsyncStorage.removeItem(key);
        setAllData(prev => {
          const updated = { ...prev, [key]: null };
          setSummary(getTodaySummary(updated));
          return updated;
        });
      } else if (message.type === 'LOCAL_STORAGE_CLEAR') {
        const keysToRemove = Object.values(KEYS);
        await AsyncStorage.multiRemove(keysToRemove);
        setAllData({});
        setSummary(getTodaySummary({}));
      }
    } catch (e) {
      console.error('Error parsing WebView message:', e);
    }
  }, []);

  if (loading || !initialDataCached) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A84FF" />
        <Text style={styles.loadingText}>データを読み込んでいます...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={darkTheme}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Tab.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#000000',
            borderBottomWidth: 1,
            borderBottomColor: '#2C2C2E',
          },
          headerTitleStyle: {
            color: '#FFFFFF',
            fontWeight: 'bold',
            fontSize: 18,
          },
          tabBarStyle: {
            backgroundColor: '#1C1C1E',
            borderTopWidth: 1,
            borderTopColor: '#2C2C2E',
            paddingBottom: 5,
            height: 60,
          },
          tabBarActiveTintColor: '#0A84FF',
          tabBarInactiveTintColor: '#8E8E93',
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
          },
        }}
      >
        <Tab.Screen
          name="Dashboard"
          options={{
            title: 'ホーム',
            tabBarLabel: 'ホーム',
            tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
          }}
        >
          {(props) => (
            <SafeAreaView style={styles.safeArea}>
              <Dashboard {...props} summary={summary} />
            </SafeAreaView>
          )}
        </Tab.Screen>

        <Tab.Screen
          name="HabitCounter"
          options={{
            title: '習慣カウンター',
            tabBarLabel: '習慣',
            tabBarIcon: ({ color, size }) => <Flame size={size} color={color} />,
          }}
        >
          {() => (
            <WebViewTab
              html={HabitCounterHTML}
              initialData={initialDataCached}
              onMessage={handleWebViewMessage}
            />
          )}
        </Tab.Screen>

        <Tab.Screen
          name="RoutineTracker"
          options={{
            title: 'ルーティン管理',
            tabBarLabel: 'ルーティン',
            tabBarIcon: ({ color, size }) => <CheckSquare size={size} color={color} />,
          }}
        >
          {() => (
            <WebViewTab
              html={RoutineTrackerHTML}
              initialData={initialDataCached}
              onMessage={handleWebViewMessage}
            />
          )}
        </Tab.Screen>

        <Tab.Screen
          name="Water"
          options={{
            title: '水分補給',
            tabBarLabel: '水分',
            tabBarIcon: ({ color, size }) => <Droplet size={size} color={color} />,
          }}
        >
          {() => (
            <WebViewTab
              html={WaterHTML}
              initialData={initialDataCached}
              onMessage={handleWebViewMessage}
            />
          )}
        </Tab.Screen>

        <Tab.Screen
          name="ZikanKanri"
          options={{
            title: '24時間管理',
            tabBarLabel: '時間管理',
            tabBarIcon: ({ color, size }) => <Clock size={size} color={color} />,
          }}
        >
          {() => (
            <WebViewTab
              html={ZikanKanriHTML}
              initialData={initialDataCached}
              onMessage={handleWebViewMessage}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// React Navigationのダークテーマ定義
const darkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#0A84FF',
    background: '#000000',
    card: '#1C1C1E',
    text: '#FFFFFF',
    border: '#2C2C2E',
    notification: '#FF453A',
  },
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    color: '#8E8E93',
    marginTop: 12,
    fontSize: 14,
  },
});

const fs = require('fs');
const path = require('path');

// 設定：統合するWebアプリ一覧とそれぞれのパス
const webApps = [
  {
    name: 'HabitCounter',
    dir: path.join(__dirname, '../sozai/HabitCounter-main/HabitCounter-main'),
    html: 'index.html',
    css: 'style.css',
    js: 'app.js'
  },
  {
    name: 'RoutineTracker',
    dir: path.join(__dirname, '../sozai/routine-tracker3-main/routine-tracker3-main/pwa'),
    html: 'index.html',
    css: 'style.css',
    js: 'app.js'
  },
  {
    name: 'Water',
    dir: path.join(__dirname, '../sozai/water-main/water-main'),
    html: 'index.html',
    css: 'styles.css',
    js: 'app.js'
  },
  {
    name: 'ZikanKanri',
    dir: path.join(__dirname, '../sozai/zikankanri-main/zikankanri-main'),
    html: 'index.html',
    css: 'styles.css',
    js: 'app.js'
  }
];

const outputDir = path.join(__dirname, '../src/web-apps');

// 出力先ディレクトリの作成
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// LocalStorageの変更を検知してReactNative側（postMessage）に転送するブリッジコード
// 初期ロード同期中 (window.isInitialSync) は postMessage をスキップして無限ループを防止します。
const syncBridgeScript = `
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
`;

webApps.forEach(app => {
  console.log(`Bundling ${app.name}...`);
  
  const htmlPath = path.join(app.dir, app.html);
  const cssPath = path.join(app.dir, app.css);
  const jsPath = path.join(app.dir, app.js);

  if (!fs.existsSync(htmlPath)) {
    console.error(`HTML file not found: ${htmlPath}`);
    return;
  }

  let htmlContent = fs.readFileSync(htmlPath, 'utf8');
  let cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
  let jsContent = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf8') : '';

  // 1. CSSファイルのインライン化
  const cssLinkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["'][^"']*["'][^>]*>/i;
  const cssLinkRegex2 = /<link[^>]*href=["'][^"']*["'][^>]*rel=["']stylesheet["'][^>]*>/i;
  
  const styleTag = `<style>\n${cssContent}\n</style>`;
  
  if (cssLinkRegex.test(htmlContent)) {
    htmlContent = htmlContent.replace(cssLinkRegex, styleTag);
  } else if (cssLinkRegex2.test(htmlContent)) {
    htmlContent = htmlContent.replace(cssLinkRegex2, styleTag);
  } else {
    htmlContent = htmlContent.replace('</head>', `${styleTag}\n</head>`);
  }

  // 2. JSファイルのインライン化
  const jsScriptRegex = /<script[^>]*src=["'](?:app\.js|app_pwa\.js|sw\.js)["'][^>]*><\/script>/i;
  const genericJsScriptRegex = /<script[^>]*src=["'][^"']*["'][^>]*><\/script>/i;

  const scriptTag = `<script>\n${jsContent}\n</script>`;

  if (jsScriptRegex.test(htmlContent)) {
    htmlContent = htmlContent.replace(jsScriptRegex, scriptTag);
  } else if (genericJsScriptRegex.test(htmlContent)) {
    htmlContent = htmlContent.replace(genericJsScriptRegex, scriptTag);
  } else {
    htmlContent = htmlContent.replace('</body>', `${scriptTag}\n</body>`);
  }

  // 3. PWA系の不要な読み込み・登録タグを削除する
  htmlContent = htmlContent.replace(/<link[^>]*rel=["']manifest["'][^>]*>/gi, '');
  htmlContent = htmlContent.replace(/<script[^>]*src=["']sw\.js["'][^>]*><\/script>/gi, '');

  // 4. 同期ブリッジスクリプトの注入
  htmlContent = htmlContent.replace('<head>', `<head>\n${syncBridgeScript}`);

  // 5. バッククォートとバックスラッシュをエスケープしてJS文字列化
  const escapedContent = htmlContent
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${');

  const jsOutput = `export default \`${escapedContent}\`;\n`;

  // 6. 出力ファイルとして書き出す (.jsファイル)
  const outputPath = path.join(outputDir, `${app.name}.js`);
  fs.writeFileSync(outputPath, jsOutput, 'utf8');
  console.log(`Bundled ${app.name} -> ${outputPath}`);
});

console.log('Web apps bundling completed successfully.');

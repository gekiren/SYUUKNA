# ⚠️ 開発・デプロイにおける絶対遵守ルール (CRITICAL DEVELOPMENT RULES)

このプロジェクト（gym-tracker / TreNote）を開発するすべてのAIエージェントおよび開発者は、以下のワークフローおよびルールを無条件で完全に遵守しなければなりません。

---

## 1. ブランチ管理 ＆ 本番マージの絶対制限

> [!CAUTION]
> **勝手に origin/master へ Push しないこと ＆ 作業ブランチの徹底**
> 
> 1. **開発作業時のブランチ制限:**
>    - 新機能の追加、バグ修正、その他一切のコード変更は、ローカルの `master` ブランチで直接作業を行ってはなりません。
>    - 必ず **`staging` ブランチ**、または作業内容に応じた**新規ブランチ（例: `feature/xxx`、`fix/xxx`）**を作成し、そこで開発・コミットを行ってください。
> 2. **ステージング検証:**
>    - 作成した作業ブランチ（または `staging` ブランチ）で実装と検証（`npx tsc --noEmit`）を行い、EAS Update による `staging` チャンネルへの配信・動作確認を行います。
> 3. **本番マージの実行:**
>    - ユーザーによる実機検証が完了し、本番マージの承認が得られた後にのみ、変更を `master` ブランチへマージし、`origin/master` へ Push します。
>    - ご自身の判断でローカルの変更を `origin/master`（本番用リモートブランチ）へ直接マージまたは Push することは**厳格に禁止**されています。
>    - 変更がどれほど些細なものであっても、必ず上記のデプロイライフサイクルに従ってください。

---

## 2. 実装計画の提示 ＆ デプロイ ＆ 動作確認ライフサイクル (EAS Update Flow)

新機能の実装やバグ修正を行う際は、以下のステップを順に実行してください：

1. **実装プランの作成と承認 (Planning & Approval):**
   - コードの修正や変更、コマンド実行を行う前に、必ず具体的な変更内容をまとめた「実装計画（Implementation Plan）」を作成し、ユーザーに提示して承認（確認）を得てください。勝手に実装を開始することは厳禁です。**また、実装計画（Implementation Plan）は必ず日本語で作成・出力してください。**
2. **ローカル実装とコンパイル検証 (Local Coding & Type Check):**
   - 承認を得たプランに基づきローカルで実装し、完了後に必ず `npx tsc --noEmit` を実行して、TypeScriptのコンパイルエラーが「0件」であることを確認します。
3. **ステージング版への配信 (EAS Update to staging):**
   - 変更内容を **`staging` ブランチ（ステージング用チャンネル）** にのみ配信します。（検証はステージングチャンネルで行います）
   - 実行コマンド:
     ```bash
     npx eas update -p android --branch staging
     # または
     npx eas update -p ios --branch staging
     ```
   
   > [!CAUTION]
   > **EAS Build（ネイティブビルド）およびローカルビルド実行に関する絶対制限と選択ルール**
   > ビルド回数制限（利用枠）の節約および安全なリリースのため、**`eas build` コマンドやローカルビルドの実行は、ユーザーから事前に明確な「ビルドの実行指示」または「ビルドの選択承認」を得るまで厳格に禁止**されています。
   >
   > 新規実装機能やネイティブ設定変更（`app.json` 等）に伴いネイティブビルドが必要になった場合は、**AIから必ず以下の選択肢を提示し、ユーザーにどのルートで実行するかを決めてもらってください。その際には、ビルドルートの確認と併せて、対象環境が「開発ビルド（development）」「ステージングビルド（staging）」「本番ビルド（production）」のいずれであるかも必ず確認してください。**
   >
   > - **ルート１ (EASクラウドAPK):** EASクラウドビルドで検証用APKファイルをビルド → 実機に直接インストールして確認（※クレジットを消費するため、急ぎの場合のみ推奨）
   > - **ルート２ (ローカルAAB):** Android Studio等でローカルAABファイルをビルド（OTA対応） → Google Play Consoleにて内部テスト
   > - **ルート３ (EASクラウドAAB):** EASクラウドビルドで本番用AABファイルをビルド → Google Play Consoleにて内部テスト
   >
   > ---
   >
    > **🔑 ルート２（ローカルビルド）選択時のセキュリティ・手順＆チャンネル注入ルール**
    > ルート２を選択する場合、**Keystoreのパスワードやキーパスワードなどの秘匿情報をチャットに入力したり、AIに扱わせることは厳禁**です。
    > また、ローカルビルドの作業は**必ず PowerShell で行う**必要があります。AIがユーザーへ提示・出力するコマンドも、**PowerShell用に完全に対応した記述**としてください（パスの区切り記号 `\` や環境変数の設定方法 `$env:SENTRY_DISABLE_AUTO_UPLOAD = "true"` など）。
    > ローカルビルドでは自動的に `EXPO_CHANNEL_NAME` が注入されないため、以下の「ローカルビルド成功手順」をそのままユーザーに提示して実行を指示してください。
    > 
    > **ローカルビルド成功手順（ユーザーへの指示手順）：**
    > 
    > 1. **事前クリーンアップ（ロックエラー回避）:** 
    >    Android Studioや関連フォルダを閉じ、以下を実行してバックグラウンドのJava/Gradleプロセスを停止する：
    >    `Stop-Process -Name java -Force -ErrorAction SilentlyContinue`
    > 2. **クリーンネイティブビルドの生成 (プロジェクトルートで実行):**
    >    `npx expo prebuild --clean --platform android`
    > 3. **チャンネルの自動注入 ＆ 署名設定・properties生成 (プロジェクトルートで実行):**
    >    以下を実行して、`AndroidManifest.xml` へのチャンネル注入、`build.gradle` へのリリース署名設定の追加、および `expo-updates.properties` の生成を自動で行います：
    >    `powershell -ExecutionPolicy Bypass -File .\scripts\inject-channel.ps1`
    > 4. **署名設定の追加 (androidディレクトリへ移動):**
    >    `cd android` して、`gradle.properties` の末尾に以下の本番署名キー設定を一時的に追記するよう指示します：
    >    ```properties
    >    MYAPP_UPLOAD_KEY_ALIAS=gekirennomad
    >    MYAPP_UPLOAD_STORE_PASSWORD=[パスワード]
    >    MYAPP_UPLOAD_KEY_PASSWORD=[パスワード]
    >    ```
    > 5. **ビルド実行 (Sentry無効化・Gradleリセット):**
    >    `.\gradlew --stop`
    >    `$env:SENTRY_DISABLE_AUTO_UPLOAD = "true"`
    >    `.\gradlew bundleRelease`
    > 6. **生成ファイルと後片付け:**
    >    ファイルは `android/app/build/outputs/bundle/release/app-release.aab` に生成されることを伝える。ビルド後は追記したパスワード等の変更をGitで元に戻す（破棄する）よう指示する。
    > 
    > **ローカルビルドでのOTAチャンネル設定の内部仕様と解決策 (expo-updatesのバグ対策):**
    > 
    > Androidのローカルビルドにおいて、JS側で `Updates.channel` が `null` (N/A) となり、OTAアップデートが受信できなくなる問題に対する恒久的な解決策と注意点は以下の通りです。
    > 
    > 1. **expo-updatesライブラリのタイポバグについて:**
    >    `expo-updates` の Android 用ネイティブコード（`UpdatesConfiguration.kt`）において、リクエストヘッダー（`requestHeaders`）を `AndroidManifest.xml` のメタデータから読み取る際に、キー名として間違って定数名そのものである `"expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY"` がハードコードされています。
    >    標準の Expo Config Plugin は `"expo.modules.updates.requestHeaders"` に書き込むため、ネイティブコード側でチャンネル情報が読み取れず、チャンネル名が `N/A` になります。
    > 2. **解決策 (ダブル注入):**
    >    このため、`scripts/inject-channel.ps1` では、`AndroidManifest.xml` に以下の両方のメタデータタグを注入しています。
    >    - `<meta-data android:name="expo.modules.updates.requestHeaders" android:value="{&quot;expo-channel-name&quot;:&quot;production&quot;,&quot;expo-release-channel&quot;:&quot;production&quot;}"/>`
    >    - `<meta-data android:name="expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY" android:value="{&quot;expo-channel-name&quot;:&quot;production&quot;,&quot;expo-release-channel&quot;:&quot;production&quot;}"/>`
    >    値の中のダブルクォーテーションは、XMLエンティティとして必ず `&quot;` でエスケープする必要があります。
    > 3. **expo-updates.properties の同期:**
    >    ローカルビルド時には、自動生成されない `android/app/src/main/assets/expo-updates.properties` ファイルにもチャンネル設定（`expo.modules.updates.EXPO_RELEASE_CHANNEL=production`）が必要です。これらすべてを `scripts/inject-channel.ps1` が自動処理します。
    > 4. **検証方法:**
    >    ビルド後、デベロッパーメニューを開き、`Channel: production` が表示されていること、およびアップデートIDが適用できることを確認してください。
    > 
    > ---

    > [!IMPORTANT]
   > **クラウドビルド運用時のローカル Prebuild クリーン徹底ルール**
   > 本プロジェクトでは `/android` フォルダが `.gitignore` に指定されています。クラウドビルド（EAS Build）はコミットされた `app.json` から常にクリーンビルドされますが、ローカルで動作検証（`npx expo run:android` 等）を行う際は手元の古い `android` フォルダが使い回されるため、設定が同期しない問題が発生します。
   > **`app.json` の設定（`plugins` や `android` 設定、パーミッション、バージョン等）を変更した後は、ローカル動作検証の前に必ず以下のコマンドを実行し、ローカルのネイティブファイルを最新に同期してください：**
   > `npx expo prebuild --clean --platform android`

   > [!IMPORTANT]
   > **ユーザーへのターミナル操作指示における絶対配慮ルール**
   > ユーザーに PowerShell やコマンドプロンプト等のターミナル操作を依頼する場合は、**必ず初期画面（`C:\Users\toshi` 等のホームディレクトリ）にいる前提で指示を作成してください。**
   > コマンドを実行させる前に、必ず以下のプロジェクトフォルダへの移動（`cd`）から順を追って丁寧に説明すること：
   > `cd C:\TreNote`

4. **ユーザーによる実機検証の依頼:**
   - 配信されたステージング版の **Update ID** などの情報を提示し、ユーザー様に動作確認を依頼します。
5. **本番マージの実行 (ユーザー承認後):**
   - ユーザー様が実機で動作確認を行い、**「マージして良い」「本番へPushして良い」などの明示的なご承認をいただいた場合のみ**、`origin/master` ブランチへ Push（マージ）します。
6. **本番OTAの留保:**
   - 本番用チャンネルへの配信（`eas update --branch production`）は、本番用OTAのご指示があるまで絶対に実行しないでください。
7. **OTAアップデート時の更新情報の記載 (Update Information Log):**
   - 今後、不具合修正や機能追加等でOTAアップデート（`eas update`）を行う際は、ユーザーがアプリアップデート後に起動した際に表示される更新情報ポップアップにその変更内容を反映させるため、必ず [src/config/otaUpdateConfig.ts](file:///c:/kintore/gym-tracker/src/config/otaUpdateConfig.ts) の `CURRENT_OTA_CONFIG`（バージョン、タイトル、更新内容 `notes`）を適切に更新してください。
   - **EAS Update の実行前に、インフォメーションポップアップに表示する具体的な内容（日本語・英語の notes）を必ずユーザーに提示し、文言の確認と承認を得てください。**
8. **Google Play Storeリリースノートの作成ルール (Google Play Store Release Notes):**
   - 新しいネイティブビルド（`.aab`）を作成する際は、必ず前回の本番バージョンからの変更点をまとめたリリースノート（日本語・英語）を作成してユーザーに提示してください。
   - **Google Play Consoleの文字数制限に対応するため、文章は極力短く簡素にまとめ、表題（概要）のみを簡潔な箇条書き形式で記述してください。**
9. **EAS Update 配信時のチャンネルマッピングおよびプラットフォーム制限ルール (EAS Update Channels & Platforms):**
   - **チャンネルとブランチのマッピング不整合の防止:**
     - ステージング（`staging`）チャンネルは `staging` ブランチ、本番（`production`）チャンネルは `production` ブランチを指している必要があります。
     - アップデート配信後、アプリ側で更新が検知されない場合は `npx eas channel:view <channel-name>` でマッピングを確認し、不整合があれば `npx eas channel:edit <channel-name> --branch <branch-name>` で紐付けを修正してください。
   - **プラットフォーム制限（Webバンドルエラーの回避）:**
     - プロジェクトには Web プラットフォームの設定（Expo Router 等）が含まれていますが、`react-native-google-mobile-ads` 等のネイティブ専用ライブラリが Web ビルド時にエラーを引き起こすため、デフォルトの `platform=all` による一括配信は失敗します。
     - **必ず `-p android` または `-p ios` を明示的に指定して、個別に配信を行ってください。**
       ```bash
       npx eas update -p android --branch <branch> --message "<message>"
       npx eas update -p ios --branch <branch> --message "<message>"
       ```


---

## 3. 開発ディレクトリに関する絶対ルール (Development Directory)

> [!IMPORTANT]
> **開発は必ず `C:\TreNote` で行ってください。**
> 過去に `C:\Users\toshi\.gemini\antigravity\scratch\kintore` というディレクトリが使用されていた経緯がありますが、**現在このディレクトリは使用されていません（廃止済み）。**
> ファイルの読み書き・コマンド実行・パス参照は、すべて `C:\TreNote` を基準に行ってください。
> scratch ディレクトリ（`C:\Users\toshi\.gemini\antigravity\scratch\kintore`）への変更・参照は一切行わないこと。

---

### 🧹 環境移行時・ビルド不整合時のクリーンアップ手順（PowerShell用）
開発フォルダの移行後や、ローカルビルドで原因不明のエラー・不整合（古いパスの参照など）が発生した場合、また動作が重くなったと感じた場合は、PowerShellを開き、プロジェクトルート（`C:\TreNote`）で以下のクリーンアップ手順を実行してください。

> [!WARNING]
> **※注意:** このクリーンアップを実行した直後の初回 `npm install` および最初のビルド（EAS Build Local等）は、すべてのキャッシュを再構築するため**通常より大幅に時間がかかります（5〜15分程度）**。
> そのため、本手順は**「開発フォルダを移行した直後」**や**「トラブルシューティング時（※下記基準）」**などの必要な場合のみ実行してください。日常的なビルド毎に実行する必要はありません。

**トラブルシューティング時の実行基準:**
- コード의 修正や対策を行った上で、**連続して2回ビルドに失敗し、かつエラーログから具体的なコード上の原因が特定できない場合**、速やかにこのクリーンアップ手順を実行してください。

**クリーンアップ実行手順:**

1. **不要なキャッシュ・ビルドフォルダの物理削除**
   以下のPowerShellコマンドを実行し、不整合の原因となるキャッシュや一時ファイルを根こそぎ強制削除します：
   ```powershell
   Remove-Item -Recurse -Force -ErrorAction SilentlyContinue .expo, android/.gradle, android/.idea, android/build, android/app/build, node_modules, package-lock.json
   ```

2. **npmパッケージのクリーンインストール**
   削除後、依存関係を最新の状態で再インストールします：
   ```powershell
   npm install
   ```

3. **ネイティブディレクトリ（/android）のクリーン再生成**
   `app.json` などの設定をクリーンな状態でネイティブファイルに同期します：
   ```powershell
   npx expo prebuild --clean --platform android
   ```

4. **Metroデベロッパーサーバーのキャッシュクリア起動**
   JavaScriptバンドル時のキャッシュの不整合を解消して起動します：
   ```powershell
   npx expo start -c
   ```

### 🔗 絶対パス依存の排除ガイドライン
- プロジェクト内のスクリプトや設定ファイルにおいて、**特定のローカルマシンに依存する絶対パス（`C:\Users\...` 等）をハードコードすることは厳禁**です。
- パスを記述する際は、必ずプロジェクトルートからの相対パス（例: `../../@gekirennomads-organization__gym-tracker.jks`）を使用するか、Node.js of `path.resolve` 等を用いて動的に解決してください。
- ユーザーに共有するドキュメント内（`DEVELOPMENT_RULES.md` 自体を含む）のファイルリンクも、現在のプロジェクトルート `file:///c:/TreNote/` を基準とした正しいパスに更新されていることを常に確認してください。

---

## 4. UI/UX ＆ データベース実装の鉄則 (Critical Engineering Guardrails)

アプリの品質とパフォーマンスを担保するため、以下の実装仕様を維持してください。

### ① 重量（kg/lbs）入力欄の固定スリム幅
- 重量入力欄（`TextInput`）は、右側の無駄な広がりを防ぐため、固定幅 **`width: 90`** に調整されています。テーブルヘッダーの「kg (lbs)」列も同じ幅を維持し、整列性を保ってください。

### ② 入力フォーカス時のカーソル（｜）中央位置バグ修正
- `textAlign: 'center'` が有効で入力値が空（`-` 表示）の際、カーソルが右端に寄ってしまうReactNativeの描画バグを回避するため、入力欄が空のフォーカス時は選択範囲を先頭に固定するロジック（`selection={localValue === '' ? (sel ?? { start: 0, end: 0 }) : sel}`）を使用してください。

### ③ SQLiteデッドロックの防止（プリフェッチ設計）
- データベース初期化（`initDB()`）やデータ挿入時、トランザクション（`withTransactionAsync`）の内部で非同期の `getFirstAsync` や `getAllAsync` などの SELECT クエリを実行するとデッドロックが発生し、起動画面で永久にフリーズします。
- 必要なデータは必ず**トランザクション開始前に await してメモリ上に取得（キャッシュ）**し、トランザクション内は同期的・逐次的な `runAsync` の実行のみで完結させてください。

### ④ 広告表示プランの厳格な制限（ベーシックプラン限定）
- アプリ内のすべての広告（バナー広告、リワードインタースティシャル広告など）は、**「ベーシックプラン（無料プラン）」のユーザーにのみ表示・処理**されなければなりません。
- **「プレミアムプラン」**および**「アーリーアダプター」**のユーザーに対しては、広告の初期化・ロード・描画プロセスを一切走らせず、完全に広告フリーの体験を提供してください。

### ⑤ 本番ビルド（production）における開発者メニュー（デベロッパーメニュー）の完全無効化
- 本番ビルド（`Updates.channel === 'production'` チャンネル）では、ストアの審査リジェクト（規約違反）およびセキュリティ脆弱性を回避するため、アプリ内の隠し開発者メニュー（`developer-menu`）へのアクセス・遷移を完全に無効化（遮断）しなければなりません。
- ただし、ステージングビルド（`staging` チャンネル）およびローカル開発環境（`__DEV__`）では、検証およびメンテナンスのために隠しコマンド（プライバシーポリシー画面を5回タップしてパスコードを入力）でのアクセスを可能に維持してください。

---

## 5. AIパーソナルトレーナー（AI Trainer）および Gemini API の仕様

### ① 使用する最新モデルの絶対的な指定
- 最新の軽量・高速な公式モデルは **`gemini-3.5-flash`** です。過去の誤った思い込みや以前のバージョン（`gemini-1.5-flash`など）への書き換えは**厳禁**です。
- サーバー（Cloudflare Workers プロキシ）およびドキュメントのモデル名は、常に `gemini-3.5-flash` を指定・維持してください。
- **公式リリース情報＆移行ガイド**: [Whats new with Gemini 3.5](https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.5?hl=ja)

### ② サーバー（Worker）接続仕様
- クライアント側（`aiCoachService.ts`）の接続先は、必ず実際に稼働しているユーザー様のプロキシアドレス `https://gym-tracker-ai-proxy.toshi-diyil.workers.dev/api/chat` を参照・維持してください。テスト用のプレースホルダーへの変更は絶対に行わないでください。

---

## 6. 会話セッションの移行・引き継ぎのルール (Conversation Handover Rule)

AIエージェントのコンテキストメモリ（脳のメモリ領域）の肥大化による誤判断や、古いコードへの固執、コード品質の低下を防ぐため、AIは以下のタイミングを検知した際、**自発的にユーザーに対して会話を切り替えて新しいセッションへ移行する提案（引き継ぎサマリー `handover_summary.md` の作成）を行う**ものとします。

### 🚨 会話セッション切り替えの推奨タイミング

1. **【実装】から【ビルド・検証】へのフェーズ移行時:**
   - 新機能や不具合修正のコード実装が完了し、`npx tsc --noEmit` で型チェックが通り、Gitのコミット整理を終えたタイミング。（※これから実行するビルド手順や動作確認プロセスに頭をクリーンにして集中するため）
2. **【トラブルシューティング（デバッグ）】完了直後:**
   - 複雑なビルドエラーや実行時エラーの調査がようやく解決し、コード修正を完了したタイミング。（※会話履歴にある大量のエラーログのノイズにAIが引っ張られないようにするため）
3. **【設計（プランニング）】から【実装】へのフェーズ移行時:**
   - 実装計画（Implementation Plan）についての議論を終え、ユーザーから承認（Goサイン）が得られたタイミング。（※設計時の雑談や古い選択肢の迷いを忘れ、実装に特化するため）
4. **会話の往復（ターン数）が 30〜40 ターンを超えたとき:**
   - 順調に進んでいても、閲覧したファイル数や実行したコマンド数が増え、AIの動作が不安定になり始める前のタイミング。

### 🤖 AIの行動ガイドライン
- 上記のタイミングに達した際、AIは**自発的にユーザーへ「ここでの新しい会話への移行」を提案**してください。
- 移行が承認されたら、現在の会話ID of brain フォルダ直下に引き継ぎサマリー（`handover_summary.md`）を作成し、次のセッションで最初に行うべきアクションを明記して会話を終了してください。
- **【重要】ユーザーが新しい会話で即座に貼り付けて指示できるよう、以下の「引き継ぎ指示テンプレート」のフォーマットに沿って、チャット上にコピペ可能なコードブロックおよびクリック用リンクを必ず最後に出力してください。**

  ```text
  作業前にルートにある DEVELOPMENT_RULES.md を確認してください。
  下記のファイルの内容を読み込んで、指示に従って進めてください。
  file:///C:/Users/toshi/.gemini/antigravity/brain/[Conversation-ID]/handover_summary.md
  ```





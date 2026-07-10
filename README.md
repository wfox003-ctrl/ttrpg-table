# TRPG 卓上ツール（テスト版）

ダイスロールと会話ログをブラウザだけで使える、静的なテスト版です。

## ローカルで開く

`index.html` をブラウザで開くだけで使えます。

## GitHub Pages で公開する

1. GitHubで新しいリポジトリ（例：`ttrpg-table`）を作成します。
2. このフォルダ内の4ファイルをリポジトリへアップロードします。
3. リポジトリの **Settings → Pages** を開きます。
4. **Build and deployment** の Source を **Deploy from a branch**、Branch を **main / (root)** にして Save。
5. 数分後に表示されるURLが公開URLです。

この版では、ログは各利用者のブラウザにのみ保存されます。共有チャットはFirebaseまたはSupabaseを加えて実装できます。

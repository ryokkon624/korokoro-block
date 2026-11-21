# korokoro-block

タブレットを傾けてボールを転がす、ブロックの世界のブラウザゲーム。

- HTML + JavaScript のみ（ビルド不要）
- タブレットの傾きセンサー（DeviceMotion / DeviceOrientation）で操作
- GitHub Pages で公開: https://ryokkon624.github.io/korokoro-block/

## ページ

| ファイル           | 内容                                   |
| ------------------ | -------------------------------------- |
| `sensor-test.html` | 傾きセンサーの動作確認用テストページ   |

## 傾きセンサーについて

- 傾きセンサーは HTTPS（または localhost）でしか動かないため、実機確認は GitHub Pages 上で行う
- 遊ぶときはタブレットの画面の自動回転をオフにする（「はじめる」で全画面＋横向き固定も試みる）

## ローカルでの確認

```sh
python -m http.server 8765
# http://localhost:8765/sensor-test.html を開く
```

PC ではマウスでドラッグした方向にボールが転がる。

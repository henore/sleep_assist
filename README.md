# sleep 不眠症認知行動療法支援アプリ

## 概要
医療目的ではない、不眠症に対しての認知行動療法を、日々の睡眠記録や自身の行動療法の活動記録から、AIのAPIを利用した形で応援メッセージを受け取り、支援するためのアプリ。

## 開発背景における研究との関連

本アプリは、認知行動療法（CBT-I）における科学的エビデンスに基づいた支援を意識して設計しています。参考とした論文では、以下のポイントが特に注目されていました：

- 一般的な睡眠衛生（光、カフェイン等）は効果が薄い
- リラクゼーション（特に筋弛緩）は他の疾患でも効果が減少する傾向
- 瞑想（マインドフルネス）は有望であるが、リラクゼーションとは別枠で検討すべき

実際に著者の方からも、「睡眠衛生の限界」「マインドフルネスの重要性」「AIを使った自動的な継続支援の可能性」について示唆をいただきました。

> ※このやりとりは個人で行ったもので、研究者からの正式な協力は受けていません。

## 目的
不眠症に悩む人に対して、従来の薬のみの治療だけに頼らず、認知行動療法も取り入れることにより、不眠症の改善をはかる。開発者が不眠症で多くの薬を飲んでいるので試作。

## 技術構成
- Python（デスクトップアプリ形式）

## 対応範囲
- 不眠症に悩む人のため。今回は開発者本人で、試作品。
- 不眠症でも薬に頼りたくない人向け。もしくは両方で改善に向かいたい人。

## 利用方法
1. アプリを起動
2. 睡眠時間や睡眠の感想を記録。チェックボックスで心境（寝れるか不安だった）などを選んでもらう。
3. それを記録すると、APIを通じてAIがアドバイス。
4. 日々の生活習慣について意識を高めてもらう。

## 今後の課題、展望
- APIが個人個人の記録を常に把握した、gptやクロードなら会話を継続したような状態で助言ができないか
　（現状場当たり的だったり、同じアドバイスを繰り返す） 
- デスクトップアプリで自分用に作っているので、スマホアプリ化して配布の検討
- 配布の場合は、必ず医療目的ではなく、支援目的とする
- 支援目的なので、基本的には無理をしてもらわず、通院や医師に相談してもらうことを前提とする
- サブスク化も検討するが、価格帯としては睡眠と言うカテゴリに絞っているので、従来のアプリよりは手頃な値段としたい。

# sleep_assist
# sleep_assist

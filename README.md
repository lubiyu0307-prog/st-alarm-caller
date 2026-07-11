# ST鬧鐘呼叫

讓 SillyTavern 裡的角色可以在聊天中幫你「設鬧鐘」：
角色答應你之後，訊息下方會出現一張鬧鐘卡片，點一下就把鬧鐘設到你的手機上。

- **Android**：直接呼叫系統時鐘 App，不需要安裝任何東西
- **iPhone**：透過一個 iOS 捷徑中轉建立鬧鐘

## 安裝擴充

1. 在 SillyTavern 裡：Extensions（左側插座圖示）→ 右上角「Install extension」
2. 貼上這個 repo 的網址：
   `https://github.com/lubiyu0307-prog/st-alarm-caller`
3. 安裝完成後重新整理頁面。
4. 到 Extensions 設定面板會看到「ST鬧鐘呼叫」的抽屜，裡面可以：
   - 開關鬧鐘功能
   - 設定 iOS 捷徑名稱（預設已填「ST鬧鐘呼叫」）

## 使用前準備

### Android

不需要額外安裝任何東西。點鬧鐘卡片時，擴充會直接呼叫系統時鐘 App 的
「設定鬧鐘」intent，時間和名稱自動帶入。
（需在 Chrome 或其他 Chromium 系瀏覽器中使用；少數自訂時鐘 App 可能不支援。）

### iPhone（iOS 捷徑）

1. 在 iPhone 上安裝「ST鬧鐘呼叫」捷徑：
   https://www.icloud.com/shortcuts/162c14d3452247278cd2febcbeb86eba
   （擴充的設定面板裡也有這個安裝連結）
2. 捷徑名稱必須和擴充設定裡填的完全一致（預設都是「ST鬧鐘呼叫」，不改名就直接能用）。
3. 第一次執行捷徑時 iOS 會詢問權限，按允許即可。

## 運作方式

1. 只有你明確請角色設鬧鐘/提醒時，角色才會在回覆中輸出一行隱藏標記
   `[[ALARM|HH:MM|名稱]]`，平常聊天不會出現。
2. 擴充會把這行從正文剝掉，正文照常顯示，並在描寫設鬧鐘動作的段落下方
   生成一張鬧鐘卡片（大字時間＋名稱＋「點一下設到手機」）。
3. 點卡片才會真的設鬧鐘（iOS 規定自訂 scheme 必須由使用者手勢觸發）。
4. 卡片資訊會存進訊息本身，重新整理頁面、切換聊天再回來都還看得到卡片。

## 已知限制

- 卡片是附加在角色訊息內，而不是獨立的一則新訊息。
- 同一張卡片可以重複點擊，目前沒有「已設定」的狀態鎖。

## 授權 License

本專案採用 [PolyForm Noncommercial License 1.0.0](./LICENSE)：
歡迎自由使用、修改、合併、散佈，但**僅限非商業用途**。
Free to use, modify, and redistribute for **noncommercial purposes only**.

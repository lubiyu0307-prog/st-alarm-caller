# ST鬧鐘呼叫

讓 SillyTavern 裡的角色可以在聊天中幫你「設鬧鐘」，透過 iOS 捷徑中轉建立 iPhone 鬧鐘。
邏輯與 Brume 的鬧鐘功能相同，只是換成 SillyTavern 擴充的形式。

## 使用前準備

### Android
不需要安裝任何東西。點鬧鐘卡片時，擴充會直接呼叫系統時鐘 App 的
「設定鬧鐘」intent，時間和名稱自動帶入。
（需在 Chrome 或其他 Chromium 系瀏覽器中使用；少數自訂時鐘 App 可能不支援。）

### iPhone（iOS 捷徑）

1. 在 iPhone 上安裝「ST鬧鐘呼叫」捷徑：
   https://www.icloud.com/shortcuts/162c14d3452247278cd2febcbeb86eba
   （擴充的設定面板裡也有這個安裝連結）
2. 捷徑名稱必須和擴充設定裡填的完全一致（預設都是「ST鬧鐘呼叫」，不改名就直接能用）。
3. 第一次執行捷徑時 iOS 會詢問權限，按允許即可。

## 安裝擴充（GitHub 那條路）

1. 把這個資料夾（manifest.json / index.js / style.css）推到你自己的 GitHub repo，例如：
   `github.com/lubiyu0307-prog/st-alarm-caller`
2. 在 SillyTavern 裡：Extensions（左側插座圖示）→ 右上角「Install extension」
3. 貼上你的 repo URL，安裝完成後重新整理頁面。
4. 到 Extensions 設定面板會看到「ST鬧鐘呼叫」的抽屜，裡面可以：
   - 開關鬧鐘功能
   - 設定 iOS 捷徑名稱（預設已填「ST鬧鐘呼叫」）

## 運作方式

1. 只有你明確請角色設鬧鐘/提醒時，角色才會在回覆最後偷偷輸出一行
   `[[ALARM|HH:MM|名稱]]`，平常聊天不會出現。
2. 擴充會把這行從正文剝掉，正文照常顯示，同時在那則訊息下方生成一張鬧鐘卡片
   （大字時間＋名稱＋「點一下設到 iPhone」）。
3. 點卡片才會呼叫捷徑（符合 iOS 規定：自訂 scheme 一定要由使用者手勢觸發）。
4. 卡片資訊會存進訊息本身（`message.extra.stAlarmCard`），重新整理頁面、
   切換分頁再回來都還看得到卡片。

## 已知限制 / 之後可以再加強的地方

- 卡片目前是「附加在同一則角色訊息下方」，而不是獨立成一則新訊息——
  這是配合 SillyTavern 訊息結構做的簡化，行為上跟 Brume 原本規格（另外生成一則鬧鐘卡片訊息）
  略有不同，但視覺效果一樣是「一張獨立卡片」。
- 目前沒有做重複呼叫防呆（同一張卡片可以一直點、一直觸發捷徑），如果之後想加
  「已設定」狀態鎖住卡片，可以再跟我說。

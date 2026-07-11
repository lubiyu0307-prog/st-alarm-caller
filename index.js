// ST鬧鐘呼叫 (st-alarm-caller)
// 讓酒館角色可以在對話中「設鬧鐘」，透過 iOS 捷徑中轉建立 iPhone 鬧鐘。
//
// 架構對應原本 Brume 施工單的三部分：
// 1) 系統規則注入：只有使用者明確要求時，角色才在回覆最後輸出 [[ALARM|HH:MM|名稱]]
// 2) 訊息解析：從角色訊息中剝除該標記，正文正常顯示，另外把資訊存進 message.extra
// 3) 鬧鐘卡片 UI：在該則訊息下方渲染卡片，點擊才呼叫 iOS 捷徑（符合 iOS 手勢觸發限制）

import { extension_settings, getContext } from "../../../extensions.js";
import {
    eventSource,
    event_types,
    saveSettingsDebounced,
} from "../../../../script.js";

const MODULE_NAME = "st-alarm-caller";
const VERSION = "1.3.0";

const defaultSettings = {
    enabled: true,
    shortcutName: "ST鬧鐘呼叫", // 對應 iOS 捷徑名稱，需與實際捷徑名稱一致
};

// iOS 捷徑安裝連結（「ST鬧鐘呼叫」捷徑）
const SHORTCUT_INSTALL_URL =
    "https://www.icloud.com/shortcuts/162c14d3452247278cd2febcbeb86eba";

// [[ALARM|HH:MM|名稱]]，允許出現在訊息中任何位置（相容結尾帶狀態欄的角色卡）
// 同時容忍模型輸出全形「｜」「：」與分隔符旁的空格
const ALARM_REGEX = /[ \t]*\[\[ALARM[|｜]\s*(\d{1,2}[:：]\d{2})\s*[|｜]\s*([^\[\]|｜\n]{1,20}?)\s*\]\][ \t]*\n?/;

function getSettings() {
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = structuredClone(defaultSettings);
    }
    for (const key of Object.keys(defaultSettings)) {
        if (extension_settings[MODULE_NAME][key] === undefined) {
            extension_settings[MODULE_NAME][key] = defaultSettings[key];
        }
    }
    return extension_settings[MODULE_NAME];
}

function buildAlarmRule() {
    return [
        "【鬧鐘功能規則】",
        "只有當使用者明確請你設定鬧鐘或提醒（例如「明天六點叫我起床」「等一下提醒我喝水」）時，才需要輸出鬧鐘標記；使用者沒有明確要求時，絕對不要輸出這個格式，也不要主動提議。",
        "若使用者明確要求，請先用你自己的語氣正常回覆、答應對方，接著在正文結束後「另起一行」，單獨輸出一行如下格式的標記（若你的回覆結尾有狀態欄或其他固定格式區塊，標記放在正文與該區塊之間）：",
        "[[ALARM|HH:MM|鬧鐘名稱]]",
        "規則：",
        "- 時間一律使用24小時制（HH:MM）",
        "- 鬧鐘名稱由你依照自己的語氣與你平常對使用者的稱呼現場撰寫，需貼合用途（例如叫醒、提醒事項、休息、喝水吃飯等），限10字以內，不使用emoji，讀起來像一張你留在鬧鐘裡的小紙條",
        "- 標記必須單獨佔一行，可以放在正文之後、狀態欄或其他固定格式區塊之前，不受「最後一行必須是某格式」之類規則影響",
        "- 這是系統功能標記，優先級最高：即使你在劇情中已經描寫了「拿起手機設鬧鐘」的動作，或角色設定中有其他輸出格式要求，只要使用者要求設鬧鐘，就必須輸出這行標記，否則使用者的手機不會真的建立鬧鐘，等於你答應了卻沒做到",
        "- 絕對不要照抄任何範例文字，名稱必須是你當下用自己的口吻生成的",
    ].join("\n");
}

function applyExtensionPrompt() {
    const context = getContext();
    const settings = getSettings();
    // position: extension_prompt_types.IN_CHAT = 1, depth 0 表示插在最接近當前對話的位置
    context.setExtensionPrompt(
        MODULE_NAME,
        settings.enabled ? buildAlarmRule() : "",
        1,
        0,
        false,
        0 // extension_prompt_roles.SYSTEM
    );
}

// 聊天補全（OpenAI/Gemini/Claude 等 Chat Completion API）專用的保險注入：
// 在 prompt 組裝完成、即將送出的時刻，直接把規則塞進訊息列表結尾，
// 不依賴 setExtensionPrompt 的注入管線
function onChatCompletionPromptReady(eventData) {
    if (eventData.dryRun) return;
    if (!getSettings().enabled) return;
    if (!Array.isArray(eventData.chat)) return;
    // setExtensionPrompt 那條路已經注入的話就不重複塞
    const alreadyInjected = eventData.chat.some(
        (msg) =>
            typeof msg?.content === "string" &&
            msg.content.includes("【鬧鐘功能規則】")
    );
    if (alreadyInjected) return;
    eventData.chat.push({ role: "system", content: buildAlarmRule() });
}

// 暫存：訊息渲染前偵測到的鬧鐘資訊，key 為 messageId
const pendingAlarms = new Map();

function extractAlarmFromMessage(message) {
    if (!message || message.is_user || typeof message.mes !== "string") {
        return null;
    }
    const match = message.mes.match(ALARM_REGEX);
    if (!match) return null;

    const [fullMatch, rawTime, label] = match;
    const time = rawTime.replace("：", ":");

    // 記下標記前最後一行正文當「錨點」，渲染時把卡片插在該段劇情正下方
    const anchor = buildAnchor(message.mes.slice(0, match.index));

    // 從正文剝除標記（標記可能在訊息中間，例如角色卡結尾有狀態欄），正文照常顯示
    message.mes = message.mes.replace(fullMatch, "").replace(/\n{3,}/g, "\n\n").trim();

    // 存進 message.extra，讓重新整理/切換分頁後仍能還原卡片
    if (!message.extra) message.extra = {};
    message.extra.stAlarmCard = { time, label, anchor };

    return { time, label, anchor };
}

// 取標記前最後一行非空白文字，去掉 markdown 符號後留尾端片段，
// 用來在渲染後的 HTML 中定位「設鬧鐘那段劇情」
function buildAnchor(textBeforeMarker) {
    const lines = textBeforeMarker
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    if (!lines.length) return "";
    return lines[lines.length - 1]
        .replace(/[*_~`>#"'「」『』\[\]]/g, "")
        .replace(/\s+/g, "")
        .slice(-20);
}

function isAndroid() {
    return /android/i.test(navigator.userAgent);
}

function buildAlarmUrl(time, label) {
    const [hourStr, minuteStr] = time.split(":");
    if (isAndroid()) {
        // Android：直接呼叫系統時鐘的 SET_ALARM intent，不需要任何額外 App
        return (
            "intent://alarm/#Intent;" +
            "action=android.intent.action.SET_ALARM;" +
            `i.android.intent.extra.alarm.HOUR=${parseInt(hourStr, 10)};` +
            `i.android.intent.extra.alarm.MINUTES=${parseInt(minuteStr, 10)};` +
            `S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(label)};` +
            "end"
        );
    }
    // iOS：透過捷徑中轉
    const settings = getSettings();
    const shortcutName = settings.shortcutName || defaultSettings.shortcutName;
    return `shortcuts://run-shortcut?name=${encodeURIComponent(
        shortcutName
    )}&input=text&text=${encodeURIComponent(`${time}|${label}`)}`;
}

function buildCardElement(time, label) {
    const card = document.createElement("div");
    card.className = "st-alarm-card";
    card.innerHTML = `
        <div class="st-alarm-card-time">${time}</div>
        <div class="st-alarm-card-label">${label}</div>
        <div class="st-alarm-card-hint">${
            isAndroid() ? "點一下設到手機" : "點一下設到 iPhone"
        }</div>
    `;
    card.addEventListener("click", () => {
        location.href = buildAlarmUrl(time, label);
    });
    return card;
}

function renderCardForMessageId(messageId, time, label, anchor) {
    const messageBlock = document.querySelector(
        `#chat .mes[mesid="${messageId}"] .mes_block .mes_text`
    );
    if (!messageBlock) return;
    // 避免重複插入（卡片可能在 .mes_text 內部或後方）
    const mesRoot = messageBlock.closest(".mes") || messageBlock.parentElement;
    if (mesRoot.querySelector(".st-alarm-card")) return;
    const card = buildCardElement(time, label);

    // 依錨點找到「設鬧鐘那段劇情」的段落，把卡片插在它正下方
    if (anchor) {
        const paragraphs = messageBlock.querySelectorAll(
            "p, li, blockquote, pre, h1, h2, h3, h4"
        );
        let target = null;
        for (const el of paragraphs) {
            const text = (el.textContent || "").replace(/\s+/g, "");
            if (text.includes(anchor)) target = el; // 取最後一個符合的段落
        }
        if (target) {
            target.insertAdjacentElement("afterend", card);
            return;
        }
    }
    // 找不到錨點時退回原本的置底
    messageBlock.insertAdjacentElement("afterend", card);
}

function onMessageReceived(messageId) {
    const context = getContext();
    const message = context.chat[messageId];
    const result = extractAlarmFromMessage(message);
    if (result) {
        pendingAlarms.set(messageId, result);
    }
}

function onCharacterMessageRendered(messageId) {
    const pending = pendingAlarms.get(messageId);
    if (pending) {
        renderCardForMessageId(messageId, pending.time, pending.label, pending.anchor);
        pendingAlarms.delete(messageId);
        return;
    }
    // 處理讀取舊聊天記錄時，訊息本身已存有 stAlarmCard 的情況
    const context = getContext();
    const message = context.chat[messageId];
    const saved = message?.extra?.stAlarmCard;
    if (saved) {
        renderCardForMessageId(messageId, saved.time, saved.label, saved.anchor);
    }
}

function rescanChatForCards() {
    const context = getContext();
    if (!context.chat) return;
    context.chat.forEach((message, messageId) => {
        const saved = message?.extra?.stAlarmCard;
        if (saved) {
            renderCardForMessageId(messageId, saved.time, saved.label, saved.anchor);
        }
    });
}

function buildSettingsPanel() {
    const settings = getSettings();
    const panel = document.createElement("div");
    panel.id = "st-alarm-caller-settings";
    panel.classList.add("st-alarm-caller-settings");
    panel.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>ST鬧鐘呼叫 <small>v${VERSION}</small></b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label class="checkbox_label">
                    <input id="st-alarm-caller-enabled" type="checkbox" ${
                        settings.enabled ? "checked" : ""
                    } />
                    啟用鬧鐘功能
                </label>
                <label>
                    iOS 捷徑名稱（僅 iPhone 需要，需與 Shortcuts App 內的捷徑名稱完全一致）
                    <input id="st-alarm-caller-shortcut-name" type="text"
                        class="text_pole" value="${settings.shortcutName}" />
                </label>
                <div class="st-alarm-caller-install">
                    iPhone 使用者：還沒裝捷徑？
                    <a href="${SHORTCUT_INSTALL_URL}" target="_blank" rel="noopener">
                        點這裡安裝「ST鬧鐘呼叫」捷徑
                    </a>
                    <div class="st-alarm-caller-install-note">
                        請在 iPhone 上開啟此連結安裝。第一次執行時 iOS 會詢問權限，按允許即可。<br>
                        Android 使用者不需要安裝任何東西，點卡片會直接呼叫系統時鐘設鬧鐘。
                    </div>
                </div>
            </div>
        </div>
    `;

    const container =
        document.getElementById("extensions_settings2") ||
        document.getElementById("extensions_settings");
    container?.appendChild(panel);

    panel
        .querySelector("#st-alarm-caller-enabled")
        .addEventListener("change", (e) => {
            settings.enabled = e.target.checked;
            saveSettingsDebounced();
            applyExtensionPrompt();
        });

    panel
        .querySelector("#st-alarm-caller-shortcut-name")
        .addEventListener("change", (e) => {
            settings.shortcutName = e.target.value.trim() || defaultSettings.shortcutName;
            saveSettingsDebounced();
        });
}

jQuery(async () => {
    getSettings();
    buildSettingsPanel();
    applyExtensionPrompt();

    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onCharacterMessageRendered);
    eventSource.on(event_types.CHAT_CHANGED, () => {
        // 切換聊天時重新注入，避免規則被其他流程清掉
        applyExtensionPrompt();
        rescanChatForCards();
    });
    // 聊天補全 API 的保險注入（Gemini/OpenAI/Claude 等走這條）
    eventSource.on(
        event_types.CHAT_COMPLETION_PROMPT_READY,
        onChatCompletionPromptReady
    );
});

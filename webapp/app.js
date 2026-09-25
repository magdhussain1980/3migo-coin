/* =========================================================
   3MIGO COIN — APP.JS V5.2
   Premium Wallet + Circular Mining Experience
   Backend-compatible version
   ========================================================= */

"use strict";

/* =========================================================
   TELEGRAM WEB APP
   ========================================================= */

const tg = window.Telegram?.WebApp || null;

if (tg) {
    try {
        tg.ready();
        tg.expand();

        tg.setHeaderColor("#04142a");
        tg.setBackgroundColor("#031024");

        if (typeof tg.enableClosingConfirmation === "function") {
            tg.enableClosingConfirmation();
        }
    } catch (error) {
        console.warn("Telegram WebApp setup:", error);
    }
}


/* =========================================================
   CONFIG
   ========================================================= */

const CONFIG = {
    API_BASE: window.location.origin,

    BOT_USERNAME: "threemigosmart_bot",

    FALLBACK_TELEGRAM_ID: 1,

    MINING_CYCLE_HOURS: 12,

    MINING_CYCLE_SECONDS: 12 * 60 * 60,

    MINING_REWARD: 10,

    TOAST_DURATION: 2600
};


/* =========================================================
   STATE
   ========================================================= */

const state = {

    telegram: {
        id: null,
        username: "",
        firstName: "",
        lastName: "",
        languageCode: ""
    },

    balance: 0,
    totalEarned: 0,
    todayEarned: 0,
    sessions: 0,

    mining: {
        active: false,
        remaining: 0,
        reward: CONFIG.MINING_REWARD,
        timer: null,
        requestPending: false,
        startedAt: null,
        duration: CONFIG.MINING_CYCLE_SECONDS
    },

    tasks: [],

    referral: {
        code: "",
        link: "",
        count: 0,
        earned: 0
    },

    economic: {
        totalMined: 0,
        locked3m: 0,
        unlocked3m: 0,
        airdrop3m: 0,
        contributionScore: 0,
        trustScore: 0
    },

    experience: {
        level: 1,
        name: "Explorer",
        progress: 0,
        score: 0,
        nextScore: 100,
        source: ""
    },

    growth: {
        index: 0,
        change: 0,
        label: "Starting"
    },

    adGalaxy: {
        loaded: false,
        tasks: []
    },

    ai: {
        messages: []
    },

    loading: {
        user: false,
        mining: false,
        tasks: false,
        referral: false,
        economic: false,
        transactions: false
    },

    currentView: "home",

    initialized: false
};


/* =========================================================
   DOM HELPERS
   ========================================================= */

const $ = (selector, root = document) => {
    try {
        return root.querySelector(selector);
    } catch {
        return null;
    }
};

const $$ = (selector, root = document) => {
    try {
        return [...root.querySelectorAll(selector)];
    } catch {
        return [];
    }
};


function exists(selector) {
    return !!$(selector);
}


function safeNumber(value, fallback = 0) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}


function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatNumber(value, decimals = 2) {
    const number = safeNumber(value);

    return number.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}


function formatCompact(value) {
    const number = safeNumber(value);

    if (number >= 1_000_000_000) {
        return `${(number / 1_000_000_000).toFixed(2)}B`;
    }

    if (number >= 1_000_000) {
        return `${(number / 1_000_000).toFixed(2)}M`;
    }

    if (number >= 1_000) {
        return `${(number / 1_000).toFixed(2)}K`;
    }

    return formatNumber(number, 2);
}


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer = null;


function showToast(message, type = "info") {

    const toast = $("#toast");

    if (!toast) {
        console.log(message);
        return;
    }

    toast.textContent = message;

    toast.classList.remove(
        "success",
        "error",
        "warning",
        "info",
        "show"
    );

    toast.classList.add(type);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, CONFIG.TOAST_DURATION);
}


/* =========================================================
   TELEGRAM USER
   ========================================================= */

function getTelegramUser() {

    const user = tg?.initDataUnsafe?.user;

    if (user?.id) {

        state.telegram.id = Number(user.id);

        state.telegram.username = user.username || "";

        state.telegram.firstName = user.first_name || "";

        state.telegram.lastName = user.last_name || "";

        state.telegram.languageCode = user.language_code || "";

        return state.telegram;
    }

    state.telegram.id = CONFIG.FALLBACK_TELEGRAM_ID;

    return state.telegram;
}


function getTelegramId() {

    if (!state.telegram.id) {
        getTelegramUser();
    }

    return Number(
        state.telegram.id || CONFIG.FALLBACK_TELEGRAM_ID
    );
}


/* =========================================================
   API
   ========================================================= */

async function apiRequest(
    endpoint,
    options = {}
) {

    const url = `${CONFIG.API_BASE}${endpoint}`;

    const config = {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    };

    try {

        const response = await fetch(url, config);

        const contentType =
            response.headers.get("content-type") || "";

        let data;

        if (contentType.includes("application/json")) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {

            const message =
                typeof data === "object"
                    ? data.detail ||
                      data.message ||
                      data.error ||
                      `Request failed: ${response.status}`
                    : data || `Request failed: ${response.status}`;

            throw new Error(message);
        }

        return data;

    } catch (error) {

        console.error("API:", endpoint, error);

        throw error;
    }
}


/* =========================================================
   USER
   ========================================================= */

async function registerUser() {

    if (state.loading.user) return;

    state.loading.user = true;

    const telegramId = getTelegramId();

    try {

        const payload = {
            telegram_id: telegramId,
            username: state.telegram.username || "",
            first_name: state.telegram.firstName || "",
            last_name: state.telegram.lastName || ""
        };

        try {

            await apiRequest(
                `/user/${telegramId}`,
                {
                    method: "POST",
                    body: JSON.stringify(payload)
                }
            );

        } catch {

            await apiRequest(
                "/register",
                {
                    method: "POST",
                    body: JSON.stringify(payload)
                }
            );
        }

    } catch (error) {

        console.warn(
            "User registration:",
            error.message
        );

    } finally {

        state.loading.user = false;
    }
}


async function loadUser() {

    const telegramId = getTelegramId();

    try {

        const data = await apiRequest(
            `/user/${telegramId}`
        );

        if (data) {

            state.balance = safeNumber(
                data.balance ??
                data.balance_3m ??
                data.amount
            );

            state.totalEarned = safeNumber(
                data.total_earned ??
                data.totalEarned ??
                data.total_mined
            );

            state.todayEarned = safeNumber(
                data.today_earned ??
                data.todayEarned
            );

            state.sessions = safeNumber(
                data.sessions ??
                data.mining_sessions
            );
        }

    } catch (error) {

        console.warn(
            "Load user:",
            error.message
        );
    }

    updateWalletUI();
    updateProfileUI();
}


/* =========================================================
   WALLET UI
   ========================================================= */

function updateWalletUI() {

    const values = {
        "#balance": state.balance,
        "#walletBalance": state.balance,
        "#walletTotal": state.totalEarned,
        "#walletToday": state.todayEarned
    };

    Object.entries(values).forEach(
        ([selector, value]) => {

            const element = $(selector);

            if (!element) return;

            element.textContent =
                formatNumber(value, 2);
        }
    );

    $$(".balance-value").forEach(element => {

        if (
            element.id !== "walletBalance" &&
            element.id !== "walletTotal" &&
            element.id !== "walletToday"
        ) {
            element.textContent =
                formatNumber(state.balance, 2);
        }
    });
}


/* =========================================================
   PROFILE
   ========================================================= */

function updateProfileUI() {

    const username =
        state.telegram.username
            ? `@${state.telegram.username}`
            : state.telegram.firstName ||
              "3Migo Member";

    const displayName =
        [
            state.telegram.firstName,
            state.telegram.lastName
        ]
            .filter(Boolean)
            .join(" ") ||
        username;

    const usernameElements = [
        "#profileUsername",
        "#username",
        "#userName"
    ];

    usernameElements.forEach(selector => {

        const element = $(selector);

        if (element) {
            element.textContent = displayName;
        }
    });

    const idElements = [
        "#telegramId",
        "#profileTelegramId",
        "#memberTelegramId"
    ];

    idElements.forEach(selector => {

        const element = $(selector);

        if (element) {
            element.textContent = getTelegramId();
        }
    });

    updateExperienceUI();
}


/* =========================================================
   MINING — TIME
   ========================================================= */

function formatTime(totalSeconds) {

    const seconds = Math.max(
        0,
        Math.floor(safeNumber(totalSeconds))
    );

    const hours =
        Math.floor(seconds / 3600);

    const minutes =
        Math.floor((seconds % 3600) / 60);

    const secs =
        seconds % 60;

    return [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(secs).padStart(2, "0")
    ].join(":");
}


function getMiningProgress() {

    if (!state.mining.active) {
        return 0;
    }

    const duration =
        Math.max(
            1,
            safeNumber(
                state.mining.duration,
                CONFIG.MINING_CYCLE_SECONDS
            )
        );

    const remaining =
        Math.max(
            0,
            safeNumber(state.mining.remaining)
        );

    const elapsed =
        Math.max(
            0,
            duration - remaining
        );

    return Math.min(
        100,
        Math.max(
            0,
            (elapsed / duration) * 100
        )
    );
}


/* =========================================================
   MINING — CIRCULAR VISUAL
   ========================================================= */

function updateMiningProgressVisual() {

    const progress =
        getMiningProgress();

    const degrees =
        Math.round(progress * 3.6);

    const remaining =
        formatTime(state.mining.remaining);

    const progressText =
        `${Math.round(progress)}%`;

    const miningButtons = [
        "#mineBtn",
        "#mineBtnPage"
    ];

    miningButtons.forEach(selector => {

        const button = $(selector);

        if (!button) return;

        button.style.setProperty(
            "--mine-progress",
            `${degrees}deg`
        );

        button.style.setProperty(
            "--mining-progress",
            `${progress}%`
        );

        button.setAttribute(
            "data-progress",
            Math.round(progress)
        );

        button.setAttribute(
            "aria-valuenow",
            Math.round(progress)
        );
    });

    const progressElements = [
        "#miningProgress",
        "#mineProgress",
        "#miningPercent"
    ];

    progressElements.forEach(selector => {

        const element = $(selector);

        if (!element) return;

        element.textContent =
            state.mining.active
                ? progressText
                : "0%";
    });

    const timer = $("#miningTimer");

    if (timer) {

        timer.textContent =
            state.mining.active
                ? remaining
                : "12:00:00";
    }

    const remainingElement =
        $("#miningRemaining");

    if (remainingElement) {

        remainingElement.textContent =
            state.mining.active
                ? remaining
                : "--:--:--";
    }

    const progressBars =
        $$(".mining-progress-bar");

    progressBars.forEach(bar => {

        bar.style.width =
            `${progress}%`;
    });
}


/* =========================================================
   MINING — UI STATE
   ========================================================= */

function updateMiningUI() {

    const active =
        !!state.mining.active;

    const remaining =
        safeNumber(state.mining.remaining);

    const buttons = [
        "#mineBtn",
        "#mineBtnPage"
    ];

    buttons.forEach(selector => {

        const button = $(selector);

        if (!button) return;

        button.classList.toggle(
            "active",
            active
        );

        button.classList.toggle(
            "is-mining",
            active
        );

        button.classList.toggle(
            "mining-active",
            active
        );

        button.disabled =
            active ||
            state.mining.requestPending;

        button.setAttribute(
            "aria-pressed",
            active ? "true" : "false"
        );

        if (active) {

            button.setAttribute(
                "aria-label",
                "Mining Active"
            );

        } else {

            button.setAttribute(
                "aria-label",
                "Start Mining"
            );
        }

        const label =
            button.querySelector(
                ".mine-label"
            );

        if (label) {

            label.textContent =
                active
                    ? "MINING ACTIVE"
                    : "START MINING";
        }

        const title =
            button.querySelector(
                ".mine-title"
            );

        if (title) {

            title.textContent =
                active
                    ? "MINING ACTIVE"
                    : "MINE 3M";
        }

        const reward =
            button.querySelector(
                ".mine-reward"
            );

        if (reward) {

            reward.textContent =
                active
                    ? `${Math.round(
                        getMiningProgress()
                    )}%`
                    : `+${CONFIG.MINING_REWARD} 3M`;
        }
    });

    const status =
        $("#miningState");

    if (status) {

        if (active) {

            status.textContent =
                `Mining active • ${formatTime(remaining)} remaining`;

            status.classList.add(
                "active"
            );

        } else {

            status.textContent =
                "Ready to mine";

            status.classList.remove(
                "active"
            );
        }
    }

    updateMiningProgressVisual();
}


/* =========================================================
   MINING — STATUS
   ========================================================= */

async function loadMiningStatus(
    silent = false
) {

    if (state.loading.mining) {
        return;
    }

    state.loading.mining = true;

    const telegramId =
        getTelegramId();

    try {

        const data =
            await apiRequest(
                `/mining/${telegramId}/status`
            );

        const active =
            Boolean(
                data.active ??
                data.mining_active ??
                data.is_mining
            );

        const remaining =
            safeNumber(
                data.remaining ??
                data.remaining_seconds ??
                data.seconds_remaining ??
                0
            );

        state.mining.active =
            active && remaining > 0;

        state.mining.remaining =
            remaining;

        state.mining.reward =
            safeNumber(
                data.reward ??
                data.reward_3m ??
                CONFIG.MINING_REWARD,
                CONFIG.MINING_REWARD
            );

        state.mining.duration =
            safeNumber(
                data.duration ??
                data.duration_seconds ??
                CONFIG.MINING_CYCLE_SECONDS,
                CONFIG.MINING_CYCLE_SECONDS
            );

        if (
            state.mining.active &&
            !state.mining.startedAt
        ) {
            state.mining.startedAt =
                Date.now() -
                (
                    state.mining.duration -
                    state.mining.remaining
                ) * 1000;
        }

        if (
            !state.mining.active
        ) {
            state.mining.startedAt = null;
        }

        updateMiningUI();

        if (state.mining.active) {
            startMiningTicker();
        } else {
            stopMiningTicker();
        }

    } catch (error) {

        if (!silent) {

            showToast(
                "Unable to load mining status",
                "error"
            );
        }

        console.warn(
            "Mining status:",
            error.message
        );

    } finally {

        state.loading.mining = false;
    }
}


/* =========================================================
   MINING — TICKER
   ========================================================= */

function stopMiningTicker() {

    if (state.mining.timer) {

        clearInterval(
            state.mining.timer
        );

        state.mining.timer = null;
    }
}


function startMiningTicker() {

    stopMiningTicker();

    if (!state.mining.active) {
        updateMiningUI();
        return;
    }

    state.mining.timer =
        setInterval(() => {

            if (!state.mining.active) {

                stopMiningTicker();

                return;
            }

            state.mining.remaining =
                Math.max(
                    0,
                    state.mining.remaining - 1
                );

            updateMiningUI();

            if (
                state.mining.remaining <= 0
            ) {

                state.mining.active = false;

                stopMiningTicker();

                updateMiningUI();

                showToast(
                    "Mining cycle completed. Claim your 10 3M.",
                    "success"
                );

                loadMiningStatus(true);
            }

        }, 1000);
}


/* =========================================================
   MINING — START
   ========================================================= */

async function startMining() {

    if (
        state.mining.active ||
        state.mining.requestPending
    ) {
        return;
    }

    state.mining.requestPending = true;

    updateMiningUI();

    const telegramId =
        getTelegramId();

    try {

        const data =
            await apiRequest(
                `/mining/${telegramId}/start`,
                {
                    method: "POST"
                }
            );

        const remaining =
            safeNumber(
                data.remaining ??
                data.remaining_seconds ??
                CONFIG.MINING_CYCLE_SECONDS,
                CONFIG.MINING_CYCLE_SECONDS
            );

        state.mining.active = true;

        state.mining.remaining =
            remaining;

        state.mining.duration =
            safeNumber(
                data.duration ??
                data.duration_seconds ??
                CONFIG.MINING_CYCLE_SECONDS,
                CONFIG.MINING_CYCLE_SECONDS
            );

        state.mining.reward =
            safeNumber(
                data.reward ??
                data.reward_3m ??
                CONFIG.MINING_REWARD,
                CONFIG.MINING_REWARD
            );

        state.mining.startedAt =
            Date.now();

        showToast(
            `Mining started • +${state.mining.reward} 3M`,
            "success"
        );

        updateMiningUI();

        startMiningTicker();

    } catch (error) {

        showToast(
            error.message ||
            "Unable to start mining",
            "error"
        );

        await loadMiningStatus(true);

    } finally {

        state.mining.requestPending =
            false;

        updateMiningUI();
    }
}


/* =========================================================
   MINING — CLAIM
   ========================================================= */

async function claimMining() {

    const telegramId =
        getTelegramId();

    try {

        const data =
            await apiRequest(
                `/mining/${telegramId}/claim`,
                {
                    method: "POST"
                }
            );

        const reward =
            safeNumber(
                data.reward ??
                data.reward_3m ??
                CONFIG.MINING_REWARD
            );

        state.balance =
            safeNumber(
                data.balance ??
                data.balance_3m ??
                state.balance + reward
            );

        state.totalEarned += reward;

        state.mining.active = false;

        state.mining.remaining = 0;

        state.mining.startedAt = null;

        stopMiningTicker();

        updateWalletUI();

        updateMiningUI();

        showToast(
            `Claimed +${formatNumber(reward, 2)} 3M`,
            "success"
        );

        await loadEconomic(true);

    } catch (error) {

        showToast(
            error.message ||
            "Unable to claim mining reward",
            "error"
        );

        await loadMiningStatus(true);
    }
}


/* =========================================================
   MINING BUTTONS
   ========================================================= */

function setupMiningButton() {

    const mainButton =
        $("#mineBtn");

    const pageButton =
        $("#mineBtnPage");

    if (mainButton) {

        mainButton.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                if (
                    state.mining.active ||
                    state.mining.requestPending
                ) {
                    return;
                }

                await startMining();
            }
        );
    }

    if (pageButton) {

        pageButton.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                if (
                    state.mining.active ||
                    state.mining.requestPending
                ) {
                    return;
                }

                await startMining();
            }
        );
    }
}


/* =========================================================
   TASKS
   ========================================================= */

async function loadTasks(
    silent = false
) {

    if (state.loading.tasks) {
        return;
    }

    state.loading.tasks = true;

    const telegramId =
        getTelegramId();

    try {

        const data =
            await apiRequest(
                `/tasks/${telegramId}`
            );

        state.tasks =
            Array.isArray(data)
                ? data
                : data.tasks || [];

        renderTasks();

    } catch (error) {

        if (!silent) {

            showToast(
                "Unable to load tasks",
                "error"
            );
        }

        console.warn(
            "Tasks:",
            error.message
        );

    } finally {

        state.loading.tasks = false;
    }
}


function renderTasks() {

    const container =
        $("#tasksContainer");

    if (!container) return;

    if (!state.tasks.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <h3>No tasks available</h3>
                <p>New opportunities will appear here.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        state.tasks.map(task => {

            const completed =
                Number(task.completed || 0) === 1 ||
                task.completed === true;

            return `
                <article
                    class="task-card ${
                        completed
                            ? "completed"
                            : ""
                    }"
                >

                    <div class="task-content">

                        <h3>
                            ${escapeHtml(
                                task.title ||
                                "3Migo Task"
                            )}
                        </h3>

                        <p>
                            ${escapeHtml(
                                task.description ||
                                ""
                            )}
                        </p>

                    </div>

                    <div class="task-action">

                        <strong>
                            +${formatNumber(
                                task.reward_3m || 0,
                                2
                            )} 3M
                        </strong>

                        ${
                            completed
                                ? `
                                    <button
                                        class="btn secondary"
                                        disabled
                                    >
                                        ✓ Completed
                                    </button>
                                `
                                : `
                                    <button
                                        class="btn primary"
                                        data-task-id="${
                                            task.id
                                        }"
                                    >
                                        Complete
                                    </button>
                                `
                        }

                    </div>

                </article>
            `;

        }).join("");
}


async function completeTask(taskId) {

    try {

        const telegramId =
            getTelegramId();

        const data =
            await apiRequest(
                `/tasks/${telegramId}/complete/${taskId}`,
                {
                    method: "POST"
                }
            );

        const reward =
            safeNumber(
                data.reward ??
                data.reward_3m ??
                0
            );

        if (reward > 0) {

            state.balance += reward;

            state.totalEarned += reward;

            updateWalletUI();
        }

        showToast(
            reward > 0
                ? `Task completed • +${formatNumber(reward, 2)} 3M`
                : "Task completed",
            "success"
        );

        await loadTasks(true);

    } catch (error) {

        showToast(
            error.message ||
            "Unable to complete task",
            "error"
        );
    }
}


/* =========================================================
   DAILY REWARD
   ========================================================= */

async function claimDaily() {

    const telegramId =
        getTelegramId();

    try {

        const data =
            await apiRequest(
                `/daily/${telegramId}`,
                {
                    method: "POST"
                }
            );

        const reward =
            safeNumber(
                data.reward ??
                data.reward_3m ??
                0
            );

        if (reward > 0) {

            state.balance += reward;

            state.todayEarned += reward;

            state.totalEarned += reward;

            updateWalletUI();
        }

        showToast(
            reward > 0
                ? `Daily reward • +${formatNumber(reward, 2)} 3M`
                : "Daily reward processed",
            "success"
        );

    } catch (error) {

        showToast(
            error.message ||
            "Daily reward unavailable",
            "error"
        );
    }
}


/* =========================================================
   REFERRAL
   ========================================================= */

async function loadReferral(
    silent = false
) {

    if (state.loading.referral) {
        return;
    }

    state.loading.referral = true;

    const telegramId =
        getTelegramId();

    try {

        const data =
            await apiRequest(
                `/referral/${telegramId}`
            );

        state.referral.code =
            data.code ||
            data.referral_code ||
            `3M${telegramId}`;

        state.referral.link =
            data.link ||
            data.referral_link ||
            `https://t.me/${CONFIG.BOT_USERNAME}?start=ref_${state.referral.code}`;

        state.referral.count =
            safeNumber(
                data.count ??
                data.referrals ??
                data.referral_count
            );

        state.referral.earned =
            safeNumber(
                data.earned ??
                data.earned_3m ??
                data.referral_earned
            );

    } catch (error) {

        state.referral.code =
            state.referral.code ||
            `3M${telegramId}`;

        state.referral.link =
            state.referral.link ||
            `https://t.me/${CONFIG.BOT_USERNAME}?start=ref_${state.referral.code}`;

        if (!silent) {

            console.warn(
                "Referral:",
                error.message
            );
        }

    } finally {

        state.loading.referral = false;

        updateReferralUI();
    }
}


/* =========================================================
   VISUAL BARCODE
   ========================================================= */

function generateBarcode(
    value
) {

    const text =
        String(value || "3MIGO");

    let seed = 0;

    for (let i = 0; i < text.length; i++) {

        seed =
            (
                seed * 31 +
                text.charCodeAt(i)
            ) >>> 0;
    }

    let bars = "";

    for (let i = 0; i < 64; i++) {

        seed =
            (
                seed * 1664525 +
                1013904223
            ) >>> 0;

        const width =
            1 + (seed % 4);

        bars +=
            `<i style="width:${width}px"></i>`;
    }

    return bars;
}


function updateReferralUI() {

    const code =
        state.referral.code;

    const link =
        state.referral.link;

    const codeElements = [
        "#referralCode",
        "#profileReferralCode"
    ];

    codeElements.forEach(selector => {

        const element = $(selector);

        if (element) {
            element.textContent = code;
        }
    });

    const linkElement =
        $("#referralLink");

    if (linkElement) {

        linkElement.textContent =
            link;
    }

    const barcode =
        $("#referralBarcode");

    if (barcode) {

        barcode.innerHTML =
            generateBarcode(code);

        barcode.setAttribute(
            "data-code",
            code
        );
    }

    const count =
        $("#referralCount");

    if (count) {

        count.textContent =
            formatNumber(
                state.referral.count,
                0
            );
    }

    const earned =
        $("#referralEarned");

    if (earned) {

        earned.textContent =
            formatNumber(
                state.referral.earned,
                2
            );
    }
}


/* =========================================================
   COPY REFERRAL
   ========================================================= */

async function copyReferralLink() {

    const link =
        state.referral.link;

    if (!link) {

        showToast(
            "Referral link unavailable",
            "error"
        );

        return;
    }

    try {

        await navigator.clipboard.writeText(link);

        showToast(
            "Referral link copied",
            "success"
        );

    } catch {

        const textarea =
            document.createElement("textarea");

        textarea.value = link;

        document.body.appendChild(
            textarea
        );

        textarea.select();

        document.execCommand("copy");

        textarea.remove();

        showToast(
            "Referral link copied",
            "success"
        );
    }
}


/* =========================================================
   SHARE REFERRAL
   ========================================================= */

function shareReferral() {

    const link =
        state.referral.link;

    const text =
        "Join 3Migo Coin and explore the 3Migo ecosystem.";

    const shareUrl =
        `https://t.me/share/url?url=${encodeURIComponent(
            link
        )}&text=${encodeURIComponent(
            text
        )}`;

    if (tg?.openTelegramLink) {

        try {

            tg.openTelegramLink(
                shareUrl
            );

            return;

        } catch {}
    }

    window.open(
        shareUrl,
        "_blank"
    );
}


/* =========================================================
   ECONOMIC DATA
   ========================================================= */

async function loadEconomic(
    silent = false
) {

    if (state.loading.economic) {
        return;
    }

    state.loading.economic = true;

    const telegramId =
        getTelegramId();

    try {

        const data =
            await apiRequest(
                `/economic/user/${telegramId}`
            );

        state.economic.totalMined =
            safeNumber(
                data.total_mined ??
                data.totalMined
            );

        state.economic.locked3m =
            safeNumber(
                data.locked_3m ??
                data.locked3m
            );

        state.economic.unlocked3m =
            safeNumber(
                data.unlocked_3m ??
                data.unlocked3m
            );

        state.economic.airdrop3m =
            safeNumber(
                data.airdrop_3m ??
                data.airdrop3m
            );

        state.economic.contributionScore =
            safeNumber(
                data.contribution_score ??
                data.contributionScore
            );

        state.economic.trustScore =
            safeNumber(
                data.trust_score ??
                data.trustScore
            );

        calculateGrowthIndex();

        calculateExperience();

        updateEconomicUI();

    } catch (error) {

        if (!silent) {

            console.warn(
                "Economic:",
                error.message
            );
        }

    } finally {

        state.loading.economic = false;
    }
}


/* =========================================================
   GROWTH INDEX
   ========================================================= */

function calculateGrowthIndex() {

    const sessions =
        safeNumber(
            state.sessions
        );

    const contribution =
        safeNumber(
            state.economic.contributionScore
        );

    const trust =
        safeNumber(
            state.economic.trustScore
        );

    const activityScore =
        Math.min(
            40,
            sessions * 2
        );

    const contributionScore =
        Math.min(
            35,
            contribution
        );

    const trustScore =
        Math.min(
            25,
            trust
        );

    const index =
        Math.round(
            activityScore +
            contributionScore +
            trustScore
        );

    state.growth.index =
        Math.min(
            100,
            Math.max(
                0,
                index
            )
        );

    state.growth.change =
        Math.min(
            99,
            Math.round(
                (
                    activityScore +
                    contributionScore
                ) / 2
            )
        );

    if (state.growth.index >= 80) {

        state.growth.label =
            "High Activity";

    } else if (state.growth.index >= 55) {

        state.growth.label =
            "Growing";

    } else if (state.growth.index >= 30) {

        state.growth.label =
            "Developing";

    } else {

        state.growth.label =
            "Starting";
    }
}


/* =========================================================
   GROWTH UI
   ========================================================= */

function updateGrowthUI() {

    const value =
        state.growth.index;

    const gauge =
        $(".growth-gauge");

    if (gauge) {

        gauge.style.setProperty(
            "--growth-progress",
            `${value * 3.6}deg`
        );
    }

    const valueElement =
        $("#growthIndexValue");

    if (valueElement) {

        valueElement.textContent =
            value;
    }

    const change =
        $("#growthChange");

    if (change) {

        change.textContent =
            `+${state.growth.change}%`;
    }

    const label =
        $("#growthLabel");

    if (label) {

        label.textContent =
            state.growth.label;
    }

    const indexElements =
        $$(".growth-index-value");

    indexElements.forEach(element => {

        element.textContent =
            value;
    });
}


/* =========================================================
   ECONOMIC UI
   ========================================================= */

function updateEconomicUI() {

    const map = {

        "#totalMined":
            state.economic.totalMined,

        "#locked3m":
            state.economic.locked3m,

        "#unlocked3m":
            state.economic.unlocked3m,

        "#airdrop3m":
            state.economic.airdrop3m,

        "#contributionScore":
            state.economic.contributionScore,

        "#trustScore":
            state.economic.trustScore
    };

    Object.entries(map).forEach(
        ([selector, value]) => {

            const element =
                $(selector);

            if (!element) return;

            element.textContent =
                formatNumber(
                    value,
                    2
                );
        }
    );

    updateGrowthUI();
}


/* =========================================================
   EXPERIENCE
   ========================================================= */

function calculateExperience() {

    const score =
        Math.max(
            0,
            Math.round(
                state.sessions * 10 +
                state.economic.contributionScore +
                state.economic.trustScore
            )
        );

    const level =
        Math.max(
            1,
            Math.floor(score / 100) + 1
        );

    const currentBase =
        (level - 1) * 100;

    const nextScore =
        level * 100;

    const progress =
        Math.min(
            100,
            Math.max(
                0,
                (
                    (score - currentBase) /
                    (nextScore - currentBase)
                ) * 100
            )
        );

    let name = "Explorer";

    if (level >= 10) {
        name = "Legend";
    } else if (level >= 7) {
        name = "Master";
    } else if (level >= 5) {
        name = "Builder";
    } else if (level >= 3) {
        name = "Contributor";
    }

    state.experience = {
        level,
        name,
        progress,
        score,
        nextScore,
        source: "3Migo Activity"
    };
}


function updateExperienceUI() {

    const level =
        state.experience.level;

    const name =
        state.experience.name;

    const progress =
        state.experience.progress;

    const score =
        state.experience.score;

    const levelElements = [
        "#experienceLevel",
        "#profileLevel",
        "#levelNumber"
    ];

    levelElements.forEach(selector => {

        const element = $(selector);

        if (element) {
            element.textContent = level;
        }
    });

    const nameElements = [
        "#experienceName",
        "#profileExperienceName"
    ];

    nameElements.forEach(selector => {

        const element = $(selector);

        if (element) {
            element.textContent = name;
        }
    });

    const scoreElement =
        $("#experienceScore");

    if (scoreElement) {

        scoreElement.textContent =
            formatNumber(score, 0);
    }

    $$(".experience-progress").forEach(
        element => {

            element.style.width =
                `${progress}%`;
        }
    );

    $$(".experience-card").forEach(
        element => {

            element.style.setProperty(
                "--experience-progress",
                `${progress}%`
            );
        }
    );
}


/* =========================================================
   TRANSACTIONS
   ========================================================= */

async function loadTransactions(
    silent = false
) {

    if (state.loading.transactions) {
        return;
    }

    state.loading.transactions = true;

    const telegramId =
        getTelegramId();

    try {

        const data =
            await apiRequest(
                `/transactions/${telegramId}`
            );

        const transactions =
            Array.isArray(data)
                ? data
                : data.transactions || [];

        renderTransactions(
            transactions
        );

    } catch (error) {

        if (!silent) {

            console.warn(
                "Transactions:",
                error.message
            );
        }

    } finally {

        state.loading.transactions = false;
    }
}


function renderTransactions(
    transactions
) {

    const container =
        $("#transactionsList");

    if (!container) return;

    if (!transactions.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💳</div>
                <h3>No transactions yet</h3>
                <p>Your 3M activity will appear here.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        transactions.map(item => {

            const amount =
                safeNumber(
                    item.amount ??
                    item.amount_3m ??
                    item.reward
                );

            const positive =
                amount >= 0;

            return `
                <div class="transaction-item">

                    <div class="transaction-info">

                        <strong>
                            ${escapeHtml(
                                item.title ||
                                item.type ||
                                "3M Transaction"
                            )}
                        </strong>

                        <small>
                            ${escapeHtml(
                                item.created_at ||
                                item.date ||
                                ""
                            )}
                        </small>

                    </div>

                    <div
                        class="transaction-amount ${
                            positive
                                ? "positive"
                                : "negative"
                        }"
                    >
                        ${
                            positive
                                ? "+"
                                : ""
                        }${formatNumber(
                            amount,
                            2
                        )} 3M
                    </div>

                </div>
            `;

        }).join("");
}


/* =========================================================
   VIEW NAVIGATION
   ========================================================= */

function setActiveNav(
    viewName
) {

    $$("[data-view-target]").forEach(
        button => {

            const target =
                button.getAttribute(
                    "data-view-target"
                );

            const active =
                target === viewName;

            button.classList.toggle(
                "active",
                active
            );

            button.setAttribute(
                "aria-current",
                active
                    ? "page"
                    : "false"
            );
        }
    );
}


function activateView(
    viewName
) {

    const views =
        $$(".app-view");

    if (!views.length) {
        return;
    }

    views.forEach(view => {

        const target =
            view.getAttribute(
                "data-view"
            );

        const active =
            target === viewName;

        view.classList.toggle(
            "active",
            active
        );

        view.hidden =
            !active;

        view.setAttribute(
            "aria-hidden",
            active
                ? "false"
                : "true"
        );
    });

    state.currentView =
        viewName;

    setActiveNav(
        viewName
    );

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* =========================================================
   VIEW LOADERS
   ========================================================= */

async function showHome() {

    activateView("home");

    updateWalletUI();

    updateMiningUI();

    updateGrowthUI();
}


async function showMining() {

    activateView("mine");

    await loadMiningStatus(true);
}


async function showTasks() {

    activateView("tasks");

    await loadTasks(true);
}


async function showWallet() {

    activateView("wallet");

    updateWalletUI();

    updateEconomicUI();

    await loadTransactions(true);
}


async function showProfile() {

    activateView("profile");

    updateProfileUI();

    updateReferralUI();

    updateExperienceUI();

    await loadReferral(true);
}


async function switchView(
    viewName
) {

    switch (viewName) {

        case "home":
            await showHome();
            break;

        case "mine":
        case "mining":
            await showMining();
            break;

        case "tasks":
            await showTasks();
            break;

        case "wallet":
            await showWallet();
            break;

        case "profile":
            await showProfile();
            break;

        default:
            await showHome();
    }
}


/* =========================================================
   ACTION HANDLER
   ========================================================= */

async function handleAction(
    action,
    element
) {

    switch (action) {

        case "mine":
        case "start-mining":
            await startMining();
            break;

        case "claim-mining":
            await claimMining();
            break;

        case "daily":
        case "daily-reward":
            await claimDaily();
            break;

        case "copy-referral":
            await copyReferralLink();
            break;

        case "share-referral":
            shareReferral();
            break;

        case "wallet":
            await showWallet();
            break;

        case "profile":
            await showProfile();
            break;

        case "tasks":
            await showTasks();
            break;

        case "mining":
            await showMining();
            break;

        case "home":
            await showHome();
            break;

        case "refresh-economic":
            await loadEconomic();
            break;

        case "refresh-tasks":
            await loadTasks();
            break;

        case "refresh-referral":
            await loadReferral();
            break;

        case "close-modal":
            closeModal(
                element?.closest(".modal")
            );
            break;

        default:
            break;
    }
}


/* =========================================================
   MODALS
   ========================================================= */

function openModal(
    modal
) {

    if (!modal) return;

    modal.classList.add(
        "open",
        "active",
        "show"
    );

    modal.removeAttribute(
        "aria-hidden"
    );

    document.body.classList.add(
        "modal-open"
    );
}


function closeModal(
    modal
) {

    if (!modal) return;

    modal.classList.remove(
        "open",
        "active",
        "show"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    if (
        !$(".modal.open") &&
        !$(".modal.active")
    ) {
        document.body.classList.remove(
            "modal-open"
        );
    }
}


function setupModals() {

    $$(".modal").forEach(modal => {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal
                ) {
                    closeModal(modal);
                }
            }
        );
    });

    $$("[data-modal]").forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const selector =
                    button.getAttribute(
                        "data-modal"
                    );

                const modal =
                    $(selector);

                openModal(modal);
            }
        );
    });
}


/* =========================================================
   TASK EVENTS
   ========================================================= */

function setupTaskEvents() {

    document.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "[data-task-id]"
                );

            if (!button) return;

            const taskId =
                button.getAttribute(
                    "data-task-id"
                );

            if (!taskId) return;

            button.disabled = true;

            try {

                await completeTask(
                    taskId
                );

            } finally {

                button.disabled = false;
            }
        }
    );
}


/* =========================================================
   GLOBAL ACTIONS
   ========================================================= */

function setupActions() {

    document.addEventListener(
        "click",
        async event => {

            const viewButton =
                event.target.closest(
                    "[data-view-target]"
                );

            if (viewButton) {

                event.preventDefault();

                const view =
                    viewButton.getAttribute(
                        "data-view-target"
                    );

                await switchView(view);

                return;
            }

            const actionButton =
                event.target.closest(
                    "[data-action]"
                );

            if (!actionButton) {
                return;
            }

            event.preventDefault();

            const action =
                actionButton.getAttribute(
                    "data-action"
                );

            await handleAction(
                action,
                actionButton
            );
        }
    );
}


/* =========================================================
   AI ASSISTANT
   ========================================================= */

function aiAnswer(question) {

    const text =
        String(question || "")
            .toLowerCase();

    if (
        text.includes("mine") ||
        text.includes("mining") ||
        text.includes("تعدين")
    ) {

        return "Mining runs on a 12-hour cycle. Start the cycle, follow the circular progress indicator, then claim the available reward when the cycle completes.";
    }

    if (
        text.includes("reward") ||
        text.includes("مكاف") ||
        text.includes("ربح")
    ) {

        return "3M rewards can come from mining, tasks, daily rewards and the referral system, according to the current 3Migo ecosystem rules.";
    }

    if (
        text.includes("referral") ||
        text.includes("إحال") ||
        text.includes("دعوة")
    ) {

        return "Your referral card contains your referral code and sharing link. Copy the link or use the share button to invite others.";
    }

    if (
        text.includes("wallet") ||
        text.includes("محفظ")
    ) {

        return "Your wallet shows your current 3M balance, total activity and available ecosystem information.";
    }

    if (
        text.includes("growth") ||
        text.includes("نمو")
    ) {

        return "The 3Migo Growth Index is an internal ecosystem activity indicator based on activity, contribution and trust metrics. It is not a market price.";
    }

    return "I can help you understand mining, rewards, referrals, wallet activity and the 3Migo ecosystem.";
}


function setupAI() {

    const input =
        $("#aiInput");

    const send =
        $("#aiSend");

    const container =
        $("#aiMessages");

    if (!input || !send || !container) {
        return;
    }

    const sendMessage = () => {

        const question =
            input.value.trim();

        if (!question) return;

        const userMessage =
            document.createElement(
                "div"
            );

        userMessage.className =
            "ai-message user";

        userMessage.textContent =
            question;

        container.appendChild(
            userMessage
        );

        const answer =
            document.createElement(
                "div"
            );

        answer.className =
            "ai-message assistant";

        answer.textContent =
            aiAnswer(question);

        container.appendChild(
            answer
        );

        input.value = "";

        container.scrollTop =
            container.scrollHeight;
    };

    send.addEventListener(
        "click",
        sendMessage
    );

    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                sendMessage();
            }
        }
    );

    $$(".ai-question").forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    input.value =
                        button.textContent
                            .trim();

                    sendMessage();
                }
            );
        }
    );
}


/* =========================================================
   ECONOMIC ACTIONS
   ========================================================= */

async function previewAirdrop() {

    const telegramId =
        getTelegramId();

    try {

        const data =
            await apiRequest(
                `/economic/airdrop/${telegramId}`
            );

        const amount =
            safeNumber(
                data.amount ??
                data.airdrop_3m ??
                0
            );

        const target =
            $("#airdropPreview");

        if (target) {

            target.textContent =
                `${formatNumber(amount, 2)} 3M`;
        }

        showToast(
            "Airdrop preview updated",
            "success"
        );

    } catch (error) {

        showToast(
            error.message ||
            "Unable to preview airdrop",
            "error"
        );
    }
}


async function spendEconomic() {

    const telegramId =
        getTelegramId();

    const amountElement =
        $("#spendAmount");

    const amount =
        safeNumber(
            amountElement?.value
        );

    if (amount <= 0) {

        showToast(
            "Enter a valid amount",
            "warning"
        );

        return;
    }

    try {

        await apiRequest(
            `/economic/spend/${telegramId}`,
            {
                method: "POST",
                body: JSON.stringify({
                    amount
                })
            }
        );

        showToast(
            "3M spend recorded",
            "success"
        );

        await loadEconomic(true);
        await loadUser();

    } catch (error) {

        showToast(
            error.message ||
            "Unable to process spend",
            "error"
        );
    }
}


/* =========================================================
   AD GALAXY
   ========================================================= */

async function refreshAdGalaxy() {

    await loadTasks(true);

    state.adGalaxy.tasks =
        state.tasks;

    state.adGalaxy.loaded =
        true;

    showToast(
        "Ad Galaxy refreshed",
        "success"
    );
}


/* =========================================================
   DYNAMIC V4 HUB
   ========================================================= */

function setupV4Hub() {

    const hub =
        $("#v4Hub");

    if (!hub) return;

    hub.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-v4-action]"
                );

            if (!button) return;

            const action =
                button.getAttribute(
                    "data-v4-action"
                );

            if (
                action === "wallet"
            ) {
                showWallet();
            }

            if (
                action === "mining"
            ) {
                showMining();
            }

            if (
                action === "tasks"
            ) {
                showTasks();
            }
        }
    );
}


/* =========================================================
   KEYBOARD / ESCAPE
   ========================================================= */

function setupKeyboard() {

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                const modal =
                    $(".modal.open") ||
                    $(".modal.active");

                if (modal) {
                    closeModal(modal);
                }
            }
        }
    );
}


/* =========================================================
   VISIBILITY SYNC
   ========================================================= */

function setupVisibilitySync() {

    document.addEventListener(
        "visibilitychange",
        async () => {

            if (
                document.visibilityState ===
                "visible"
            ) {

                await loadMiningStatus(
                    true
                );
            }
        }
    );
}


/* =========================================================
   INIT
   ========================================================= */

async function init() {

    if (state.initialized) {
        return;
    }

    state.initialized = true;

    getTelegramUser();

    setupMiningButton();

    setupActions();

    setupTaskEvents();

    setupModals();

    setupAI();

    setupV4Hub();

    setupKeyboard();

    setupVisibilitySync();

    updateWalletUI();

    updateProfileUI();

    updateMiningUI();

    activateView("home");

    /*
       Register first.
       Then load current user data.
    */

    await registerUser();

    await Promise.allSettled([
        loadUser(),
        loadMiningStatus(true),
        loadReferral(true),
        loadEconomic(true)
    ]);

    /*
       Final UI synchronization
    */

    updateWalletUI();

    updateProfileUI();

    updateMiningUI();

    updateReferralUI();

    updateEconomicUI();

    updateExperienceUI();

    console.log(
        "3Migo Coin App V5.2 initialized",
        {
            telegramId: getTelegramId(),
            view: state.currentView
        }
    );
}


/* =========================================================
   PUBLIC API
   ========================================================= */

window.ThreeMigo = {

    state,

    startMining,

    claimMining,

    loadMiningStatus,

    loadTasks,

    loadReferral,

    loadEconomic,

    loadUser,

    showHome,

    showMining,

    showTasks,

    showWallet,

    showProfile,

    switchView,

    copyReferralLink,

    shareReferral,

    claimDaily,

    refreshAdGalaxy,

    previewAirdrop,

    spendEconomic
};


/* =========================================================
   START APPLICATION
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        init,
        {
            once: true
        }
    );

} else {

    init();
}
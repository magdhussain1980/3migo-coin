"use strict";

/*
=========================================================
  3MIGO COIN — APP.JS V5.1
  Frontend Controller
=========================================================

  V5.1 FEATURES
  - Real screen navigation
  - Telegram Mini App integration
  - Mining 12-hour progress
  - Circular mining progress
  - Wallet synchronization
  - Tasks
  - Referral
  - Growth Index
  - Economic Engine
  - AI Assistant
  - Ad Galaxy
  - Profile
  - Toast notifications

  Backend/API contracts remain unchanged.
=========================================================
*/


/* ========================================================
   TELEGRAM
======================================================== */

const tg = window.Telegram?.WebApp || null;

if (tg) {
    try {
        tg.ready();
        tg.expand();

        try {
            tg.setHeaderColor("#04142a");
            tg.setBackgroundColor("#031024");
        } catch (error) {
            console.log("Telegram UI settings unavailable", error);
        }

        try {
            tg.enableClosingConfirmation();
        } catch (error) {
            console.log("Closing confirmation unavailable", error);
        }

    } catch (error) {
        console.error("Telegram initialization error:", error);
    }
}


/* ========================================================
   CONFIGURATION
======================================================== */

const API_BASE = window.location.origin;

const BOT_USERNAME = "threemigosmart_bot";

const FALLBACK_TELEGRAM_ID = 1;

const MINING_CYCLE_HOURS = 12;

const MINING_CYCLE_SECONDS =
    MINING_CYCLE_HOURS * 60 * 60;


/* ========================================================
   GLOBAL STATE
======================================================== */

const state = {

    telegramUser: null,

    telegramId: null,

    username: "",

    /* Wallet */
    balance: 0,
    total: 0,
    today: 0,
    sessions: 0,

    /* Mining */
    miningActive: false,
    miningRemaining: 0,
    miningReward: 10,
    miningTimer: null,

    /* Tasks */
    tasks: [],
    loadingTasks: false,

    /* Referral */
    referral: {
        code: "",
        link: "",
        count: 0,
        earned: 0
    },

    /* Economic */
    economic: {
        totalMined: 0,
        locked3m: 0,
        unlocked3m: 0,
        airdrop3m: 0,
        contributionScore: 0,
        trustScore: 0,
        loaded: false,
        loading: false
    },

    /* Experience */
    experience: {
        level: 1,
        levelName: "Explorer",
        progress: 0,
        score: 0,
        nextScore: 100,
        source: "local"
    },

    /* Ad Galaxy */
    adGalaxy: {
        available: 0,
        completed: 0,
        verified: 0,
        loading: false,
        connected: false,
        providerConnected: false
    },

    /* AI */
    aiMessages: [],

    /* Economic loading */
    loadingEconomic: false,

    loadingUser: false,

    /* Current screen */
    currentView: "home"

};


/* ========================================================
   DOM HELPERS
======================================================== */

function $(selector, root = document) {
    return root.querySelector(selector);
}


function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
}


/* ========================================================
   SAFE HELPERS
======================================================== */

function safeNumber(value, fallback = 0) {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}


function clamp(value, min, max) {

    return Math.min(
        Math.max(value, min),
        max
    );

}


function formatNumber(value, decimals = 2) {

    const number = safeNumber(value);

    return number.toLocaleString(
        "en-US",
        {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }
    );

}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* ========================================================
   TOAST
======================================================== */

let toastTimer = null;


function showToast(message, type = "info") {

    const toast = $("#toast");

    if (!toast) return;

    toast.textContent = message;

    toast.classList.remove(
        "show",
        "success",
        "error",
        "warning",
        "info"
    );

    toast.classList.add(type);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 3200);

}


/* ========================================================
   TELEGRAM USER
======================================================== */

function getTelegramUser() {

    const user =
        tg?.initDataUnsafe?.user ||
        null;

    if (user) {

        state.telegramUser = user;

        state.telegramId =
            user.id ||
            FALLBACK_TELEGRAM_ID;

        state.username =
            user.username ||
            (
                `${user.first_name || ""} ` +
                `${user.last_name || ""}`
            ).trim() ||
            "3Migo Member";

    } else {

        state.telegramId =
            FALLBACK_TELEGRAM_ID;

        state.username =
            "3Migo Member";

    }

    return state.telegramUser;

}


/* ========================================================
   API REQUEST
======================================================== */

async function apiRequest(endpoint, options = {}) {

    const url =
        endpoint.startsWith("http")
            ? endpoint
            : `${API_BASE}${endpoint}`;

    const config = {
        method: options.method || "GET",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    };

    if (options.body !== undefined) {

        config.body =
            typeof options.body === "string"
                ? options.body
                : JSON.stringify(options.body);

    }

    try {

        const response =
            await fetch(url, config);

        const text =
            await response.text();

        let data = null;

        try {
            data = text
                ? JSON.parse(text)
                : null;
        } catch {
            data = text;
        }

        if (!response.ok) {

            let message =
                data?.detail ||
                data?.message ||
                data?.error ||
                `HTTP ${response.status}`;

            throw new Error(message);

        }

        return data;

    } catch (error) {

        console.error(
            "API Error:",
            endpoint,
            error
        );

        throw error;

    }

}


/* ========================================================
   USER REGISTRATION / LOAD
======================================================== */

async function registerUser() {

    const telegramId =
        state.telegramId ||
        FALLBACK_TELEGRAM_ID;

    try {

        const user =
            await apiRequest(
                `/user/${telegramId}`
            );

        return user;

    } catch (firstError) {

        try {

            return await apiRequest(
                "/register",
                {
                    method: "POST",
                    body: {
                        telegram_id: telegramId,
                        username: state.username
                    }
                }
            );

        } catch (secondError) {

            console.warn(
                "User registration fallback failed",
                secondError
            );

            return null;

        }

    }

}


/* ========================================================
   LOAD USER
======================================================== */

async function loadUser() {

    if (state.loadingUser) {
        return;
    }

    state.loadingUser = true;

    try {

        const data =
            await apiRequest(
                `/user/${state.telegramId}`
            );

        const user =
            data?.user ||
            data ||
            {};

        state.balance =
            safeNumber(
                user.balance ??
                user.balance_3m ??
                data?.balance
            );

        state.total =
            safeNumber(
                user.total ??
                user.total_earned ??
                data?.total
            );

        state.today =
            safeNumber(
                user.today ??
                user.today_earned ??
                data?.today
            );

        state.sessions =
            safeNumber(
                user.sessions ??
                user.mining_sessions ??
                data?.sessions
            );

        updateWalletUI();

        updateProfileUI();

        updateMiningPageUI();

        updateExperience();

    } catch (error) {

        console.warn(
            "Could not load user:",
            error
        );

    } finally {

        state.loadingUser = false;

    }

}


/* ========================================================
   WALLET UI
======================================================== */

function updateWalletUI() {

    const balance =
        formatNumber(state.balance);

    const total =
        formatNumber(state.total);

    const today =
        formatNumber(state.today);

    const sessions =
        formatNumber(state.sessions, 0);


    /* Main card */

    const balanceEl =
        $("#balance");

    if (balanceEl) {
        balanceEl.textContent = balance;
    }


    const totalEl =
        $("#total");

    if (totalEl) {
        totalEl.textContent = total;
    }


    const todayEl =
        $("#today");

    if (todayEl) {
        todayEl.textContent = today;
    }


    const sessionsEl =
        $("#sessions");

    if (sessionsEl) {
        sessionsEl.textContent = sessions;
    }


    /* Wallet screen */

    const walletBalance =
        $("#walletBalance");

    if (walletBalance) {
        walletBalance.textContent = balance;
    }


    const walletTotal =
        $("#walletTotal");

    if (walletTotal) {
        walletTotal.textContent = total;
    }


    const walletToday =
        $("#walletToday");

    if (walletToday) {
        walletToday.textContent = today;
    }


    /* Wallet modal */

    const modalBalance =
        $("#modalWalletBalance");

    if (modalBalance) {
        modalBalance.textContent = balance;
    }

}


/* ========================================================
   PROFILE UI
======================================================== */

function updateProfileUI() {

    const username =
        state.username ||
        "3Migo Member";

    const telegramId =
        state.telegramId ||
        FALLBACK_TELEGRAM_ID;


    const profileUsername =
        $("#profileUsername");

    if (profileUsername) {
        profileUsername.textContent =
            username.startsWith("@")
                ? username
                : `@${username}`;
    }


    const profileTelegramId =
        $("#profileTelegramId");

    if (profileTelegramId) {

        profileTelegramId.textContent =
            `Telegram ID: ${telegramId}`;

    }


    const memberId =
        $("#memberId");

    if (memberId) {
        memberId.textContent =
            `3M${telegramId}`;
    }

}


/* ========================================================
   MINING
======================================================== */

function formatTime(totalSeconds) {

    const seconds =
        Math.max(
            0,
            Math.floor(
                safeNumber(totalSeconds)
            )
        );

    const hours =
        Math.floor(seconds / 3600);

    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );

    const remainingSeconds =
        seconds % 60;

    return [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(remainingSeconds).padStart(2, "0")
    ].join(":");

}


/* ========================================================
   MINING PROGRESS
======================================================== */

function getMiningProgress() {

    if (!state.miningActive) {
        return 0;
    }

    const remaining =
        clamp(
            state.miningRemaining,
            0,
            MINING_CYCLE_SECONDS
        );

    return clamp(
        1 -
        (
            remaining /
            MINING_CYCLE_SECONDS
        ),
        0,
        1
    );

}


/* ========================================================
   UPDATE MINING CIRCLE
======================================================== */

function updateMiningProgressVisual() {

    const progress =
        getMiningProgress();

    const degrees =
        progress * 360;


    const buttons =
        $all(".mine-btn");

    buttons.forEach(button => {

        button.style.setProperty(
            "--mine-progress",
            `${degrees}deg`
        );

        button.setAttribute(
            "aria-pressed",
            state.miningActive
                ? "true"
                : "false"
        );

    });


    const progressText =
        $("#miningProgress");

    if (progressText) {

        progressText.textContent =
            `${Math.round(progress * 100)}%`;

    }


    /* Mining page mirror */

    const miningBalance =
        $("#miningBalance");

    if (miningBalance) {

        miningBalance.textContent =
            formatNumber(state.balance);

    }


    const miningSessions =
        $("#miningSessions");

    if (miningSessions) {

        miningSessions.textContent =
            formatNumber(
                state.sessions,
                0
            );

    }


    const miningToday =
        $("#miningToday");

    if (miningToday) {

        miningToday.textContent =
            formatNumber(state.today);

    }

}


/* ========================================================
   UPDATE MINING UI
======================================================== */

function updateMiningUI() {

    const stateEl =
        $("#miningState");

    const timerEl =
        $("#miningTimer");

    const rateEl =
        $("#rate");

    const mineBtn =
        $("#mineBtn");


    const reward =
        safeNumber(
            state.miningReward,
            10
        );


    if (rateEl) {

        rateEl.textContent =
            `${formatNumber(reward, 0)} 3M لكل جلسة (12 ساعة)`;

    }


    if (state.miningActive) {

        if (stateEl) {

            stateEl.textContent =
                state.miningRemaining > 0
                    ? "⛏️ التعدين نشط"
                    : "🎁 استلم مكافأة 3M";

        }


        if (timerEl) {

            timerEl.textContent =
                formatTime(
                    state.miningRemaining
                );

        }


        if (mineBtn) {

            mineBtn.classList.add(
                "mining-active"
            );

            mineBtn.classList.add(
                "active"
            );


            if (
                state.miningRemaining > 0
            ) {

                mineBtn.disabled = true;

                const text =
                    $("#mineButtonText");

                if (text) {
                    text.textContent =
                        "⛏️ جارٍ التعدين...";
                }

            } else {

                mineBtn.disabled = false;

                const text =
                    $("#mineButtonText");

                if (text) {
                    text.textContent =
                        "🎁 استلم 3M";
                }

            }

        }

    } else {

        if (stateEl) {

            stateEl.textContent =
                "⚡ جاهز للتعدين";

        }


        if (timerEl) {

            timerEl.textContent =
                "12:00:00";

        }


        if (mineBtn) {

            mineBtn.disabled = false;

            mineBtn.classList.remove(
                "mining-active",
                "active"
            );

            const text =
                $("#mineButtonText");

            if (text) {
                text.textContent =
                    "⛏️ ابدأ التعدين";
            }

        }

    }


    updateMiningProgressVisual();

}


/* ========================================================
   LOAD MINING STATUS
======================================================== */

async function loadMiningStatus() {

    try {

        const data =
            await apiRequest(
                `/mining/${state.telegramId}/status`
            );


        state.miningActive =
            Boolean(
                data?.active ??
                data?.mining_active ??
                data?.status === "active"
            );


        state.miningRemaining =
            safeNumber(
                data?.remaining_seconds ??
                data?.remaining ??
                data?.seconds_remaining ??
                0
            );


        state.miningReward =
            safeNumber(
                data?.reward_3m ??
                data?.reward ??
                10,
                10
            );


        updateMiningUI();

        startMiningTicker();

    } catch (error) {

        console.warn(
            "Mining status unavailable:",
            error
        );

        state.miningActive = false;

        state.miningRemaining = 0;

        updateMiningUI();

    }

}


/* ========================================================
   MINING TICKER
======================================================== */

function startMiningTicker() {

    if (state.miningTimer) {

        clearInterval(
            state.miningTimer
        );

    }


    if (!state.miningActive) {

        updateMiningUI();

        return;

    }


    state.miningTimer =
        setInterval(() => {

            if (
                state.miningRemaining > 0
            ) {

                state.miningRemaining--;

                updateMiningUI();

                return;

            }


            state.miningRemaining = 0;

            updateMiningUI();

            showToast(
                "🎁 انتهت دورة التعدين — يمكنك استلام 3M",
                "success"
            );


            clearInterval(
                state.miningTimer
            );

            state.miningTimer = null;

        }, 1000);

}


/* ========================================================
   START MINING
======================================================== */

async function startMining() {

    if (state.miningActive) {

        if (
            state.miningRemaining <= 0
        ) {

            await claimMining();

        } else {

            showToast(
                `⏱️ التعدين نشط — المتبقي ${formatTime(state.miningRemaining)}`,
                "info"
            );

        }

        return;

    }


    const button =
        $("#mineBtn");

    if (button) {
        button.disabled = true;
    }


    try {

        const data =
            await apiRequest(
                `/mining/${state.telegramId}/start`,
                {
                    method: "POST"
                }
            );


        state.miningActive = true;

        state.miningRemaining =
            safeNumber(
                data?.remaining_seconds ??
                data?.remaining ??
                MINING_CYCLE_SECONDS
            );


        state.miningReward =
            safeNumber(
                data?.reward_3m ??
                data?.reward ??
                10,
                10
            );


        updateMiningUI();

        startMiningTicker();


        showToast(
            `⛏️ بدأ التعدين — مكافأة ${state.miningReward} 3M`,
            "success"
        );

    } catch (error) {

        console.error(
            "Start mining error:",
            error
        );

        showToast(
            `تعذر بدء التعدين: ${error.message}`,
            "error"
        );

        updateMiningUI();

    }

}


/* ========================================================
   CLAIM MINING
======================================================== */

async function claimMining() {

    try {

        const data =
            await apiRequest(
                `/mining/${state.telegramId}/claim`,
                {
                    method: "POST"
                }
            );


        const reward =
            safeNumber(
                data?.reward_3m ??
                data?.reward ??
                state.miningReward,
                state.miningReward
            );


        state.miningActive = false;

        state.miningRemaining = 0;


        updateMiningUI();

        await loadUser();

        await loadEconomicProfile();


        showToast(
            `🎁 تم استلام ${formatNumber(reward)} 3M`,
            "success"
        );

    } catch (error) {

        console.error(
            "Claim mining error:",
            error
        );

        showToast(
            `تعذر استلام المكافأة: ${error.message}`,
            "error"
        );

    }

}


/* ========================================================
   MINING BUTTON
======================================================== */

function setupMiningButton() {

    const mineBtn =
        $("#mineBtn");

    if (!mineBtn) return;


    mineBtn.addEventListener(
        "click",
        async () => {

            if (
                state.miningActive &&
                state.miningRemaining <= 0
            ) {

                await claimMining();

                return;

            }


            if (
                state.miningActive
            ) {

                showToast(
                    `⏱️ المتبقي ${formatTime(state.miningRemaining)}`,
                    "info"
                );

                return;

            }


            await startMining();

        }
    );


    /* Secondary mining button */

    const pageBtn =
        $("#mineBtnPage");

    if (pageBtn) {

        pageBtn.addEventListener(
            "click",
            () => {

                $("#mineBtn")?.click();

            }
        );

    }

}


/* ========================================================
   TASKS
======================================================== */

async function loadTasks() {

    const container =
        $("#tasksContainer");

    if (!container) return;


    state.loadingTasks = true;


    container.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <span>جاري تحميل المهام...</span>
        </div>
    `;


    try {

        const data =
            await apiRequest(
                `/tasks/${state.telegramId}`
            );


        const tasks =
            Array.isArray(data)
                ? data
                : (
                    data?.tasks ||
                    []
                );


        state.tasks = tasks;

        renderTasks();

    } catch (error) {

        console.error(
            "Tasks error:",
            error
        );


        container.innerHTML = `
            <div class="empty-state">
                تعذر تحميل المهام حالياً.
            </div>
        `;

    } finally {

        state.loadingTasks = false;

    }

}


/* ========================================================
   RENDER TASKS
======================================================== */

function renderTasks() {

    const container =
        $("#tasksContainer");

    if (!container) return;


    if (!state.tasks.length) {

        container.innerHTML = `
            <div class="empty-state">
                لا توجد مهام متاحة حالياً.
            </div>
        `;

        return;

    }


    container.innerHTML =
        state.tasks.map(task => {

            const id =
                task.id ??
                task.task_id;

            const title =
                escapeHTML(
                    task.title ||
                    "مهمة 3Migo"
                );

            const description =
                escapeHTML(
                    task.description ||
                    ""
                );

            const reward =
                safeNumber(
                    task.reward_3m ??
                    task.reward
                );


            const completed =
                Boolean(
                    task.completed
                );


            return `
                <div class="task-card">

                    <div class="task-icon">
                        🎯
                    </div>

                    <div class="task-content">

                        <strong>
                            ${title}
                        </strong>

                        <p>
                            ${description}
                        </p>

                        <span class="task-reward">
                            +${formatNumber(reward)} 3M
                        </span>

                    </div>

                    <button
                        class="primary-btn"
                        type="button"
                        data-complete-task="${id}"
                        ${completed ? "disabled" : ""}
                    >
                        ${
                            completed
                                ? "✓ مكتملة"
                                : "إنجاز"
                        }
                    </button>

                </div>
            `;

        }).join("");

}


/* ========================================================
   COMPLETE TASK
======================================================== */

async function completeTask(taskId) {

    try {

        const data =
            await apiRequest(
                `/tasks/${state.telegramId}/complete/${taskId}`,
                {
                    method: "POST"
                }
            );


        const reward =
            safeNumber(
                data?.reward_3m ??
                data?.reward ??
                0
            );


        showToast(
            reward > 0
                ? `🎁 حصلت على ${formatNumber(reward)} 3M`
                : "✓ تم إكمال المهمة",
            "success"
        );


        await loadTasks();

        await loadUser();

        await loadEconomicProfile();


    } catch (error) {

        console.error(
            "Complete task error:",
            error
        );

        showToast(
            `تعذر إكمال المهمة: ${error.message}`,
            "error"
        );

    }

}


/* ========================================================
   DAILY REWARD
======================================================== */

async function dailyReward() {

    try {

        const data =
            await apiRequest(
                `/daily/${state.telegramId}`,
                {
                    method: "POST"
                }
            );


        const reward =
            safeNumber(
                data?.reward_3m ??
                data?.reward ??
                0
            );


        showToast(
            reward > 0
                ? `🎁 المكافأة اليومية: ${formatNumber(reward)} 3M`
                : "✓ تمت معالجة المكافأة اليومية",
            "success"
        );


        await loadUser();

    } catch (error) {

        showToast(
            `تعذر استلام المكافأة اليومية: ${error.message}`,
            "error"
        );

    }

}


/* ========================================================
   REFERRAL
======================================================== */

async function loadReferral() {

    try {

        const data =
            await apiRequest(
                `/referral/${state.telegramId}`
            );


        const code =
            data?.code ||
            data?.referral_code ||
            `3M${state.telegramId}`;


        const link =
            data?.link ||
            data?.referral_link ||
            `https://t.me/${BOT_USERNAME}?start=ref_${code}`;


        state.referral = {

            code,

            link,

            count:
                safeNumber(
                    data?.count ??
                    data?.referrals ??
                    data?.referral_count
                ),

            earned:
                safeNumber(
                    data?.earned ??
                    data?.earned_3m ??
                    data?.referral_earned
                )

        };


        updateReferralUI();

    } catch (error) {

        console.warn(
            "Referral API unavailable:",
            error
        );


        state.referral = {

            code:
                `3M${state.telegramId}`,

            link:
                `https://t.me/${BOT_USERNAME}?start=ref_3M${state.telegramId}`,

            count: 0,

            earned: 0

        };


        updateReferralUI();

    }

}


/* ========================================================
   REFERRAL UI
======================================================== */

function updateReferralUI() {

    const code =
        state.referral.code;


    const link =
        state.referral.link;


    const codeElements =
        $all(
            "#referralCode, #modalReferralCode"
        );


    codeElements.forEach(element => {

        element.textContent =
            code;

    });


    const referralInputs =
        $all(
            "#referralLink, #referralLinkModal"
        );


    referralInputs.forEach(input => {

        input.value =
            link;

    });


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
                state.referral.earned
            );

    }


    generateReferralBarcode(
        code
    );

}


/* ========================================================
   REFERRAL BARCODE
======================================================== */

function generateReferralBarcode(code) {

    const bars =
        $all(
            "[data-referral-barcode] span"
        );

    if (!bars.length) return;


    let seed = 0;

    for (
        let i = 0;
        i < code.length;
        i++
    ) {

        seed =
            (
                seed * 31 +
                code.charCodeAt(i)
            ) >>> 0;

    }


    bars.forEach((bar, index) => {

        seed =
            (
                seed * 1664525 +
                1013904223
            ) >>> 0;


        const width =
            2 +
            (seed % 5);


        bar.style.width =
            `${width}px`;

        bar.style.opacity =
            `${0.65 + ((seed % 35) / 100)}`;

    });

}


/* ========================================================
   COPY REFERRAL
======================================================== */

async function copyReferral() {

    const link =
        state.referral.link;

    if (!link) return;


    try {

        await navigator.clipboard.writeText(
            link
        );

        showToast(
            "✓ تم نسخ رابط الإحالة",
            "success"
        );

    } catch {

        const input =
            $("#referralLink");

        if (input) {

            input.select();

            document.execCommand(
                "copy"
            );

            showToast(
                "✓ تم نسخ الرابط",
                "success"
            );

        }

    }

}


/* ========================================================
   SHARE REFERRAL
======================================================== */

function shareReferral() {

    const link =
        state.referral.link;

    const text =
        encodeURIComponent(
            "انضم إلى منظومة 3Migo واكتشف عالم المكافآت الرقمية."
        );

    const encodedLink =
        encodeURIComponent(link);


    const shareUrl =
        `https://t.me/share/url?url=${encodedLink}&text=${text}`;


    try {

        if (tg?.openTelegramLink) {

            tg.openTelegramLink(
                shareUrl
            );

        } else {

            window.open(
                shareUrl,
                "_blank"
            );

        }

    } catch (error) {

        console.error(
            "Share error:",
            error
        );

    }

}


/* ========================================================
   ECONOMIC PROFILE
======================================================== */

async function loadEconomicProfile() {

    if (
        state.economic.loading
    ) {

        return;

    }


    state.economic.loading = true;


    try {

        const data =
            await apiRequest(
                `/economic/user/${state.telegramId}`
            );


        const source =
            data?.economic ||
            data?.profile ||
            data ||
            {};


        state.economic.totalMined =
            safeNumber(
                source.total_mined ??
                source.totalMined ??
                source.mined_3m
            );


        state.economic.locked3m =
            safeNumber(
                source.locked_3m ??
                source.locked3m
            );


        state.economic.unlocked3m =
            safeNumber(
                source.unlocked_3m ??
                source.unlocked3m
            );


        state.economic.airdrop3m =
            safeNumber(
                source.airdrop_3m ??
                source.airdrop3m
            );


        state.economic.contributionScore =
            safeNumber(
                source.contribution_score ??
                source.contributionScore
            );


        state.economic.trustScore =
            safeNumber(
                source.trust_score ??
                source.trustScore
            );


        state.economic.loaded = true;


        updateEconomicUI();

        updateGrowthIndex();

        updateExperience();

    } catch (error) {

        console.warn(
            "Economic profile unavailable:",
            error
        );

    } finally {

        state.economic.loading = false;

    }

}


/* ========================================================
   ECONOMIC UI
======================================================== */

function updateEconomicUI() {

    const values = {

        "#economicTotalMined":
            state.economic.totalMined,

        "#economicLocked":
            state.economic.locked3m,

        "#economicUnlocked":
            state.economic.unlocked3m,

        "#economicAirdrop":
            state.economic.airdrop3m,

        "#economicContribution":
            state.economic.contributionScore,

        "#economicTrust":
            state.economic.trustScore,

        "#modalEconomicMined":
            state.economic.totalMined,

        "#modalEconomicLocked":
            state.economic.locked3m,

        "#modalEconomicUnlocked":
            state.economic.unlocked3m,

        "#modalEconomicAirdrop":
            state.economic.airdrop3m

    };


    Object.entries(values)
        .forEach(([selector, value]) => {

            const element =
                $(selector);

            if (element) {

                element.textContent =
                    formatNumber(value);

            }

        });

}


/* ========================================================
   GROWTH INDEX
======================================================== */

function updateGrowthIndex() {

    /*
      Internal ecosystem activity indicator.

      It is NOT a market price.
      It is NOT a financial return prediction.
    */


    const activity =
        clamp(
            state.sessions * 5,
            0,
            40
        );


    const contribution =
        clamp(
            state.economic.contributionScore,
            0,
            30
        );


    const trust =
        clamp(
            state.economic.trustScore,
            0,
            30
        );


    const index =
        Math.round(
            activity +
            contribution +
            trust
        );


    const growthValue =
        $("#growthIndexValue");

    if (growthValue) {

        growthValue.textContent =
            index;

    }


    const growthActivity =
        $("#growthActivity");

    if (growthActivity) {

        growthActivity.textContent =
            Math.round(activity);

    }


    const growthContribution =
        $("#growthContribution");

    if (growthContribution) {

        growthContribution.textContent =
            Math.round(contribution);

    }


    const growthTrust =
        $("#growthTrust");

    if (growthTrust) {

        growthTrust.textContent =
            Math.round(trust);

    }


    const change =
        $("#growthChange");

    if (change) {

        change.textContent =
            `+${index}%`;

    }


    const gauge =
        $(".growth-gauge");

    if (gauge) {

        const degrees =
            clamp(
                index,
                0,
                100
            ) * 2.6;

        gauge.style.setProperty(
            "--growth-progress",
            `${degrees}deg`
        );

    }

}


/* ========================================================
   EXPERIENCE
======================================================== */

function updateExperience() {

    const activityScore =
        clamp(
            state.sessions * 5,
            0,
            100
        );


    const contribution =
        clamp(
            state.economic.contributionScore,
            0,
            100
        );


    const trust =
        clamp(
            state.economic.trustScore,
            0,
            100
        );


    const score =
        Math.round(
            (
                activityScore +
                contribution +
                trust
            ) / 3
        );


    let level = 1;

    let levelName =
        "Explorer";

    if (score >= 75) {

        level = 4;
        levelName = "Builder";

    } else if (score >= 50) {

        level = 3;
        levelName = "Contributor";

    } else if (score >= 25) {

        level = 2;
        levelName = "Active";

    }


    state.experience = {

        level,

        levelName,

        progress: score,

        score,

        nextScore: 100,

        source: "economic"

    };


    /* Main */

    const levelEl =
        $("#v4Level");

    if (levelEl) {
        levelEl.textContent =
            levelName;
    }


    const scoreEl =
        $("#v4ExperienceScore");

    if (scoreEl) {
        scoreEl.textContent =
            score;
    }


    const progressEl =
        $("#v4LevelProgress");

    if (progressEl) {

        progressEl.style.width =
            `${score}%`;

    }


    /* Profile */

    const profileLevel =
        $("#profileLevel");

    if (profileLevel) {

        profileLevel.textContent =
            levelName;

    }


    const profileScore =
        $("#profileScore");

    if (profileScore) {

        profileScore.textContent =
            score;

    }


    const profileProgress =
        $("#profileProgress");

    if (profileProgress) {

        profileProgress.style.width =
            `${score}%`;

    }

}


/* ========================================================
   TRANSACTIONS
======================================================== */

async function loadTransactions() {

    const container =
        $("#transactionsList");

    if (!container) return;


    try {

        const data =
            await apiRequest(
                `/transactions/${state.telegramId}`
            );


        const transactions =
            Array.isArray(data)
                ? data
                : (
                    data?.transactions ||
                    []
                );


        if (!transactions.length) {

            container.innerHTML = `
                <div class="empty-state">
                    لا توجد عمليات حتى الآن.
                </div>
            `;

            return;

        }


        container.innerHTML =
            transactions
                .slice(0, 20)
                .map(transaction => {

                    const amount =
                        safeNumber(
                            transaction.amount ??
                            transaction.amount_3m
                        );


                    const title =
                        escapeHTML(
                            transaction.title ||
                            transaction.type ||
                            "عملية 3Migo"
                        );


                    const positive =
                        amount >= 0;


                    return `
                        <div class="transaction-item">

                            <div class="transaction-icon">
                                ${
                                    positive
                                        ? "↗️"
                                        : "↘️"
                                }
                            </div>

                            <div class="transaction-content">

                                <strong>
                                    ${title}
                                </strong>

                                <small>
                                    ${escapeHTML(
                                        transaction.description ||
                                        ""
                                    )}
                                </small>

                            </div>

                            <div class="transaction-amount">

                                ${
                                    positive
                                        ? "+"
                                        : ""
                                }${formatNumber(amount)}
                                3M

                            </div>

                        </div>
                    `;

                })
                .join("");

    } catch (error) {

        console.warn(
            "Transactions unavailable:",
            error
        );

    }

}


/* ========================================================
   WALLET SCREEN
======================================================== */

async function showWallet() {

    switchView("wallet");

    updateWalletUI();

    await loadUser();

    await loadEconomicProfile();

    await loadTransactions();

}


/* ========================================================
   TASKS SCREEN
======================================================== */

async function showTasks() {

    switchView("tasks");

    await loadTasks();

}


/* ========================================================
   MINING SCREEN
======================================================== */

async function showMining() {

    switchView("mine");

    updateMiningUI();

    await loadUser();

    await loadMiningStatus();

}


/* ========================================================
   PROFILE SCREEN
======================================================== */

async function showProfile() {

    switchView("profile");

    updateProfileUI();

    updateExperience();

    await loadReferral();

}


/* ========================================================
   HOME SCREEN
======================================================== */

function showHome() {

    switchView("home");

}


/* ========================================================
   SCREEN NAVIGATION
======================================================== */

function switchView(viewName) {

    const validViews = [
        "home",
        "mine",
        "tasks",
        "wallet",
        "profile"
    ];


    if (
        !validViews.includes(viewName)
    ) {

        viewName = "home";

    }


    state.currentView =
        viewName;


    const views =
        $all(".app-view");


    views.forEach(view => {

        const active =
            view.dataset.view === viewName;


        view.classList.toggle(
            "active",
            active
        );


        view.setAttribute(
            "aria-hidden",
            active
                ? "false"
                : "true"
        );

    });


    const navItems =
        $all(
            "#bottomNav [data-view-target]"
        );


    navItems.forEach(item => {

        item.classList.toggle(
            "active",
            item.dataset.viewTarget ===
            viewName
        );

    });


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    /* Lazy screen loading */

    if (viewName === "tasks") {

        loadTasks();

    }

    if (viewName === "wallet") {

        loadUser();

        loadEconomicProfile();

        loadTransactions();

    }

    if (viewName === "profile") {

        loadReferral();

    }

    if (viewName === "mine") {

        loadMiningStatus();

    }

}


/* ========================================================
   NAVIGATION STATE
======================================================== */

function setActiveNavigation(action) {

    const map = {

        home: "home",

        mine: "mine",

        tasks: "tasks",

        wallet: "wallet",

        profile: "profile"

    };


    const target =
        map[action] ||
        "home";


    $all(
        "#bottomNav [data-view-target]"
    ).forEach(item => {

        item.classList.toggle(
            "active",
            item.dataset.viewTarget ===
            target
        );

    });

}


/* ========================================================
   ACTIONS
======================================================== */

function setupActions() {

    document.addEventListener(
        "click",
        async event => {

            const actionElement =
                event.target.closest(
                    "[data-action]"
                );


            if (actionElement) {

                const action =
                    actionElement.dataset.action;


                switch (action) {

                    case "home":

                        showHome();

                        break;


                    case "mine":

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


                    case "daily":

                        await dailyReward();

                        break;


                    case "referral":

                        await loadReferral();

                        openModal(
                            "#referralModal"
                        );

                        break;


                    case "economic":

                        await showEconomicDashboard();

                        break;


                    case "airdrop":

                        await loadAirdropPreview();

                        break;


                    case "spend":

                        openModal(
                            "#spendModal"
                        );

                        break;


                    case "ad-galaxy":

                        await showAdGalaxy();

                        break;


                    case "ai":

                        show3MigoAI();

                        break;


                    case "v4":

                        showV4Hub();

                        break;

                }

            }


            /* View-target navigation */

            const viewTarget =
                event.target.closest(
                    "[data-view-target]"
                );


            if (
                viewTarget &&
                viewTarget.dataset.viewTarget
            ) {

                const target =
                    viewTarget.dataset.viewTarget;


                if (target === "home") {
                    showHome();
                }

                else if (target === "mine") {
                    await showMining();
                }

                else if (target === "tasks") {
                    await showTasks();
                }

                else if (target === "wallet") {
                    await showWallet();
                }

                else if (target === "profile") {
                    await showProfile();
                }

            }


            /* Complete task */

            const taskButton =
                event.target.closest(
                    "[data-complete-task]"
                );


            if (taskButton) {

                event.preventDefault();

                const taskId =
                    taskButton.dataset.completeTask;


                if (taskId) {

                    await completeTask(
                        taskId
                    );

                }

            }


            /* Copy referral */

            if (
                event.target.closest(
                    "[data-copy-referral]"
                )
            ) {

                await copyReferral();

            }


            /* Share referral */

            if (
                event.target.closest(
                    "[data-share-referral]"
                )
            ) {

                shareReferral();

            }


            /* Close modal */

            if (
                event.target.closest(
                    "[data-close-modal]"
                )
            ) {

                closeAllModals();

            }


            /* AI */

            const aiQuestion =
                event.target.closest(
                    "[data-ai-question]"
                );


            if (aiQuestion) {

                const question =
                    aiQuestion.dataset.aiQuestion;


                if (question) {

                    sendAIMessage(
                        question
                    );

                }

            }


            /* AI send */

            if (
                event.target.closest(
                    "[data-ai-send]"
                )
            ) {

                sendAIFromInput();

            }


            /* Economic Airdrop */

            if (
                event.target.closest(
                    "[data-economic-airdrop]"
                )
            ) {

                await loadAirdropPreview();

            }


            /* Economic spend */

            if (
                event.target.closest(
                    "[data-economic-spend]"
                )
            ) {

                openModal(
                    "#spendModal"
                );

            }


            /* Execute spend */

            if (
                event.target.closest(
                    "[data-execute-spend]"
                )
            ) {

                await executeSpend();

            }


            /* Refresh Ad Galaxy */

            if (
                event.target.closest(
                    "[data-refresh-ad-galaxy]"
                )
            ) {

                await loadAdGalaxy();

            }

        }
    );

}


/* ========================================================
   MODALS
======================================================== */

function openModal(selector) {

    const modal =
        typeof selector === "string"
            ? $(selector)
            : selector;


    if (!modal) return;


    modal.classList.add(
        "show",
        "active"
    );


    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.classList.add(
        "modal-open"
    );

}


function closeModal(modal) {

    if (!modal) return;


    modal.classList.remove(
        "show",
        "active"
    );


    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    if (
        !$all(
            ".modal-overlay.show"
        ).length
    ) {

        document.body.classList.remove(
            "modal-open"
        );

    }

}


function closeAllModals() {

    $all(
        ".modal-overlay"
    ).forEach(closeModal);

}


/* ========================================================
   ECONOMIC DASHBOARD
======================================================== */

async function showEconomicDashboard() {

    await loadEconomicProfile();

    openModal(
        "#economicModal"
    );

}


/* ========================================================
   AIRDROP PREVIEW
======================================================== */

async function loadAirdropPreview() {

    try {

        const data =
            await apiRequest(
                `/economic/airdrop/${state.telegramId}`
            );


        const amount =
            safeNumber(
                data?.airdrop_3m ??
                data?.amount ??
                data?.preview ??
                0
            );


        showToast(
            `🎁 معاينة Airdrop: ${formatNumber(amount)} 3M`,
            "success"
        );


    } catch (error) {

        showToast(
            `تعذر تحميل معاينة Airdrop: ${error.message}`,
            "error"
        );

    }

}


/* ========================================================
   SPEND
======================================================== */

async function executeSpend() {

    const serviceInput =
        $("#spendService");

    const amountInput =
        $("#spendAmount");


    const service =
        serviceInput?.value.trim() ||
        "";


    const amount =
        safeNumber(
            amountInput?.value
        );


    if (!service) {

        showToast(
            "أدخل اسم الخدمة",
            "warning"
        );

        return;

    }


    if (
        amount <= 0
    ) {

        showToast(
            "أدخل مبلغاً صحيحاً",
            "warning"
        );

        return;

    }


    try {

        const data =
            await apiRequest(
                `/economic/spend/${state.telegramId}`,
                {
                    method: "POST",
                    body: {
                        service,
                        amount_3m: amount
                    }
                }
            );


        showToast(
            "✓ تمت معالجة العملية",
            "success"
        );


        closeAllModals();


        if (serviceInput) {
            serviceInput.value = "";
        }

        if (amountInput) {
            amountInput.value = "";
        }


        await loadUser();

        await loadEconomicProfile();


    } catch (error) {

        showToast(
            `تعذر تنفيذ العملية: ${error.message}`,
            "error"
        );

    }

}


/* ========================================================
   AD GALAXY
======================================================== */

async function showAdGalaxy() {

    openAdGalaxyModal();

    await loadAdGalaxy();

}


/* ========================================================
   AD GALAXY MODAL
======================================================== */

function openAdGalaxyModal() {

    let modal =
        $("#adGalaxyModal");


    if (!modal) {

        modal =
            document.createElement(
                "div"
            );


        modal.id =
            "adGalaxyModal";

        modal.className =
            "modal-overlay";


        modal.innerHTML = `

            <div class="modal-card ad-galaxy-modal">

                <button
                    class="modal-close"
                    type="button"
                    data-close-modal
                >
                    ×
                </button>

                <div class="modal-icon">
                    🌌
                </div>

                <h2>
                    Ad Galaxy
                </h2>

                <p class="modal-subtitle">
                    مركز المهام الإعلانية
                </p>

                <div class="ad-galaxy-stats">

                    <div class="ad-galaxy-stat">
                        <strong id="adAvailable">
                            0
                        </strong>
                        <span>
                            متاح
                        </span>
                    </div>

                    <div class="ad-galaxy-stat">
                        <strong id="adCompleted">
                            0
                        </strong>
                        <span>
                            مكتمل
                        </span>
                    </div>

                    <div class="ad-galaxy-stat">
                        <strong id="adVerified">
                            0
                        </strong>
                        <span>
                            موثق
                        </span>
                    </div>

                </div>

                <div class="ad-provider-status">
                    <span class="status-dot online"></span>
                    <span>
                        3Migo Ad System
                    </span>
                </div>

                <div
                    id="adGalaxyList"
                    class="ad-galaxy-list"
                >
                    <div class="loading-state">
                        جاري التحميل...
                    </div>
                </div>

            </div>
        `;


        document.body.appendChild(
            modal
        );

    }


    openModal(
        modal
    );

}


/* ========================================================
   LOAD AD GALAXY
======================================================== */

async function loadAdGalaxy() {

    const list =
        $("#adGalaxyList");


    state.adGalaxy.loading = true;


    if (list) {

        list.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <span>
                    جاري تحميل المهام الإعلانية...
                </span>
            </div>
        `;

    }


    /*
      The current backend may not expose a
      dedicated Ad Galaxy endpoint.

      We therefore use the existing task
      system as the current verified source.
    */

    try {

        const data =
            await apiRequest(
                `/tasks/${state.telegramId}`
            );


        const tasks =
            Array.isArray(data)
                ? data
                : (
                    data?.tasks ||
                    []
                );


        state.adGalaxy.available =
            tasks.length;


        state.adGalaxy.completed =
            tasks.filter(
                task =>
                    Boolean(task.completed)
            ).length;


        state.adGalaxy.verified =
            state.adGalaxy.completed;


        state.adGalaxy.connected =
            true;


        updateAdGalaxyUI(
            tasks
        );

    } catch (error) {

        console.warn(
            "Ad Galaxy:",
            error
        );


        state.adGalaxy.connected =
            false;


        if (list) {

            list.innerHTML = `
                <div class="empty-state">
                    لا توجد مهام إعلانية متاحة حالياً.
                </div>
            `;

        }

    } finally {

        state.adGalaxy.loading =
            false;

    }

}


/* ========================================================
   UPDATE AD GALAXY
======================================================== */

function updateAdGalaxyUI(tasks = []) {

    const available =
        $("#adAvailable");

    const completed =
        $("#adCompleted");

    const verified =
        $("#adVerified");


    if (available) {

        available.textContent =
            state.adGalaxy.available;

    }


    if (completed) {

        completed.textContent =
            state.adGalaxy.completed;

    }


    if (verified) {

        verified.textContent =
            state.adGalaxy.verified;

    }


    const list =
        $("#adGalaxyList");


    if (!list) return;


    if (!tasks.length) {

        list.innerHTML = `
            <div class="empty-state">
                لا توجد مهام متاحة.
            </div>
        `;

        return;

    }


    list.innerHTML =
        tasks.map(task => {

            const id =
                task.id ??
                task.task_id;


            const completed =
                Boolean(
                    task.completed
                );


            return `

                <div class="ad-galaxy-item">

                    <div class="ad-galaxy-item-icon">
                        📢
                    </div>

                    <div class="ad-galaxy-item-content">

                        <strong>
                            ${escapeHTML(
                                task.title ||
                                "مهمة إعلانية"
                            )}
                        </strong>

                        <span>
                            +${formatNumber(
                                task.reward_3m ??
                                task.reward ??
                                0
                            )} 3M
                        </span>

                    </div>

                    <button
                        class="primary-btn"
                        type="button"
                        data-complete-task="${id}"
                        ${completed ? "disabled" : ""}
                    >
                        ${
                            completed
                                ? "✓"
                                : "ابدأ"
                        }
                    </button>

                </div>
            `;

        }).join("");

}


/* ========================================================
   AI ASSISTANT
======================================================== */

function show3MigoAI() {

    openModal(
        "#aiModal"
    );


    const input =
        $("#aiInput");

    if (input) {

        setTimeout(() => {

            input.focus();

        }, 250);

    }

}


/* ========================================================
   AI MESSAGE
======================================================== */

function addAIMessage(
    text,
    role = "assistant"
) {

    const messages =
        $("#aiMessages");

    if (!messages) return;


    const message =
        document.createElement(
            "div"
        );


    message.className =
        `ai-message ${role}`;


    message.textContent =
        text;


    messages.appendChild(
        message
    );


    messages.scrollTop =
        messages.scrollHeight;


    state.aiMessages.push({
        role,
        text
    });

}


/* ========================================================
   AI LOCAL ASSISTANT
======================================================== */

function generateAIResponse(question) {

    const q =
        question.toLowerCase();


    if (
        q.includes("تعدين") ||
        q.includes("mine")
    ) {

        return (
            "التعدين في النموذج الحالي يعمل " +
            "بدورة مدتها 12 ساعة، ومكافأة الدورة " +
            "الافتراضية هي 10 3M. بعد انتهاء الدورة " +
            "يمكنك استلام المكافأة."
        );

    }


    if (
        q.includes("مكاف") ||
        q.includes("ربح")
    ) {

        return (
            "يمكن زيادة رصيد 3M من خلال التعدين " +
            "والمهام وبرنامج الإحالة، وفقاً لما " +
            "هو متاح فعلياً في النظام."
        );

    }


    if (
        q.includes("نمو") ||
        q.includes("growth")
    ) {

        return (
            "مؤشر نمو 3Migo هو مؤشر داخلي لنشاط " +
            "المشاركة والمساهمة والثقة داخل المنظومة، " +
            "وليس سعراً سوقياً للعملة."
        );

    }


    if (
        q.includes("إحال") ||
        q.includes("referral")
    ) {

        return (
            "يمكنك استخدام رقم الإحالة والرابط " +
            "الموجودين في صفحة حسابي لمشاركة 3Migo."
        );

    }


    if (
        q.includes("محفظ") ||
        q.includes("رصيد")
    ) {

        return (
            `رصيدك الحالي هو ${formatNumber(
                state.balance
            )} 3M.`
        );

    }


    return (
        "أنا مساعد 3Migo. يمكنني مساعدتك في " +
        "فهم التعدين والمهام والإحالة والمحفظة " +
        "ومؤشر نمو المنظومة."
    );

}


/* ========================================================
   SEND AI MESSAGE
======================================================== */

function sendAIMessage(question) {

    const text =
        String(question || "")
            .trim();


    if (!text) return;


    addAIMessage(
        text,
        "user"
    );


    setTimeout(() => {

        const response =
            generateAIResponse(
                text
            );


        addAIMessage(
            response,
            "assistant"
        );

    }, 350);

}


/* ========================================================
   SEND AI INPUT
======================================================== */

function sendAIFromInput() {

    const input =
        $("#aiInput");


    if (!input) return;


    const text =
        input.value.trim();


    if (!text) return;


    input.value = "";


    sendAIMessage(
        text
    );

}


/* ========================================================
   V4 HUB
======================================================== */

function showV4Hub() {

    let modal =
        $("#v4HubModal");


    if (!modal) {

        modal =
            document.createElement(
                "div"
            );


        modal.id =
            "v4HubModal";


        modal.className =
            "modal-overlay";


        modal.innerHTML = `

            <div class="modal-card v4-hub-modal">

                <button
                    class="modal-close"
                    type="button"
                    data-close-modal
                >
                    ×
                </button>

                <div class="modal-icon">
                    ✦
                </div>

                <h2>
                    3Migo Hub
                </h2>

                <div class="v4-hub-level">
                    ${escapeHTML(
                        state.experience.levelName
                    )}
                </div>

                <div class="v4-hub-actions">

                    <button
                        class="v4-hub-action"
                        type="button"
                        data-action="mine"
                    >
                        <span class="v4-hub-icon">
                            ⛏️
                        </span>
                        <span class="v4-hub-text">
                            التعدين
                        </span>
                    </button>

                    <button
                        class="v4-hub-action"
                        type="button"
                        data-action="tasks"
                    >
                        <span class="v4-hub-icon">
                            🎯
                        </span>
                        <span class="v4-hub-text">
                            المهام
                        </span>
                    </button>

                    <button
                        class="v4-hub-action"
                        type="button"
                        data-action="wallet"
                    >
                        <span class="v4-hub-icon">
                            💳
                        </span>
                        <span class="v4-hub-text">
                            المحفظة
                        </span>
                    </button>

                </div>

            </div>
        `;


        document.body.appendChild(
            modal
        );

    }


    openModal(
        modal
    );

}


/* ========================================================
   ECONOMIC BUTTON
======================================================== */

function setupEconomicButton() {

    const button =
        $("#economicButton");

    if (!button) return;


    button.addEventListener(
        "click",
        async () => {

            await showEconomicDashboard();

        }
    );

}


/* ========================================================
   ESCAPE KEY
======================================================== */

function setupEscapeHandler() {

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeAllModals();

            }

        }
    );

}


/* ========================================================
   MODAL BACKDROP
======================================================== */

function setupModalBackdrop() {

    document.addEventListener(
        "click",
        event => {

            if (
                event.target.classList.contains(
                    "modal-overlay"
                )
            ) {

                closeModal(
                    event.target
                );

            }

        }
    );

}


/* ========================================================
   AI ENTER KEY
======================================================== */

function setupAIKeyboard() {

    const input =
        $("#aiInput");

    if (!input) return;


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                sendAIFromInput();

            }

        }
    );

}


/* ========================================================
   INITIAL DATA LOAD
======================================================== */

async function initializeData() {

    getTelegramUser();


    await registerUser();


    await loadUser();


    await loadMiningStatus();


    await loadReferral();


    await loadEconomicProfile();


    updateProfileUI();


    updateWalletUI();


    updateMiningUI();


    updateGrowthIndex();


    updateExperience();

}


/* ========================================================
   INITIALIZATION
======================================================== */

async function initializeApp() {

    console.log(
        "3Migo Coin App V5.1 initializing..."
    );


    setupActions();

    setupMiningButton();

    setupEconomicButton();

    setupEscapeHandler();

    setupModalBackdrop();

    setupAIKeyboard();


    /*
      Make sure Home is the first screen.
    */

    switchView(
        "home"
    );


    try {

        await initializeData();

    } catch (error) {

        console.error(
            "3Migo initialization error:",
            error
        );

        showToast(
            "تم تشغيل الواجهة، لكن تعذر تحميل بعض البيانات.",
            "warning"
        );

    }


    console.log(
        "3Migo Coin App V5.1 ready."
    );

}


/* ========================================================
   PUBLIC API
======================================================== */

window.ThreeMigo = {

    state,

    apiRequest,

    showToast,

    switchView,

    startMining,

    claimMining,

    loadUser,

    loadMiningStatus,

    loadTasks,

    loadReferral,

    loadEconomicProfile,

    loadTransactions,

    updateGrowthIndex,

    showWallet,

    showProfile,

    show3MigoAI,

    showAdGalaxy,

    showV4Hub

};


/* ========================================================
   START
======================================================== */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApp,
        {
            once: true
        }
    );

} else {

    initializeApp();

}
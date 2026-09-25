/* =========================================================
   3Migo Coin — Telegram Mini App
   APP.JS
   VERSION 5.1
   3MIGO SMART — DIGITAL ECONOMY EXPERIENCE

   V5.1 UPDATES:
   - Real 12H mining progress visual
   - Circular mining timeline synchronization
   - Mining percentage indicator
   - Premium referral / member ID support
   - Barcode visual data support
   - Wallet / Referral / Tasks / AI / Economic preserved
   - API / DB / Economic Engine unchanged
   - Compatible with STYLE.CSS V5.3
========================================================= */

"use strict";


/* =========================================================
   01. TELEGRAM
========================================================= */

const tg = window.Telegram?.WebApp || null;

if (tg) {
    try {
        tg.ready();
        tg.expand();

        try {
            tg.setHeaderColor("#04142a");
            tg.setBackgroundColor("#031024");
        } catch (error) {
            console.log("Telegram UI settings unavailable:", error);
        }

        try {
            if (tg.enableClosingConfirmation) {
                tg.enableClosingConfirmation();
            }
        } catch (error) {
            console.log("Closing confirmation unavailable:", error);
        }
    } catch (error) {
        console.error("Telegram initialization error:", error);
    }
}


/* =========================================================
   02. CONFIGURATION
========================================================= */

const API_BASE =
    window.location.origin;

const BOT_USERNAME =
    "threemigosmart_bot";

const FALLBACK_TELEGRAM_ID =
    1;

const MINING_CYCLE_HOURS =
    12;

const MINING_CYCLE_SECONDS =
    MINING_CYCLE_HOURS * 60 * 60;

const MINING_DEFAULT_REWARD =
    10;


/* =========================================================
   03. APPLICATION STATE
========================================================= */

const state = {

    telegramUser: null,

    telegramId:
        FALLBACK_TELEGRAM_ID,

    username:
        "3Migo User",

    /* -------------------------
       Main wallet
    ------------------------- */

    balance: 0,

    total: 0,

    today: 0,

    sessions: 0,


    /* -------------------------
       Mining
    ------------------------- */

    miningActive: false,

    miningRemaining: 0,

    miningReward:
        MINING_DEFAULT_REWARD,

    miningTimer: null,

    miningStartedAt: null,

    miningCycleSeconds:
        MINING_CYCLE_SECONDS,


    /* -------------------------
       Tasks
    ------------------------- */

    tasks: [],

    loadingTasks: false,


    /* -------------------------
       Referral
    ------------------------- */

    referral: {

        code: "",

        link: "",

        count: 0,

        rewards: 0
    },


    /* -------------------------
       Economic Engine
    ------------------------- */

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


    /* -------------------------
       Experience
    ------------------------- */

    experience: {

        level: 1,

        levelName: "Explorer",

        progress: 0,

        score: 0,

        nextScore: 100,

        source: "activity"
    },


    /* -------------------------
       Ad Galaxy
    ------------------------- */

    adGalaxy: {

        available: 0,

        completed: 0,

        verified: 0,

        loading: false,

        connected: false,

        providerConnected: false
    },


    /* -------------------------
       AI
    ------------------------- */

    aiMessages: [],


    /* -------------------------
       Airdrop
    ------------------------- */

    airdropPreview: null,


    /* -------------------------
       General loading
    ------------------------- */

    loadingEconomic: false,

    loadingUser: false
};


/* =========================================================
   04. DOM HELPERS
========================================================= */

function $(selector, root = document) {
    try {
        return root.querySelector(selector);
    } catch (error) {
        return null;
    }
}


function $all(selector, root = document) {
    try {
        return Array.from(
            root.querySelectorAll(selector)
        );
    } catch (error) {
        return [];
    }
}


/* =========================================================
   05. SAFE HELPERS
========================================================= */

function safeNumber(value, fallback = 0) {

    const number =
        Number(value);

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

    const number =
        safeNumber(value);

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


/* =========================================================
   06. TOAST
========================================================= */

function showToast(message, duration = 2800) {

    const toast =
        $("#toast");

    if (!toast) {
        console.log(message);
        return;
    }

    toast.textContent =
        String(message ?? "");

    toast.classList.add("show");

    clearTimeout(
        showToast.timer
    );

    showToast.timer =
        setTimeout(() => {

            toast.classList.remove("show");

        }, duration);
}


/* =========================================================
   07. TELEGRAM USER
========================================================= */

function getTelegramUser() {

    try {

        const user =
            tg?.initDataUnsafe?.user;

        if (user?.id) {

            state.telegramUser =
                user;

            state.telegramId =
                Number(user.id);

            state.username =
                user.username ||
                [
                    user.first_name,
                    user.last_name
                ]
                .filter(Boolean)
                .join(" ") ||
                `User ${user.id}`;

            return user;
        }

    } catch (error) {

        console.error(
            "Telegram user error:",
            error
        );
    }

    return null;
}


/* =========================================================
   08. API REQUEST
========================================================= */

async function apiRequest(
    endpoint,
    options = {}
) {

    const url =
        endpoint.startsWith("http")
            ? endpoint
            : `${API_BASE}${endpoint}`;

    const config = {

        method:
            options.method ||
            "GET",

        headers: {

            "Accept":
                "application/json",

            ...(options.headers || {})
        }
    };


    if (
        options.body !== undefined
    ) {

        config.headers[
            "Content-Type"
        ] =
            "application/json";

        config.body =
            typeof options.body === "string"
                ? options.body
                : JSON.stringify(
                    options.body
                );
    }


    const response =
        await fetch(
            url,
            config
        );


    const text =
        await response.text();


    let data = null;


    try {

        data =
            text
                ? JSON.parse(text)
                : null;

    } catch (error) {

        data =
            text;
    }


    if (!response.ok) {

        let message =
            `HTTP ${response.status}`;

        if (
            data &&
            typeof data === "object"
        ) {

            message =
                data.detail ||
                data.message ||
                data.error ||
                message;

        } else if (data) {

            message =
                String(data);
        }


        const error =
            new Error(message);

        error.status =
            response.status;

        error.data =
            data;

        throw error;
    }


    return data;
}


/* =========================================================
   09. USER REGISTRATION
========================================================= */

async function ensureUserRegistered() {

    const id =
        state.telegramId ||
        FALLBACK_TELEGRAM_ID;

    try {

        return await apiRequest(
            `/user/${id}`
        );

    } catch (error) {

        console.warn(
            "User GET failed, trying register:",
            error
        );
    }


    try {

        return await apiRequest(
            "/register",
            {
                method: "POST",

                body: {

                    telegram_id:
                        id,

                    username:
                        state.username
                }
            }
        );

    } catch (error) {

        console.error(
            "Registration failed:",
            error
        );

        return null;
    }
}


/* =========================================================
   10. MAIN BALANCE UI
========================================================= */

function updateBalanceUI() {

    const balance =
        $("#balance");

    const total =
        $("#total");

    const today =
        $("#today");

    const sessions =
        $("#sessions");


    if (balance) {

        balance.textContent =
            formatNumber(
                state.balance,
                2
            );
    }


    if (total) {

        total.textContent =
            formatNumber(
                state.total,
                2
            );
    }


    if (today) {

        today.textContent =
            formatNumber(
                state.today,
                2
            );
    }


    if (sessions) {

        sessions.textContent =
            formatNumber(
                state.sessions,
                0
            );
    }
}


/* =========================================================
   11. LOAD USER
========================================================= */

async function loadUser() {

    if (state.loadingUser) {
        return null;
    }

    state.loadingUser =
        true;


    try {

        const data =
            await ensureUserRegistered();


        if (!data) {
            return null;
        }


        /*
           Backend structures can vary slightly,
           therefore we safely support common forms.
        */

        const source =
            data.user ||
            data.data ||
            data;


        state.balance =
            safeNumber(
                source.balance ??
                source.balance_3m ??
                source.available_balance,
                state.balance
            );


        state.total =
            safeNumber(
                source.total ??
                source.total_earned ??
                source.total_3m,
                state.total
            );


        state.today =
            safeNumber(
                source.today ??
                source.today_earned ??
                source.daily_earned,
                state.today
            );


        state.sessions =
            safeNumber(
                source.sessions ??
                source.mining_sessions ??
                source.total_sessions,
                state.sessions
            );


        updateBalanceUI();


        return data;

    } catch (error) {

        console.error(
            "Load user failed:",
            error
        );

        showToast(
            "تعذر تحميل بيانات المحفظة"
        );

        return null;

    } finally {

        state.loadingUser =
            false;
    }
}


/* =========================================================
   12. ECONOMIC PROFILE
========================================================= */

async function loadEconomicProfile() {

    if (state.economic.loading) {
        return null;
    }

    state.economic.loading =
        true;

    state.loadingEconomic =
        true;


    try {

        const data =
            await apiRequest(
                `/economic/user/${state.telegramId}`
            );


        const source =
            data?.economic ||
            data?.data ||
            data ||
            {};


        state.economic.totalMined =
            safeNumber(
                source.total_mined ??
                source.totalMined,
                0
            );


        state.economic.locked3m =
            safeNumber(
                source.locked_3m ??
                source.locked3M ??
                source.locked,
                0
            );


        state.economic.unlocked3m =
            safeNumber(
                source.unlocked_3m ??
                source.unlocked3M ??
                source.unlocked,
                0
            );


        state.economic.airdrop3m =
            safeNumber(
                source.airdrop_3m ??
                source.airdrop3M ??
                source.airdrop,
                0
            );


        state.economic.contributionScore =
            safeNumber(
                source.contribution_score ??
                source.contributionScore,
                0
            );


        state.economic.trustScore =
            safeNumber(
                source.trust_score ??
                source.trustScore,
                0
            );


        state.economic.loaded =
            true;


        updateEconomicUI();


        updateExperience();


        return data;

    } catch (error) {

        console.warn(
            "Economic profile unavailable:",
            error
        );

        return null;

    } finally {

        state.economic.loading =
            false;

        state.loadingEconomic =
            false;
    }
}


/* =========================================================
   13. ECONOMIC UI
========================================================= */

function updateEconomicUI() {

    const fields = {

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
            state.economic.trustScore
    };


    Object.entries(fields)
        .forEach(
            ([selector, value]) => {

                const element =
                    $(selector);

                if (!element) {
                    return;
                }

                element.textContent =
                    formatNumber(
                        value,
                        2
                    );
            }
        );
}


/* =========================================================
   14. EXPERIENCE SYSTEM
========================================================= */

function updateExperience() {

    const sessions =
        safeNumber(
            state.sessions
        );

    const contribution =
        safeNumber(
            state.economic
                .contributionScore
        );

    const trust =
        safeNumber(
            state.economic
                .trustScore
        );


    const activityScore =
        clamp(
            sessions * 5,
            0,
            100
        );


    const totalScore =
        Math.round(
            activityScore +
            contribution +
            trust
        );


    let level = 1;
    let levelName = "Explorer";
    let nextScore = 100;
    let previousScore = 0;


    if (totalScore >= 300) {

        level = 4;
        levelName = "Builder";
        nextScore = 500;
        previousScore = 300;

    } else if (totalScore >= 200) {

        level = 3;
        levelName = "Contributor";
        nextScore = 300;
        previousScore = 200;

    } else if (totalScore >= 100) {

        level = 2;
        levelName = "Active";
        nextScore = 200;
        previousScore = 100;
    }


    const progress =
        clamp(
            (
                (totalScore - previousScore) /
                (nextScore - previousScore)
            ) * 100,
            0,
            100
        );


    state.experience = {

        level,

        levelName,

        progress,

        score:
            totalScore,

        nextScore,

        source:
            "activity"
    };


    const levelElement =
        $("#v4Level");

    const scoreElement =
        $("#v4ExperienceScore");

    const progressElement =
        $("#v4LevelProgress");


    if (levelElement) {

        levelElement.textContent =
            `LV.${level} ${levelName}`;
    }


    if (scoreElement) {

        scoreElement.textContent =
            `${formatNumber(totalScore, 0)} XP`;
    }


    if (progressElement) {

        progressElement.style.width =
            `${progress}%`;
    }
}


/* =========================================================
   15. MINING TIME FORMAT
========================================================= */

function formatTime(totalSeconds) {

    const seconds =
        Math.max(
            0,
            Math.floor(
                safeNumber(
                    totalSeconds
                )
            )
        );


    const hours =
        Math.floor(
            seconds / 3600
        );


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


/* =========================================================
   16. MINING PROGRESS
========================================================= */

function getMiningProgress() {

    const total =
        Math.max(
            1,
            safeNumber(
                state.miningCycleSeconds,
                MINING_CYCLE_SECONDS
            )
        );


    const remaining =
        clamp(
            safeNumber(
                state.miningRemaining
            ),
            0,
            total
        );


    const elapsed =
        total - remaining;


    const percentage =
        clamp(
            (elapsed / total) * 100,
            0,
            100
        );


    return {

        elapsed,

        remaining,

        percentage
    };
}


/* =========================================================
   17. MINING UI
========================================================= */

function updateMiningUI() {

    const miningState =
        $("#miningState");

    const mineBtn =
        $("#mineBtn");

    const rate =
        $("#rate");


    const {
        remaining,
        percentage
    } =
        getMiningProgress();


    /* -------------------------------------
       Progress ring
    ------------------------------------- */

    const progressDegrees =
        (percentage / 100) * 360;


    if (mineBtn) {

        mineBtn.style.setProperty(
            "--mine-progress",
            `${progressDegrees}deg`
        );


        mineBtn.style.setProperty(
            "--mine-progress-percent",
            `${percentage}%`
        );


        mineBtn.setAttribute(
            "data-progress",
            percentage.toFixed(1)
        );
    }


    /* -------------------------------------
       Optional percentage elements
    ------------------------------------- */

    const progressElements =
        $all(
            "[data-mining-progress], #miningProgress"
        );


    progressElements.forEach(
        element => {

            element.textContent =
                `${Math.round(percentage)}%`;

            element.setAttribute(
                "aria-valuenow",
                String(
                    Math.round(percentage)
                )
            );
        }
    );


    /* -------------------------------------
       Reward rate
    ------------------------------------- */

    if (rate) {

        rate.innerHTML =
            `<strong>${formatNumber(
                state.miningReward,
                0
            )} 3M</strong> لكل جلسة (${MINING_CYCLE_HOURS} ساعة)`;
    }


    if (!miningState || !mineBtn) {
        return;
    }


    /* -------------------------------------
       Active mining
    ------------------------------------- */

    if (state.miningActive) {

        mineBtn.classList.add(
            "mining-active"
        );

        mineBtn.setAttribute(
            "aria-pressed",
            "true"
        );


        if (remaining > 0) {

            mineBtn.disabled =
                true;

            mineBtn.innerHTML =
                `
                <span>
                    ⛏️ التعدين نشط
                    <br>
                    <small>
                        ${formatTime(remaining)}
                    </small>
                </span>
                `;


            miningState.innerHTML =
                `
                <strong>
                    ⛏️ التعدين نشط
                </strong>
                <br>
                <small>
                    ${formatTime(remaining)}
                    · ${Math.round(percentage)}%
                </small>
                `;

        } else {

            mineBtn.disabled =
                false;

            mineBtn.innerHTML =
                `
                <span>
                    🎁 استلم 3M
                </span>
                `;


            miningState.innerHTML =
                `
                <strong>
                    🎁 اكتملت دورة التعدين
                </strong>
                <br>
                <small>
                    المكافأة ${formatNumber(
                        state.miningReward,
                        0
                    )} 3M جاهزة للاستلام
                </small>
                `;
        }


    } else {

        /* ---------------------------------
           Idle
        --------------------------------- */

        mineBtn.disabled =
            false;

        mineBtn.classList.remove(
            "mining-active"
        );

        mineBtn.removeAttribute(
            "aria-pressed"
        );


        mineBtn.innerHTML =
            `
            <span>
                ⛏️ ابدأ التعدين
            </span>
            `;


        miningState.innerHTML =
            `
            <strong>
                ⚡ جاهز للتعدين
            </strong>
            <br>
            <small>
                مكافأة ${formatNumber(
                    state.miningReward,
                    0
                )} 3M
            </small>
            `;
    }
}


/* =========================================================
   18. MINING TIMER
========================================================= */

function stopMiningTimer() {

    if (
        state.miningTimer
    ) {

        clearInterval(
            state.miningTimer
        );

        state.miningTimer =
            null;
    }
}


function startMiningTimer() {

    stopMiningTimer();


    if (
        !state.miningActive ||
        state.miningRemaining <= 0
    ) {

        updateMiningUI();

        return;
    }


    state.miningTimer =
        setInterval(() => {

            if (
                !state.miningActive
            ) {

                stopMiningTimer();

                return;
            }


            state.miningRemaining =
                Math.max(
                    0,
                    state.miningRemaining - 1
                );


            updateMiningUI();


            if (
                state.miningRemaining <= 0
            ) {

                stopMiningTimer();

                state.miningActive =
                    true;

                updateMiningUI();

                showToast(
                    "🎁 اكتملت دورة التعدين — المكافأة جاهزة للاستلام",
                    4000
                );
            }

        }, 1000);
}


/* =========================================================
   19. LOAD MINING STATUS
========================================================= */

async function loadMiningStatus() {

    try {

        const data =
            await apiRequest(
                `/mining/${state.telegramId}/status`
            );


        const source =
            data?.mining ||
            data?.data ||
            data ||
            {};


        state.miningActive =
            Boolean(
                source.active ??
                source.mining_active ??
                source.is_active ??
                false
            );


        state.miningRemaining =
            Math.max(
                0,
                Math.floor(
                    safeNumber(
                        source.remaining ??
                        source.remaining_seconds ??
                        source.seconds_remaining ??
                        0
                    )
                )
            );


        state.miningReward =
            safeNumber(
                source.reward ??
                source.reward_3m ??
                source.reward3m ??
                MINING_DEFAULT_REWARD,
                MINING_DEFAULT_REWARD
            );


        state.miningCycleSeconds =
            safeNumber(
                source.cycle_seconds ??
                source.duration_seconds ??
                MINING_CYCLE_SECONDS,
                MINING_CYCLE_SECONDS
            );


        state.miningStartedAt =
            source.started_at ??
            source.start_time ??
            null;


        updateMiningUI();

        startMiningTimer();


        return data;

    } catch (error) {

        console.warn(
            "Mining status failed:",
            error
        );

        /*
           Keep UI usable even if endpoint
           is temporarily unavailable.
        */

        updateMiningUI();

        return null;
    }
}


/* =========================================================
   20. START MINING
========================================================= */

async function startMining() {

    if (
        state.miningActive &&
        state.miningRemaining > 0
    ) {

        showToast(
            `⛏️ التعدين نشط — ${formatTime(
                state.miningRemaining
            )}`
        );

        return;
    }


    try {

        const data =
            await apiRequest(
                `/mining/${state.telegramId}/start`,
                {
                    method: "POST"
                }
            );


        const source =
            data?.mining ||
            data?.data ||
            data ||
            {};


        state.miningActive =
            true;


        state.miningRemaining =
            Math.max(
                0,
                Math.floor(
                    safeNumber(
                        source.remaining ??
                        source.remaining_seconds ??
                        source.duration_seconds ??
                        MINING_CYCLE_SECONDS,
                        MINING_CYCLE_SECONDS
                    )
                )
            );


        state.miningReward =
            safeNumber(
                source.reward ??
                source.reward_3m ??
                MINING_DEFAULT_REWARD,
                MINING_DEFAULT_REWARD
            );


        state.miningCycleSeconds =
            safeNumber(
                source.cycle_seconds ??
                source.duration_seconds ??
                MINING_CYCLE_SECONDS,
                MINING_CYCLE_SECONDS
            );


        state.miningStartedAt =
            source.started_at ??
            new Date().toISOString();


        updateMiningUI();

        startMiningTimer();


        showToast(
            `⛏️ بدأ التعدين — ${formatNumber(
                state.miningReward,
                0
            )} 3M خلال ${MINING_CYCLE_HOURS} ساعة`
        );


        return data;

    } catch (error) {

        console.error(
            "Start mining failed:",
            error
        );

        showToast(
            error.message ||
            "تعذر بدء التعدين"
        );

        return null;
    }
}


/* =========================================================
   21. CLAIM MINING
========================================================= */

async function claimMining() {

    try {

        const data =
            await apiRequest(
                `/mining/${state.telegramId}/claim`,
                {
                    method: "POST"
                }
            );


        stopMiningTimer();


        state.miningActive =
            false;

        state.miningRemaining =
            0;


        updateMiningUI();


        await loadUser();

        await loadEconomicProfile();

        await loadMiningStatus();


        showToast(
            `🎁 تمت إضافة مكافأة التعدين إلى رصيدك`
        );


        return data;

    } catch (error) {

        console.error(
            "Claim mining failed:",
            error
        );

        showToast(
            error.message ||
            "تعذر استلام مكافأة التعدين"
        );

        return null;
    }
}


/* =========================================================
   22. MINING BUTTON
========================================================= */

function setupMiningButton() {

    const mineBtn =
        $("#mineBtn");


    if (!mineBtn) {
        return;
    }


    if (
        mineBtn.dataset.bound ===
        "true"
    ) {

        return;
    }


    mineBtn.dataset.bound =
        "true";


    mineBtn.addEventListener(
        "click",
        async () => {

            if (
                state.miningActive
            ) {

                if (
                    state.miningRemaining <= 0
                ) {

                    await claimMining();

                } else {

                    showToast(
                        `⛏️ التعدين نشط — ${formatTime(
                            state.miningRemaining
                        )}`
                    );
                }

                return;
            }


            await startMining();
        }
    );


    updateMiningUI();
}


/* =========================================================
   23. TASKS
========================================================= */

async function loadTasks() {

    const container =
        $("#tasksContainer");


    if (!container) {
        return;
    }


    state.loadingTasks =
        true;


    container.innerHTML =
        `
        <div class="loading-state loading">
            جاري تحميل المهام...
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
                    data?.data ||
                    []
                );


        state.tasks =
            tasks;


        renderTasks();


    } catch (error) {

        console.error(
            "Tasks load failed:",
            error
        );


        container.innerHTML =
            `
            <div class="error-state">
                تعذر تحميل المهام حاليًا.
            </div>
            `;

    } finally {

        state.loadingTasks =
            false;
    }
}


/* =========================================================
   24. RENDER TASKS
========================================================= */

function renderTasks() {

    const container =
        $("#tasksContainer");


    if (!container) {
        return;
    }


    if (
        !state.tasks.length
    ) {

        container.innerHTML =
            `
            <div class="empty-state">
                لا توجد مهام متاحة حاليًا.
            </div>
            `;

        return;
    }


    container.innerHTML =
        state.tasks
            .map(task => {

                const id =
                    task.id;

                const title =
                    escapeHTML(
                        task.title ||
                        "مهمة"
                    );

                const description =
                    escapeHTML(
                        task.description ||
                        ""
                    );

                const reward =
                    safeNumber(
                        task.reward_3m ??
                        task.reward ??
                        0
                    );

                const completed =
                    Boolean(
                        task.completed
                    );


                return `
                    <div
                        class="task-card"
                        data-task-id="${escapeHTML(id)}"
                    >

                        <div class="task-icon">
                            🎯
                        </div>

                        <div class="task-content">

                            <div class="task-title">
                                ${title}
                            </div>

                            <div class="task-description">
                                ${description}
                            </div>

                            <div class="task-reward">
                                +${formatNumber(
                                    reward,
                                    0
                                )} 3M
                            </div>

                        </div>

                        <button
                            type="button"
                            class="task-btn"
                            data-complete-task="${escapeHTML(id)}"
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

            })
            .join("");
}


/* =========================================================
   25. COMPLETE TASK
========================================================= */

async function completeTask(taskId) {

    if (!taskId) {
        return;
    }


    try {

        const data =
            await apiRequest(
                `/tasks/${state.telegramId}/complete/${taskId}`,
                {
                    method: "POST"
                }
            );


        showToast(
            data?.message ||
            "🎁 تمت إضافة مكافأة المهمة"
        );


        await loadUser();

        await loadEconomicProfile();

        await loadTasks();


    } catch (error) {

        console.error(
            "Complete task failed:",
            error
        );

        showToast(
            error.message ||
            "تعذر إكمال المهمة"
        );
    }
}


/* =========================================================
   26. SCROLL TO TASKS
========================================================= */

function scrollToTasks() {

    const section =
        $("#tasksSection");


    if (section) {

        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        return;
    }


    const container =
        $("#tasksContainer");


    if (container) {

        container.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}


/* =========================================================
   27. DAILY REWARD
========================================================= */

async function dailyReward() {

    try {

        const data =
            await apiRequest(
                `/daily/${state.telegramId}`,
                {
                    method: "POST"
                }
            );


        showToast(
            data?.message ||
            "🎁 تمت معالجة المكافأة اليومية"
        );


        await loadUser();

        await loadEconomicProfile();


    } catch (error) {

        console.error(
            "Daily reward failed:",
            error
        );

        showToast(
            error.message ||
            "تعذر الحصول على المكافأة اليومية"
        );
    }
}


/* =========================================================
   28. REFERRAL
========================================================= */

async function loadReferral() {

    try {

        const data =
            await apiRequest(
                `/referral/${state.telegramId}`
            );


        const source =
            data?.referral ||
            data?.data ||
            data ||
            {};


        const code =
            String(
                source.code ??
                source.referral_code ??
                source.referralCode ??
                `3M${state.telegramId}`
            );


        const link =
            String(
                source.link ??
                source.referral_link ??
                source.referralLink ??
                `https://t.me/${BOT_USERNAME}?start=ref_${code}`
            );


        state.referral = {

            code,

            link,

            count:
                safeNumber(
                    source.count ??
                    source.referrals ??
                    source.referral_count ??
                    0
                ),

            rewards:
                safeNumber(
                    source.rewards ??
                    source.referral_rewards ??
                    source.rewards_3m ??
                    0
                )
        };


        updateReferralUI();


        return data;

    } catch (error) {

        console.warn(
            "Referral load failed:",
            error
        );


        /*
           Fallback remains local and does
           not alter the backend.
        */

        const code =
            `3M${state.telegramId}`;


        state.referral = {

            code,

            link:
                `https://t.me/${BOT_USERNAME}?start=ref_${code}`,

            count: 0,

            rewards: 0
        };


        updateReferralUI();


        return null;
    }
}


/* =========================================================
   29. REFERRAL UI
========================================================= */

function updateReferralUI() {

    const linkInput =
        $("#referralLink");


    if (linkInput) {

        if (
            linkInput.tagName ===
            "INPUT"
        ) {

            linkInput.value =
                state.referral.link;

        } else {

            linkInput.textContent =
                state.referral.link;
        }


        linkInput.setAttribute(
            "data-referral-code",
            state.referral.code
        );
    }


    const count =
        $("#referralCount");


    const rewards =
        $("#referralRewards");


    if (count) {

        count.textContent =
            formatNumber(
                state.referral.count,
                0
            );
    }


    if (rewards) {

        rewards.textContent =
            formatNumber(
                state.referral.rewards,
                2
            );
    }


    /*
       Support optional barcode elements.
    */

    const barcode =
        $(".referral-barcode") ||
        $(".barcode");


    if (barcode) {

        barcode.setAttribute(
            "data-referral-code",
            state.referral.code
        );


        barcode.setAttribute(
            "aria-label",
            `Referral ID ${state.referral.code}`
        );
    }


    const referralIds =
        $all(
            ".referral-id, .member-id, [data-referral-id]"
        );


    referralIds.forEach(
        element => {

            element.textContent =
                state.referral.code;
        }
    );
}


/* =========================================================
   30. REFERRAL MODAL
========================================================= */

function showReferral() {

    const modal =
        $("#referralModal");


    if (!modal) {

        showToast(
            `رابط الإحالة: ${state.referral.link}`
        );

        return;
    }


    modal.classList.add("active");
    modal.classList.add("show");

    modal.removeAttribute(
        "hidden"
    );


    updateReferralUI();
}


/* =========================================================
   31. COPY REFERRAL
========================================================= */

async function copyReferral() {

    const text =
        state.referral.link;


    try {

        if (
            navigator.clipboard &&
            window.isSecureContext
        ) {

            await navigator.clipboard.writeText(
                text
            );

        } else {

            const temporary =
                document.createElement(
                    "textarea"
                );

            temporary.value =
                text;

            temporary.style.position =
                "fixed";

            temporary.style.opacity =
                "0";

            document.body.appendChild(
                temporary
            );

            temporary.select();

            document.execCommand(
                "copy"
            );

            temporary.remove();
        }


        showToast(
            "✓ تم نسخ رابط الإحالة"
        );


    } catch (error) {

        console.error(
            "Copy referral failed:",
            error
        );

        showToast(
            "تعذر نسخ الرابط"
        );
    }
}


/* =========================================================
   32. SHARE REFERRAL
========================================================= */

function shareReferral() {

    const text =
        encodeURIComponent(
            "انضم إلى 3Migo Coin"
        );


    const url =
        encodeURIComponent(
            state.referral.link
        );


    const shareUrl =
        `https://t.me/share/url?url=${url}&text=${text}`;


    try {

        if (
            tg &&
            typeof tg.openTelegramLink ===
            "function"
        ) {

            tg.openTelegramLink(
                shareUrl
            );

        } else {

            window.open(
                shareUrl,
                "_blank",
                "noopener"
            );
        }

    } catch (error) {

        console.error(
            "Referral share failed:",
            error
        );
    }
}


/* =========================================================
   33. WALLET
========================================================= */

async function showWallet() {

    await loadUser();

    await loadEconomicProfile();


    const modal =
        $("#walletModal");


    if (!modal) {

        showToast(
            `رصيدك الحالي: ${formatNumber(
                state.balance,
                2
            )} 3M`
        );

        return;
    }


    modal.classList.add(
        "active"
    );

    modal.classList.add(
        "show"
    );

    modal.removeAttribute(
        "hidden"
    );


    updateWalletModal();


    await loadTransactions();
}


/* =========================================================
   34. WALLET MODAL UI
========================================================= */

function updateWalletModal() {

    const balance =
        $(".wallet-main-balance");


    if (balance) {

        balance.textContent =
            formatNumber(
                state.balance,
                2
            );
    }


    const walletBalance =
        $("#walletBalance");


    if (walletBalance) {

        walletBalance.textContent =
            formatNumber(
                state.balance,
                2
            );
    }


    const walletLevel =
        $(".wallet-level");


    if (walletLevel) {

        walletLevel.textContent =
            `LV.${state.experience.level} · ${state.experience.levelName}`;
    }
}


/* =========================================================
   35. TRANSACTIONS
========================================================= */

async function loadTransactions() {

    const container =
        $(".transactions-list") ||
        $(".transactions");


    if (!container) {
        return;
    }


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
                    data?.data ||
                    []
                );


        renderTransactions(
            container,
            transactions
        );


    } catch (error) {

        console.warn(
            "Transactions unavailable:",
            error
        );


        container.innerHTML =
            `
            <div class="empty-state">
                لا توجد معاملات متاحة حاليًا.
            </div>
            `;
    }
}


/* =========================================================
   36. RENDER TRANSACTIONS
========================================================= */

function renderTransactions(
    container,
    transactions
) {

    if (
        !Array.isArray(transactions) ||
        !transactions.length
    ) {

        container.innerHTML =
            `
            <div class="empty-state">
                لا توجد معاملات بعد.
            </div>
            `;

        return;
    }


    container.innerHTML =
        transactions
            .slice(0, 50)
            .map(transaction => {

                const title =
                    escapeHTML(
                        transaction.title ||
                        transaction.type ||
                        "معاملة"
                    );

                const amount =
                    safeNumber(
                        transaction.amount ??
                        transaction.amount_3m ??
                        transaction.reward ??
                        0
                    );


                const date =
                    escapeHTML(
                        transaction.created_at ||
                        transaction.date ||
                        ""
                    );


                const icon =
                    amount >= 0
                        ? "＋"
                        : "−";


                return `
                    <div class="transaction transaction-item">

                        <div class="transaction-icon">
                            ${icon}
                        </div>

                        <div class="transaction-info transaction-content">

                            <div class="transaction-title">
                                ${title}
                            </div>

                            <div class="transaction-date">
                                ${date}
                            </div>

                        </div>

                        <div class="transaction-amount">
                            ${amount >= 0 ? "+" : ""}
                            ${formatNumber(
                                amount,
                                2
                            )} 3M
                        </div>

                    </div>
                `;

            })
            .join("");
}


/* =========================================================
   37. ECONOMIC DASHBOARD
========================================================= */

async function showEconomicDashboard() {

    await loadEconomicProfile();


    const modal =
        $("#economicModal") ||
        $("#economicDashboardModal");


    if (!modal) {

        showToast(
            "تم تحديث المؤشر الاقتصادي"
        );

        return;
    }


    modal.classList.add(
        "active"
    );

    modal.classList.add(
        "show"
    );

    modal.removeAttribute(
        "hidden"
    );


    updateEconomicUI();
}


/* =========================================================
   38. AIRDROP PREVIEW
========================================================= */

async function loadAirdropPreview() {

    try {

        const data =
            await apiRequest(
                `/economic/airdrop/${state.telegramId}`
            );


        state.airdropPreview =
            data;


        const preview =
            data?.preview ??
            data?.data ??
            data;


        const amount =
            safeNumber(
                preview?.amount ??
                preview?.airdrop_3m ??
                preview?.reward ??
                0
            );


        showToast(
            `🎁 معاينة Airdrop: ${formatNumber(
                amount,
                2
            )} 3M`
        );


        return data;

    } catch (error) {

        console.error(
            "Airdrop preview failed:",
            error
        );

        showToast(
            error.message ||
            "تعذر تحميل معاينة Airdrop"
        );

        return null;
    }
}


/* =========================================================
   39. SPEND MODAL
========================================================= */

function showSpendModal() {

    const modal =
        $("#spendModal");


    if (!modal) {

        showToast(
            "خدمة الإنفاق متاحة من لوحة الاقتصاد"
        );

        return;
    }


    modal.classList.add(
        "active"
    );

    modal.classList.add(
        "show"
    );

    modal.removeAttribute(
        "hidden"
    );
}


/* =========================================================
   40. EXECUTE SPEND
========================================================= */

async function executeSpend() {

    const serviceInput =
        $("#spendService");

    const amountInput =
        $("#spendAmount");


    const service =
        serviceInput?.value?.trim() ||
        "";


    const amount =
        safeNumber(
            amountInput?.value
        );


    if (!service) {

        showToast(
            "أدخل اسم الخدمة"
        );

        return;
    }


    if (
        amount <= 0
    ) {

        showToast(
            "أدخل مبلغًا صحيحًا"
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

                        amount_3m:
                            amount
                    }
                }
            );


        showToast(
            data?.message ||
            "✓ تمت معالجة عملية الإنفاق"
        );


        await loadUser();

        await loadEconomicProfile();


    } catch (error) {

        console.error(
            "Spend failed:",
            error
        );

        showToast(
            error.message ||
            "تعذر تنفيذ العملية"
        );
    }
}


/* =========================================================
   41. AD GALAXY
========================================================= */

async function showAdGalaxy() {

    const modal =
        $("#adGalaxyModal");


    if (!modal) {

        showToast(
            "🌌 Ad Galaxy"
        );

        return;
    }


    modal.classList.add(
        "active"
    );

    modal.classList.add(
        "show"
    );

    modal.removeAttribute(
        "hidden"
    );


    await loadAdGalaxy();
}


/* =========================================================
   42. LOAD AD GALAXY
========================================================= */

async function loadAdGalaxy() {

    state.adGalaxy.loading =
        true;


    try {

        /*
           The backend may not yet expose
           a dedicated Ad Galaxy endpoint.
           Therefore this section safely
           derives available values from tasks.
        */

        if (
            !state.tasks.length
        ) {

            await loadTasks();
        }


        const available =
            state.tasks.filter(
                task =>
                    !Boolean(
                        task.completed
                    )
            ).length;


        const completed =
            state.tasks.filter(
                task =>
                    Boolean(
                        task.completed
                    )
            ).length;


        state.adGalaxy.available =
            available;

        state.adGalaxy.completed =
            completed;


        state.adGalaxy.verified =
            completed;


        state.adGalaxy.connected =
            true;


        state.adGalaxy.providerConnected =
            true;


        renderAdGalaxy();


    } catch (error) {

        console.error(
            "Ad Galaxy error:",
            error
        );

    } finally {

        state.adGalaxy.loading =
            false;
    }
}


/* =========================================================
   43. RENDER AD GALAXY
========================================================= */

function renderAdGalaxy() {

    const available =
        $("[data-ad-available]");

    const completed =
        $("[data-ad-completed]");

    const verified =
        $("[data-ad-verified]");


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


    const progress =
        $(".progress-fill");


    if (progress) {

        const total =
            state.adGalaxy.available +
            state.adGalaxy.completed;


        const percentage =
            total > 0
                ? (
                    state.adGalaxy.completed /
                    total
                ) * 100
                : 0;


        progress.style.width =
            `${percentage}%`;
    }


    const status =
        $(".ad-provider-status");


    if (status) {

        const dot =
            $(".status-dot", status);


        if (dot) {

            dot.classList.toggle(
                "online",
                state.adGalaxy.providerConnected
            );

            dot.classList.toggle(
                "offline",
                !state.adGalaxy.providerConnected
            );
        }
    }
}


/* =========================================================
   44. AI ASSISTANT
========================================================= */

function show3MigoAI() {

    const modal =
        $("#aiModal");


    if (!modal) {

        showToast(
            "🤖 3Migo AI جاهز للمساعدة"
        );

        return;
    }


    modal.classList.add(
        "active"
    );

    modal.classList.add(
        "show"
    );

    modal.removeAttribute(
        "hidden"
    );


    initializeAI();
}


/* =========================================================
   45. AI INITIALIZATION
========================================================= */

function initializeAI() {

    const messages =
        $("#aiMessages");


    if (!messages) {
        return;
    }


    if (
        state.aiMessages.length === 0
    ) {

        state.aiMessages.push({

            role: "assistant",

            text:
                "مرحبًا بك في 3Migo AI 🤖\nكيف يمكنني مساعدتك في استخدام المنصة؟"
        });
    }


    renderAIMessages();
}


/* =========================================================
   46. AI RENDER
========================================================= */

function renderAIMessages() {

    const container =
        $("#aiMessages");


    if (!container) {
        return;
    }


    container.innerHTML =
        state.aiMessages
            .map(message => {

                const role =
                    message.role === "user"
                        ? "user"
                        : "assistant";


                return `
                    <div class="ai-message ${role}">
                        ${escapeHTML(
                            message.text
                        ).replace(
                            /\n/g,
                            "<br>"
                        )}
                    </div>
                `;

            })
            .join("");


    container.scrollTop =
        container.scrollHeight;
}


/* =========================================================
   47. AI RESPONSE
========================================================= */

function generateAIResponse(question) {

    const q =
        String(question)
            .toLowerCase();


    if (
        q.includes("تعدين") ||
        q.includes("mine") ||
        q.includes("mining")
    ) {

        return (
            "التعدين في النسخة الحالية يعمل بدورة 12 ساعة، " +
            `ومكافأة الدورة الحالية ${formatNumber(
                state.miningReward,
                0
            )} 3M.`
        );
    }


    if (
        q.includes("رصيد") ||
        q.includes("محفظ") ||
        q.includes("wallet")
    ) {

        return (
            `رصيدك الحالي هو ${formatNumber(
                state.balance,
                2
            )} 3M.`
        );
    }


    if (
        q.includes("إحال") ||
        q.includes("referral")
    ) {

        return (
            `رمز الإحالة الخاص بك هو ${state.referral.code}.`
        );
    }


    if (
        q.includes("اقتصاد") ||
        q.includes("economic")
    ) {

        return (
            "المؤشر الاقتصادي يعتمد على بيانات النظام " +
            "مثل التعدين والمساهمة والثقة، وليس سعرًا سوقيًا ثابتًا."
        );
    }


    if (
        q.includes("3migo") ||
        q.includes("3m")
    ) {

        return (
            "3Migo Coin هو نظام مكافآت رقمي تجريبي " +
            "يربط النشاط والمهام والإحالات بالرصيد الداخلي."
        );
    }


    return (
        "أستطيع مساعدتك في التعدين، الرصيد، الإحالات، " +
        "المهام، الاقتصاد الرقمي، وخدمات 3Migo."
    );
}


/* =========================================================
   48. SEND AI MESSAGE
========================================================= */

async function sendAIMessage() {

    const input =
        $("#aiInput");


    if (!input) {
        return;
    }


    const question =
        input.value.trim();


    if (!question) {
        return;
    }


    state.aiMessages.push({

        role: "user",

        text:
            question
    });


    input.value =
        "";


    renderAIMessages();


    /*
       Current AI is an in-app assistant.
       Backend AI integration can be connected
       later without changing this UI contract.
    */

    setTimeout(() => {

        state.aiMessages.push({

            role: "assistant",

            text:
                generateAIResponse(
                    question
                )
        });


        renderAIMessages();

    }, 300);
}


/* =========================================================
   49. MASTER HUB
========================================================= */

function showV4Hub() {

    const modal =
        $("#v4HubModal");


    if (!modal) {

        showToast(
            "🚀 3Migo Master Hub"
        );

        return;
    }


    modal.classList.add(
        "active"
    );

    modal.classList.add(
        "show"
    );

    modal.removeAttribute(
        "hidden"
    );


    updateExperience();
}


/* =========================================================
   50. PROFILE
========================================================= */

function showProfile() {

    const modal =
        $("#profileModal");


    if (modal) {

        modal.classList.add(
            "active"
        );

        modal.classList.add(
            "show"
        );

        modal.removeAttribute(
            "hidden"
        );

        return;
    }


    showToast(
        `👤 ${state.username} · ID ${state.telegramId}`
    );
}


/* =========================================================
   51. ACTIVE NAVIGATION
========================================================= */

function setActiveNavigation(
    action
) {

    const navItems =
        $all(
            ".bottom-nav [data-action]"
        );


    navItems.forEach(
        item => {

            const itemAction =
                item.dataset.action;


            const active =
                itemAction === action;


            item.classList.toggle(
                "active",
                active
            );


            if (active) {

                item.setAttribute(
                    "aria-current",
                    "page"
                );

            } else {

                item.removeAttribute(
                    "aria-current"
                );
            }
        }
    );
}


/* =========================================================
   52. CLOSE MODAL
========================================================= */

function closeModal(modal) {

    if (!modal) {
        return;
    }


    modal.classList.remove(
        "active"
    );

    modal.classList.remove(
        "show"
    );


    modal.setAttribute(
        "hidden",
        ""
    );
}


/* =========================================================
   53. MODAL SETUP
========================================================= */

function setupModals() {

    $all(
        ".modal-close, [data-modal-close]"
    )
    .forEach(button => {

        if (
            button.dataset.bound ===
            "true"
        ) {

            return;
        }


        button.dataset.bound =
            "true";


        button.addEventListener(
            "click",
            event => {

                event.preventDefault();

                const modal =
                    button.closest(
                        ".modal"
                    ) ||
                    button.closest(
                        ".modal-overlay"
                    );


                closeModal(
                    modal
                );
            }
        );
    });


    $all(
        ".modal"
    )
    .forEach(modal => {

        if (
            modal.dataset.overlayBound ===
            "true"
        ) {

            return;
        }


        modal.dataset.overlayBound =
            "true";


        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    modal
                ) {

                    closeModal(
                        modal
                    );
                }
            }
        );
    });
}


/* =========================================================
   54. ACTION SYSTEM
========================================================= */

function setupActions() {

    document.addEventListener(
        "click",
        async event => {

            const target =
                event.target.closest(
                    "[data-action]"
                );


            if (target) {

                const action =
                    target.dataset.action;


                setActiveNavigation(
                    action
                );


                switch (action) {

                    case "home":

                        window.scrollTo({
                            top: 0,
                            behavior: "smooth"
                        });

                        break;


                    case "tasks":

                        scrollToTasks();

                        break;


                    case "mine": {

                        const miningSection =
                            $("#miningSection");

                        if (miningSection) {

                            miningSection.scrollIntoView({
                                behavior: "smooth",
                                block: "center"
                            });

                        } else {

                            $("#mineBtn")?.scrollIntoView({
                                behavior: "smooth",
                                block: "center"
                            });
                        }

                        break;
                    }


                    case "daily":

                        await dailyReward();

                        break;


                    case "referral":

                        await loadReferral();

                        showReferral();

                        break;


                    case "wallet":

                        await showWallet();

                        break;


                    case "profile":

                        showProfile();

                        break;


                    case "economic":

                        await showEconomicDashboard();

                        break;


                    case "airdrop":

                        await loadAirdropPreview();

                        break;


                    case "spend":

                        showSpendModal();

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


                    default:

                        break;
                }


                return;
            }


            /* -----------------------------------------
               Task completion
            ----------------------------------------- */

            const taskButton =
                event.target.closest(
                    "[data-complete-task]"
                );


            if (taskButton) {

                event.preventDefault();


                await completeTask(
                    taskButton.dataset.completeTask
                );

                return;
            }


            /* -----------------------------------------
               Referral copy
            ----------------------------------------- */

            const copyButton =
                event.target.closest(
                    "[data-copy-referral]"
                );


            if (copyButton) {

                event.preventDefault();

                await copyReferral();

                return;
            }


            /* -----------------------------------------
               Referral share
            ----------------------------------------- */

            const shareButton =
                event.target.closest(
                    "[data-share-referral]"
                );


            if (shareButton) {

                event.preventDefault();

                shareReferral();

                return;
            }


            /* -----------------------------------------
               AI quick question
            ----------------------------------------- */

            const aiQuestion =
                event.target.closest(
                    "[data-ai-question]"
                );


            if (aiQuestion) {

                event.preventDefault();


                const question =
                    aiQuestion.dataset.aiQuestion ||
                    aiQuestion.textContent ||
                    "";


                const input =
                    $("#aiInput");


                if (input) {

                    input.value =
                        question;

                    await sendAIMessage();
                }


                return;
            }


            /* -----------------------------------------
               AI send
            ----------------------------------------- */

            const aiSend =
                event.target.closest(
                    "[data-ai-send]"
                );


            if (aiSend) {

                event.preventDefault();

                await sendAIMessage();

                return;
            }


            /* -----------------------------------------
               Refresh Ad Galaxy
            ----------------------------------------- */

            const refreshAds =
                event.target.closest(
                    "[data-refresh-ad-galaxy]"
                );


            if (refreshAds) {

                event.preventDefault();

                await loadAdGalaxy();

                showToast(
                    "🔄 تم تحديث Ad Galaxy"
                );

                return;
            }


            /* -----------------------------------------
               Complete Ad Galaxy task
            ----------------------------------------- */

            const completeAd =
                event.target.closest(
                    "[data-complete-task]"
                );


            if (completeAd) {

                await completeTask(
                    completeAd.dataset.completeTask
                );

                return;
            }


            /* -----------------------------------------
               Economic actions
            ----------------------------------------- */

            const airdrop =
                event.target.closest(
                    "[data-economic-airdrop]"
                );


            if (airdrop) {

                await loadAirdropPreview();

                return;
            }


            const spend =
                event.target.closest(
                    "[data-economic-spend]"
                );


            if (spend) {

                showSpendModal();

                return;
            }


            /* -----------------------------------------
               Execute spend
            ----------------------------------------- */

            const executeSpendButton =
                event.target.closest(
                    "[data-execute-spend]"
                );


            if (executeSpendButton) {

                await executeSpend();

                return;
            }


            /* -----------------------------------------
               Master Hub action
            ----------------------------------------- */

            const hubAction =
                event.target.closest(
                    "[data-hub-action]"
                );


            if (hubAction) {

                const hubValue =
                    hubAction.dataset.hubAction;


                switch (hubValue) {

                    case "wallet":
                        await showWallet();
                        break;

                    case "referral":
                        await loadReferral();
                        showReferral();
                        break;

                    case "tasks":
                        scrollToTasks();
                        break;

                    case "economic":
                        await showEconomicDashboard();
                        break;

                    case "ai":
                        show3MigoAI();
                        break;

                    case "ads":
                        await showAdGalaxy();
                        break;

                    default:
                        showToast(
                            "الخدمة متاحة قريبًا"
                        );
                }

                return;
            }
        }
    );
}


/* =========================================================
   55. ECONOMIC BUTTON
========================================================= */

function setupEconomicButton() {

    const button =
        $("#economicDashboardBtn");


    if (!button) {
        return;
    }


    if (
        button.dataset.bound ===
        "true"
    ) {

        return;
    }


    button.dataset.bound =
        "true";


    button.addEventListener(
        "click",
        async event => {

            event.preventDefault();

            await showEconomicDashboard();
        }
    );
}


/* =========================================================
   56. KEYBOARD / ENTER
========================================================= */

function setupKeyboard() {

    const aiInput =
        $("#aiInput");


    if (aiInput) {

        aiInput.addEventListener(
            "keydown",
            async event => {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    await sendAIMessage();
                }
            }
        );
    }
}


/* =========================================================
   57. VISIBILITY SYNC
========================================================= */

function setupVisibilitySync() {

    document.addEventListener(
        "visibilitychange",
        async () => {

            if (
                document.visibilityState ===
                "visible"
            ) {

                /*
                   Re-sync from backend after
                   returning to the Mini App.
                */

                try {

                    await loadMiningStatus();

                } catch (error) {

                    console.warn(
                        "Visibility mining sync failed:",
                        error
                    );
                }
            }
        }
    );
}


/* =========================================================
   58. ESCAPE KEY
========================================================= */

function setupEscapeKey() {

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !== "Escape"
            ) {

                return;
            }


            $all(
                ".modal.active, .modal.show"
            )
            .forEach(
                closeModal
            );
        }
    );
}


/* =========================================================
   59. GLOBAL PUBLIC API
========================================================= */

window.ThreeMigo = {

    state,

    loadUser,

    loadEconomicProfile,

    loadMiningStatus,

    startMining,

    claimMining,

    loadTasks,

    completeTask,

    loadReferral,

    showReferral,

    copyReferral,

    shareReferral,

    showWallet,

    showEconomicDashboard,

    loadAirdropPreview,

    showAdGalaxy,

    show3MigoAI,

    showV4Hub,

    showProfile,

    dailyReward,

    executeSpend,

    formatNumber,

    formatTime,

    getMiningProgress
};


/* =========================================================
   60. LEGACY GLOBAL FUNCTIONS
========================================================= */

window.startMining =
    startMining;

window.claimMining =
    claimMining;

window.showReferral =
    showReferral;

window.showWallet =
    showWallet;

window.showProfile =
    showProfile;

window.show3MigoAI =
    show3MigoAI;

window.showV4Hub =
    showV4Hub;

window.dailyReward =
    dailyReward;


/* =========================================================
   61. INITIALIZATION
========================================================= */

async function initializeApp() {

    console.log(
        "3Migo Coin App V5.1 initializing..."
    );


    /* -------------------------------------
       Telegram user
    ------------------------------------- */

    getTelegramUser();


    /* -------------------------------------
       Initial UI
    ------------------------------------- */

    updateBalanceUI();

    updateEconomicUI();

    updateExperience();

    updateMiningUI();


    /* -------------------------------------
       Event systems
    ------------------------------------- */

    setupMiningButton();

    setupActions();

    setupEconomicButton();

    setupModals();

    setupKeyboard();

    setupVisibilitySync();

    setupEscapeKey();


    /* -------------------------------------
       Backend synchronization
    ------------------------------------- */

    await loadUser();

    await loadEconomicProfile();

    await loadMiningStatus();

    await loadReferral();

    await loadTasks();


    /* -------------------------------------
       Final UI sync
    ------------------------------------- */

    updateBalanceUI();

    updateEconomicUI();

    updateExperience();

    updateMiningUI();


    console.log(
        "3Migo Coin App V5.1 initialized successfully."
    );
}


/* =========================================================
   62. START APPLICATION
========================================================= */

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


/* =========================================================
   END — 3MIGO APP V5.1
========================================================= */
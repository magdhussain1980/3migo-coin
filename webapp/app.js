/* =========================================================
   3Migo Coin - Telegram Mini App
   Frontend Controller
   Version 4.0.0
   Economy Experience Layer

   IMPORTANT:
   - Frontend/UI layer only.
   - Existing API contracts preserved.
   - No fake revenue.
   - No fake market value.
   - No changes to economic_engine.py.
   - No changes to database.
   ========================================================= */

"use strict";


/* =========================================================
   TELEGRAM
   ========================================================= */

const tg = window.Telegram?.WebApp || null;

if (tg) {
    try {
        tg.ready();
        tg.expand();

        if (typeof tg.setHeaderColor === "function") {
            tg.setHeaderColor("#04142a");
        }

        if (typeof tg.setBackgroundColor === "function") {
            tg.setBackgroundColor("#031024");
        }
    } catch (error) {
        console.warn("Telegram UI unavailable:", error);
    }
}


/* =========================================================
   CONFIG
   ========================================================= */

const API_BASE = window.location.origin;

const BOT_USERNAME = "threemigosmart_bot";

const FALLBACK_TELEGRAM_ID = 1;

const MINING_CYCLE_HOURS = 12;

const MINING_CYCLE_SECONDS =
    MINING_CYCLE_HOURS * 60 * 60;


/* =========================================================
   STATE
   ========================================================= */

const state = {

    telegramUser: null,

    telegramId: null,

    username: "",

    /* =====================================================
       LEGACY WALLET
       ===================================================== */

    balance: 0,

    total: 0,

    today: 0,

    sessions: 0,


    /* =====================================================
       MINING
       ===================================================== */

    miningActive: false,

    miningRemaining: 0,

    miningReward: 10,

    miningTimer: null,


    /* =====================================================
       TASKS
       ===================================================== */

    tasks: [],

    loadingTasks: false,


    /* =====================================================
       REFERRAL
       ===================================================== */

    referral: null,


    /* =====================================================
       ECONOMIC LAYER
       ===================================================== */

    economic: {

        totalMined: 0,

        locked3m: 0,

        unlocked3m: 0,

        airdrop3m: 0,

        contributionScore: 0,

        trustScore: 100,

        loaded: false,

        loading: false

    },


    /* =====================================================
       V4 EXPERIENCE
       ===================================================== */

    experience: {

        level: 1,

        levelName: "Explorer",

        progress: 0,

        score: 0,

        nextScore: 100,

        source: "Frontend Experience Layer"

    },


    /* =====================================================
       AD GALAXY
       ===================================================== */

    adGalaxy: {

        available: 0,

        completed: 0,

        verified: 0,

        loading: false,

        connected: false,

        providerConnected: false

    },


    /* =====================================================
       AI UI
       ===================================================== */

    aiMessages: [],


    airdropPreview: null,

    loadingEconomic: false,

    loadingUser: false

};


/* =========================================================
   HELPERS
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}


function safeNumber(value, fallback = 0) {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatNumber(value, decimals = 2) {

    return safeNumber(value)
        .toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals
        });
}


function clamp(value, min, max) {

    return Math.min(
        max,
        Math.max(min, value)
    );
}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(message, duration = 3000) {

    const toast = $("toast");

    if (!toast) {
        console.log(message);
        return;
    }

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {

        toast.classList.remove("show");

    }, duration);
}


/* =========================================================
   TELEGRAM USER
   ========================================================= */

function getTelegramUser() {

    try {

        const user =
            tg?.initDataUnsafe?.user;

        if (user?.id) {
            return user;
        }

    } catch (error) {

        console.warn(
            "Telegram user unavailable:",
            error
        );
    }

    return {
        id: FALLBACK_TELEGRAM_ID,
        username: "demo"
    };
}


/* =========================================================
   API REQUEST
   ========================================================= */

async function apiRequest(endpoint, options = {}) {

    const url =
        `${API_BASE}${endpoint}`;

    const config = {

        method:
            options.method || "GET",

        headers: {

            "Content-Type":
                "application/json",

            ...(options.headers || {})

        }

    };


    if (
        options.body !== undefined &&
        options.body !== null
    ) {

        config.body =
            typeof options.body === "string"
                ? options.body
                : JSON.stringify(options.body);
    }


    const response =
        await fetch(url, config);


    let data = null;


    try {

        data =
            await response.json();

    } catch {

        data = null;
    }


    if (!response.ok) {

        let message =
            data?.detail ||
            data?.message ||
            data?.error ||
            `HTTP ${response.status}`;


        if (Array.isArray(data?.detail)) {

            message =
                data.detail
                    .map(item =>
                        item?.msg ||
                        JSON.stringify(item)
                    )
                    .join(", ");
        }


        throw new Error(message);
    }


    return data;
}


/* =========================================================
   REGISTER USER
   ========================================================= */

async function ensureUserRegistered() {

    const user =
        getTelegramUser();


    state.telegramUser =
        user;


    state.telegramId =
        user?.id ||
        FALLBACK_TELEGRAM_ID;


    state.username =
        user?.username ||
        "";


    try {

        const existing =
            await apiRequest(
                `/user/${state.telegramId}`
            );


        if (existing) {
            return existing;
        }

    } catch (error) {

        console.log(
            "User not found. Registering..."
        );
    }


    try {

        return await apiRequest(
            "/register",
            {

                method: "POST",

                body: {

                    telegram_id:
                        state.telegramId,

                    username:
                        state.username,

                    referral_code: ""

                }

            }
        );

    } catch (error) {

        console.warn(
            "Registration failed:",
            error
        );

        return null;
    }
}


/* =========================================================
   LEGACY BALANCE UI
   ========================================================= */

function updateBalanceUI() {

    const balance =
        $("balance");


    if (balance) {

        balance.innerHTML =
            `${formatNumber(state.balance)}
             <span>3M</span>`;
    }


    const total =
        $("total");


    if (total) {

        total.textContent =
            `${formatNumber(state.total)} 3M`;
    }


    const today =
        $("today");


    if (today) {

        today.textContent =
            `${formatNumber(state.today)} 3M`;
    }


    const sessions =
        $("sessions");


    if (sessions) {

        sessions.textContent =
            String(state.sessions);
    }
}


/* =========================================================
   LOAD USER
   ========================================================= */

async function loadUser() {

    if (!state.telegramId) {
        return null;
    }


    state.loadingUser = true;


    try {

        const user =
            await apiRequest(
                `/user/${state.telegramId}`
            );


        if (!user) {
            return null;
        }


        state.balance =
            safeNumber(
                user.balance_3m ??
                user.balance ??
                user.balance3m ??
                0
            );


        state.total =
            safeNumber(
                user.total_earned ??
                user.total ??
                user.total_3m ??
                0
            );


        state.today =
            safeNumber(
                user.today_earned ??
                user.today ??
                user.today_3m ??
                0
            );


        state.sessions =
            safeNumber(
                user.mining_sessions ??
                user.sessions ??
                0
            );


        updateBalanceUI();

        updateExperienceLevel();


        return user;

    } catch (error) {

        console.warn(
            "Unable to load user:",
            error
        );


        return null;

    } finally {

        state.loadingUser = false;
    }
}


/* =========================================================
   ECONOMIC PROFILE
   ========================================================= */

async function loadEconomicProfile() {

    if (!state.telegramId) {
        return null;
    }


    if (state.loadingEconomic) {
        return null;
    }


    state.loadingEconomic = true;


    try {

        const data =
            await apiRequest(
                `/economic/user/${state.telegramId}`
            );


        if (!data) {
            return null;
        }


        state.economic.totalMined =
            safeNumber(
                data.total_mined
            );


        state.economic.locked3m =
            safeNumber(
                data.locked_3m
            );


        state.economic.unlocked3m =
            safeNumber(
                data.unlocked_3m
            );


        state.economic.airdrop3m =
            safeNumber(
                data.airdrop_3m
            );


        state.economic.contributionScore =
            safeNumber(
                data.contribution_score
            );


        state.economic.trustScore =
            safeNumber(
                data.trust_score,
                100
            );


        state.economic.loaded =
            true;


        updateEconomicUI();

        updateExperienceLevel();


        return data;

    } catch (error) {

        console.warn(
            "Economic profile unavailable:",
            error
        );


        return null;

    } finally {

        state.loadingEconomic = false;
    }
}


/* =========================================================
   ECONOMIC UI
   ========================================================= */

function updateEconomicUI() {

    const map = {

        economicTotalMined:
            state.economic.totalMined,

        economicLocked:
            state.economic.locked3m,

        economicUnlocked:
            state.economic.unlocked3m,

        economicAirdrop:
            state.economic.airdrop3m,

        economicContribution:
            state.economic.contributionScore,

        economicTrust:
            state.economic.trustScore

    };


    Object.entries(map)
        .forEach(([id, value]) => {

            const element = $(id);

            if (!element) {
                return;
            }


            element.textContent =
                formatNumber(value);
        });
}


/* =========================================================
   V4 EXPERIENCE LEVEL
   =========================================================
   This is an EXPERIENCE/UI level only.
   It is NOT an official backend economic level.
   ========================================================= */

function updateExperienceLevel() {

    const activityScore =
        clamp(
            state.sessions * 5,
            0,
            100
        );


    const contributionScore =
        clamp(
            state.economic.contributionScore,
            0,
            100
        );


    const trustScore =
        clamp(
            state.economic.trustScore,
            0,
            100
        );


    const score =
        Math.round(
            activityScore * 0.30 +
            contributionScore * 0.40 +
            trustScore * 0.30
        );


    let level = 1;

    let levelName = "Explorer";

    if (score >= 80) {

        level = 4;
        levelName = "Builder";

    } else if (score >= 60) {

        level = 3;
        levelName = "Contributor";

    } else if (score >= 35) {

        level = 2;
        levelName = "Active";

    }


    const thresholds = {
        1: 35,
        2: 60,
        3: 80,
        4: 100
    };


    const previousThreshold =
        level === 1
            ? 0
            : thresholds[level - 1];


    const nextThreshold =
        thresholds[level];


    const progress =
        level >= 4
            ? 100
            : clamp(
                (
                    (score - previousThreshold) /
                    (nextThreshold - previousThreshold)
                ) * 100,
                0,
                100
            );


    state.experience = {

        level,

        levelName,

        progress,

        score,

        nextScore:
            nextThreshold,

        source:
            "Frontend Experience Layer"

    };


    updateExperienceUI();
}


function updateExperienceUI() {

    const level =
        $("v4Level");


    if (level) {

        level.textContent =
            `Lv.${state.experience.level} ${state.experience.levelName}`;
    }


    const score =
        $("v4ExperienceScore");


    if (score) {

        score.textContent =
            `${state.experience.score}/100`;
    }


    const progress =
        $("v4LevelProgress");


    if (progress) {

        progress.style.width =
            `${state.experience.progress}%`;
    }
}


/* =========================================================
   AD GALAXY DATA
   ========================================================= */

function analyzeAdGalaxy() {

    const tasks =
        Array.isArray(state.tasks)
            ? state.tasks
            : [];


    const adTasks =
        tasks.filter(task => {

            const type =
                String(
                    task?.task_type ||
                    task?.type ||
                    ""
                ).toLowerCase();


            const title =
                String(
                    task?.title ||
                    ""
                ).toLowerCase();


            const description =
                String(
                    task?.description ||
                    ""
                ).toLowerCase();


            return (
                type.includes("ad") ||
                type.includes("advert") ||
                title.includes("إعلان") ||
                title.includes("اعلان") ||
                title.includes("ad ") ||
                description.includes("إعلان") ||
                description.includes("اعلان") ||
                description.includes("advert")
            );

        });


    const available =
        adTasks.filter(
            task =>
                !(
                    Number(task.completed) === 1 ||
                    task.completed === true
                )
        ).length;


    const completed =
        adTasks.filter(
            task =>
                Number(task.completed) === 1 ||
                task.completed === true
        ).length;


    state.adGalaxy.available =
        available;

    state.adGalaxy.completed =
        completed;

    state.adGalaxy.connected =
        adTasks.length > 0;

    state.adGalaxy.providerConnected =
        false;


    return adTasks;
}


/* =========================================================
   AD GALAXY MODAL
   ========================================================= */

function showAdGalaxy() {

    const old =
        $("adGalaxyModal");


    if (old) {
        old.remove();
    }


    const adTasks =
        analyzeAdGalaxy();


    const available =
        state.adGalaxy.available;


    const completed =
        state.adGalaxy.completed;


    const total =
        adTasks.length;


    const progress =
        total > 0
            ? Math.round(
                (completed / total) * 100
            )
            : 0;


    const modal =
        document.createElement("div");


    modal.id =
        "adGalaxyModal";


    modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:6000;
        background:rgba(0,0,0,.82);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:14px;
        direction:rtl;
    `;


    modal.innerHTML = `

        <div style="
            width:100%;
            max-width:500px;
            max-height:94vh;
            overflow:auto;
            background:
                radial-gradient(
                    circle at top right,
                    rgba(39,132,255,.18),
                    transparent 35%
                ),
                #06162d;
            border:1px solid rgba(79,157,255,.28);
            border-radius:28px;
            color:#fff;
            box-shadow:0 30px 90px rgba(0,0,0,.6);
        ">

            <div style="
                padding:20px;
                border-bottom:1px solid rgba(255,255,255,.07);
                display:flex;
                justify-content:space-between;
                align-items:center;
            ">

                <div>

                    <div style="
                        font-size:23px;
                        font-weight:900;
                    ">
                        📢 Ad Galaxy
                    </div>

                    <div style="
                        color:#8197b0;
                        font-size:12px;
                        margin-top:5px;
                    ">
                        مركز الإعلانات والمساهمات
                    </div>

                </div>

                <button
                    id="closeAdGalaxy"
                    type="button"
                    style="
                        width:40px;
                        height:40px;
                        border:0;
                        border-radius:12px;
                        background:rgba(255,255,255,.06);
                        color:#9db0c7;
                        font-size:25px;
                    "
                >
                    ×
                </button>

            </div>


            <div style="padding:18px;">


                <!-- STATUS -->

                <div style="
                    padding:16px;
                    border-radius:20px;
                    background:
                        linear-gradient(
                            135deg,
                            #103963,
                            #09233f
                        );
                    border:1px solid rgba(65,158,255,.25);
                ">

                    <div style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                    ">

                        <div>

                            <div style="
                                color:#90a7c0;
                                font-size:12px;
                            ">
                                الإعلانات المتاحة
                            </div>

                            <strong style="
                                display:block;
                                font-size:30px;
                                margin-top:5px;
                            ">
                                ${
                                    total > 0
                                        ? available
                                        : "—"
                                }
                            </strong>

                        </div>


                        <div style="
                            text-align:left;
                        ">

                            <div style="
                                color:#90a7c0;
                                font-size:12px;
                            ">
                                مساهمتك
                            </div>

                            <strong style="
                                display:block;
                                margin-top:5px;
                                font-size:20px;
                            ">
                                ${
                                    formatNumber(
                                        state.economic
                                            .contributionScore
                                    )
                                }
                            </strong>

                        </div>

                    </div>


                    <div style="
                        margin-top:15px;
                        height:8px;
                        background:rgba(255,255,255,.08);
                        border-radius:20px;
                        overflow:hidden;
                    ">

                        <div style="
                            width:${progress}%;
                            height:100%;
                            background:#319bff;
                            border-radius:20px;
                            transition:width .4s ease;
                        "></div>

                    </div>


                    <div style="
                        margin-top:7px;
                        color:#7890aa;
                        font-size:10px;
                    ">
                        ${
                            total > 0
                                ? `${completed} مكتمل من ${total}`
                                : "لا توجد بيانات إعلانات موصولة حالياً"
                        }
                    </div>

                </div>


                <!-- LEVEL -->

                <div style="
                    margin-top:12px;
                    padding:15px;
                    background:#0a2340;
                    border-radius:18px;
                ">

                    <div style="
                        display:flex;
                        justify-content:space-between;
                    ">

                        <div>

                            <small style="
                                color:#7f95ad;
                            ">
                                مستوى التجربة
                            </small>

                            <strong
                                id="v4Level"
                                style="
                                    display:block;
                                    margin-top:5px;
                                    font-size:18px;
                                "
                            >
                                Lv.${state.experience.level}
                                ${escapeHTML(
                                    state.experience.levelName
                                )}
                            </strong>

                        </div>


                        <strong
                            id="v4ExperienceScore"
                            style="
                                color:#52aaff;
                                font-size:16px;
                            "
                        >
                            ${state.experience.score}/100
                        </strong>

                    </div>


                    <div style="
                        margin-top:10px;
                        height:6px;
                        background:rgba(255,255,255,.08);
                        border-radius:10px;
                        overflow:hidden;
                    ">

                        <div
                            id="v4LevelProgress"
                            style="
                                width:${state.experience.progress}%;
                                height:100%;
                                background:#52aaff;
                            "
                        ></div>

                    </div>

                </div>


                <!-- AD TASKS -->

                <div style="
                    margin-top:18px;
                ">

                    <div style="
                        font-weight:800;
                        margin-bottom:9px;
                    ">
                        🌌 Galaxy Feed
                    </div>


                    ${
                        adTasks.length
                            ? adTasks.map(
                                renderAdGalaxyItem
                            ).join("")
                            : `
                                <div style="
                                    padding:18px;
                                    border-radius:16px;
                                    background:#0a2340;
                                    color:#8095ad;
                                    font-size:12px;
                                    text-align:center;
                                    line-height:1.8;
                                ">
                                    لا توجد حملات إعلانية فعلية
                                    موصولة بالمنصة حالياً.
                                </div>
                            `
                    }

                </div>


                <!-- IMPORTANT NOTICE -->

                <div style="
                    margin-top:15px;
                    padding:15px;
                    border-radius:17px;
                    background:rgba(255,181,71,.07);
                    border:1px solid rgba(255,181,71,.18);
                    color:#b7a88f;
                    font-size:11px;
                    line-height:1.8;
                ">
                    ⚠️ <strong style="color:#e4c995;">
                    تنبيه اقتصادي
                    </strong><br>
                    هذه الواجهة لا تعتبر مشاهدة الإعلان إيراداً
                    بحد ذاتها. الإعلانات الحقيقية تحتاج إلى
                    مزود إعلانات أو حملات فعلية وربط تحقق موثق.
                    لن يتم عرض إيراد أو مكافأة اقتصادية حقيقية
                    قبل وصول البيانات من النظام الخلفي.
                </div>


                <button
                    id="adGalaxyRefresh"
                    type="button"
                    style="
                        width:100%;
                        margin-top:12px;
                        padding:14px;
                        border:0;
                        border-radius:15px;
                        background:#12365d;
                        color:#fff;
                        font-weight:800;
                    "
                >
                    🔄 تحديث بيانات الإعلانات
                </button>

            </div>

        </div>
    `;


    document.body.appendChild(modal);


    $("closeAdGalaxy")
        ?.addEventListener(
            "click",
            () => modal.remove()
        );


    $("adGalaxyRefresh")
        ?.addEventListener(
            "click",
            async () => {

                await loadTasks();

                updateExperienceLevel();

                modal.remove();

                showAdGalaxy();

            }
        );


    modal.addEventListener(
        "click",
        event => {

            if (event.target === modal) {
                modal.remove();
            }

        }
    );
}


function renderAdGalaxyItem(task) {

    const id =
        safeNumber(task.id);


    const title =
        escapeHTML(
            task.title ||
            "حملة إعلانية"
        );


    const description =
        escapeHTML(
            task.description ||
            "حملة غير موصوفة"
        );


    const reward =
        safeNumber(
            task.reward_3m ??
            task.reward
        );


    const completed =
        Number(task.completed) === 1 ||
        task.completed === true;


    return `

        <div style="
            background:#0a2340;
            border-radius:17px;
            padding:14px;
            margin-bottom:9px;
            border:1px solid rgba(255,255,255,.04);
        ">

            <div style="
                display:flex;
                justify-content:space-between;
                gap:10px;
            ">

                <div style="min-width:0;">

                    <strong style="
                        display:block;
                        font-size:13px;
                    ">
                        ${title}
                    </strong>

                    <div style="
                        color:#7188a2;
                        font-size:10px;
                        margin-top:5px;
                        line-height:1.6;
                    ">
                        ${description}
                    </div>

                </div>


                <div style="
                    white-space:nowrap;
                    color:#52aaff;
                    font-weight:800;
                    font-size:12px;
                ">
                    +${formatNumber(reward)} 3M
                </div>

            </div>


            <button
                type="button"
                class="v4-ad-task-button"
                data-complete-task="${id}"
                ${completed ? "disabled" : ""}
                style="
                    width:100%;
                    margin-top:11px;
                    padding:10px;
                    border:0;
                    border-radius:11px;
                    background:${
                        completed
                            ? "#18304a"
                            : "#168cff"
                    };
                    color:#fff;
                    font-weight:700;
                "
            >
                ${
                    completed
                        ? "✓ مكتملة"
                        : "فتح / إنجاز"
                }
            </button>

        </div>
    `;
}


/* =========================================================
   ECONOMIC DASHBOARD
   ========================================================= */

function showEconomicDashboard() {

    const old =
        $("economicModal");


    if (old) {
        old.remove();
    }


    const e =
        state.economic;


    const modal =
        document.createElement("div");


    modal.id =
        "economicModal";


    modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:4000;
        background:rgba(0,0,0,.78);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:18px;
        direction:rtl;
    `;


    modal.innerHTML = `

        <div style="
            width:100%;
            max-width:460px;
            max-height:90vh;
            overflow:auto;
            background:#071a34;
            border:1px solid rgba(91,140,190,.28);
            border-radius:24px;
            padding:20px;
            color:#fff;
            box-shadow:0 20px 60px rgba(0,0,0,.4);
        ">

            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                margin-bottom:18px;
            ">

                <div>

                    <div style="
                        font-size:19px;
                        font-weight:800;
                    ">
                        🌐 مركز اقتصاد 3Migo
                    </div>

                    <div style="
                        color:#8095ad;
                        font-size:12px;
                        margin-top:4px;
                    ">
                        بيانات Economic Engine الحالية
                    </div>

                </div>

                <button
                    id="closeEconomic"
                    type="button"
                    style="
                        background:transparent;
                        color:#9aabc0;
                        border:0;
                        font-size:26px;
                    "
                >
                    ×
                </button>

            </div>


            <div style="
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:10px;
            ">

                ${economicCard(
                    "إجمالي التعدين",
                    "economicTotalMined",
                    e.totalMined,
                    "3M"
                )}

                ${economicCard(
                    "مقفل 🔒",
                    "economicLocked",
                    e.locked3m,
                    "3M"
                )}

                ${economicCard(
                    "متاح",
                    "economicUnlocked",
                    e.unlocked3m,
                    "3M"
                )}

                ${economicCard(
                    "Airdrop 🎁",
                    "economicAirdrop",
                    e.airdrop3m,
                    "3M"
                )}

                ${economicCard(
                    "المساهمة ⭐",
                    "economicContribution",
                    e.contributionScore,
                    "Score"
                )}

                ${economicCard(
                    "الثقة 🛡️",
                    "economicTrust",
                    e.trustScore,
                    "/ 100"
                )}

            </div>


            <div style="
                margin-top:14px;
                background:rgba(22,140,255,.07);
                border:1px solid rgba(22,140,255,.16);
                border-radius:15px;
                padding:13px;
                font-size:12px;
                color:#a9bad0;
                line-height:1.7;
            ">
                💡 هذه الأرقام مأخوذة من Economic API.
                الواجهة لا تضيف إليها إيرادات أو قيمة سوقية
                من عندها.
            </div>


            <div style="
                margin-top:14px;
                padding:14px;
                border-radius:15px;
                background:#0b2443;
                color:#93a8bf;
                font-size:11px;
                line-height:1.7;
            ">
                🔗 مسار الاقتصاد المستقبلي:
                <br>
                الإعلان/المساهمة → حدث موثق → Revenue Ledger
                → Economic Allocation → Reward Rules
            </div>


            <div style="
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:9px;
                margin-top:14px;
            ">

                <button
                    id="economicAirdropBtn"
                    type="button"
                    style="
                        padding:13px;
                        border:0;
                        border-radius:13px;
                        background:#102f52;
                        color:#fff;
                        font-weight:700;
                    "
                >
                    🎁 Airdrop
                </button>


                <button
                    id="economicSpendBtn"
                    type="button"
                    style="
                        padding:13px;
                        border:0;
                        border-radius:13px;
                        background:#168cff;
                        color:#fff;
                        font-weight:700;
                    "
                >
                    💳 استخدام 3M
                </button>

            </div>

        </div>
    `;


    document.body.appendChild(modal);


    $("closeEconomic")
        ?.addEventListener(
            "click",
            () => modal.remove()
        );


    $("economicAirdropBtn")
        ?.addEventListener(
            "click",
            showAirdropPreview
        );


    $("economicSpendBtn")
        ?.addEventListener(
            "click",
            showSpendDialog
        );


    modal.addEventListener(
        "click",
        event => {

            if (event.target === modal) {
                modal.remove();
            }

        }
    );
}


function economicCard(
    title,
    id,
    value,
    suffix
) {

    return `

        <div style="
            background:rgba(255,255,255,.045);
            border-radius:15px;
            padding:14px;
        ">

            <small style="
                color:#7f94ad;
            ">
                ${title}
            </small>

            <strong
                id="${id}"
                style="
                    display:block;
                    margin-top:7px;
                    font-size:20px;
                "
            >
                ${formatNumber(value)}
            </strong>

            <span style="
                color:#6e849e;
                font-size:11px;
            ">
                ${suffix}
            </span>

        </div>

    `;
}


/* =========================================================
   AIRDROP
   ========================================================= */

async function loadAirdropPreview() {

    if (!state.telegramId) {
        return null;
    }


    const data =
        await apiRequest(
            `/economic/airdrop/${state.telegramId}`
        );


    state.airdropPreview =
        data?.result ||
        data;


    return state.airdropPreview;
}


async function showAirdropPreview() {

    try {

        showToast(
            "جاري حساب تقدير Airdrop..."
        );


        const data =
            await loadAirdropPreview();


        if (!data) {

            showToast(
                "تعذر حساب Airdrop."
            );

            return;
        }


        const amount =
            safeNumber(
                data.estimated_airdrop_3m
            );


        const contribution =
            safeNumber(
                data.user_contribution_score
            );


        const totalContribution =
            safeNumber(
                data.total_contribution_score
            );


        showToast(
            `تقدير Airdrop: ${formatNumber(amount)} 3M | مساهمتك: ${formatNumber(contribution)} من ${formatNumber(totalContribution)}`,
            6000
        );


    } catch (error) {

        showToast(
            `تعذر حساب Airdrop: ${error.message}`
        );
    }
}


/* =========================================================
   SPEND
   ========================================================= */

function showSpendDialog() {

    const old =
        $("spendModal");


    if (old) {
        old.remove();
    }


    const available =
        safeNumber(
            state.economic.unlocked3m
        );


    const modal =
        document.createElement("div");


    modal.id =
        "spendModal";


    modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:5000;
        background:rgba(0,0,0,.78);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:18px;
        direction:rtl;
    `;


    modal.innerHTML = `

        <div style="
            width:100%;
            max-width:420px;
            background:#071a34;
            border:1px solid rgba(91,140,190,.28);
            border-radius:22px;
            padding:20px;
            color:#fff;
        ">

            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                margin-bottom:18px;
            ">

                <strong style="font-size:18px;">
                    💳 استخدام 3M
                </strong>

                <button
                    id="closeSpend"
                    type="button"
                    style="
                        background:transparent;
                        border:0;
                        color:#9aabc0;
                        font-size:25px;
                    "
                >
                    ×
                </button>

            </div>


            <div style="
                background:rgba(255,255,255,.04);
                padding:13px;
                border-radius:13px;
                margin-bottom:14px;
                color:#9fb1c7;
                font-size:13px;
            ">
                الرصيد الاقتصادي المتاح:
                <strong style="color:#fff;">
                    ${formatNumber(available)} 3M
                </strong>
            </div>


            <input
                id="spendService"
                type="text"
                value="3Migo AI Service"
                maxlength="200"
                placeholder="اسم الخدمة"
                style="
                    width:100%;
                    box-sizing:border-box;
                    padding:12px;
                    border-radius:12px;
                    border:1px solid rgba(255,255,255,.1);
                    background:#0b2443;
                    color:#fff;
                    margin-bottom:12px;
                    outline:none;
                "
            />


            <input
                id="spendAmount"
                type="number"
                min="0.01"
                step="0.01"
                max="${available}"
                value="1"
                style="
                    width:100%;
                    box-sizing:border-box;
                    padding:12px;
                    border-radius:12px;
                    border:1px solid rgba(255,255,255,.1);
                    background:#0b2443;
                    color:#fff;
                    margin-bottom:14px;
                    outline:none;
                "
            />


            <button
                id="confirmSpend"
                type="button"
                style="
                    width:100%;
                    padding:13px;
                    border:0;
                    border-radius:13px;
                    background:#168cff;
                    color:#fff;
                    font-weight:800;
                "
            >
                تأكيد استخدام 3M
            </button>

        </div>
    `;


    document.body.appendChild(modal);


    $("closeSpend")
        ?.addEventListener(
            "click",
            () => modal.remove()
        );


    $("confirmSpend")
        ?.addEventListener(
            "click",
            () => executeSpend(modal)
        );


    modal.addEventListener(
        "click",
        event => {

            if (event.target === modal) {
                modal.remove();
            }

        }
    );
}


async function executeSpend(modal) {

    const service =
        String(
            $("spendService")?.value || ""
        ).trim();


    const amount =
        safeNumber(
            $("spendAmount")?.value
        );


    const available =
        safeNumber(
            state.economic.unlocked3m
        );


    const button =
        $("confirmSpend");


    if (!service) {

        showToast(
            "أدخل اسم الخدمة."
        );

        return;
    }


    if (amount <= 0) {

        showToast(
            "أدخل مبلغاً صحيحاً."
        );

        return;
    }


    if (amount > available) {

        showToast(
            `الرصيد الاقتصادي المتاح فقط ${formatNumber(available)} 3M`
        );

        return;
    }


    if (button) {

        button.disabled = true;

        button.textContent =
            "جاري التنفيذ...";
    }


    try {

        const reference =
            `miniapp_spend_${Date.now()}`;


        const data =
            await apiRequest(
                `/economic/spend/${state.telegramId}`,
                {

                    method: "POST",

                    body: {

                        service,

                        amount_3m:
                            amount,

                        reference

                    }

                }
            );


        const result =
            data?.result ||
            data;


        if (result?.success === false) {

            throw new Error(
                result?.message ||
                "فشلت العملية."
            );
        }


        await loadEconomicProfile();


        modal?.remove();


        showToast(
            `تم استخدام ${formatNumber(amount)} 3M بنجاح ✅`,
            5000
        );


    } catch (error) {

        console.error(
            "Spend error:",
            error
        );


        showToast(
            `تعذر استخدام 3M: ${error.message}`
        );


        if (button) {

            button.disabled = false;

            button.textContent =
                "تأكيد استخدام 3M";
        }
    }
}


/* =========================================================
   MINING
   ========================================================= */

function formatTime(seconds) {

    seconds =
        Math.max(
            0,
            Math.floor(
                safeNumber(seconds)
            )
        );


    const hours =
        Math.floor(seconds / 3600);


    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );


    const secs =
        seconds % 60;


    return [

        String(hours).padStart(2, "0"),

        String(minutes).padStart(2, "0"),

        String(secs).padStart(2, "0")

    ].join(":");
}


function updateMiningUI() {

    const stateElement =
        $("miningState");


    const button =
        $("mineBtn");


    if (!state.miningActive) {

        if (stateElement) {
            stateElement.textContent = "جاهز";
        }


        if (button) {

            button.disabled = false;


            const strong =
                button.querySelector("strong");


            const small =
                button.querySelector("small");


            if (strong) {
                strong.textContent =
                    "ابدأ التعدين";
            }


            if (small) {
                small.textContent =
                    "ابدأ جلسة 12 ساعة";
            }
        }


        return;
    }


    if (stateElement) {

        stateElement.textContent =
            formatTime(
                state.miningRemaining
            );
    }


    if (button) {

        button.disabled = true;


        const strong =
            button.querySelector("strong");


        const small =
            button.querySelector("small");


        if (strong) {
            strong.textContent =
                "التعدين نشط";
        }


        if (small) {
            small.textContent =
                "انتظر حتى انتهاء الدورة";
        }
    }
}


async function loadMiningStatus() {

    if (!state.telegramId) {
        return;
    }


    try {

        const data =
            await apiRequest(
                `/mining/${state.telegramId}/status`
            );


        state.miningActive =
            Boolean(
                data?.active ??
                data?.is_active
            );


        state.miningRemaining =
            safeNumber(
                data?.remaining_seconds ??
                data?.remaining ??
                data?.seconds_remaining
            );


        state.miningReward =
            safeNumber(
                data?.reward_3m ??
                data?.reward ??
                10
            );


        const rate =
            $("rate");


        if (rate) {
            rate.textContent =
                `+${state.miningReward}`;
        }


        updateMiningUI();

        startMiningCountdown();


    } catch (error) {

        console.warn(
            "Mining status unavailable:",
            error
        );
    }
}


function startMiningCountdown() {

    clearInterval(
        state.miningTimer
    );


    if (!state.miningActive) {

        updateMiningUI();

        return;
    }


    updateMiningUI();


    state.miningTimer =
        setInterval(() => {

            if (state.miningRemaining > 0) {

                state.miningRemaining--;

                updateMiningUI();

                return;
            }


            clearInterval(
                state.miningTimer
            );


            state.miningActive = false;

            state.miningRemaining = 0;


            updateMiningUI();


            showToast(
                "اكتملت دورة التعدين. يمكنك استلام المكافأة."
            );

        }, 1000);
}


async function startMining() {

    if (state.miningActive) {

        showToast(
            `التعدين نشط — ${formatTime(state.miningRemaining)}`
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
                10
            );


        updateMiningUI();

        startMiningCountdown();


        showToast(
            "تم بدء جلسة التعدين لمدة 12 ساعة ⛏️"
        );


    } catch (error) {

        showToast(
            `تعذر بدء التعدين: ${error.message}`
        );
    }
}


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
                state.miningReward
            );


        state.miningActive = false;

        state.miningRemaining = 0;


        state.balance += reward;

        state.total += reward;

        state.today += reward;

        state.sessions += 1;


        updateBalanceUI();

        updateMiningUI();

        updateExperienceLevel();


        showToast(
            `تم استلام ${formatNumber(reward)} 3M بنجاح 🎉`
        );


        await loadEconomicProfile();


    } catch (error) {

        showToast(
            `تعذر استلام المكافأة: ${error.message}`
        );
    }
}


function handleMiningButton() {

    if (state.miningActive) {

        if (state.miningRemaining <= 0) {

            claimMining();

        } else {

            showToast(
                `التعدين مستمر — ${formatTime(state.miningRemaining)}`
            );
        }


        return;
    }


    startMining();
}


/* =========================================================
   TASKS
   ========================================================= */

function renderTasksLoading() {

    const container =
        $("tasksContainer");


    if (!container) {
        return;
    }


    container.innerHTML = `
        <div class="task-loading">
            ⏳ جاري تحميل المهام...
        </div>
    `;
}


function renderTasksError(message) {

    const container =
        $("tasksContainer");


    if (!container) {
        return;
    }


    container.innerHTML = `
        <div class="task-error">
            ⚠️ ${escapeHTML(message)}
        </div>
    `;
}


function renderTasks() {

    const container =
        $("tasksContainer");


    if (!container) {
        return;
    }


    if (
        !Array.isArray(state.tasks) ||
        state.tasks.length === 0
    ) {

        container.innerHTML = `
            <div class="task-loading">
                لا توجد مهام متاحة حالياً.
            </div>
        `;


        analyzeAdGalaxy();

        return;
    }


    container.innerHTML =
        state.tasks.map(task => {

            const id =
                safeNumber(task.id);


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
                Number(task.completed) === 1 ||
                task.completed === true;


            return `

                <div
                    class="task-card"
                    data-task-id="${id}"
                >

                    <div class="task-card-content">

                        <div class="task-card-title">
                            ${title}
                        </div>

                        <div class="task-card-description">
                            ${description}
                        </div>

                        <div class="task-card-reward">
                            +${formatNumber(reward)} 3M
                        </div>

                    </div>


                    <button
                        type="button"
                        class="task-button ${completed ? "completed" : ""}"
                        data-complete-task="${id}"
                        ${completed ? "disabled" : ""}
                    >
                        ${completed ? "✓ مكتملة" : "إنجاز"}
                    </button>

                </div>

            `;

        }).join("");


    analyzeAdGalaxy();

    updateExperienceLevel();
}


async function loadTasks() {

    if (!state.telegramId) {

        renderTasksError(
            "لم يتم التعرف على المستخدم."
        );

        return;
    }


    if (state.loadingTasks) {
        return;
    }


    state.loadingTasks = true;


    renderTasksLoading();


    try {

        const data =
            await apiRequest(
                `/tasks/${state.telegramId}`
            );


        if (Array.isArray(data)) {

            state.tasks = data;

        } else if (
            Array.isArray(data?.tasks)
        ) {

            state.tasks =
                data.tasks;

        } else {

            state.tasks = [];
        }


        renderTasks();


    } catch (error) {

        console.error(
            "Tasks error:",
            error
        );


        renderTasksError(
            "تعذر تحميل المهام. حاول مرة أخرى."
        );


    } finally {

        state.loadingTasks = false;
    }
}


async function completeTask(taskId) {

    if (!taskId) {
        return;
    }


    const task =
        state.tasks.find(
            item =>
                Number(item.id) ===
                Number(taskId)
        );


    if (!task) {

        showToast(
            "المهمة غير موجودة."
        );

        return;
    }


    if (
        Number(task.completed) === 1 ||
        task.completed === true
    ) {

        showToast(
            "هذه المهمة مكتملة بالفعل."
        );

        return;
    }


    const button =
        document.querySelector(
            `[data-complete-task="${taskId}"]`
        );


    if (button) {

        button.disabled = true;

        button.textContent =
            "جاري التنفيذ...";
    }


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
                task.reward_3m
            );


        task.completed = 1;


        state.balance += reward;

        state.total += reward;

        state.today += reward;


        updateBalanceUI();

        renderTasks();

        updateExperienceLevel();


        await loadEconomicProfile();


        showToast(
            `تم إنجاز المهمة وإضافة ${formatNumber(reward)} 3M 🎉`
        );


    } catch (error) {

        console.error(
            "Complete task error:",
            error
        );


        if (button) {

            button.disabled = false;

            button.textContent =
                "إنجاز";
        }


        showToast(
            `تعذر إكمال المهمة: ${error.message}`
        );
    }
}


function setupTaskEvents() {

    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-complete-task]"
                );


            if (!button) {
                return;
            }


            const taskId =
                button.getAttribute(
                    "data-complete-task"
                );


            completeTask(taskId);

        }
    );
}


function scrollToTasks() {

    const section =
        $("tasksSection");


    if (!section) {
        return;
    }


    section.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });


    setTimeout(
        loadTasks,
        150
    );
}


/* =========================================================
   DAILY
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


        const reward =
            safeNumber(
                data?.reward_3m ??
                data?.reward ??
                50
            );


        state.balance += reward;

        state.total += reward;

        state.today += reward;


        updateBalanceUI();

        await loadEconomicProfile();


        showToast(
            `تم استلام المكافأة اليومية: ${formatNumber(reward)} 3M 🎁`
        );


    } catch (error) {

        showToast(
            `تعذر استلام المكافأة اليومية: ${error.message}`
        );
    }
}


/* =========================================================
   REFERRAL
   ========================================================= */

async function loadReferral() {

    try {

        const data =
            await apiRequest(
                `/referral/${state.telegramId}`
            );


        state.referral =
            data;


        return data;


    } catch (error) {

        console.error(
            "Referral error:",
            error
        );


        showToast(
            "تعذر تحميل بيانات الإحالة."
        );


        return null;
    }
}


function showReferralModal(data) {

    if (!data) {
        return;
    }


    const code =
        data.referral_code ||
        `3M${state.telegramId}`;


    const referralLink =
        data.referral_link ||
        `https://t.me/${BOT_USERNAME}?start=ref_${code}`;


    const old =
        $("referralModal");


    if (old) {
        old.remove();
    }


    const modal =
        document.createElement("div");


    modal.id =
        "referralModal";


    modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:3000;
        background:rgba(0,0,0,.72);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
    `;


    modal.innerHTML = `

        <div style="
            width:100%;
            max-width:430px;
            background:#071a34;
            border:1px solid rgba(91,140,190,.25);
            border-radius:22px;
            padding:20px;
            color:#fff;
            direction:rtl;
        ">

            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                margin-bottom:18px;
            ">

                <strong style="font-size:18px;">
                    👥 الإحالات
                </strong>

                <button
                    id="closeReferral"
                    type="button"
                    style="
                        background:transparent;
                        color:#91a4bd;
                        border:0;
                        font-size:24px;
                    "
                >
                    ×
                </button>

            </div>


            <div style="
                background:rgba(255,255,255,.04);
                border-radius:15px;
                padding:15px;
                margin-bottom:12px;
            ">

                <small style="
                    color:#8195ad;
                    display:block;
                    margin-bottom:7px;
                ">
                    كود الإحالة
                </small>

                <strong style="
                    color:#55aaff;
                    font-size:20px;
                ">
                    ${escapeHTML(code)}
                </strong>

            </div>


            <div style="
                background:rgba(255,255,255,.04);
                border-radius:15px;
                padding:12px;
                margin-bottom:12px;
                word-break:break-all;
                direction:ltr;
                text-align:left;
                font-size:11px;
                color:#9fb1c7;
            ">
                ${escapeHTML(referralLink)}
            </div>


            <div style="
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:9px;
            ">

                <button
                    id="copyReferral"
                    type="button"
                    style="
                        padding:12px;
                        border:0;
                        border-radius:12px;
                        background:#168cff;
                        color:#fff;
                        font-weight:bold;
                    "
                >
                    📋 نسخ الرابط
                </button>


                <button
                    id="shareReferral"
                    type="button"
                    style="
                        padding:12px;
                        border:0;
                        border-radius:12px;
                        background:#102c4d;
                        color:#fff;
                        font-weight:bold;
                    "
                >
                    📤 مشاركة
                </button>

            </div>


            <div style="
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:9px;
                margin-top:12px;
            ">

                <div style="
                    background:rgba(255,255,255,.04);
                    padding:12px;
                    border-radius:12px;
                    text-align:center;
                ">

                    <small style="
                        display:block;
                        color:#7187a2;
                        margin-bottom:5px;
                    ">
                        عدد الإحالات
                    </small>

                    <strong>
                        ${formatNumber(data.referral_count)}
                    </strong>

                </div>


                <div style="
                    background:rgba(255,255,255,.04);
                    padding:12px;
                    border-radius:12px;
                    text-align:center;
                ">

                    <small style="
                        display:block;
                        color:#7187a2;
                        margin-bottom:5px;
                    ">
                        مكافآت الإحالة
                    </small>

                    <strong>
                        ${formatNumber(data.referral_rewards)}
                        3M
                    </strong>

                </div>

            </div>

        </div>
    `;


    document.body.appendChild(modal);


    $("closeReferral")
        ?.addEventListener(
            "click",
            () => modal.remove()
        );


    $("copyReferral")
        ?.addEventListener(
            "click",
            async () => {

                try {

                    await navigator.clipboard.writeText(
                        referralLink
                    );


                    showToast(
                        "تم نسخ رابط الإحالة."
                    );


                } catch {

                    showToast(
                        "تعذر نسخ الرابط."
                    );
                }
            }
        );


    $("shareReferral")
        ?.addEventListener(
            "click",
            () => {

                const shareUrl =
                    `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("انضم إلى 3Migo وابدأ جمع 3M 🚀")}`;


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
                        "_blank"
                    );
                }
            }
        );


    modal.addEventListener(
        "click",
        event => {

            if (event.target === modal) {
                modal.remove();
            }

        }
    );
}


async function showReferral() {

    const data =
        await loadReferral();


    if (data) {
        showReferralModal(data);
    }
}


/* =========================================================
   WALLET V4
   ========================================================= */

async function showWallet() {

    const old =
        $("walletModal");


    if (old) {
        old.remove();
    }


    await Promise.allSettled([

        loadUser(),

        loadEconomicProfile()

    ]);


    let transactions = [];


    try {

        const response =
            await apiRequest(
                `/transactions/${state.telegramId}`
            );


        transactions =
            Array.isArray(response)
                ? response
                : response?.transactions ||
                  [];

    } catch (error) {

        console.warn(
            "Transactions unavailable:",
            error
        );
    }


    const modal =
        document.createElement("div");


    modal.id =
        "walletModal";


    modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:4500;
        background:rgba(0,0,0,.80);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:18px;
        direction:rtl;
    `;


    const available =
        safeNumber(
            state.economic.unlocked3m
        );


    const locked =
        safeNumber(
            state.economic.locked3m
        );


    const totalMined =
        safeNumber(
            state.economic.totalMined
        );


    const airdrop =
        safeNumber(
            state.economic.airdrop3m
        );


    const contribution =
        safeNumber(
            state.economic.contributionScore
        );


    const trust =
        safeNumber(
            state.economic.trustScore
        );


    modal.innerHTML = `

        <div style="
            width:100%;
            max-width:490px;
            max-height:92vh;
            overflow:auto;
            background:
                radial-gradient(
                    circle at top right,
                    rgba(25,121,255,.13),
                    transparent 35%
                ),
                #061a34;
            border:1px solid rgba(91,140,190,.28);
            border-radius:27px;
            color:#fff;
            box-shadow:0 25px 80px rgba(0,0,0,.55);
        ">


            <div style="
                padding:20px;
                border-bottom:1px solid rgba(255,255,255,.07);
                display:flex;
                justify-content:space-between;
                align-items:center;
            ">

                <div>

                    <div style="
                        font-size:23px;
                        font-weight:900;
                    ">
                        💎 Wallet
                    </div>

                    <div style="
                        color:#8296ae;
                        font-size:11px;
                        margin-top:4px;
                    ">
                        3Migo Economy Experience
                    </div>

                </div>


                <button
                    id="closeWallet"
                    type="button"
                    style="
                        width:42px;
                        height:42px;
                        border:0;
                        border-radius:13px;
                        background:rgba(255,255,255,.06);
                        color:#9eb1c8;
                        font-size:25px;
                    "
                >
                    ×
                </button>

            </div>


            <!-- AVAILABLE -->

            <div style="
                margin:18px;
                padding:22px;
                border-radius:24px;
                background:
                    linear-gradient(
                        145deg,
                        #123d69,
                        #09294d
                    );
                border:1px solid rgba(61,158,255,.28);
                text-align:center;
            ">

                <div style="
                    color:#9fb3ca;
                    font-size:12px;
                ">
                    Available
                </div>

                <div style="
                    margin-top:7px;
                    font-size:42px;
                    font-weight:900;
                ">
                    ${formatNumber(available)}
                </div>

                <div style="
                    color:#4ca5ff;
                    font-size:18px;
                    font-weight:800;
                ">
                    3M
                </div>

            </div>


            <!-- CORE BALANCES -->

            <div style="
                padding:0 18px;
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:10px;
            ">

                ${walletMetric(
                    "🔒 Locked",
                    locked,
                    "3M"
                )}

                ${walletMetric(
                    "⛏️ Total Mined",
                    totalMined,
                    "3M"
                )}

                ${walletMetric(
                    "🎁 Airdrop",
                    airdrop,
                    "3M"
                )}

                ${walletMetric(
                    "⭐ Contribution",
                    contribution,
                    "Score"
                )}

                ${walletMetric(
                    "🛡️ Trust",
                    trust,
                    "/ 100"
                )}

                ${walletMetric(
                    "🏆 Level",
                    `Lv.${state.experience.level}`,
                    state.experience.levelName
                )}

            </div>


            <!-- MAIN BALANCE NOTE -->

            <div style="
                margin:14px 18px 0;
                padding:13px;
                border-radius:15px;
                background:#0a2340;
                color:#8ea4bd;
                font-size:11px;
                line-height:1.7;
            ">
                الرصيد الرئيسي:
                <strong style="color:#dce8f4;">
                    ${formatNumber(state.balance)} 3M
                </strong>
                <br>
                يتم عرض الرصيد الرئيسي منفصلاً عن الرصيد الاقتصادي
                حتى لا تختلط طبقات النظام.
            </div>


            <!-- ACTIONS -->

            <div style="
                padding:0 18px;
                margin-top:13px;
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:10px;
            ">

                <button
                    id="walletEconomicBtn"
                    type="button"
                    style="
                        padding:14px;
                        border:0;
                        border-radius:14px;
                        background:#168cff;
                        color:#fff;
                        font-weight:800;
                    "
                >
                    🌐 الاقتصاد
                </button>


                <button
                    id="walletSpendBtn"
                    type="button"
                    style="
                        padding:14px;
                        border:0;
                        border-radius:14px;
                        background:#102f52;
                        color:#fff;
                        font-weight:800;
                    "
                >
                    💳 استخدام 3M
                </button>

            </div>


            <!-- TRANSACTIONS -->

            <div style="
                margin:18px;
                padding-bottom:18px;
            ">

                <div style="
                    color:#a9bad0;
                    font-size:14px;
                    font-weight:800;
                    margin-bottom:10px;
                ">
                    📋 آخر العمليات
                </div>


                ${
                    transactions.length
                        ? transactions
                            .slice(0, 10)
                            .map(renderTransaction)
                            .join("")
                        : `
                            <div style="
                                background:#0c2747;
                                border-radius:14px;
                                padding:15px;
                                color:#7389a3;
                                text-align:center;
                                font-size:12px;
                            ">
                                لا توجد عمليات مسجلة حالياً.
                            </div>
                        `
                }

            </div>

        </div>
    `;


    document.body.appendChild(modal);


    $("closeWallet")
        ?.addEventListener(
            "click",
            () => modal.remove()
        );


    $("walletEconomicBtn")
        ?.addEventListener(
            "click",
            () => {

                modal.remove();

                showEconomicDashboard();

            }
        );


    $("walletSpendBtn")
        ?.addEventListener(
            "click",
            () => {

                modal.remove();

                showSpendDialog();

            }
        );


    modal.addEventListener(
        "click",
        event => {

            if (event.target === modal) {
                modal.remove();
            }

        }
    );
}


function walletMetric(
    title,
    value,
    suffix
) {

    return `

        <div style="
            background:#0c2747;
            border-radius:16px;
            padding:14px;
        ">

            <div style="
                color:#8297af;
                font-size:11px;
            ">
                ${title}
            </div>

            <strong style="
                display:block;
                margin-top:6px;
                font-size:19px;
            ">
                ${
                    typeof value === "number"
                        ? formatNumber(value)
                        : escapeHTML(value)
                }
            </strong>

            <span style="
                color:#5b9fe5;
                font-size:10px;
            ">
                ${escapeHTML(suffix)}
            </span>

        </div>
    `;
}


/* =========================================================
   TRANSACTION RENDER
   ========================================================= */

function renderTransaction(transaction) {

    if (!transaction) {
        return "";
    }


    const amount =
        safeNumber(
            transaction.amount_3m ??
            transaction.amount ??
            transaction.reward_3m ??
            0
        );


    const type =
        escapeHTML(
            transaction.type ||
            transaction.action ||
            transaction.description ||
            "عملية"
        );


    const date =
        escapeHTML(
            transaction.created_at ||
            transaction.date ||
            ""
        );


    const positive =
        amount >= 0;


    return `

        <div style="
            background:#0c2747;
            border-radius:14px;
            padding:12px 14px;
            margin-bottom:8px;
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:10px;
        ">

            <div style="
                min-width:0;
            ">

                <div style="
                    color:#d8e3ef;
                    font-size:12px;
                    overflow:hidden;
                    text-overflow:ellipsis;
                    white-space:nowrap;
                ">
                    ${type}
                </div>

                ${
                    date
                        ? `
                            <div style="
                                color:#637b96;
                                font-size:10px;
                                margin-top:4px;
                            ">
                                ${date}
                            </div>
                          `
                        : ""
                }

            </div>


            <strong style="
                color:${positive ? "#53b1ff" : "#ff8585"};
                white-space:nowrap;
                font-size:13px;
            ">
                ${positive ? "+" : ""}
                ${formatNumber(amount)}
                3M
            </strong>

        </div>

    `;
}


/* =========================================================
   3MIGO AI EXPERIENCE
   =========================================================
   Current version:
   - Real chat UI.
   - Local knowledge responses.
   - No claim of connected AI.
   - Ready for future AI API adapter.
   ========================================================= */

const AI_KNOWLEDGE = {

    "كيف أزيد مكافآتي؟":
        `
        يمكنك زيادة مساهمتك من خلال النشاط المتاح فعلياً
        في 3Migo مثل التعدين والمهام والإحالات عندما تكون
        متاحة. أما المكافآت الاقتصادية النهائية فتخضع لقواعد
        النظام والبيانات التي تصل إلى Economic Engine.
        `,

    "ما الفرق بين Locked وUnlocked؟":
        `
        Locked هو رصيد اقتصادي مقيد وفق قواعد النظام،
        بينما Unlocked هو الرصيد الاقتصادي المتاح للاستخدام
        في الخدمات التي تسمح بها Economic Engine.
        `,

    "كيف يعمل اقتصاد 3Migo؟":
        `
        الفكرة الحالية هي فصل النشاط عن الاقتصاد الحقيقي.
        الحدث أو المساهمة يجب أن تكون موثقة، ثم يمكن لاحقاً
        تسجيل الإيراد في Revenue Ledger وتطبيق قواعد التخصيص
        قبل احتساب أي مكافأة اقتصادية.
        `,

    "ما المهام المتاحة؟":
        `
        يمكنني عرض المهام التي وصلت فعلياً من Tasks API.
        افتح قسم المهام لرؤية المهام الحالية والمكافآت
        المرتبطة بها.
        `

};


function show3MigoAI() {

    const old =
        $("aiModal");


    if (old) {
        old.remove();
    }


    const modal =
        document.createElement("div");


    modal.id =
        "aiModal";


    modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:7000;
        background:rgba(0,0,0,.84);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:12px;
        direction:rtl;
    `;


    modal.innerHTML = `

        <div style="
            width:100%;
            max-width:500px;
            height:min(92vh,700px);
            background:#06182f;
            border:1px solid rgba(91,140,190,.28);
            border-radius:27px;
            display:flex;
            flex-direction:column;
            overflow:hidden;
            color:#fff;
        ">

            <div style="
                padding:17px;
                border-bottom:1px solid rgba(255,255,255,.07);
                display:flex;
                justify-content:space-between;
                align-items:center;
            ">

                <div>

                    <div style="
                        font-size:20px;
                        font-weight:900;
                    ">
                        🤖 3Migo AI
                    </div>

                    <div style="
                        color:#7e95ae;
                        font-size:10px;
                        margin-top:4px;
                    ">
                        Economy Assistant Interface
                    </div>

                </div>


                <button
                    id="closeAI"
                    type="button"
                    style="
                        width:40px;
                        height:40px;
                        border:0;
                        border-radius:12px;
                        background:rgba(255,255,255,.06);
                        color:#9eb1c8;
                        font-size:24px;
                    "
                >
                    ×
                </button>

            </div>


            <div style="
                padding:12px;
                background:rgba(255,181,71,.05);
                border-bottom:1px solid rgba(255,255,255,.05);
                color:#a99b82;
                font-size:10px;
                line-height:1.6;
            ">
                ℹ️ هذه واجهة المساعد فقط.
                محرك AI خارجي غير متصل حالياً، لذلك لن ندّعي
                وجود ذكاء اصطناعي فعلي أو إجابات مولدة من نموذج.
            </div>


            <div
                id="aiMessages"
                style="
                    flex:1;
                    overflow:auto;
                    padding:14px;
                "
            ></div>


            <div style="
                padding:10px;
                border-top:1px solid rgba(255,255,255,.07);
            ">

                <div
                    id="aiQuickQuestions"
                    style="
                        display:flex;
                        gap:7px;
                        overflow-x:auto;
                        padding-bottom:9px;
                    "
                ></div>


                <div style="
                    display:flex;
                    gap:7px;
                ">

                    <input
                        id="aiInput"
                        type="text"
                        maxlength="300"
                        placeholder="اكتب سؤالك..."
                        style="
                            flex:1;
                            min-width:0;
                            padding:12px;
                            border-radius:13px;
                            border:1px solid rgba(255,255,255,.09);
                            background:#0b2443;
                            color:#fff;
                            outline:none;
                        "
                    />


                    <button
                        id="aiSend"
                        type="button"
                        style="
                            width:52px;
                            border:0;
                            border-radius:13px;
                            background:#168cff;
                            color:#fff;
                            font-size:18px;
                        "
                    >
                        ➤
                    </button>

                </div>

            </div>

        </div>
    `;


    document.body.appendChild(modal);


    $("closeAI")
        ?.addEventListener(
            "click",
            () => modal.remove()
        );


    const quickContainer =
        $("aiQuickQuestions");


    Object.keys(AI_KNOWLEDGE)
        .forEach(question => {

            const button =
                document.createElement("button");


            button.type =
                "button";


            button.textContent =
                question;


            button.style.cssText = `
                flex:0 0 auto;
                padding:8px 10px;
                border:1px solid rgba(255,255,255,.08);
                border-radius:12px;
                background:#0b2443;
                color:#dce8f4;
                font-size:10px;
            `;


            button.addEventListener(
                "click",
                () => ask3MigoAI(question)
            );


            quickContainer?.appendChild(button);

        });


    $("aiSend")
        ?.addEventListener(
            "click",
            () => {

                const question =
                    String(
                        $("aiInput")?.value || ""
                    ).trim();


                if (question) {
                    ask3MigoAI(question);
                }

            }
        );


    $("aiInput")
        ?.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {

                    event.preventDefault();

                    const question =
                        String(
                            $("aiInput")?.value || ""
                        ).trim();


                    if (question) {
                        ask3MigoAI(question);
                    }
                }

            }
        );


    addAIMessage(
        "assistant",
        "مرحباً بك في 3Migo AI Experience 👋<br><br>اختر أحد الأسئلة الجاهزة أو اكتب سؤالك. حالياً أنا واجهة معرفة محلية وليست متصلة بمحرك AI خارجي."
    );


    modal.addEventListener(
        "click",
        event => {

            if (event.target === modal) {
                modal.remove();
            }

        }
    );
}


function normalizeQuestion(question) {

    return String(question || "")
        .trim()
        .replace(/\s+/g, " ");
}


function findAIAnswer(question) {

    const normalized =
        normalizeQuestion(question);


    for (
        const key of Object.keys(AI_KNOWLEDGE)
    ) {

        if (
            normalized.includes(key) ||
            key.includes(normalized)
        ) {

            return AI_KNOWLEDGE[key];
        }
    }


    const lower =
        normalized.toLowerCase();


    if (
        lower.includes("wallet") ||
        lower.includes("محفظ")
    ) {

        return `
            افتح Wallet لمشاهدة Available وLocked
            وTotal Mined وAirdrop وContribution وTrust
            وآخر العمليات.
        `;
    }


    if (
        lower.includes("ad") ||
        lower.includes("إعلان") ||
        lower.includes("اعلان")
    ) {

        return `
            Ad Galaxy جاهزة لعرض الحملات الفعلية.
            لا يتم اعتبار الإعلان إيراداً حقيقياً إلا بعد
            وجود مزود/حملة فعلية وآلية تحقق وربطها بالـRevenue Ledger.
        `;
    }


    if (
        lower.includes("level") ||
        lower.includes("مستوى")
    ) {

        return `
            مستوى التجربة الحالي يتم حسابه في الواجهة فقط
            من النشاط والمساهمة والثقة. لا يعتبر هذا المستوى
            نظاماً رسمياً في الـBackend.
        `;
    }


    return `
        لم أجد إجابة معرفة لهذا السؤال في النسخة الحالية.
        يمكنك تجربة أحد الأسئلة الجاهزة حول المحفظة أو التعدين
        أو Ad Galaxy أو اقتصاد 3Migo.
    `;
}


function addAIMessage(type, message) {

    const container =
        $("aiMessages");


    if (!container) {
        return;
    }


    const bubble =
        document.createElement("div");


    bubble.style.cssText = `
        max-width:88%;
        margin-bottom:10px;
        padding:11px 13px;
        border-radius:15px;
        line-height:1.7;
        font-size:12px;
        ${
            type === "user"
                ? `
                    margin-right:auto;
                    background:#168cff;
                    color:#fff;
                  `
                : `
                    margin-left:auto;
                    background:#0b294a;
                    color:#dce8f4;
                  `
        }
    `;


    bubble.innerHTML =
        escapeHTML(message)
            .replace(/\n/g, "<br>");


    container.appendChild(bubble);

    container.scrollTop =
        container.scrollHeight;
}


function ask3MigoAI(question) {

    const normalized =
        normalizeQuestion(question);


    if (!normalized) {
        return;
    }


    const input =
        $("aiInput");


    if (input) {
        input.value = "";
    }


    addAIMessage(
        "user",
        normalized
    );


    const answer =
        findAIAnswer(normalized);


    setTimeout(
        () => {

            addAIMessage(
                "assistant",
                answer
            );

        },
        180
    );
}


/* =========================================================
   V4 HUB
   ========================================================= */

function injectV4HubButton() {

    if ($("v4HubButton")) {
        return;
    }


    const button =
        document.createElement("button");


    button.id =
        "v4HubButton";


    button.type =
        "button";


    button.textContent =
        "⚡ 3Migo V4";


    button.style.cssText = `
        position:fixed;
        bottom:18px;
        left:18px;
        z-index:2500;
        border:1px solid rgba(82,170,255,.35);
        border-radius:18px;
        padding:11px 14px;
        background:
            linear-gradient(
                135deg,
                #123d69,
                #0a294a
            );
        color:#fff;
        font-weight:900;
        font-size:11px;
        box-shadow:0 10px 30px rgba(0,0,0,.35);
    `;


    button.addEventListener(
        "click",
        showV4Hub
    );


    document.body.appendChild(button);
}


function showV4Hub() {

    const old =
        $("v4HubModal");


    if (old) {
        old.remove();
    }


    const modal =
        document.createElement("div");


    modal.id =
        "v4HubModal";


    modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:5500;
        background:rgba(0,0,0,.80);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:15px;
        direction:rtl;
    `;


    modal.innerHTML = `

        <div style="
            width:100%;
            max-width:470px;
            background:#06182f;
            border:1px solid rgba(91,140,190,.28);
            border-radius:27px;
            padding:20px;
            color:#fff;
        ">

            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
            ">

                <div>

                    <div style="
                        font-size:22px;
                        font-weight:900;
                    ">
                        ⚡ 3Migo V4
                    </div>

                    <div style="
                        color:#8197b0;
                        font-size:11px;
                        margin-top:4px;
                    ">
                        Economy Experience
                    </div>

                </div>


                <button
                    id="closeV4Hub"
                    type="button"
                    style="
                        background:transparent;
                        color:#9aabc0;
                        border:0;
                        font-size:25px;
                    "
                >
                    ×
                </button>

            </div>


            <div style="
                margin-top:17px;
                padding:16px;
                border-radius:19px;
                background:
                    linear-gradient(
                        135deg,
                        #103963,
                        #09233f
                    );
            ">

                <div style="
                    color:#8da5bf;
                    font-size:11px;
                ">
                    مستوى تجربة المستخدم
                </div>

                <strong style="
                    display:block;
                    margin-top:6px;
                    font-size:24px;
                ">
                    Lv.${state.experience.level}
                    ${escapeHTML(
                        state.experience.levelName
                    )}
                </strong>

                <div style="
                    margin-top:11px;
                    height:7px;
                    background:rgba(255,255,255,.08);
                    border-radius:10px;
                    overflow:hidden;
                ">

                    <div style="
                        width:${state.experience.progress}%;
                        height:100%;
                        background:#52aaff;
                    "></div>

                </div>

                <div style="
                    margin-top:7px;
                    color:#7189a3;
                    font-size:10px;
                ">
                    Experience Score:
                    ${state.experience.score}/100
                </div>

            </div>


            <div style="
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:10px;
                margin-top:13px;
            ">

                ${v4HubButton(
                    "📢",
                    "Ad Galaxy",
                    "showAdGalaxy"
                )}

                ${v4HubButton(
                    "💎",
                    "Wallet",
                    "showWallet"
                )}

                ${v4HubButton(
                    "🤖",
                    "3Migo AI",
                    "show3MigoAI"
                )}

                ${v4HubButton(
                    "🌐",
                    "Economy Center",
                    "showEconomicDashboard"
                )}

            </div>


            <div style="
                margin-top:14px;
                padding:13px;
                border-radius:15px;
                background:#0a2340;
                color:#839ab3;
                font-size:10px;
                line-height:1.7;
            ">
                طبقة V4 تعمل فوق الـAPI الحالية.
                لا يتم إنشاء إيرادات أو أرصدة اقتصادية
                من الواجهة.
            </div>

        </div>
    `;


    document.body.appendChild(modal);


    $("closeV4Hub")
        ?.addEventListener(
            "click",
            () => modal.remove()
        );


    modal.querySelectorAll(
        "[data-v4-open]"
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const action =
                    button.getAttribute(
                        "data-v4-open"
                    );


                modal.remove();


                if (
                    typeof window[action] ===
                    "function"
                ) {

                    window[action]();

                }

            }
        );

    });


    modal.addEventListener(
        "click",
        event => {

            if (event.target === modal) {
                modal.remove();
            }

        }
    );
}


function v4HubButton(
    icon,
    title,
    action
) {

    return `

        <button
            type="button"
            data-v4-open="${action}"
            style="
                padding:17px 10px;
                border:1px solid rgba(255,255,255,.06);
                border-radius:17px;
                background:#0a2340;
                color:#fff;
                text-align:right;
            "
        >

            <span style="
                font-size:21px;
            ">
                ${icon}
            </span>

            <strong style="
                display:block;
                margin-top:7px;
                font-size:12px;
            ">
                ${title}
            </strong>

        </button>
    `;
}


/* =========================================================
   PROFILE
   ========================================================= */

function showProfile() {

    const username =
        state.username
            ? `@${state.username}`
            : "مستخدم 3Migo";


    showToast(
        `${username} — ID: ${state.telegramId}`,
        5000
    );
}


/* =========================================================
   ACTION HANDLER
   ========================================================= */

function setupActions() {

    document.addEventListener(
        "click",
        event => {

            const element =
                event.target.closest(
                    "[data-action]"
                );


            if (!element) {
                return;
            }


            const action =
                element.getAttribute(
                    "data-action"
                );


            switch (action) {

                case "tasks":

                    scrollToTasks();

                    break;


                case "mine":

                    window.scrollTo({
                        top: 0,
                        behavior: "smooth"
                    });

                    break;


                case "daily":

                    dailyReward();

                    break;


                case "referral":

                    showReferral();

                    break;


                case "wallet":

                    showWallet();

                    break;


                case "profile":

                    showProfile();

                    break;


                case "economic":

                    showEconomicDashboard();

                    break;


                case "airdrop":

                    showAirdropPreview();

                    break;


                case "spend":

                    showSpendDialog();

                    break;


                case "ad-galaxy":

                    showAdGalaxy();

                    break;


                case "ai":

                    show3MigoAI();

                    break;


                case "v4":

                    showV4Hub();

                    break;

            }

        }
    );
}


/* =========================================================
   MINING BUTTON SETUP
   ========================================================= */

function setupMining() {

    const button =
        $("mineBtn");


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        handleMiningButton
    );
}


/* =========================================================
   ECONOMIC BUTTON
   ========================================================= */

function setupEconomicButton() {

    const selectors = [

        "[data-action='economic']",

        "#economicBtn",

        "#economicDashboardBtn"

    ];


    const button =
        document.querySelector(
            selectors.join(",")
        );


    if (
        button &&
        !button.hasAttribute("data-action")
    ) {

        button.addEventListener(
            "click",
            showEconomicDashboard
        );
    }
}


/* =========================================================
   V4 ACTION BUTTONS
   ========================================================= */

function setupV4Actions() {

    const adButtons =
        document.querySelectorAll(
            "[data-action='ad-galaxy']"
        );


    adButtons.forEach(button => {

        if (
            button.dataset.v4Bound === "1"
        ) {
            return;
        }


        button.dataset.v4Bound =
            "1";


        button.addEventListener(
            "click",
            showAdGalaxy
        );

    });


    const aiButtons =
        document.querySelectorAll(
            "[data-action='ai']"
        );


    aiButtons.forEach(button => {

        if (
            button.dataset.v4Bound === "1"
        ) {
            return;
        }


        button.dataset.v4Bound =
            "1";


        button.addEventListener(
            "click",
            show3MigoAI
        );

    });
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeApp() {

    console.log(
        "3Migo Coin Mini App v4.0.0 starting..."
    );


    try {

        /*
         * 1. Identify Telegram user
         */

        await ensureUserRegistered();


        /*
         * 2. Main wallet
         */

        await loadUser();


        /*
         * 3. Economic Engine
         */

        await loadEconomicProfile();


        /*
         * 4. Mining
         */

        await loadMiningStatus();


        /*
         * 5. Tasks
         */

        await loadTasks();


        /*
         * 6. Experience
         */

        updateExperienceLevel();


        /*
         * 7. Event handlers
         */

        setupTaskEvents();

        setupActions();

        setupMining();

        setupEconomicButton();

        setupV4Actions();


        /*
         * 8. V4 floating hub
         */

        injectV4HubButton();


        /*
         * 9. Final UI refresh
         */

        updateBalanceUI();

        updateMiningUI();

        updateEconomicUI();

        updateExperienceUI();


        console.log(
            "3Migo Coin Mini App v4.0.0 ready.",
            {

                telegramId:
                    state.telegramId,

                mainBalance:
                    state.balance,

                economic:
                    state.economic,

                experience:
                    state.experience,

                adGalaxy:
                    state.adGalaxy,

                tasks:
                    state.tasks.length

            }
        );


    } catch (error) {

        console.error(
            "3Migo Mini App initialization error:",
            error
        );


        showToast(
            "حدث خطأ أثناء تشغيل 3Migo. حاول إعادة فتح التطبيق.",
            5000
        );
    }
}


/* =========================================================
   PUBLIC API
   ========================================================= */

window.ThreeMigo = {

    state,

    loadUser,

    loadTasks,

    completeTask,

    startMining,

    claimMining,

    loadMiningStatus,

    loadReferral,

    showReferral,

    dailyReward,

    showWallet,

    showProfile,

    loadEconomicProfile,

    showEconomicDashboard,

    loadAirdropPreview,

    showAirdropPreview,

    showSpendDialog,

    executeSpend,

    showAdGalaxy,

    show3MigoAI,

    showV4Hub,

    updateExperienceLevel

};


/* =========================================================
   GLOBAL V4 ACCESS
   ========================================================= */

window.showAdGalaxy =
    showAdGalaxy;

window.show3MigoAI =
    show3MigoAI;

window.showV4Hub =
    showV4Hub;

window.showWallet =
    showWallet;

window.showEconomicDashboard =
    showEconomicDashboard;


/* =========================================================
   START
   ========================================================= */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApp
    );

} else {

    initializeApp();
}
/* =========================================================
   3Migo Coin — Telegram Mini App
   Frontend Controller V5.0
   MASTER UI EXPERIENCE LAYER
   ---------------------------------------------------------
   Safe frontend upgrade:
   - Existing API contracts preserved
   - No database changes
   - No economic_engine.py changes
   - No fake revenue
   - No fake market value
   - Main balance remains separate from Economic Available
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

        tg.setHeaderColor("#04142a");
        tg.setBackgroundColor("#031024");

        if (typeof tg.enableClosingConfirmation === "function") {
            tg.enableClosingConfirmation();
        }
    } catch (error) {
        console.log("Telegram UI settings unavailable:", error);
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
    telegramId: FALLBACK_TELEGRAM_ID,
    username: "demo",

    /* Main / legacy wallet */
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
    referral: null,

    /* Economic */
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

    /* Experience */
    experience: {
        level: 1,
        levelName: "Explorer",
        progress: 0,
        score: 0,
        nextScore: 100,
        source: "Frontend Experience Layer"
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

    /* Airdrop */
    airdropPreview: null,

    loadingEconomic: false,
    loadingUser: false
};


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(selector) {
    return document.querySelector(selector);
}


function $all(selector) {
    return Array.from(document.querySelectorAll(selector));
}


/* =========================================================
   SAFE HELPERS
   ========================================================= */

function safeNumber(value, fallback = 0) {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}


function clamp(value, min = 0, max = 100) {

    return Math.min(
        max,
        Math.max(
            min,
            safeNumber(value, min)
        )
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


/* =========================================================
   TOAST
   ========================================================= */

function showToast(message, duration = 3000) {

    let toast = $("#toast");

    if (!toast) {

        toast = document.createElement("div");

        toast.id = "toast";

        document.body.appendChild(toast);
    }

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(toast._timer);

    toast._timer = setTimeout(() => {

        toast.classList.remove("show");

    }, duration);
}


/* =========================================================
   TELEGRAM USER
   ========================================================= */

function getTelegramUser() {

    if (
        tg &&
        tg.initDataUnsafe &&
        tg.initDataUnsafe.user
    ) {

        const user = tg.initDataUnsafe.user;

        state.telegramUser = user;

        state.telegramId =
            user.id || FALLBACK_TELEGRAM_ID;

        state.username =
            user.username ||
            user.first_name ||
            "user";

        return user;
    }


    state.telegramUser = {
        id: FALLBACK_TELEGRAM_ID,
        username: "demo",
        first_name: "Demo"
    };

    state.telegramId =
        FALLBACK_TELEGRAM_ID;

    state.username = "demo";

    return state.telegramUser;
}


/* =========================================================
   API
   ========================================================= */

async function apiRequest(endpoint, options = {}) {

    const url = `${API_BASE}${endpoint}`;

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


    const response =
        await fetch(url, config);


    let data = null;

    try {

        data = await response.json();

    } catch (error) {

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
                        item?.message ||
                        JSON.stringify(item)
                    )
                    .join(", ");
        }

        throw new Error(message);
    }


    return data;
}


/* =========================================================
   USER REGISTRATION
   ========================================================= */

async function ensureUserRegistered() {

    getTelegramUser();

    try {

        await apiRequest(
            `/user/${state.telegramId}`
        );

        return true;

    } catch (error) {

        try {

            await apiRequest(
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

            return true;

        } catch (registerError) {

            console.error(
                "Registration error:",
                registerError
            );

            throw registerError;
        }
    }
}


/* =========================================================
   MAIN BALANCE UI
   ========================================================= */

function updateBalanceUI() {

    const balanceEl = $("#balance");
    const totalEl = $("#total");
    const todayEl = $("#today");
    const sessionsEl = $("#sessions");


    if (balanceEl) {

        balanceEl.textContent =
            formatNumber(state.balance);
    }


    if (totalEl) {

        totalEl.textContent =
            formatNumber(state.total);
    }


    if (todayEl) {

        todayEl.textContent =
            formatNumber(state.today);
    }


    if (sessionsEl) {

        sessionsEl.textContent =
            formatNumber(state.sessions, 0);
    }
}


/* =========================================================
   LOAD MAIN USER
   ========================================================= */

async function loadUser() {

    state.loadingUser = true;

    try {

        const user =
            await apiRequest(
                `/user/${state.telegramId}`
            );


        /*
         * IMPORTANT:
         * Main wallet balance is authoritative here.
         */

        state.balance = safeNumber(
            user.balance_3m ??
            user.balance ??
            user.balance3m ??
            0
        );


        state.total = safeNumber(
            user.total_earned ??
            user.total ??
            user.total_3m ??
            0
        );


        state.today = safeNumber(
            user.today_earned ??
            user.today ??
            user.today_3m ??
            0
        );


        state.sessions = safeNumber(
            user.mining_sessions ??
            user.sessions ??
            0
        );


        updateBalanceUI();

        updateExperienceLevel();

        return user;

    } catch (error) {

        console.error(
            "loadUser:",
            error
        );

        throw error;

    } finally {

        state.loadingUser = false;
    }
}


/* =========================================================
   ECONOMIC PROFILE
   ========================================================= */

async function loadEconomicProfile() {

    state.economic.loading = true;
    state.loadingEconomic = true;

    try {

        const data =
            await apiRequest(
                `/economic/user/${state.telegramId}`
            );


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


        state.economic.loaded = true;


        updateEconomicUI();

        updateExperienceLevel();


        return data;

    } catch (error) {

        console.error(
            "loadEconomicProfile:",
            error
        );

        state.economic.loaded = false;

        /*
         * Do not fabricate economic values.
         */

        updateEconomicUI();

        return null;

    } finally {

        state.economic.loading = false;
        state.loadingEconomic = false;
    }
}


/* =========================================================
   ECONOMIC UI
   ========================================================= */

function updateEconomicUI() {

    const ids = {

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


    Object.entries(ids).forEach(
        ([id, value]) => {

            const element =
                document.getElementById(id);

            if (!element) return;

            element.textContent =
                formatNumber(value);
        }
    );


    updateExperienceUI();
}


/* =========================================================
   EXPERIENCE ENGINE
   FRONTEND EXPERIENCE ONLY
   ========================================================= */

function updateExperienceLevel() {

    const activityScore =
        clamp(
            state.sessions * 5
        );


    const contributionScore =
        clamp(
            state.economic.contributionScore
        );


    const trustScore =
        clamp(
            state.economic.trustScore,
            0,
            100
        );


    const score =
        (
            activityScore * 0.30
        ) +
        (
            contributionScore * 0.40
        ) +
        (
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


    let progress = 0;

    if (level === 1) {

        progress =
            (score / 35) * 100;

    } else if (level === 2) {

        progress =
            ((score - 35) / 25) * 100;

    } else if (level === 3) {

        progress =
            ((score - 60) / 20) * 100;

    } else {

        progress = score;
    }


    state.experience = {

        level,

        levelName,

        progress:
            clamp(progress),

        score:
            clamp(score),

        nextScore:
            level === 1
                ? 35
                : level === 2
                    ? 60
                    : level === 3
                        ? 80
                        : 100,

        source:
            "Frontend Experience Layer"
    };


    updateExperienceUI();
}


/* =========================================================
   EXPERIENCE UI
   ========================================================= */

function updateExperienceUI() {

    const levelEl =
        $("#v4Level");

    const scoreEl =
        $("#v4ExperienceScore");

    const progressEl =
        $("#v4LevelProgress");


    if (levelEl) {

        levelEl.textContent =
            `LV.${state.experience.level} • ${state.experience.levelName}`;
    }


    if (scoreEl) {

        scoreEl.textContent =
            `${formatNumber(
                state.experience.score,
                0
            )} XP`;
    }


    if (progressEl) {

        progressEl.style.width =
            `${state.experience.progress}%`;
    }
}


/* =========================================================
   AD GALAXY ANALYSIS
   ========================================================= */

function analyzeAdGalaxy() {

    const adKeywords = [
        "ad",
        "ads",
        "advert",
        "advertising",
        "sponsor",
        "promo",
        "إعلان",
        "اعلان",
        "إعلانات",
        "اعلانات",
        "ترويج"
    ];


    const adTasks =
        state.tasks.filter(task => {

            const content = [
                task?.task_type,
                task?.type,
                task?.title,
                task?.description
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            return adKeywords.some(
                keyword =>
                    content.includes(
                        keyword.toLowerCase()
                    )
            );
        });


    const completed =
        adTasks.filter(
            task =>
                Number(task.completed) === 1 ||
                task.completed === true
        ).length;


    state.adGalaxy.available =
        adTasks.length;


    state.adGalaxy.completed =
        completed;


    state.adGalaxy.verified =
        completed;


    state.adGalaxy.connected =
        adTasks.length > 0;


    /*
     * IMPORTANT:
     * No real ad provider has been connected.
     */

    state.adGalaxy.providerConnected =
        false;


    return adTasks;
}


/* =========================================================
   AD GALAXY
   ========================================================= */

function showAdGalaxy() {

    const adTasks =
        analyzeAdGalaxy();


    const existing =
        $("#adGalaxyModal");

    if (existing) {

        existing.remove();
    }


    const modal =
        document.createElement("div");

    modal.id =
        "adGalaxyModal";

    modal.className =
        "modal-overlay";


    const progress =
        state.adGalaxy.available > 0
            ? (
                state.adGalaxy.completed /
                state.adGalaxy.available
            ) * 100
            : 0;


    modal.innerHTML = `

        <div class="modal-card ad-galaxy-modal">

            <button
                class="modal-close"
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
                مركز المهام والإعلانات
            </p>


            <div class="ad-galaxy-stats">

                <div class="ad-galaxy-stat">
                    <strong>
                        ${formatNumber(
                            state.adGalaxy.available,
                            0
                        )}
                    </strong>

                    <span>
                        Available
                    </span>
                </div>


                <div class="ad-galaxy-stat">
                    <strong>
                        ${formatNumber(
                            state.adGalaxy.completed,
                            0
                        )}
                    </strong>

                    <span>
                        Completed
                    </span>
                </div>


                <div class="ad-galaxy-stat">
                    <strong>
                        ${formatNumber(
                            state.economic.contributionScore,
                            0
                        )}
                    </strong>

                    <span>
                        Contribution
                    </span>
                </div>

            </div>


            <div class="progress-wrapper">

                <div class="progress-label">
                    Galaxy Progress
                    <span>
                        ${formatNumber(progress, 0)}%
                    </span>
                </div>

                <div class="progress-bar">
                    <div
                        class="progress-fill"
                        style="width:${clamp(progress)}%"
                    ></div>
                </div>

            </div>


            <div class="ad-provider-status">

                <span class="status-dot ${
                    state.adGalaxy.providerConnected
                        ? "online"
                        : "offline"
                }"></span>

                ${
                    state.adGalaxy.providerConnected
                        ? "Ad Provider Connected"
                        : "Provider Integration Pending"
                }

            </div>


            <div class="ad-galaxy-list">

                ${
                    adTasks.length
                        ? adTasks
                            .map(renderAdGalaxyItem)
                            .join("")
                        : `
                            <div class="empty-state">
                                لا توجد مهام إعلانية مكتشفة حالياً.
                            </div>
                        `
                }

            </div>


            <div class="economic-warning">

                <strong>
                    ℹ️ شفافية النظام
                </strong>

                <p>
                    مهام Ad Galaxy الحالية تعتمد على
                    المهام المتاحة في النظام.
                    لا يتم احتساب أي إيراد إعلاني حقيقي
                    ما لم يتم ربط مزود إعلانات فعلي.
                </p>

            </div>


            <button
                class="primary-btn"
                data-refresh-ad-galaxy
            >
                🔄 تحديث Galaxy
            </button>

        </div>
    `;


    document.body.appendChild(modal);


    modal.addEventListener(
        "click",
        event => {

            if (
                event.target === modal ||
                event.target.closest(
                    "[data-close-modal]"
                )
            ) {

                modal.remove();

                return;
            }


            if (
                event.target.closest(
                    "[data-refresh-ad-galaxy]"
                )
            ) {

                modal.remove();

                loadTasks()
                    .then(() => showAdGalaxy())
                    .catch(() =>
                        showToast(
                            "تعذر تحديث المهام"
                        )
                    );
            }
        }
    );


    const taskButtons =
        modal.querySelectorAll(
            "[data-complete-task]"
        );


    taskButtons.forEach(button => {

        button.addEventListener(
            "click",
            async event => {

                event.stopPropagation();

                const taskId =
                    button.dataset.completeTask;

                if (!taskId) return;

                await completeTask(taskId);

                modal.remove();

                showAdGalaxy();
            }
        );
    });
}


function renderAdGalaxyItem(task) {

    const id =
        task.id ??
        task.task_id ??
        "";


    const title =
        task.title ||
        "Ad Task";


    const description =
        task.description ||
        "Complete this activity.";


    const reward =
        safeNumber(
            task.reward_3m ??
            task.reward ??
            0
        );


    const completed =
        Number(task.completed) === 1 ||
        task.completed === true;


    return `

        <div class="ad-galaxy-item">

            <div class="ad-galaxy-item-icon">
                📡
            </div>

            <div class="ad-galaxy-item-content">

                <strong>
                    ${escapeHTML(title)}
                </strong>

                <p>
                    ${escapeHTML(description)}
                </p>

                <span>
                    +${formatNumber(reward)} 3M
                </span>

            </div>

            <button
                ${
                    completed
                        ? "disabled"
                        : ""
                }
                data-complete-task="${escapeHTML(id)}"
            >
                ${
                    completed
                        ? "✓"
                        : "Open"
                }
            </button>

        </div>
    `;
}


/* =========================================================
   ECONOMIC DASHBOARD
   ========================================================= */

function economicCard(
    icon,
    title,
    value,
    subtitle = ""
) {

    return `

        <div class="economic-card">

            <div class="economic-card-icon">
                ${icon}
            </div>

            <div class="economic-card-content">

                <span>
                    ${escapeHTML(title)}
                </span>

                <strong>
                    ${escapeHTML(value)}
                </strong>

                ${
                    subtitle
                        ? `
                            <small>
                                ${escapeHTML(subtitle)}
                            </small>
                        `
                        : ""
                }

            </div>

        </div>
    `;
}


function showEconomicDashboard() {

    const existing =
        $("#economicModal");

    if (existing) {

        existing.remove();
    }


    const modal =
        document.createElement("div");

    modal.id =
        "economicModal";

    modal.className =
        "modal-overlay";


    modal.innerHTML = `

        <div class="modal-card economic-modal">

            <button
                class="modal-close"
                data-close-modal
            >
                ×
            </button>


            <div class="modal-icon">
                🏛️
            </div>


            <h2>
                3Migo Economy Center
            </h2>


            <p class="modal-subtitle">
                طبقة الاقتصاد والمساهمات
            </p>


            <div class="economic-grid">

                ${economicCard(
                    "⛏️",
                    "Total Mined",
                    `${formatNumber(
                        state.economic.totalMined
                    )} 3M`
                )}


                ${economicCard(
                    "🔒",
                    "Locked",
                    `${formatNumber(
                        state.economic.locked3m
                    )} 3M`
                )}


                ${economicCard(
                    "💰",
                    "Economic Available",
                    `${formatNumber(
                        state.economic.unlocked3m
                    )} 3M`
                )}


                ${economicCard(
                    "🎁",
                    "Airdrop",
                    `${formatNumber(
                        state.economic.airdrop3m
                    )} 3M`
                )}


                ${economicCard(
                    "⚡",
                    "Contribution",
                    formatNumber(
                        state.economic.contributionScore
                    )
                )}


                ${economicCard(
                    "🛡️",
                    "Trust",
                    formatNumber(
                        state.economic.trustScore
                    )
                )}

            </div>


            <div class="economy-level">

                <span>
                    Experience
                </span>

                <strong>
                    LV.${state.experience.level}
                    •
                    ${escapeHTML(
                        state.experience.levelName
                    )}
                </strong>

            </div>


            <div class="economic-warning">

                <strong>
                    ⚠️ ملاحظة اقتصادية
                </strong>

                <p>
                    هذه البيانات تعكس أرصدة وحسابات
                    النظام الحالية. لا تمثل قيمة سوقية
                    للعملة ولا إيراداً نقدياً محققاً.
                </p>

            </div>


            <div class="modal-actions">

                <button
                    class="primary-btn"
                    data-economic-airdrop
                >
                    🎁 Airdrop
                </button>


                <button
                    class="secondary-btn"
                    data-economic-spend
                >
                    💳 Spend
                </button>

            </div>

        </div>
    `;


    document.body.appendChild(modal);


    modal.addEventListener(
        "click",
        async event => {

            if (
                event.target === modal ||
                event.target.closest(
                    "[data-close-modal]"
                )
            ) {

                modal.remove();

                return;
            }


            if (
                event.target.closest(
                    "[data-economic-airdrop]"
                )
            ) {

                await loadAirdropPreview();

                showAirdropPreview();

                return;
            }


            if (
                event.target.closest(
                    "[data-economic-spend]"
                )
            ) {

                modal.remove();

                showSpendDialog();
            }
        }
    );
}


/* =========================================================
   AIRDROP
   ========================================================= */

async function loadAirdropPreview() {

    try {

        const data =
            await apiRequest(
                `/economic/airdrop/${state.telegramId}`
            );


        state.airdropPreview =
            data?.result ||
            data ||
            null;


        return state.airdropPreview;

    } catch (error) {

        console.error(
            "loadAirdropPreview:",
            error
        );

        showToast(
            `تعذر تحميل Airdrop: ${error.message}`
        );

        return null;
    }
}


function showAirdropPreview() {

    const data =
        state.airdropPreview;


    if (!data) {

        showToast(
            "لا توجد بيانات Airdrop متاحة حالياً."
        );

        return;
    }


    const estimated =
        safeNumber(
            data.estimated_airdrop ??
            data.airdrop_3m ??
            data.amount_3m ??
            data.estimated_3m ??
            0
        );


    const userContribution =
        safeNumber(
            data.user_contribution ??
            data.contribution_score ??
            0
        );


    const totalContribution =
        safeNumber(
            data.total_contribution ??
            data.total_contribution_score ??
            0
        );


    showToast(
        `Airdrop تقديري: ${formatNumber(estimated)} 3M | مساهمتك: ${formatNumber(userContribution)} | الإجمالي: ${formatNumber(totalContribution)}`,
        6000
    );
}


/* =========================================================
   SPEND
   ========================================================= */

function showSpendDialog() {

    const existing =
        $("#spendModal");

    if (existing) {

        existing.remove();
    }


    const modal =
        document.createElement("div");

    modal.id =
        "spendModal";

    modal.className =
        "modal-overlay";


    modal.innerHTML = `

        <div class="modal-card">

            <button
                class="modal-close"
                data-close-modal
            >
                ×
            </button>


            <div class="modal-icon">
                💳
            </div>


            <h2>
                Economic Spend
            </h2>


            <p class="modal-subtitle">
                استخدام الرصيد الاقتصادي المتاح
            </p>


            <div class="wallet-metric">

                <span>
                    Economic Available
                </span>

                <strong>
                    ${formatNumber(
                        state.economic.unlocked3m
                    )} 3M
                </strong>

            </div>


            <label>
                الخدمة
            </label>

            <input
                id="spendService"
                type="text"
                placeholder="مثال: service"
                maxlength="100"
            />


            <label>
                المبلغ 3M
            </label>

            <input
                id="spendAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
            />


            <button
                class="primary-btn"
                data-execute-spend
            >
                تأكيد الاستخدام
            </button>

        </div>
    `;


    document.body.appendChild(modal);


    modal.addEventListener(
        "click",
        event => {

            if (
                event.target === modal ||
                event.target.closest(
                    "[data-close-modal]"
                )
            ) {

                modal.remove();

                return;
            }


            if (
                event.target.closest(
                    "[data-execute-spend]"
                )
            ) {

                executeSpend(modal);
            }
        }
    );
}


async function executeSpend(modal) {

    const serviceInput =
        modal.querySelector(
            "#spendService"
        );


    const amountInput =
        modal.querySelector(
            "#spendAmount"
        );


    const service =
        serviceInput?.value.trim();


    const amount =
        safeNumber(
            amountInput?.value
        );


    if (!service) {

        showToast(
            "أدخل اسم الخدمة."
        );

        return;
    }


    if (
        amount <= 0
    ) {

        showToast(
            "أدخل مبلغاً صحيحاً."
        );

        return;
    }


    if (
        amount >
        state.economic.unlocked3m
    ) {

        showToast(
            "الرصيد الاقتصادي المتاح غير كافٍ."
        );

        return;
    }


    const button =
        modal.querySelector(
            "[data-execute-spend]"
        );


    if (button) {

        button.disabled = true;
        button.textContent = "جارٍ التنفيذ...";
    }


    try {

        await apiRequest(
            `/economic/spend/${state.telegramId}`,
            {
                method: "POST",

                body: {

                    service,

                    amount_3m:
                        amount,

                    reference:
                        `miniapp_spend_${Date.now()}`
                }
            }
        );


        showToast(
            "تم تسجيل الاستخدام بنجاح."
        );


        modal.remove();


        await loadUser();

        await loadEconomicProfile();


    } catch (error) {

        console.error(
            "executeSpend:",
            error
        );


        showToast(
            `فشل الاستخدام: ${error.message}`
        );


        if (button) {

            button.disabled = false;
            button.textContent =
                "تأكيد الاستخدام";
        }
    }
}


/* =========================================================
   MINING
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


    const secs =
        seconds % 60;


    return [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(secs).padStart(2, "0")
    ].join(":");
}


/* =========================================================
   MINING UI
   ========================================================= */

function updateMiningUI() {

    const stateEl =
        $("#miningState");

    const button =
        $("#mineBtn");

    const rateEl =
        $("#rate");


    if (rateEl) {

        rateEl.textContent =
            `${formatNumber(
                state.miningReward
            )} 3M / ${MINING_CYCLE_HOURS}h`;
    }


    if (!stateEl || !button) {

        return;
    }


    const strong =
        stateEl.querySelector("strong");


    const small =
        stateEl.querySelector("small");


    if (state.miningActive) {

        if (strong) {

            strong.textContent =
                "⛏️ Mining Active";
        }


        if (small) {

            small.textContent =
                formatTime(
                    state.miningRemaining
                );
        }


        button.disabled =
            state.miningRemaining > 0;


        button.textContent =
            state.miningRemaining > 0
                ? "⛏️ Mining..."
                : "🎁 Claim 3M";


        button.classList.add(
            "mining-active"
        );


    } else {

        if (strong) {

            strong.textContent =
                "⚡ Ready to Mine";
        }


        if (small) {

            small.textContent =
                `${formatNumber(
                    state.miningReward
                )} 3M reward`;
        }


        button.disabled = false;

        button.textContent =
            "⛏️ Start Mining";


        button.classList.remove(
            "mining-active"
        );
    }
}


/* =========================================================
   MINING STATUS
   ========================================================= */

async function loadMiningStatus() {

    try {

        const data =
            await apiRequest(
                `/mining/${state.telegramId}/status`
            );


        state.miningActive =
            Boolean(
                data.active ??
                data.is_active ??
                false
            );


        state.miningRemaining =
            Math.max(
                0,
                safeNumber(
                    data.remaining_seconds ??
                    data.remaining ??
                    data.seconds_remaining ??
                    0
                )
            );


        state.miningReward =
            safeNumber(
                data.reward_3m ??
                data.reward ??
                10,
                10
            );


        updateMiningUI();


        if (state.miningActive) {

            startMiningCountdown();
        }


        return data;

    } catch (error) {

        console.error(
            "loadMiningStatus:",
            error
        );

        return null;
    }
}


/* =========================================================
   MINING COUNTDOWN
   ========================================================= */

function startMiningCountdown() {

    clearInterval(
        state.miningTimer
    );


    state.miningTimer =
        setInterval(
            () => {

                if (
                    !state.miningActive
                ) {

                    clearInterval(
                        state.miningTimer
                    );

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

                    clearInterval(
                        state.miningTimer
                    );


                    state.miningActive =
                        true;


                    updateMiningUI();


                    showToast(
                        "⏰ دورة التعدين اكتملت. يمكنك الآن المطالبة بالمكافأة."
                    );
                }

            },
            1000
        );
}


/* =========================================================
   START MINING
   ========================================================= */

async function startMining() {

    if (
        state.miningActive &&
        state.miningRemaining > 0
    ) {

        showToast(
            `التعدين مستمر: ${formatTime(
                state.miningRemaining
            )}`
        );

        return;
    }


    const button =
        $("#mineBtn");


    if (button) {

        button.disabled = true;
        button.textContent =
            "⏳ Starting...";
    }


    try {

        const data =
            await apiRequest(
                `/mining/${state.telegramId}/start`,
                {
                    method: "POST"
                }
            );


        state.miningActive =
            Boolean(
                data.active ??
                data.is_active ??
                true
            );


        state.miningRemaining =
            Math.max(
                0,
                safeNumber(
                    data.remaining_seconds ??
                    data.remaining ??
                    MINING_CYCLE_SECONDS
                )
            );


        state.miningReward =
            safeNumber(
                data.reward_3m ??
                data.reward ??
                10,
                10
            );


        updateMiningUI();

        startMiningCountdown();


        showToast(
            `⛏️ بدأ التعدين — المكافأة ${formatNumber(
                state.miningReward
            )} 3M`
        );


    } catch (error) {

        console.error(
            "startMining:",
            error
        );


        showToast(
            `تعذر بدء التعدين: ${error.message}`
        );


        updateMiningUI();
    }
}


/* =========================================================
   CLAIM MINING
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


        showToast(
            `🎉 تمت المطالبة بالمكافأة: ${
                formatNumber(
                    safeNumber(
                        data?.reward_3m ??
                        data?.reward ??
                        state.miningReward
                    )
                )
            } 3M`
        );


        state.miningActive = false;
        state.miningRemaining = 0;


        clearInterval(
            state.miningTimer
        );


        await loadUser();

        await loadEconomicProfile();

        await loadMiningStatus();


    } catch (error) {

        console.error(
            "claimMining:",
            error
        );


        showToast(
            `تعذر المطالبة: ${error.message}`
        );


        await loadMiningStatus();
    }
}


/* =========================================================
   MINING BUTTON
   ========================================================= */

async function handleMiningButton() {

    if (
        state.miningActive
    ) {

        if (
            state.miningRemaining <= 0
        ) {

            await claimMining();

        } else {

            showToast(
                `التعدين مستمر — ${formatTime(
                    state.miningRemaining
                )}`
            );
        }

        return;
    }


    await startMining();
}


/* =========================================================
   TASKS
   ========================================================= */

function renderTasksLoading() {

    const container =
        $("#tasksContainer");

    if (!container) return;


    container.innerHTML = `

        <div class="loading-state">
            <div class="loading-spinner"></div>
            <span>
                جاري تحميل المهام...
            </span>
        </div>
    `;
}


function renderTasksError(message) {

    const container =
        $("#tasksContainer");

    if (!container) return;


    container.innerHTML = `

        <div class="empty-state error">
            ⚠️ ${escapeHTML(message)}
        </div>
    `;
}


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
        state.tasks
            .map(task => {

                const id =
                    task.id ??
                    task.task_id ??
                    "";


                const title =
                    task.title ||
                    "Task";


                const description =
                    task.description ||
                    "";


                const reward =
                    safeNumber(
                        task.reward_3m ??
                        task.reward ??
                        0
                    );


                const completed =
                    Number(task.completed) === 1 ||
                    task.completed === true;


                return `

                    <div class="task-card">

                        <div class="task-icon">
                            ${
                                completed
                                    ? "✅"
                                    : "🎯"
                            }
                        </div>


                        <div class="task-content">

                            <h3>
                                ${escapeHTML(title)}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    description
                                )}
                            </p>

                            <strong>
                                +${formatNumber(
                                    reward
                                )} 3M
                            </strong>

                        </div>


                        <button
                            ${
                                completed
                                    ? "disabled"
                                    : ""
                            }
                            data-complete-task="${escapeHTML(
                                id
                            )}"
                        >
                            ${
                                completed
                                    ? "Completed"
                                    : "Complete"
                            }
                        </button>

                    </div>
                `;
            })
            .join("");
}


/* =========================================================
   LOAD TASKS
   ========================================================= */

async function loadTasks() {

    state.loadingTasks = true;

    renderTasksLoading();


    try {

        const data =
            await apiRequest(
                `/tasks/${state.telegramId}`
            );


        state.tasks =
            Array.isArray(data)
                ? data
                : Array.isArray(data?.tasks)
                    ? data.tasks
                    : [];


        renderTasks();

        analyzeAdGalaxy();


        return state.tasks;

    } catch (error) {

        console.error(
            "loadTasks:",
            error
        );


        state.tasks = [];

        renderTasksError(
            error.message ||
            "تعذر تحميل المهام"
        );


        throw error;

    } finally {

        state.loadingTasks = false;
    }
}


/* =========================================================
   COMPLETE TASK
   ========================================================= */

async function completeTask(taskId) {

    if (!taskId) return;


    try {

        const data =
            await apiRequest(
                `/tasks/${state.telegramId}/complete/${taskId}`,
                {
                    method: "POST"
                }
            );


        showToast(
            `🎉 تمت المهمة ${
                data?.reward_3m !== undefined
                    ? `+${formatNumber(
                        data.reward_3m
                    )} 3M`
                    : "بنجاح"
            }`
        );


        await loadUser();

        await loadEconomicProfile();

        await loadTasks();


        return data;

    } catch (error) {

        console.error(
            "completeTask:",
            error
        );


        showToast(
            `تعذر إكمال المهمة: ${error.message}`
        );

        throw error;
    }
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
                    "[data-complete-task]"
                );


            if (!button) return;


            const taskId =
                button.dataset.completeTask;


            if (!taskId) return;


            button.disabled = true;

            button.textContent =
                "..." ;


            try {

                await completeTask(taskId);

            } catch (error) {

                button.disabled = false;

                button.textContent =
                    "Complete";
            }
        }
    );
}


/* =========================================================
   SCROLL TASKS
   ========================================================= */

function scrollToTasks() {

    const section =
        $("#tasksSection");


    if (section) {

        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }


    loadTasks().catch(() => {});
}


/* =========================================================
   DAILY REWARD
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


        showToast(
            `🎁 Daily Reward +${formatNumber(
                reward
            )} 3M`
        );


        await loadUser();

        await loadEconomicProfile();

        await loadTasks();


        return data;

    } catch (error) {

        console.error(
            "dailyReward:",
            error
        );


        showToast(
            `Daily Reward: ${error.message}`
        );

        throw error;
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
            "loadReferral:",
            error
        );


        state.referral = null;

        throw error;
    }
}


/* =========================================================
   REFERRAL MODAL
   ========================================================= */

function showReferralModal(data) {

    const existing =
        $("#referralModal");

    if (existing) {

        existing.remove();
    }


    const code =
        data?.referral_code ??
        data?.code ??
        `3M${state.telegramId}`;


    const link =
        data?.referral_link ??
        `https://t.me/${BOT_USERNAME}?start=ref_${code}`;


    const count =
        safeNumber(
            data?.referral_count ??
            data?.count ??
            data?.referred_users ??
            0
        );


    const rewards =
        safeNumber(
            data?.referral_rewards ??
            data?.rewards_3m ??
            data?.rewards ??
            0
        );


    const modal =
        document.createElement("div");

    modal.id =
        "referralModal";

    modal.className =
        "modal-overlay";


    modal.innerHTML = `

        <div class="modal-card referral-modal">

            <button
                class="modal-close"
                data-close-modal
            >
                ×
            </button>


            <div class="modal-icon">
                🤝
            </div>


            <h2>
                Referral Hub
            </h2>


            <p class="modal-subtitle">
                ادعُ أصدقاءك إلى 3Migo
            </p>


            <div class="referral-code-box">

                <span>
                    Your Code
                </span>

                <strong>
                    ${escapeHTML(code)}
                </strong>

            </div>


            <div class="referral-link-box">

                <input
                    id="referralLink"
                    readonly
                    value="${escapeHTML(link)}"
                />

                <button
                    data-copy-referral
                >
                    📋
                </button>

            </div>


            <div class="referral-stats">

                <div>
                    <strong>
                        ${formatNumber(
                            count,
                            0
                        )}
                    </strong>

                    <span>
                        Referrals
                    </span>
                </div>


                <div>
                    <strong>
                        ${formatNumber(
                            rewards
                        )}
                    </strong>

                    <span>
                        Rewards
                    </span>
                </div>

            </div>


            <button
                class="primary-btn"
                data-share-referral
            >
                📤 Share on Telegram
            </button>

        </div>
    `;


    document.body.appendChild(modal);


    modal.addEventListener(
        "click",
        async event => {

            if (
                event.target === modal ||
                event.target.closest(
                    "[data-close-modal]"
                )
            ) {

                modal.remove();

                return;
            }


            if (
                event.target.closest(
                    "[data-copy-referral]"
                )
            ) {

                try {

                    await navigator.clipboard.writeText(
                        link
                    );

                    showToast(
                        "تم نسخ رابط الإحالة."
                    );

                } catch {

                    showToast(
                        "تعذر النسخ تلقائياً."
                    );
                }

                return;
            }


            if (
                event.target.closest(
                    "[data-share-referral]"
                )
            ) {

                const shareUrl =
                    `https://t.me/share/url?url=${encodeURIComponent(
                        link
                    )}&text=${encodeURIComponent(
                        "انضم إلى 3Migo 🚀"
                    )}`;


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
        }
    );
}


async function showReferral() {

    try {

        const data =
            await loadReferral();


        showReferralModal(
            data
        );

    } catch (error) {

        showToast(
            `تعذر تحميل الإحالة: ${error.message}`
        );
    }
}


/* =========================================================
   WALLET
   ========================================================= */

async function showWallet() {

    showToast(
        "جاري تحميل المحفظة..."
    );


    try {

        await Promise.all([
            loadUser(),
            loadEconomicProfile()
        ]);


        let transactions = [];


        try {

            const data =
                await apiRequest(
                    `/transactions/${state.telegramId}`
                );


            transactions =
                Array.isArray(data)
                    ? data
                    : Array.isArray(
                        data?.transactions
                    )
                        ? data.transactions
                        : [];

        } catch (error) {

            console.log(
                "Transactions unavailable:",
                error
            );
        }


        const existing =
            $("#walletModal");

        if (existing) {

            existing.remove();
        }


        const modal =
            document.createElement("div");

        modal.id =
            "walletModal";

        modal.className =
            "modal-overlay";


        modal.innerHTML = `

            <div class="modal-card wallet-modal">

                <button
                    class="modal-close"
                    data-close-modal
                >
                    ×
                </button>


                <div class="modal-icon">
                    💎
                </div>


                <h2>
                    3Migo Wallet
                </h2>


                <p class="modal-subtitle">
                    Your 3Migo financial center
                </p>


                <div class="wallet-main-balance">

                    <span>
                        Main Available
                    </span>

                    <strong>
                        ${formatNumber(
                            state.balance
                        )}
                    </strong>

                    <small>
                        3M
                    </small>

                </div>


                <div class="wallet-metrics">

                    ${walletMetric(
                        "Economic Available",
                        state.economic.unlocked3m,
                        "3M"
                    )}


                    ${walletMetric(
                        "Locked",
                        state.economic.locked3m,
                        "3M"
                    )}


                    ${walletMetric(
                        "Total Mined",
                        state.economic.totalMined,
                        "3M"
                    )}


                    ${walletMetric(
                        "Airdrop",
                        state.economic.airdrop3m,
                        "3M"
                    )}


                    ${walletMetric(
                        "Contribution",
                        state.economic.contributionScore,
                        ""
                    )}


                    ${walletMetric(
                        "Trust",
                        state.economic.trustScore,
                        ""
                    )}

                </div>


                <div class="wallet-level">

                    <span>
                        Experience
                    </span>

                    <strong>
                        LV.${state.experience.level}
                        •
                        ${escapeHTML(
                            state.experience.levelName
                        )}
                    </strong>

                </div>


                <div class="modal-actions">

                    <button
                        class="primary-btn"
                        data-wallet-economy
                    >
                        🏛️ Economy
                    </button>


                    <button
                        class="secondary-btn"
                        data-wallet-spend
                    >
                        💳 Spend
                    </button>

                </div>


                <div class="transactions-section">

                    <h3>
                        Recent Transactions
                    </h3>

                    <div class="transactions-list">

                        ${
                            transactions.length
                                ? transactions
                                    .slice(0, 20)
                                    .map(
                                        renderTransaction
                                    )
                                    .join("")
                                : `
                                    <div class="empty-state">
                                        لا توجد معاملات متاحة.
                                    </div>
                                `
                        }

                    </div>

                </div>


                <div class="economic-warning">

                    <p>
                        Available أعلاه هو الرصيد الرئيسي
                        من User API.
                        Economic Available منفصل
                        ويأتي من Economic API.
                    </p>

                </div>

            </div>
        `;


        document.body.appendChild(modal);


        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal ||
                    event.target.closest(
                        "[data-close-modal]"
                    )
                ) {

                    modal.remove();

                    return;
                }


                if (
                    event.target.closest(
                        "[data-wallet-economy]"
                    )
                ) {

                    modal.remove();

                    showEconomicDashboard();

                    return;
                }


                if (
                    event.target.closest(
                        "[data-wallet-spend]"
                    )
                ) {

                    modal.remove();

                    showSpendDialog();
                }
            }
        );

    } catch (error) {

        console.error(
            "showWallet:",
            error
        );


        showToast(
            `تعذر فتح المحفظة: ${error.message}`
        );
    }
}


function walletMetric(
    title,
    value,
    suffix = ""
) {

    return `

        <div class="wallet-metric">

            <span>
                ${escapeHTML(title)}
            </span>

            <strong>
                ${formatNumber(value)}
                ${suffix
                    ? ` ${escapeHTML(suffix)}`
                    : ""}
            </strong>

        </div>
    `;
}


function renderTransaction(transaction) {

    const type =
        transaction.type ||
        transaction.action ||
        "Transaction";


    const amount =
        safeNumber(
            transaction.amount_3m ??
            transaction.amount ??
            transaction.reward_3m ??
            0
        );


    const created =
        transaction.created_at ||
        transaction.timestamp ||
        "";


    const positive =
        amount >= 0;


    return `

        <div class="transaction-item">

            <div class="transaction-icon">
                ${positive ? "↗️" : "↘️"}
            </div>

            <div class="transaction-content">

                <strong>
                    ${escapeHTML(type)}
                </strong>

                <small>
                    ${escapeHTML(
                        String(created)
                    )}
                </small>

            </div>

            <strong class="transaction-amount">
                ${positive ? "+" : ""}
                ${formatNumber(amount)}
                3M
            </strong>

        </div>
    `;
}


/* =========================================================
   3MIGO AI
   LOCAL KNOWLEDGE UI
   ========================================================= */

const AI_KNOWLEDGE = {

    rewards: `
        يمكنك زيادة مكافآتك من خلال الالتزام بدورات
        التعدين، تنفيذ المهام المتاحة، استخدام المكافأة
        اليومية، والمشاركة في الإحالات وفق القواعد
        الموجودة في النظام.
    `,

    locked: `
        Locked يمثل الرصيد الاقتصادي المقيد وفق بيانات
        Economic API، بينما Economic Available يمثل
        الرصيد الاقتصادي المتاح للاستخدام وفق النظام.
        ولا ينبغي الخلط بينهما وبين Main Available
        الموجود في User API.
    `,

    economy: `
        اقتصاد 3Migo في هذه المرحلة يعتمد على البيانات
        والحسابات الموجودة في النظام. واجهة التطبيق لا
        تضيف إيرادات أو قيمة سوقية من تلقاء نفسها.
        أي إيراد حقيقي يحتاج إلى مصدر فعلي ومسجل في
        النظام.
    `,

    tasks: `
        المهام المتاحة يتم تحميلها مباشرة من Tasks API.
        يمكن أن تشمل مهام زيارة أو قناة أو ترويج أو
        أنواعاً أخرى بحسب ما يقدمه الخادم.
    `
};


function show3MigoAI() {

    const existing =
        $("#aiModal");

    if (existing) {

        existing.remove();
    }


    const modal =
        document.createElement("div");

    modal.id =
        "aiModal";

    modal.className =
        "modal-overlay";


    modal.innerHTML = `

        <div class="modal-card ai-modal">

            <button
                class="modal-close"
                data-close-modal
            >
                ×
            </button>


            <div class="modal-icon">
                🤖
            </div>


            <h2>
                3Migo AI
            </h2>


            <p class="modal-subtitle">
                مساعدك داخل منظومة 3Migo
            </p>


            <div class="ai-status">
                🟢 Local Knowledge Engine
            </div>


            <div
                id="aiMessages"
                class="ai-messages"
            >

                <div class="ai-message assistant">
                    مرحباً بك في 3Migo AI.
                    اسألني عن التعدين أو المحفظة
                    أو الاقتصاد أو المهام.
                </div>

            </div>


            <div class="ai-quick-actions">

                <button
                    data-ai-question="rewards"
                >
                    💰 زيادة المكافآت
                </button>

                <button
                    data-ai-question="locked"
                >
                    🔒 Locked / Available
                </button>

                <button
                    data-ai-question="economy"
                >
                    🏛️ الاقتصاد
                </button>

                <button
                    data-ai-question="tasks"
                >
                    🎯 المهام
                </button>

            </div>


            <div class="ai-input-row">

                <input
                    id="aiInput"
                    type="text"
                    placeholder="اكتب سؤالك..."
                    maxlength="500"
                />

                <button
                    data-ai-send
                >
                    ➤
                </button>

            </div>


            <div class="ai-disclaimer">
                AI Engine الحالي محلي داخل الواجهة،
                وليس اتصالاً بخدمة ذكاء اصطناعي خارجية.
            </div>

        </div>
    `;


    document.body.appendChild(modal);


    const input =
        modal.querySelector(
            "#aiInput"
        );


    modal.addEventListener(
        "click",
        event => {

            if (
                event.target === modal ||
                event.target.closest(
                    "[data-close-modal]"
                )
            ) {

                modal.remove();

                return;
            }


            const questionButton =
                event.target.closest(
                    "[data-ai-question]"
                );


            if (questionButton) {

                const key =
                    questionButton.dataset.aiQuestion;


                const answer =
                    AI_KNOWLEDGE[key] ||
                    "لا توجد إجابة متاحة.";


                addAIMessage(
                    key,
                    answer
                );

                return;
            }


            if (
                event.target.closest(
                    "[data-ai-send]"
                )
            ) {

                ask3MigoAI(
                    input?.value || "",
                    modal
                );
            }
        }
    );


    if (input) {

        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    ask3MigoAI(
                        input.value,
                        modal
                    );
                }
            }
        );
    }
}


function addAIMessage(
    userMessage,
    assistantMessage
) {

    const container =
        $("#aiMessages");

    if (!container) return;


    const user =
        document.createElement("div");

    user.className =
        "ai-message user";


    user.textContent =
        userMessage;


    container.appendChild(user);


    const assistant =
        document.createElement("div");

    assistant.className =
        "ai-message assistant";


    assistant.textContent =
        assistantMessage;


    container.appendChild(
        assistant
    );


    container.scrollTop =
        container.scrollHeight;


    state.aiMessages.push({
        user: userMessage,
        assistant: assistantMessage
    });
}


function findAIAnswer(message) {

    const text =
        String(message)
            .toLowerCase();


    if (
        text.includes("reward") ||
        text.includes("مكاف") ||
        text.includes("ربح") ||
        text.includes("تعدين")
    ) {

        return AI_KNOWLEDGE.rewards;
    }


    if (
        text.includes("locked") ||
        text.includes("available") ||
        text.includes("رصيد") ||
        text.includes("مقفل")
    ) {

        return AI_KNOWLEDGE.locked;
    }


    if (
        text.includes("economy") ||
        text.includes("اقتصاد") ||
        text.includes("قيمة")
    ) {

        return AI_KNOWLEDGE.economy;
    }


    if (
        text.includes("task") ||
        text.includes("مهام")
    ) {

        return AI_KNOWLEDGE.tasks;
    }


    if (
        text.includes("wallet") ||
        text.includes("محفظ")
    ) {

        return `
            محفظتك تحتوي على Main Available من User API،
            بالإضافة إلى Economic Available وLocked من
            Economic API. يتم عرضهما منفصلين لتجنب
            الخلط بين الطبقتين.
        `;
    }


    if (
        text.includes("level") ||
        text.includes("مستوى") ||
        text.includes("xp")
    ) {

        return `
            مستوى الخبرة الحالي هو
            LV.${state.experience.level}
            ${state.experience.levelName}
            مع ${formatNumber(
                state.experience.score,
                0
            )} XP.
            هذا نظام تجربة واجهة Frontend ولا يمثل
            قيمة مالية.
        `;
    }


    return `
        أستطيع مساعدتك حالياً في:
        التعدين، المكافآت، المحفظة، الاقتصاد،
        المهام ومستوى الخبرة.
    `;
}


function ask3MigoAI(
    message,
    modal
) {

    const text =
        String(message || "")
            .trim();


    if (!text) {

        showToast(
            "اكتب سؤالك أولاً."
        );

        return;
    }


    const answer =
        findAIAnswer(text);


    addAIMessage(
        text,
        answer
    );


    const input =
        modal?.querySelector(
            "#aiInput"
        );


    if (input) {

        input.value = "";

        input.focus();
    }
}


/* =========================================================
   V4 / MASTER HUB
   ========================================================= */

function injectV4HubButton() {

    if (
        $("#v4HubButton")
    ) {

        return;
    }


    const button =
        document.createElement("button");

    button.id =
        "v4HubButton";

    button.type =
        "button";

    button.innerHTML =
        "⚡ 3Migo V5";


    button.addEventListener(
        "click",
        showV4Hub
    );


    document.body.appendChild(
        button
    );
}


function v4HubButton(
    icon,
    title,
    subtitle,
    action
) {

    return `

        <button
            class="v4-hub-action"
            data-hub-action="${escapeHTML(action)}"
        >

            <span class="v4-hub-icon">
                ${icon}
            </span>

            <span class="v4-hub-text">

                <strong>
                    ${escapeHTML(title)}
                </strong>

                <small>
                    ${escapeHTML(subtitle)}
                </small>

            </span>

            <span>
                →
            </span>

        </button>
    `;
}


function showV4Hub() {

    const existing =
        $("#v4HubModal");

    if (existing) {

        existing.remove();
    }


    const modal =
        document.createElement("div");

    modal.id =
        "v4HubModal";

    modal.className =
        "modal-overlay";


    modal.innerHTML = `

        <div class="modal-card v4-hub-modal">

            <button
                class="modal-close"
                data-close-modal
            >
                ×
            </button>


            <div class="modal-icon">
                ⚡
            </div>


            <h2>
                3Migo Master Hub
            </h2>


            <p class="modal-subtitle">
                مركز التحكم بالتجربة الجديدة
            </p>


            <div class="v4-hub-level">

                <div>

                    <span>
                        Current Level
                    </span>

                    <strong>
                        LV.${state.experience.level}
                        •
                        ${escapeHTML(
                            state.experience.levelName
                        )}
                    </strong>

                </div>


                <div>

                    <span>
                        Experience
                    </span>

                    <strong>
                        ${formatNumber(
                            state.experience.score,
                            0
                        )} XP
                    </strong>

                </div>

            </div>


            <div class="v4-hub-actions">

                ${v4HubButton(
                    "🌌",
                    "Ad Galaxy",
                    "Explore ad tasks",
                    "ad-galaxy"
                )}


                ${v4HubButton(
                    "💎",
                    "Wallet",
                    "Main & economic balances",
                    "wallet"
                )}


                ${v4HubButton(
                    "🤖",
                    "3Migo AI",
                    "Smart local assistant",
                    "ai"
                )}


                ${v4HubButton(
                    "🏛️",
                    "Economy Center",
                    "Economic experience",
                    "economic"
                )}

            </div>


            <div class="economic-warning">

                <p>
                    Master Hub هو طبقة تجربة للواجهة.
                    البيانات المالية الفعلية تأتي من
                    API الخلفي.
                </p>

            </div>

        </div>
    `;


    document.body.appendChild(
        modal
    );


    modal.addEventListener(
        "click",
        event => {

            if (
                event.target === modal ||
                event.target.closest(
                    "[data-close-modal]"
                )
            ) {

                modal.remove();

                return;
            }


            const button =
                event.target.closest(
                    "[data-hub-action]"
                );


            if (!button) return;


            const action =
                button.dataset.hubAction;


            modal.remove();


            switch (action) {

                case "ad-galaxy":
                    showAdGalaxy();
                    break;

                case "wallet":
                    showWallet();
                    break;

                case "ai":
                    show3MigoAI();
                    break;

                case "economic":
                    showEconomicDashboard();
                    break;
            }
        }
    );
}


/* =========================================================
   PROFILE
   ========================================================= */

function showProfile() {

    showToast(
        `👤 @${state.username} | Telegram ID: ${state.telegramId}`,
        5000
    );
}


/* =========================================================
   BOTTOM NAV
   ========================================================= */

function setActiveNavigation(action) {

    const navButtons =
        $all(
            "[data-action]"
        );


    navButtons.forEach(button => {

        const current =
            button.dataset.action;


        if (
            [
                "home",
                "mine",
                "tasks",
                "wallet",
                "profile"
            ].includes(current)
        ) {

            button.classList.toggle(
                "active",
                current === action
            );
        }
    });
}


/* =========================================================
   ACTIONS
   ========================================================= */

function setupActions() {

    document.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "[data-action]"
                );


            if (!button) return;


            const action =
                button.dataset.action;


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


                case "mine":

                    const miningSection =
                        $("#miningSection") ||
                        $("#mineBtn");

                    if (miningSection) {

                        miningSection.scrollIntoView({
                            behavior: "smooth",
                            block: "center"
                        });
                    }

                    break;


                case "daily":

                    await dailyReward();

                    break;


                case "referral":

                    await showReferral();

                    break;


                case "wallet":

                    await showWallet();

                    break;


                case "profile":

                    showProfile();

                    break;


                case "economic":

                    showEconomicDashboard();

                    break;


                case "airdrop":

                    await loadAirdropPreview();

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
   ECONOMIC BUTTON
   ========================================================= */

function setupEconomicButton() {

    const button =
        document.querySelector(
            "[data-action='economic']"
        ) ||
        $("#economicBtn") ||
        $("#economicDashboardBtn");


    if (!button) return;


    if (
        button.dataset.economicBound ===
        "true"
    ) {

        return;
    }


    button.dataset.economicBound =
        "true";


    button.addEventListener(
        "click",
        event => {

            event.preventDefault();

            showEconomicDashboard();
        }
    );
}


/* =========================================================
   V4 ACTION BUTTONS
   ========================================================= */

function setupV4Actions() {

    const buttons =
        $all(
            "[data-action='ad-galaxy'], [data-action='ai']"
        );


    buttons.forEach(button => {

        if (
            button.dataset.v4Bound ===
            "true"
        ) {

            return;
        }


        button.dataset.v4Bound =
            "true";
    });
}


/* =========================================================
   MINING SETUP
   ========================================================= */

function setupMining() {

    const button =
        $("#mineBtn");


    if (!button) return;


    if (
        button.dataset.miningBound ===
        "true"
    ) {

        return;
    }


    button.dataset.miningBound =
        "true";


    button.addEventListener(
        "click",
        handleMiningButton
    );
}


/* =========================================================
   MASTER UI LIVE SYNC
   ========================================================= */

function refreshMasterUI() {

    updateBalanceUI();

    updateEconomicUI();

    updateExperienceLevel();

    updateExperienceUI();

    updateMiningUI();

    analyzeAdGalaxy();
}


/* =========================================================
   PAGE VISIBILITY
   ========================================================= */

function setupVisibilitySync() {

    document.addEventListener(
        "visibilitychange",
        async () => {

            if (
                document.visibilityState ===
                "visible"
            ) {

                try {

                    await loadUser();

                    await loadEconomicProfile();

                    await loadMiningStatus();

                    refreshMasterUI();

                } catch (error) {

                    console.log(
                        "Visibility sync:",
                        error
                    );
                }
            }
        }
    );
}


/* =========================================================
   ESC KEY
   ========================================================= */

function setupEscapeKey() {

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !==
                "Escape"
            ) {

                return;
            }


            const modals =
                $all(
                    ".modal-overlay"
                );


            const last =
                modals[
                    modals.length - 1
                ];


            if (last) {

                last.remove();
            }
        }
    );
}


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initializeApp() {

    try {

        getTelegramUser();


        /*
         * Register / verify user first.
         */

        await ensureUserRegistered();


        /*
         * Main account data.
         */

        await loadUser();


        /*
         * Economic layer.
         */

        await loadEconomicProfile();


        /*
         * Mining state.
         */

        await loadMiningStatus();


        /*
         * Tasks.
         */

        try {

            await loadTasks();

        } catch (error) {

            console.log(
                "Initial tasks load failed:",
                error
            );
        }


        /*
         * Experience layer.
         */

        updateExperienceLevel();


        /*
         * UI events.
         */

        setupTaskEvents();

        setupActions();

        setupMining();

        setupEconomicButton();

        setupV4Actions();

        setupVisibilitySync();

        setupEscapeKey();


        /*
         * Master Hub.
         */

        injectV4HubButton();


        /*
         * Final synchronization.
         */

        refreshMasterUI();


        console.log(
            "3Migo V5 initialized",
            {
                telegramId:
                    state.telegramId,

                username:
                    state.username,

                balance:
                    state.balance,

                economic:
                    state.economic,

                experience:
                    state.experience,

                adGalaxy:
                    state.adGalaxy
            }
        );


    } catch (error) {

        console.error(
            "3Migo initialization error:",
            error
        );


        showToast(
            "حدث خطأ أثناء تشغيل 3Migo. حاول إعادة فتح التطبيق.",
            6000
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

    updateExperienceLevel,

    refreshMasterUI
};


/* =========================================================
   GLOBAL V5 FUNCTIONS
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
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApp
    );

} else {

    initializeApp();
}
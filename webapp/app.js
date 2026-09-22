/* =========================================================
   3Migo Coin - Telegram Mini App
   Frontend Controller
   Version 2.2.0
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
        console.warn("Telegram UI settings unavailable:", error);
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

    balance: 0,

    total: 0,

    today: 0,

    sessions: 0,

    miningActive: false,

    miningRemaining: 0,

    miningReward: 10,

    miningTimer: null,

    tasks: [],

    referral: null,

    loadingTasks: false,

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
   API
   ========================================================= */

async function apiRequest(
    endpoint,
    options = {}
) {

    const url =
        `${API_BASE}${endpoint}`;

    const config = {
        method: options.method || "GET",
        headers: {
            "Content-Type": "application/json",
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
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {

        const message =
            data?.detail ||
            data?.message ||
            `HTTP ${response.status}`;

        throw new Error(message);
    }

    return data;
}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(
    message,
    duration = 3000
) {

    const toast = $("toast");

    if (!toast) {
        return;
    }

    toast.textContent = message;

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
   REGISTER USER
   ========================================================= */

async function ensureUserRegistered() {

    const user =
        getTelegramUser();

    state.telegramUser = user;

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
            "User not found, registering..."
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
   UPDATE BALANCE UI
   ========================================================= */

function updateBalanceUI() {

    const balance =
        $("balance");

    if (balance) {

        balance.innerHTML =
            `${state.balance.toFixed(2)}
             <span>3M</span>`;
    }


    const total =
        $("total");

    if (total) {

        total.textContent =
            `${state.total.toFixed(2)} 3M`;
    }


    const today =
        $("today");

    if (today) {

        today.textContent =
            `${state.today.toFixed(2)} 3M`;
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
        return;
    }

    state.loadingUser = true;

    try {

        const user =
            await apiRequest(
                `/user/${state.telegramId}`
            );

        if (!user) {
            return;
        }


        state.balance =
            safeNumber(
                user.balance_3m ??
                user.balance ??
                user.balance3m
            );


        state.total =
            safeNumber(
                user.total_earned ??
                user.total ??
                user.total_3m
            );


        state.today =
            safeNumber(
                user.today_earned ??
                user.today ??
                user.today_3m
            );


        state.sessions =
            safeNumber(
                user.mining_sessions ??
                user.sessions
            );


        updateBalanceUI();

    } catch (error) {

        console.warn(
            "Unable to load user:",
            error
        );
    }

    state.loadingUser = false;
}


/* =========================================================
   MINING STATUS
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


function updateMiningUI() {

    const stateElement =
        $("miningState");

    const button =
        $("mineBtn");


    if (!state.miningActive) {

        if (stateElement) {
            stateElement.textContent =
                "جاهز";
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


/* =========================================================
   LOAD MINING STATUS
   ========================================================= */

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


/* =========================================================
   MINING COUNTDOWN
   ========================================================= */

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

            if (
                state.miningRemaining > 0
            ) {

                state.miningRemaining--;

                updateMiningUI();

                return;
            }


            clearInterval(
                state.miningTimer
            );

            state.miningActive =
                false;

            state.miningRemaining =
                0;

            updateMiningUI();

            showToast(
                "اكتملت دورة التعدين. يمكنك الآن استلام مكافأتك."
            );

        }, 1000);
}


/* =========================================================
   START MINING
   ========================================================= */

async function startMining() {

    if (state.miningActive) {

        showToast(
            `التعدين نشط — المتبقي ${formatTime(state.miningRemaining)}`
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


        state.miningActive =
            true;


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


        const reward =
            safeNumber(
                data?.reward_3m ??
                data?.reward ??
                state.miningReward
            );


        state.miningActive =
            false;

        state.miningRemaining =
            0;


        state.balance += reward;

        state.total += reward;

        state.today += reward;

        state.sessions += 1;


        updateBalanceUI();

        updateMiningUI();

        showToast(
            `تم استلام ${reward} 3M بنجاح 🎉`
        );

    } catch (error) {

        showToast(
            `تعذر استلام المكافأة: ${error.message}`
        );
    }
}


/* =========================================================
   MINING BUTTON
   ========================================================= */

function handleMiningButton() {

    if (state.miningActive) {

        if (
            state.miningRemaining <= 0
        ) {

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
            <span>⏳</span>
            <span>جاري تحميل المهام...</span>
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
                Number(
                    task.completed
                ) === 1 ||
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
                            +${reward} 3M
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
}


/* =========================================================
   LOAD TASKS
   ========================================================= */

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

            state.tasks =
                data;

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


/* =========================================================
   COMPLETE TASK
   ========================================================= */

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


        showToast(
            `تم إنجاز المهمة وإضافة ${reward} 3M 🎉`
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


/* =========================================================
   TASK CLICK EVENTS
   ========================================================= */

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


/* =========================================================
   SCROLL TO TASKS
   ========================================================= */

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


    setTimeout(() => {

        loadTasks();

    }, 150);
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


        state.balance += reward;

        state.total += reward;

        state.today += reward;


        updateBalanceUI();


        showToast(
            `تم استلام المكافأة اليومية: ${reward} 3M 🎁`
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


/* =========================================================
   REFERRAL MODAL
   ========================================================= */

function showReferralModal(data) {

    if (!data) {
        return;
    }


    const code =
        data.referral_code ||
        `3M${state.telegramId}`;


    const referralLink =
        `https://t.me/${BOT_USERNAME}?start=ref_${code}`;


    const old =
        document.getElementById(
            "referralModal"
        );


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
                        ${safeNumber(data.referral_count)}
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
                        ${safeNumber(data.referral_rewards).toFixed(2)}
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
                    typeof tg.openTelegramLink === "function"
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

            if (
                event.target === modal
            ) {
                modal.remove();
            }
        }
    );
}


/* =========================================================
   REFERRAL BUTTON
   ========================================================= */

async function showReferral() {

    const data =
        await loadReferral();

    if (data) {
        showReferralModal(data);
    }
}


/* =========================================================
   WALLET
   ========================================================= */

async function showWallet() {

    try {

        const transactions =
            await apiRequest(
                `/transactions/${state.telegramId}`
            );


        const list =
            Array.isArray(transactions)
                ? transactions
                : transactions?.transactions || [];


        let message =
            `رصيدك الحالي: ${state.balance.toFixed(2)} 3M`;


        if (list.length > 0) {

            message +=
                `\n\nآخر العمليات: ${list.length}`;
        }


        showToast(message);

    } catch (error) {

        showToast(
            `الرصيد الحالي: ${state.balance.toFixed(2)} 3M`
        );
    }
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
        `${username} — ID: ${state.telegramId}`
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

            }
        }
    );
}


/* =========================================================
   MINE BUTTON SETUP
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
   INITIALIZATION
   ========================================================= */

async function initializeApp() {

    console.log(
        "3Migo Coin Mini App starting..."
    );


    await ensureUserRegistered();


    await loadUser();


    await loadMiningStatus();


    await loadTasks();


    setupTaskEvents();

    setupActions();

    setupMining();


    updateBalanceUI();

    updateMiningUI();


    console.log(
        "3Migo Coin Mini App ready.",
        {
            telegramId:
                state.telegramId,

            tasks:
                state.tasks.length
        }
    );
}


/* =========================================================
   PUBLIC API
   ========================================================= */

window.ThreeMigo = {

    state,

    loadTasks,

    completeTask,

    startMining,

    claimMining,

    loadMiningStatus,

    loadReferral,

    showReferral,

    dailyReward,

    showWallet,

    showProfile

};


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
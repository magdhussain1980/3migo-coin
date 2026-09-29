/* =========================================================
   3MIGO COIN — APP.JS V5.8
   PREMIUM REWARDS HUB + SAFE REWARD EXPERIENCE

   IMPORTANT:
   - Backend/API contracts preserved
   - Mining economy preserved
   - Referral economy preserved
   - Airdrop/economic endpoints preserved
   - No database changes
   - Home Mining Button + Mining Page Button use ONE shared state
   - AdsGram Reward integration preserved
   - Ads do NOT directly modify balance
   - Rewards Hub preserved and improved
   - Reward Wheel is frontend experience only
   - Wheel rewards are NOT added locally to wallet
   - No fake economic balance
   - One session demo spin is allowed for UX testing
========================================================= */

(() => {
    "use strict";

    /* =====================================================
       TELEGRAM WEB APP
    ===================================================== */

    const tg = window.Telegram?.WebApp || null;

    if (tg) {
        try {
            tg.ready();
            tg.expand();

            tg.setHeaderColor?.("#04142a");
            tg.setBackgroundColor?.("#031024");
        } catch (error) {
            console.log(
                "Telegram UI settings unavailable:",
                error
            );
        }
    }

    /* =====================================================
       CONFIG
    ===================================================== */

    const API_BASE = window.location.origin;
    const BOT_USERNAME = "threemigosmart_bot";
    const FALLBACK_TELEGRAM_ID = 1;

    const MINING_CYCLE_HOURS = 12;
    const MINING_CYCLE_SECONDS =
        MINING_CYCLE_HOURS * 60 * 60;

    const MINING_REWARD = 10;

    /* =====================================================
       ADSGRAM
    ===================================================== */

    const ADSGRAM_BLOCK_ID = "50727";

    let adsgramController = null;
    let adsgramLoading = false;

    /* =====================================================
       STATE
    ===================================================== */

    const state = {

        telegramUser: null,

        telegramId:
            FALLBACK_TELEGRAM_ID,

        username: "",

        balance: 0,
        total: 0,
        today: 0,
        sessions: 0,

        /* ===============================
           ONE SHARED MINING STATE
        =============================== */

        miningActive: false,
        miningRemaining: 0,
        miningReward:
            MINING_REWARD,

        miningCompleted: false,

        miningTimer: null,

        miningRequestPending: false,

        /* ===============================
           TASKS
        =============================== */

        tasks: [],

        /* ===============================
           REFERRAL
        =============================== */

        referralCode: "",
        referralLink: "",
        referralCount: 0,
        referralEarned: 0,

        /* ===============================
           ECONOMIC
        =============================== */

        economic: {

            totalMined: 0,
            locked3m: 0,
            unlocked3m: 0,
            airdrop3m: 0,

            contributionScore: 0,
            trustScore: 0

        },

        /* ===============================
           EXPERIENCE
        =============================== */

        experience: {

            level: 1,
            name: "Starter",
            progress: 0,
            score: 0,
            nextScore: 100

        },

        growthIndex: 0,

        /* ===============================
           REWARDS HUB
        =============================== */

        rewards: {

            spinsAvailable: 0,

            earned3m: 0,

            dailyActivity: 0,

            wheelBusy: false,

            lastWheelReward: null,

            pendingRewards: [],

            initialized: false,

            /*
             * UX-only session spin.
             * It does NOT create wallet balance.
             */
            sessionDemoSpinUsed: false

        },

        transactions: [],

        currentView: "home",

        aiMessages: [],

        loading: false
    };

    /* =====================================================
       REWARD WHEEL CONFIGURATION

       IMPORTANT:
       These are display outcomes only.

       No wallet balance is modified locally.
    ===================================================== */

    const REWARD_WHEEL_SEGMENTS = [

        {
            id: "reward-3",
            label: "+3M",
            amount: 3
        },

        {
            id: "reward-5",
            label: "+5M",
            amount: 5
        },

        {
            id: "reward-10",
            label: "+10M",
            amount: 10
        },

        {
            id: "reward-3-b",
            label: "+3M",
            amount: 3
        },

        {
            id: "reward-5-b",
            label: "+5M",
            amount: 5
        },

        {
            id: "bonus",
            label: "BONUS",
            amount: 0
        }

    ];

    /* =====================================================
       HELPERS
    ===================================================== */

    function $(selector) {
        return document.querySelector(selector);
    }

    function $all(selector) {
        return Array.from(
            document.querySelectorAll(selector)
        );
    }

    function setText(selector, value) {

        const element = $(selector);

        if (element) {
            element.textContent =
                value ?? "";
        }
    }

    function setValue(selector, value) {

        const element = $(selector);

        if (element) {
            element.value =
                value ?? "";
        }
    }

    function safeNumber(
        value,
        fallback = 0
    ) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    }

    function formatNumber(value) {

        return safeNumber(value)
            .toLocaleString(
                "en-US",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            );
    }

    function formatInteger(value) {

        return Math.round(
            safeNumber(value)
        ).toLocaleString("en-US");
    }

    function formatTime(seconds) {

        seconds = Math.max(
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

            String(hours)
                .padStart(2, "0"),

            String(minutes)
                .padStart(2, "0"),

            String(secs)
                .padStart(2, "0")

        ].join(":");
    }

    function toast(message) {

        const element =
            $("#toast");

        if (!element) {
            console.log(message);
            return;
        }

        const messageElement =
            $("#toastMessage");

        if (messageElement) {

            messageElement.textContent =
                message;

        } else {

            element.textContent =
                message;
        }

        element.hidden = false;

        clearTimeout(
            toast._timer
        );

        toast._timer =
            setTimeout(() => {

                element.hidden =
                    true;

            }, 2600);
    }

    /* =====================================================
       TELEGRAM USER
    ===================================================== */

    function getTelegramUser() {

        try {

            const user =
                tg?.initDataUnsafe?.user;

            if (user?.id) {
                return user;
            }

        } catch (error) {

            console.log(
                "Telegram user read error:",
                error
            );
        }

        return null;
    }

    function initializeTelegramUser() {

        const user =
            getTelegramUser();

        if (user) {

            state.telegramUser =
                user;

            state.telegramId =
                user.id;

            state.username =
                user.username ||
                user.first_name ||
                "3Migo User";

        } else {

            state.telegramId =
                FALLBACK_TELEGRAM_ID;

            state.username =
                "3Migo User";
        }
    }

    /* =====================================================
       API
    ===================================================== */

    async function apiRequest(
        path,
        options = {}
    ) {

        const url =
            `${API_BASE}${path}`;

        const requestOptions = {

            method:
                options.method || "GET",

            headers: {

                "Content-Type":
                    "application/json",

                ...(options.headers || {})
            }
        };

        if (
            options.body !== undefined
        ) {

            requestOptions.body =
                typeof options.body ===
                "string"

                    ? options.body

                    : JSON.stringify(
                        options.body
                    );
        }

        const response =
            await fetch(
                url,
                requestOptions
            );

        const text =
            await response.text();

        let data = {};

        try {

            data =
                text
                    ? JSON.parse(text)
                    : {};

        } catch {

            data = {
                raw: text
            };
        }

        if (!response.ok) {

            const message =
                data?.detail ||
                data?.message ||
                data?.error ||
                `HTTP ${response.status}`;

            throw new Error(
                message
            );
        }

        return data;
    }

    /* =====================================================
       USER
    ===================================================== */

    async function registerUser() {

        const id =
            state.telegramId;

        try {

            return await apiRequest(
                `/user/${id}`,
                {
                    method: "GET"
                }
            );

        } catch (error) {

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

            } catch (secondError) {

                console.log(
                    "User registration/load:",
                    secondError
                );

                return null;
            }
        }
    }

    async function loadUser() {

        try {

            const data =
                await apiRequest(
                    `/user/${state.telegramId}`
                );

            applyUserData(data);

        } catch (error) {

            console.log(
                "loadUser:",
                error
            );
        }

        updateProfileUI();
    }

    function applyUserData(data) {

        if (!data) return;

        const user =
            data.user ||
            data.data ||
            data;

        state.balance =
            safeNumber(
                user.balance ??
                user.balance_3m ??
                data.balance
            );

        state.total =
            safeNumber(
                user.total ??
                user.total_earned ??
                data.total
            );

        state.today =
            safeNumber(
                user.today ??
                user.today_earned ??
                data.today
            );

        state.sessions =
            safeNumber(
                user.sessions ??
                user.mining_sessions ??
                data.sessions
            );

        if (
            user.username ||
            data.username
        ) {

            state.username =
                user.username ||
                data.username;
        }

        updateBalanceUI();
    }

    /* =====================================================
       BALANCE UI
    ===================================================== */

    function updateBalanceUI() {

        const balance =
            formatNumber(
                state.balance
            );

        const today =
            formatNumber(
                state.today
            );

        const total =
            formatNumber(
                state.total
            );

        const sessions =
            formatInteger(
                state.sessions
            );

        setText(
            "#balanceValue",
            balance
        );

        setText(
            "#todayValue",
            today
        );

        setText(
            "#totalValue",
            total
        );

        setText(
            "#sessionsValue",
            sessions
        );

        setText(
            "#walletBalance",
            balance
        );

        setText(
            "#walletTotal",
            `${total} 3M`
        );

        setText(
            "#walletToday",
            `${today} 3M`
        );

        setText(
            "#walletSessions",
            sessions
        );

        setText(
            "#modalWalletBalance",
            balance
        );

        const cardNumber =
            makeMemberCardNumber(
                state.telegramId
            );

        setText(
            "#memberCardNumber",
            cardNumber
        );

        setText(
            "#walletMemberNumber",
            cardNumber
        );
    }

    function makeMemberCardNumber(id) {

        const value =
            String(
                id ||
                "00000000"
            );

        const last12 =
            value
                .padStart(12, "0")
                .slice(-12);

        return [

            "3M",

            last12.slice(0, 4),

            last12.slice(4, 8),

            last12.slice(8, 12)

        ].join(" • ");
    }

    /* =====================================================
       PROFILE
    ===================================================== */

    function updateProfileUI() {

        setText(
            "#profileUsername",
            state.username ||
            "3Migo User"
        );

        setText(
            "#profileTelegramId",
            `Telegram ID: ${state.telegramId}`
        );

        setText(
            "#profileMemberId",
            `Member ID: ${makeMemberId()}`
        );
    }

    function makeMemberId() {

        return `3M-${String(
            state.telegramId
        ).padStart(8, "0")}`;
    }

    /* =====================================================
       MINING
       ONE CENTRAL STATE FOR BOTH BUTTONS
    ===================================================== */

    function getMiningProgress() {

        if (
            state.miningRemaining <= 0
        ) {

            return state.miningCompleted
                ? 100
                : 0;
        }

        const elapsed =
            MINING_CYCLE_SECONDS -
            state.miningRemaining;

        return Math.max(
            0,
            Math.min(
                100,
                (
                    elapsed /
                    MINING_CYCLE_SECONDS
                ) * 100
            )
        );
    }

    function updateMiningProgressVisual() {

        const progress =
            getMiningProgress();

        const degrees =
            progress * 3.6;

        const rings = [

            "#miningProgressRing",

            "#miningPageProgressRing"

        ];

        rings.forEach(
            selector => {

                const ring =
                    $(selector);

                if (!ring) return;

                ring.style.setProperty(
                    "--mine-progress",
                    `${degrees}deg`
                );

                ring.style.setProperty(
                    "--progress",
                    `${degrees}deg`
                );
            }
        );

        const timeline =
            $("#miningProgress");

        if (timeline) {

            timeline.style.width =
                `${progress}%`;
        }

        const pageTimeline =
            $("#miningPageProgress");

        if (pageTimeline) {

            pageTimeline.style.width =
                `${progress}%`;
        }
    }

    function updateMiningButton(
        buttonSelector,
        textSelector
    ) {

        const button =
            $(buttonSelector);

        if (!button) return;

        const text =
            $(textSelector);

        let label;

        if (
            state.miningActive
        ) {

            label =
                "Mining Active";

            button.classList.add(
                "mining-active"
            );

            button.classList.remove(
                "claim-ready"
            );

            button.disabled =
                false;

        } else if (
            state.miningCompleted
        ) {

            label =
                "استلام المكافأة";

            button.classList.remove(
                "mining-active"
            );

            button.classList.add(
                "claim-ready"
            );

            button.disabled =
                false;

        } else {

            label =
                "ابدأ التعدين";

            button.classList.remove(
                "mining-active"
            );

            button.classList.remove(
                "claim-ready"
            );

            button.disabled =
                false;
        }

        if (text) {

            text.textContent =
                label;
        }

        button.setAttribute(
            "aria-label",
            label
        );
    }

    function updateMiningUI() {

        const active =
            state.miningActive;

        const completed =
            state.miningCompleted;

        const remaining =
            state.miningRemaining;

        const timer =
            formatTime(
                remaining
            );

        let status;

        if (active) {

            status =
                "Mining Active";

        } else if (completed) {

            status =
                "يمكن استلام المكافأة";

        } else {

            status =
                "جاهز للتعدين";
        }

        setText(
            "#miningState",
            status
        );

        setText(
            "#miningTimer",
            timer
        );

        setText(
            "#miningPageState",
            status
        );

        setText(
            "#miningPageTimer",
            timer
        );

        setText(
            "#miningPageStatus",
            active
                ? "ACTIVE"
                : completed
                    ? "CLAIM"
                    : "READY"
        );

        updateMiningButton(
            "#mineBtn",
            "#mineBtnText"
        );

        updateMiningButton(
            "#mineBtnPage",
            "#mineBtnPageText"
        );

        updateMiningProgressVisual();
    }

    /* =====================================================
       LOAD MINING STATUS
    ===================================================== */

    async function loadMiningStatus() {

        try {

            const data =
                await apiRequest(
                    `/mining/${state.telegramId}/status`
                );

            const mining =
                data?.mining ||
                data?.data ||
                data;

            state.miningActive =
                Boolean(
                    mining?.active ??
                    mining?.is_active ??
                    data?.active ??
                    false
                );

            state.miningRemaining =
                safeNumber(
                    mining?.remaining ??
                    mining?.remaining_seconds ??
                    data?.remaining ??
                    data?.remaining_seconds ??
                    0
                );

            state.miningReward =
                safeNumber(
                    mining?.reward ??
                    data?.reward ??
                    MINING_REWARD
                );

            if (
                state.miningActive
            ) {

                state.miningCompleted =
                    false;
            }

            if (
                !state.miningActive &&
                state.miningRemaining <= 0 &&
                state.sessions > 0
            ) {

                state.miningCompleted =
                    true;
            }

            updateMiningUI();

            startMiningTicker();

        } catch (error) {

            console.log(
                "Mining status:",
                error
            );

            updateMiningUI();
        }
    }

    /* =====================================================
       MINING TIMER
    ===================================================== */

    function startMiningTicker() {

        clearInterval(
            state.miningTimer
        );

        if (
            !state.miningActive
        ) {

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
                }

                if (
                    state.miningRemaining <= 0
                ) {

                    clearInterval(
                        state.miningTimer
                    );

                    state.miningTimer =
                        null;

                    state.miningRemaining =
                        0;

                    state.miningActive =
                        false;

                    state.miningCompleted =
                        true;

                    updateMiningUI();

                    toast(
                        "اكتملت دورة التعدين. يمكنك استلام المكافأة."
                    );
                }

            }, 1000);
    }

    /* =====================================================
       START MINING
    ===================================================== */

    async function startMining() {

        if (
            state.miningRequestPending
        ) {
            return;
        }

        if (
            state.miningActive
        ) {

            toast(
                "التعدين يعمل بالفعل."
            );

            return;
        }

        if (
            state.miningCompleted
        ) {

            await claimMining();

            return;
        }

        state.miningRequestPending =
            true;

        try {

            const data =
                await apiRequest(
                    `/mining/${state.telegramId}/start`,
                    {
                        method: "POST"
                    }
                );

            const mining =
                data?.mining ||
                data?.data ||
                data;

            state.miningActive =
                true;

            state.miningCompleted =
                false;

            state.miningRemaining =
                safeNumber(
                    mining?.remaining ??
                    mining?.remaining_seconds ??
                    data?.remaining ??
                    data?.remaining_seconds ??
                    MINING_CYCLE_SECONDS
                );

            state.miningReward =
                safeNumber(
                    mining?.reward ??
                    data?.reward ??
                    MINING_REWARD
                );

            updateMiningUI();

            startMiningTicker();

            toast(
                `بدأ التعدين — المكافأة ${state.miningReward} 3M`
            );

        } catch (error) {

            console.log(
                "startMining:",
                error
            );

            toast(
                error.message ||
                "تعذر بدء التعدين."
            );

        } finally {

            state.miningRequestPending =
                false;
        }
    }

    /* =====================================================
       CLAIM MINING
    ===================================================== */

    async function claimMining() {

        if (
            state.miningRequestPending
        ) {
            return;
        }

        if (
            state.miningActive ||
            state.miningRemaining > 0
        ) {

            toast(
                "دورة التعدين لم تكتمل بعد."
            );

            return;
        }

        state.miningRequestPending =
            true;

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
                    data?.reward ??
                    data?.reward_3m ??
                    state.miningReward
                );

            state.balance +=
                reward;

            state.total +=
                reward;

            state.today +=
                reward;

            state.sessions +=
                1;

            state.miningActive =
                false;

            state.miningRemaining =
                0;

            state.miningCompleted =
                false;

            updateBalanceUI();

            updateMiningUI();

            await Promise.allSettled([

                loadEconomic(),

                loadTransactions()

            ]);

            await loadMiningStatus();

            toast(
                `تمت إضافة ${reward} 3M إلى رصيدك.`
            );

        } catch (error) {

            console.log(
                "claimMining:",
                error
            );

            toast(
                error.message ||
                "تعذر استلام المكافأة."
            );

        } finally {

            state.miningRequestPending =
                false;
        }
    }

    /* =====================================================
       MINING BUTTONS
    ===================================================== */

    function handleMiningButtonClick() {

        if (
            state.miningRequestPending
        ) {
            return;
        }

        if (
            state.miningActive
        ) {

            toast(
                "التعدين يعمل بالفعل."
            );

            return;
        }

        if (
            state.miningCompleted
        ) {

            claimMining();

            return;
        }

        startMining();
    }

    function setupMiningButtons() {

        const buttons = [

            "#mineBtn",

            "#mineBtnPage"

        ];

        buttons.forEach(
            selector => {

                const button =
                    $(selector);

                if (!button) return;

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        event.stopPropagation();

                        handleMiningButtonClick();
                    }
                );
            }
        );
    }

    /* =====================================================
       TASKS
    ===================================================== */

    async function loadTasks() {

        try {

            const data =
                await apiRequest(
                    `/tasks/${state.telegramId}`
                );

            state.tasks =
                Array.isArray(data)

                    ? data

                    : data?.tasks ||
                      data?.data ||
                      [];

            updateRewardsActivityFromTasks();

            renderTasks();

            updateRewardsUI();

        } catch (error) {

            console.log(
                "loadTasks:",
                error
            );

            state.tasks = [];

            renderTasksError();
        }
    }

    function updateRewardsActivityFromTasks() {

        const completedCount =
            state.tasks.filter(
                task =>
                    Boolean(
                        task.completed
                    )
            ).length;

        state.rewards.dailyActivity =
            completedCount;
    }

    function renderTasks() {

        const container =
            $("#tasksContainer");

        if (!container) return;

        setText(
            "#tasksCount",
            state.tasks.length
        );

        if (
            !state.tasks.length
        ) {

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
                        task.task_id;

                    const title =
                        escapeHtml(
                            task.title ||
                            "مهمة 3Migo"
                        );

                    const description =
                        escapeHtml(
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

                        <div class="task-card">

                            <div class="task-info">

                                <h3>
                                    ${title}
                                </h3>

                                <p>
                                    ${description}
                                </p>

                            </div>

                            <div class="task-reward">

                                +${formatNumber(reward)} 3M

                            </div>

                            <button
                                class="task-btn"
                                data-task-id="${id}"
                                type="button"
                                ${completed ? "disabled" : ""}
                            >

                                ${
                                    completed
                                        ? "مكتملة"
                                        : "تنفيذ"
                                }

                            </button>

                        </div>

                    `;

                })
                .join("");
    }

    function renderTasksError() {

        const container =
            $("#tasksContainer");

        if (!container) return;

        container.innerHTML = `

            <div class="empty-state">

                تعذر تحميل المهام حالياً.

            </div>

        `;
    }

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
                    data?.reward ??
                    data?.reward_3m ??
                    0
                );

            if (
                reward > 0
            ) {

                state.balance +=
                    reward;

                state.total +=
                    reward;

                state.today +=
                    reward;

                updateBalanceUI();
            }

            toast(

                reward > 0

                    ? `تمت المهمة +${reward} 3M`

                    : "تم تنفيذ المهمة."
            );

            await Promise.allSettled([

                loadTasks(),

                loadEconomic()

            ]);

        } catch (error) {

            console.log(
                "completeTask:",
                error
            );

            toast(
                error.message ||
                "تعذر تنفيذ المهمة."
            );
        }
    }

    /* =====================================================
       DAILY REWARD
    ===================================================== */

    async function claimDailyReward() {

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
                    data?.reward ??
                    data?.reward_3m ??
                    0
                );

            if (
                reward > 0
            ) {

                state.balance +=
                    reward;

                state.total +=
                    reward;

                state.today +=
                    reward;

                updateBalanceUI();
            }

            toast(

                reward

                    ? `المكافأة اليومية +${reward} 3M`

                    : "تم تحديث المكافأة اليومية."
            );

        } catch (error) {

            console.log(
                "daily reward:",
                error
            );

            toast(
                error.message ||
                "تعذر الحصول على المكافأة اليومية."
            );
        }
    }

    /* =====================================================
       REFERRAL
    ===================================================== */

    async function loadReferral() {

        try {

            const data =
                await apiRequest(
                    `/referral/${state.telegramId}`
                );

            state.referralCode =
                data?.code ||
                data?.referral_code ||
                data?.referralCode ||
                `3M${state.telegramId}`;

            state.referralLink =
                data?.link ||
                data?.referral_link ||
                data?.referralLink ||
                createReferralLink(
                    state.referralCode
                );

            state.referralCount =
                safeNumber(
                    data?.count ??
                    data?.referrals ??
                    data?.referral_count ??
                    0
                );

            state.referralEarned =
                safeNumber(
                    data?.earned ??
                    data?.referral_earned ??
                    0
                );

        } catch (error) {

            console.log(
                "Referral fallback:",
                error
            );

            state.referralCode =
                `3M${state.telegramId}`;

            state.referralLink =
                createReferralLink(
                    state.referralCode
                );
        }

        updateReferralUI();

        updateRewardsFromReferral();
    }

    function updateRewardsFromReferral() {

        /*
         * Referral activity contributes to the
         * Rewards Hub presentation.
         *
         * No automatic spin is created here.
         */

        updateRewardsUI();
    }

    function createReferralLink(code) {

        return `https://t.me/${BOT_USERNAME}?start=ref_${encodeURIComponent(code)}`;
    }

    function updateReferralUI() {

        setText(
            "#referralCode",
            state.referralCode
        );

        const referralInput =
            $("#referralLink");

        if (referralInput) {

            referralInput.value =
                state.referralLink;
        }

        setText(
            "#referralCount",
            formatInteger(
                state.referralCount
            )
        );

        setText(
            "#referralEarned",
            `${formatNumber(
                state.referralEarned
            )} 3M`
        );

        generateReferralBarcode(
            state.referralCode
        );
    }

    function generateReferralBarcode(code) {

        const container =
            $("#referralBarcode");

        if (!container) return;

        container.innerHTML = "";

        const source =
            String(
                code ||
                "3MIGO"
            );

        let seed = 0;

        for (
            let i = 0;
            i < source.length;
            i++
        ) {

            seed =
                (
                    seed * 31 +
                    source.charCodeAt(i)
                ) >>> 0;
        }

        for (
            let i = 0;
            i < 72;
            i++
        ) {

            seed =
                (
                    seed * 1664525 +
                    1013904223
                ) >>> 0;

            const width =
                1 +
                (seed % 4);

            const bar =
                document.createElement(
                    "i"
                );

            bar.style.width =
                `${width}px`;

            container.appendChild(
                bar
            );
        }
    }

    async function copyReferral() {

        const link =
            state.referralLink;

        if (!link) return;

        try {

            await navigator.clipboard.writeText(
                link
            );

            toast(
                "تم نسخ رابط الإحالة."
            );

        } catch {

            const input =
                $("#referralLink");

            if (!input) return;

            input.select();

            document.execCommand(
                "copy"
            );

            toast(
                "تم نسخ رابط الإحالة."
            );
        }
    }

    function shareReferral() {

        if (
            !state.referralLink
        ) {
            return;
        }

        const shareUrl =
            `https://t.me/share/url?url=${encodeURIComponent(
                state.referralLink
            )}&text=${encodeURIComponent(
                "انضم إلى 3Migo Coin عبر رابط الإحالة"
            )}`;

        if (
            tg?.openTelegramLink
        ) {

            try {

                tg.openTelegramLink(
                    shareUrl
                );

                return;

            } catch (error) {

                console.log(
                    "Telegram share:",
                    error
                );
            }
        }

        window.open(
            shareUrl,
            "_blank"
        );
    }

    /* =====================================================
       ECONOMIC SYSTEM
    ===================================================== */

    async function loadEconomic() {

        try {

            const data =
                await apiRequest(
                    `/economic/user/${state.telegramId}`
                );

            const economic =
                data?.economic ||
                data?.data ||
                data;

            state.economic.totalMined =
                safeNumber(
                    economic?.total_mined ??
                    economic?.totalMined ??
                    data?.total_mined ??
                    0
                );

            state.economic.locked3m =
                safeNumber(
                    economic?.locked_3m ??
                    economic?.locked3m ??
                    data?.locked_3m ??
                    0
                );

            state.economic.unlocked3m =
                safeNumber(
                    economic?.unlocked_3m ??
                    economic?.unlocked3m ??
                    data?.unlocked_3m ??
                    0
                );

            state.economic.airdrop3m =
                safeNumber(
                    economic?.airdrop_3m ??
                    economic?.airdrop3m ??
                    data?.airdrop_3m ??
                    0
                );

            state.economic.contributionScore =
                safeNumber(
                    economic?.contribution_score ??
                    economic?.contributionScore ??
                    data?.contribution_score ??
                    0
                );

            state.economic.trustScore =
                safeNumber(
                    economic?.trust_score ??
                    economic?.trustScore ??
                    data?.trust_score ??
                    0
                );

            calculateGrowthIndex();

            calculateExperience();

            updateEconomicUI();

            updateRewardsUI();

        } catch (error) {

            console.log(
                "loadEconomic:",
                error
            );
        }
    }

    function calculateGrowthIndex() {

        const activity =
            Math.min(
                100,
                state.sessions * 5
            );

        const contribution =
            Math.min(
                100,
                state.economic.contributionScore
            );

        const trust =
            Math.min(
                100,
                state.economic.trustScore
            );

        state.growthIndex =
            Math.round(
                (
                    activity +
                    contribution +
                    trust
                ) / 3
            );
    }

    function calculateExperience() {

        const score =
            Math.max(
                0,
                Math.round(
                    state.economic.contributionScore +
                    state.sessions * 10 +
                    state.referralCount * 5
                )
            );

        const levels = [

            {
                level: 1,
                name: "Starter",
                min: 0,
                max: 100
            },

            {
                level: 2,
                name: "Explorer",
                min: 100,
                max: 300
            },

            {
                level: 3,
                name: "Builder",
                min: 300,
                max: 700
            },

            {
                level: 4,
                name: "Contributor",
                min: 700,
                max: 1500
            },

            {
                level: 5,
                name: "Migo Master",
                min: 1500,
                max: 3000
            }

        ];

        let current =
            levels[0];

        for (
            const level of levels
        ) {

            if (
                score >= level.min
            ) {

                current =
                    level;
            }
        }

        const progress =
            Math.max(
                0,
                Math.min(
                    100,
                    (
                        (score - current.min) /
                        Math.max(
                            1,
                            current.max -
                            current.min
                        )
                    ) * 100
                )
            );

        state.experience = {

            level:
                current.level,

            name:
                current.name,

            progress,

            score,

            nextScore:
                current.max
        };
    }

    function updateEconomicUI() {

        const e =
            state.economic;

        setText(
            "#homeTotalMined",
            `${formatNumber(e.totalMined)} 3M`
        );

        setText(
            "#homeLocked3m",
            `${formatNumber(e.locked3m)} 3M`
        );

        setText(
            "#homeAirdrop3m",
            `${formatNumber(e.airdrop3m)} 3M`
        );

        setText(
            "#walletMined",
            `${formatNumber(e.totalMined)} 3M`
        );

        setText(
            "#walletLocked",
            `${formatNumber(e.locked3m)} 3M`
        );

        setText(
            "#walletUnlocked",
            `${formatNumber(e.unlocked3m)} 3M`
        );

        setText(
            "#walletAirdrop",
            `${formatNumber(e.airdrop3m)} 3M`
        );

        setText(
            "#economicTotalMined",
            `${formatNumber(e.totalMined)} 3M`
        );

        setText(
            "#economicContribution",
            formatNumber(
                e.contributionScore
            )
        );

        /*
         * Optional element.
         * Safe even if index.html does not contain it.
         */

        setText(
            "#economicTrust",
            formatNumber(
                e.trustScore
            )
        );

        setText(
            "#economicAirdrop",
            `${formatNumber(e.airdrop3m)} 3M`
        );

        setText(
            "#growthIndex",
            `${state.growthIndex}%`
        );

        setText(
            "#experienceLevel",
            `Level ${state.experience.level}`
        );

        setText(
            "#experienceName",
            state.experience.name
        );

        setText(
            "#experienceScore",
            `${formatInteger(
                state.experience.score
            )} XP`
        );

        const experienceProgress =
            $("#experienceProgress");

        if (
            experienceProgress
        ) {

            experienceProgress.style.width =
                `${state.experience.progress}%`;
        }

        setText(
            "#profileExperienceLevel",
            `Level ${state.experience.level}`
        );

        setText(
            "#profileExperienceScore",
            `${formatInteger(
                state.experience.score
            )} XP`
        );

        setText(
            "#profileExperienceName",
            state.experience.name
        );

        setText(
            "#profileNextScore",
            `الهدف التالي: ${formatInteger(
                state.experience.nextScore
            )} XP`
        );

        const profileProgress =
            $("#profileExperienceProgress");

        if (
            profileProgress
        ) {

            profileProgress.style.width =
                `${state.experience.progress}%`;
        }
    }

    /* =====================================================
       AIRDROP
    ===================================================== */

    async function previewAirdrop() {

        try {

            const data =
                await apiRequest(
                    `/economic/airdrop/${state.telegramId}`
                );

            const amount =
                safeNumber(
                    data?.airdrop_3m ??
                    data?.amount ??
                    data?.reward ??
                    0
                );

            toast(

                amount > 0

                    ? `الإيردروب المتوقع: ${formatNumber(amount)} 3M`

                    : "لا توجد كمية إيردروب متاحة للمعاينة حالياً."
            );

        } catch (error) {

            console.log(
                "previewAirdrop:",
                error
            );

            toast(
                error.message ||
                "تعذر معاينة الإيردروب."
            );
        }
    }

    async function spendEconomic() {

        try {

            const data =
                await apiRequest(
                    `/economic/spend/${state.telegramId}`,
                    {
                        method: "POST"
                    }
                );

            toast(
                data?.message ||
                "تم تنفيذ العملية."
            );

            await Promise.allSettled([

                loadUser(),

                loadEconomic()

            ]);

        } catch (error) {

            console.log(
                "spendEconomic:",
                error
            );

            toast(
                error.message ||
                "تعذر تنفيذ العملية."
            );
        }
    }

    /* =====================================================
       TRANSACTIONS
    ===================================================== */

    async function loadTransactions() {

        try {

            const data =
                await apiRequest(
                    `/transactions/${state.telegramId}`
                );

            state.transactions =
                Array.isArray(data)

                    ? data

                    : data?.transactions ||
                      data?.data ||
                      [];

            renderTransactions();

        } catch (error) {

            console.log(
                "transactions:",
                error
            );
        }
    }

    function renderTransactions() {

        const container =
            $("#transactionsList");

        if (!container) return;

        if (
            !state.transactions.length
        ) {

            container.innerHTML = `

                <div class="empty-state">

                    لا توجد عمليات بعد

                </div>

            `;

            return;
        }

        container.innerHTML =
            state.transactions
                .slice(0, 30)
                .map(transaction => {

                    const title =
                        escapeHtml(
                            transaction.title ||
                            transaction.type ||
                            "عملية 3Migo"
                        );

                    const amount =
                        safeNumber(
                            transaction.amount ??
                            transaction.amount_3m ??
                            transaction.reward ??
                            0
                        );

                    return `

                        <div class="transaction-item">

                            <span>
                                ${title}
                            </span>

                            <strong>

                                ${amount >= 0 ? "+" : ""}

                                ${formatNumber(amount)}

                                3M

                            </strong>

                        </div>

                    `;

                })
                .join("");
    }

    /* =====================================================
       REWARDS HUB
    ===================================================== */

    function calculateInitialSpins() {

        /*
         * V5.8:
         *
         * One FREE UX demo spin per browser session.
         *
         * This does NOT:
         * - modify wallet
         * - modify backend
         * - create 3M
         * - create economic value
         *
         * It simply allows the user to experience
         * the Rewards Hub while the real backend
         * reward engine is being prepared.
         */

        if (
            state.rewards.sessionDemoSpinUsed
        ) {

            return 0;
        }

        return 1;
    }

    function initializeRewardsHub() {

        if (
            state.rewards.initialized
        ) {

            updateRewardsUI();

            return;
        }

        state.rewards.spinsAvailable =
            calculateInitialSpins();

        state.rewards.earned3m =
            0;

        state.rewards.dailyActivity =
            0;

        state.rewards.initialized =
            true;

        updateRewardsUI();

        if (
            state.rewards.spinsAvailable > 0
        ) {

            setRewardStatus(
                "🎁 لديك لفة مجانية تجريبية."
            );
        }
    }

    function updateRewardsUI() {

        const spins =
            state.rewards.spinsAvailable;

        const earned =
            state.rewards.earned3m;

        const activity =
            state.rewards.dailyActivity;

        setText(
            "#rewardSpinsValue",
            formatInteger(spins)
        );

        setText(
            "#wheelSpins",
            formatInteger(spins)
        );

        setText(
            "#modalRewardSpins",
            formatInteger(spins)
        );

        setText(
            "#rewardEarnedValue",
            formatNumber(earned)
        );

        setText(
            "#modalRewardEarned",
            formatNumber(earned)
        );

        setText(
            "#rewardDailyValue",
            formatInteger(activity)
        );

        const spinButton =
            $("#spinRewardWheelButton");

        if (spinButton) {

            spinButton.disabled =
                spins <= 0 ||
                state.rewards.wheelBusy;

            if (
                state.rewards.wheelBusy
            ) {

                spinButton.textContent =
                    "🎡 جاري الدوران...";

            } else if (
                spins > 0
            ) {

                spinButton.textContent =
                    "🎡 استخدم لفة مجانية";

            } else {

                spinButton.textContent =
                    "🎡 لا توجد لفات متاحة";
            }
        }
    }

    function setRewardStatus(message) {

        setText(
            "#rewardWheelStatus",
            message
        );
    }

    function spinRewardWheel() {

        if (
            state.rewards.wheelBusy
        ) {
            return;
        }

        if (
            state.rewards.spinsAvailable <= 0
        ) {

            setRewardStatus(
                "لا توجد لفة مجانية متاحة حالياً. أكمل نشاطاً مؤهلاً للحصول على Spin."
            );

            toast(
                "لا توجد لفات متاحة حالياً."
            );

            return;
        }

        const wheel =
            $("#rewardWheel");

        if (!wheel) {
            return;
        }

        const segmentCount =
            REWARD_WHEEL_SEGMENTS.length;

        const selectedIndex =
            Math.floor(
                Math.random() *
                segmentCount
            );

        const selectedReward =
            REWARD_WHEEL_SEGMENTS[
                selectedIndex
            ];

        const segmentAngle =
            360 / segmentCount;

        const targetAngle =
            360 -
            (
                selectedIndex *
                segmentAngle
            ) -
            (
                segmentAngle / 2
            );

        const extraTurns =
            360 * 5;

        const finalRotation =
            extraTurns +
            targetAngle;

        state.rewards.wheelBusy =
            true;

        state.rewards.spinsAvailable--;

        /*
         * The one UX demo spin is now consumed.
         */

        state.rewards.sessionDemoSpinUsed =
            true;

        updateRewardsUI();

        wheel.style.transition =
            "transform 4.8s cubic-bezier(.12,.72,.15,1)";

        wheel.style.transform =
            `rotate(${finalRotation}deg)`;

        setRewardStatus(
            "جاري تحديد نتيجة اللفة..."
        );

        setTimeout(() => {

            state.rewards.wheelBusy =
                false;

            wheel.style.transition =
                "none";

            wheel.style.transform =
                `rotate(${targetAngle}deg)`;

            state.rewards.lastWheelReward =
                selectedReward;

            /*
             * IMPORTANT:
             *
             * No local wallet modification.
             *
             * The result is only pending until
             * a real backend reward endpoint exists.
             */

            state.rewards.pendingRewards.push({

                id:
                    `local-${Date.now()}`,

                label:
                    selectedReward.label,

                amount:
                    selectedReward.amount,

                status:
                    "pending-backend",

                createdAt:
                    new Date().toISOString()

            });

            updateRewardsUI();

            const amount =
                selectedReward.amount;

            if (
                amount > 0
            ) {

                setRewardStatus(
                    `🎁 النتيجة: ${selectedReward.label} — بانتظار تأكيد النظام الخلفي.`
                );

                toast(
                    `🎁 حصلت على ${selectedReward.label}`
                );

            } else {

                setRewardStatus(
                    "✨ BONUS — النتيجة بانتظار تأكيد النظام الخلفي."
                );

                toast(
                    "✨ حصلت على BONUS"
                );
            }

        }, 4900);
    }

    /* =====================================================
       REWARDS — WATCH & EARN
    ===================================================== */

    async function rewardWatchAd() {

        closeAllModals();

        openModal(
            "adGalaxyModal"
        );

        await showRewardAd();
    }

    /* =====================================================
       REWARDS — JOIN & EARN
    ===================================================== */

    function rewardJoin() {

        setRewardStatus(
            "📢 أنشطة المجتمع المؤهلة للمكافآت ستظهر هنا بعد ربط نظام التحقق."
        );

        toast(
            "سيتم تفعيل أنشطة Join & Earn مع التحقق من العضوية."
        );
    }

    /* =====================================================
       REWARDS — INVITE & EARN
    ===================================================== */

    function rewardInvite() {

        if (
            !state.referralLink
        ) {

            toast(
                "رابط الإحالة غير جاهز حالياً."
            );

            return;
        }

        shareReferral();

        setRewardStatus(
            "👥 تمت مشاركة رابط الإحالة. مكافآت الإحالة تعتمد على النظام الخلفي."
        );
    }

    /* =====================================================
       REWARDS — DAILY MISSIONS
    ===================================================== */

    function rewardDaily() {

        switchView(
            "tasks"
        );

        toast(
            "تم فتح المهام اليومية."
        );
    }

    /* =====================================================
       REWARDS HUB MODAL
    ===================================================== */

    function openRewardsHub() {

        initializeRewardsHub();

        openModal(
            "rewardsHubModal"
        );
    }

    function scrollRewardsWheel() {

        closeAllModals();

        const wheelCard =
            $("#rewardWheelCard");

        if (wheelCard) {

            wheelCard.scrollIntoView({

                behavior:
                    "smooth",

                block:
                    "center"
            });
        }
    }

    /* =====================================================
       ADSGRAM INITIALIZATION

       DEBUG MODE REMAINS FOR TESTING ONLY.
    ===================================================== */

    function initializeAdsGram() {

        try {

            if (
                !window.Adsgram
            ) {

                console.log(
                    "AdsGram SDK is not loaded."
                );

                return false;
            }

            adsgramController =
                window.Adsgram.init({

                    blockId:
                        ADSGRAM_BLOCK_ID,

                    /*
                     * Keep DEBUG while AdsGram
                     * moderation / availability is unresolved.
                     */

                    debug:
                        true,

                    debugBannerType:
                        "RewardedVideo"

                });

            console.log(
                "AdsGram initialized — DEBUG MODE — Block ID:",
                ADSGRAM_BLOCK_ID
            );

            return true;

        } catch (error) {

            console.log(
                "AdsGram initialization error:",
                error
            );

            adsgramController =
                null;

            return false;
        }
    }

    /* =====================================================
       ADSGRAM REWARD AD
    ===================================================== */

    async function showRewardAd() {

        if (
            adsgramLoading
        ) {

            toast(
                "الإعلان قيد التحميل..."
            );

            return;
        }

        if (
            !window.Adsgram
        ) {

            toast(
                "خدمة الإعلانات غير متاحة حالياً."
            );

            return;
        }

        if (
            !adsgramController
        ) {

            const initialized =
                initializeAdsGram();

            if (!initialized) {

                toast(
                    "تعذر تشغيل خدمة الإعلانات."
                );

                return;
            }
        }

        const button =
            $(
                '[data-action="watch-reward-ad"]'
            );

        const status =
            $("#adRewardStatus");

        adsgramLoading =
            true;

        if (button) {

            button.disabled =
                true;

            button.classList.add(
                "loading"
            );
        }

        if (status) {

            status.textContent =
                "جارٍ تجهيز الإعلان...";
        }

        try {

            if (status) {

                status.textContent =
                    "شاهد الإعلان حتى النهاية لتفعيل المشاهدة.";
            }

            const result =
                await adsgramController.show();

            console.log(
                "AdsGram reward result:",
                result
            );

            /*
             * IMPORTANT:
             *
             * Never modify wallet locally.
             */

            if (
                result &&
                result.done === false
            ) {

                if (status) {

                    status.textContent =
                        "لم تكتمل مشاهدة الإعلان.";
                }

                toast(
                    "لم تكتمل مشاهدة الإعلان."
                );

                return;
            }

            if (status) {

                status.textContent =
                    "تمت مشاهدة الإعلان. انتظار تأكيد النظام الخلفي.";
            }

            setRewardStatus(
                "📺 تمت مشاهدة الإعلان. المكافأة لا تدخل المحفظة إلا بعد تأكيد النظام."
            );

            toast(
                "تمت مشاهدة الإعلان."
            );

        } catch (error) {

            console.log(
                "AdsGram show error:",
                error
            );

            if (status) {

                status.textContent =
                    "تعذر تشغيل الإعلان أو لم تتوفر مادة إعلانية حالياً.";
            }

            toast(
                "تعذر تشغيل الإعلان حالياً."
            );

        } finally {

            adsgramLoading =
                false;

            if (button) {

                button.disabled =
                    false;

                button.classList.remove(
                    "loading"
                );
            }
        }
    }

    /* =====================================================
       AD GALAXY
    ===================================================== */

    async function refreshAds() {

        toast(
            "جارٍ تحديث الأنشطة الإعلانية والمهام..."
        );

        await loadTasks();

        toast(
            "تم تحديث الأنشطة."
        );
    }

    /* =====================================================
       VIEW NAVIGATION
    ===================================================== */

    function switchView(viewName) {

        const validViews = [

            "home",
            "mine",
            "tasks",
            "wallet",
            "profile"

        ];

        if (
            !validViews.includes(
                viewName
            )
        ) {

            viewName =
                "home";
        }

        state.currentView =
            viewName;

        $all(".app-view")
            .forEach(view => {

                const active =
                    view.dataset.view ===
                    viewName;

                view.classList.toggle(
                    "active",
                    active
                );

                view.hidden =
                    !active;
            });

        $all(
            ".nav-item[data-view-target]"
        )
            .forEach(button => {

                button.classList.toggle(

                    "active",

                    button.dataset.viewTarget ===
                    viewName
                );
            });

        window.scrollTo({

            top: 0,

            behavior:
                "smooth"
        });

        loadViewData(
            viewName
        );
    }

    async function loadViewData(
        viewName
    ) {

        if (
            viewName === "mine"
        ) {

            await loadMiningStatus();

            return;
        }

        if (
            viewName === "tasks"
        ) {

            await loadTasks();

            return;
        }

        if (
            viewName === "wallet"
        ) {

            await Promise.allSettled([

                loadUser(),

                loadEconomic(),

                loadTransactions()

            ]);

            return;
        }

        if (
            viewName === "profile"
        ) {

            await Promise.allSettled([

                loadReferral(),

                loadEconomic()

            ]);

            return;
        }
    }

    /* =====================================================
       MODALS
    ===================================================== */

    function openModal(id) {

        const modal =
            document.getElementById(id);

        if (!modal) return;

        modal.hidden =
            false;

        document.body.classList.add(
            "modal-open"
        );
    }

    function closeModal(modal) {

        if (!modal) return;

        modal.hidden =
            true;

        document.body.classList.remove(
            "modal-open"
        );
    }

    function closeAllModals() {

        $all(
            ".modal-overlay"
        )
            .forEach(
                modal => {

                    modal.hidden =
                        true;
                }
            );

        document.body.classList.remove(
            "modal-open"
        );
    }

    /* =====================================================
       AI ASSISTANT
    ===================================================== */

    function openAI() {

        openModal(
            "aiModal"
        );
    }

    function addAIMessage(
        text,
        type = "assistant"
    ) {

        const container =
            $("#aiMessages");

        if (!container) return;

        const message =
            document.createElement(
                "div"
            );

        message.className =
            `ai-message ${type}`;

        const title =
            document.createElement(
                "strong"
            );

        title.textContent =
            type === "user"
                ? "أنت"
                : "3Migo AI";

        const paragraph =
            document.createElement(
                "p"
            );

        paragraph.textContent =
            text;

        message.appendChild(
            title
        );

        message.appendChild(
            paragraph
        );

        container.appendChild(
            message
        );

        container.scrollTop =
            container.scrollHeight;
    }

    function aiResponse(question) {

        const text =
            String(
                question || ""
            ).toLowerCase();

        if (
            text.includes("تعدين") ||
            text.includes("mine")
        ) {

            return `التعدين يعمل على دورة مدتها 12 ساعة. عند بدء الدورة يعمل المؤقت، وعند اكتمالها تصبح المكافأة قابلة للاستلام وفق حالة الخادم. المكافأة الحالية في النموذج هي 10 3M.`;
        }

        if (
            text.includes("محفظ") ||
            text.includes("رصيد")
        ) {

            return `المحفظة تعرض رصيد 3M الخاص بك، والإجمالي، وأرباح اليوم، وسجل العمليات. الصفحة الاقتصادية منفصلة عن البطاقة حتى يبقى العرض واضحاً.`;
        }

        if (
            text.includes("إحال") ||
            text.includes("ref")
        ) {

            return `لك كود إحالة ورابط خاص بك. يمكنك نسخ الرابط أو مشاركته مباشرة، وتظهر الإحالات والمكافآت المرتبطة بحسابك.`;
        }

        if (
            text.includes("اقتصاد") ||
            text.includes("إيردروب") ||
            text.includes("airdrop")
        ) {

            return `اقتصاد 3Migo يجمع نشاط المستخدم والمكافآت والمعلومات الاقتصادية في منظومة واحدة. الإيردروب مرتبط بالاقتصاد وليس نظاماً منفصلاً عن المنظومة.`;
        }

        if (
            text.includes("مهم") ||
            text.includes("task")
        ) {

            return `صفحة المهام تعرض الأنشطة المتاحة والمكافآت المرتبطة بها. بعد تنفيذ المهمة يتم تحديث الرصيد والاقتصاد.`;
        }

        if (
            text.includes("reward") ||
            text.includes("مكاف") ||
            text.includes("عجلة") ||
            text.includes("spin")
        ) {

            return `Rewards Hub هو مركز الأنشطة والمكافآت. توجد لفة تجريبية مجانية لتجربة الواجهة، بينما المكافآت الاقتصادية الحقيقية لا تضاف إلى المحفظة قبل تأكيد النظام الخلفي.`;
        }

        if (
            text.includes("إعلان") ||
            text.includes("adsgram") ||
            text.includes("ad")
        ) {

            return `AdsGram يعمل كإعلان مكافأة اختياري. الوظائف الأساسية في 3Migo لا تعتمد على مشاهدة الإعلان، ولا يتم تعديل الرصيد محلياً بمجرد تشغيل الإعلان.`;
        }

        return `أنا مساعد 3Migo. يمكنني شرح التعدين، المحفظة، الإحالات، المهام، Rewards Hub، الإعلانات والاقتصاد داخل التطبيق.`;
    }

    function sendAIMessage() {

        const input =
            $("#aiInput");

        if (!input) return;

        const question =
            input.value.trim();

        if (!question) {
            return;
        }

        addAIMessage(
            question,
            "user"
        );

        input.value =
            "";

        setTimeout(() => {

            addAIMessage(

                aiResponse(
                    question
                ),

                "assistant"

            );

        }, 250);
    }

    /* =====================================================
       ACTION HANDLER
    ===================================================== */

    async function handleAction(
        action,
        element
    ) {

        switch (action) {

            case "open-ai":

                openAI();

                break;

            case "open-economic":

                openModal(
                    "economicModal"
                );

                await loadEconomic();

                break;

            case "open-wallet":

                openModal(
                    "walletModal"
                );

                await loadUser();

                break;

            case "open-ad-galaxy":

                openModal(
                    "adGalaxyModal"
                );

                break;

            case "open-rewards-hub":

                openRewardsHub();

                break;

            case "spin-reward-wheel":

                spinRewardWheel();

                break;

            case "scroll-rewards-wheel":

                scrollRewardsWheel();

                break;

            case "reward-watch-ad":

                await rewardWatchAd();

                break;

            case "reward-join":

                rewardJoin();

                break;

            case "reward-invite":

                rewardInvite();

                break;

            case "reward-daily":

                rewardDaily();

                break;

            case "watch-reward-ad":

                await showRewardAd();

                break;

            case "copy-referral":

                await copyReferral();

                break;

            case "share-referral":

                shareReferral();

                break;

            case "preview-airdrop":

                await previewAirdrop();

                break;

            case "spend-economic":

                await spendEconomic();

                break;

            case "refresh-ads":

                await refreshAds();

                break;

            case "close-modal":

                closeModal(
                    element.closest(
                        ".modal-overlay"
                    )
                );

                break;

            case "daily-reward":

                await claimDailyReward();

                break;

            default:

                console.log(
                    "Unknown action:",
                    action
                );
        }
    }

    /* =====================================================
       EVENT SYSTEM
    ===================================================== */

    function setupEvents() {

        document.addEventListener(
            "click",
            async event => {

                /*
                 * Navigation
                 */

                const nav =
                    event.target.closest(
                        "[data-view-target]"
                    );

                if (nav) {

                    event.preventDefault();

                    switchView(
                        nav.dataset.viewTarget
                    );

                    return;
                }

                /*
                 * Actions
                 */

                const actionElement =
                    event.target.closest(
                        "[data-action]"
                    );

                if (
                    actionElement
                ) {

                    event.preventDefault();

                    await handleAction(

                        actionElement.dataset.action,

                        actionElement

                    );

                    return;
                }

                /*
                 * Task buttons
                 */

                const taskButton =
                    event.target.closest(
                        "[data-task-id]"
                    );

                if (
                    taskButton
                ) {

                    event.preventDefault();

                    const taskId =
                        taskButton.dataset.taskId;

                    if (
                        taskId
                    ) {

                        await completeTask(
                            taskId
                        );
                    }

                    return;
                }

                /*
                 * AI quick questions
                 */

                const aiQuestion =
                    event.target.closest(
                        "[data-ai-question]"
                    );

                if (
                    aiQuestion
                ) {

                    event.preventDefault();

                    const question =
                        aiQuestion.dataset.aiQuestion;

                    addAIMessage(
                        question,
                        "user"
                    );

                    setTimeout(() => {

                        addAIMessage(

                            aiResponse(
                                question
                            ),

                            "assistant"

                        );

                    }, 200);

                    return;
                }
            }
        );

        /*
         * AI send
         */

        const aiSend =
            $("#aiSend");

        if (
            aiSend
        ) {

            aiSend.addEventListener(
                "click",
                sendAIMessage
            );
        }

        /*
         * Enter inside AI input
         */

        const aiInput =
            $("#aiInput");

        if (
            aiInput
        ) {

            aiInput.addEventListener(

                "keydown",

                event => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        event.preventDefault();

                        sendAIMessage();
                    }
                }
            );
        }

        /*
         * Close modal by backdrop
         */

        $all(
            ".modal-overlay"
        )
            .forEach(modal => {

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

        /*
         * ESC
         */

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    closeAllModals();
                }
            }
        );
    }

    /* =====================================================
       HTML ESCAPE
    ===================================================== */

    function escapeHtml(value) {

        return String(
            value ?? ""
        )

            .replace(
                /&/g,
                "&amp;"
            )

            .replace(
                /</g,
                "&lt;"
            )

            .replace(
                />/g,
                "&gt;"
            )

            .replace(
                /"/g,
                "&quot;"
            )

            .replace(
                /'/g,
                "&#039;"
            );
    }

    /* =====================================================
       INITIALIZATION
    ===================================================== */

    async function initialize() {

        console.log(
            "3Migo Coin — App V5.8 initializing..."
        );

        /*
         * Telegram
         */

        initializeTelegramUser();

        /*
         * Rewards Hub
         */

        initializeRewardsHub();

        /*
         * AdsGram
         */

        initializeAdsGram();

        /*
         * Register/load user first.
         */

        await registerUser();

        /*
         * Load core data.
         */

        await Promise.allSettled([

            loadUser(),

            loadMiningStatus(),

            loadReferral(),

            loadEconomic(),

            loadTasks()

        ]);

        /*
         * UI
         */

        updateBalanceUI();

        updateProfileUI();

        updateReferralUI();

        updateEconomicUI();

        updateMiningUI();

        updateRewardsUI();

        /*
         * Events
         */

        setupMiningButtons();

        setupEvents();

        /*
         * Home is default.
         */

        switchView(
            "home"
        );

        console.log(
            "3Migo Coin — App V5.8 ready."
        );
    }

    /* =====================================================
       START
    ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );

    } else {

        initialize();
    }

    /* =====================================================
       GLOBAL ACCESS
    ===================================================== */

    window.ThreeMigo = {

        state,

        startMining,

        claimMining,

        loadMiningStatus,

        loadTasks,

        loadReferral,

        loadEconomic,

        loadTransactions,

        switchView,

        openAI,

        showRewardAd,

        initializeAdsGram,

        openRewardsHub,

        spinRewardWheel,

        rewardWatchAd,

        rewardJoin,

        rewardInvite,

        rewardDaily,

        updateRewardsUI,

        toast

    };

})();
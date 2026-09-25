/* =========================================================
   3MIGO COIN — APP.JS V5.4
   Compatible with:
   index.html V7
   style.css V5.4

   IMPORTANT:
   - Backend/API contracts preserved
   - Mining economy preserved
   - Referral economy preserved
   - Airdrop/economic endpoints preserved
   - No database changes
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

    const API_BASE =
        window.location.origin;

    const BOT_USERNAME =
        "threemigosmart_bot";

    const FALLBACK_TELEGRAM_ID = 1;

    const MINING_CYCLE_HOURS = 12;

    const MINING_CYCLE_SECONDS =
        MINING_CYCLE_HOURS * 60 * 60;

    const MINING_REWARD = 10;


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

        miningActive: false,

        miningRemaining: 0,

        miningReward:
            MINING_REWARD,

        miningTimer: null,

        miningRequestPending: false,

        tasks: [],

        referralCode: "",

        referralLink: "",

        referralCount: 0,

        referralEarned: 0,

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

            name: "Starter",

            progress: 0,

            score: 0,

            nextScore: 100
        },

        growthIndex: 0,

        transactions: [],

        currentView: "home",

        aiMessages: [],

        loading: false

    };


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


    function showElement(selector) {

        const element = $(selector);

        if (!element) return;

        element.hidden = false;
    }


    function hideElement(selector) {

        const element = $(selector);

        if (!element) return;

        element.hidden = true;
    }


    function safeNumber(value, fallback = 0) {

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


    function toast(message) {

        const element =
            $("#toast");

        if (!element) {

            console.log(message);

            return;
        }

        element.textContent =
            message;

        element.hidden = false;

        clearTimeout(
            toast._timer
        );

        toast._timer =
            setTimeout(() => {

                element.hidden = true;

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

        }

        else {

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
                typeof options.body === "string"
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
                            telegram_id: id,
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
            String(id || "00000000");

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
    ===================================================== */

    function getMiningProgress() {

        if (
            !state.miningActive ||
            state.miningRemaining <= 0
        ) {

            return 0;
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


        const rings =
            [
                "#miningProgressRing",
                "#miningPageProgressRing"
            ];


        rings.forEach(
            selector => {

                const ring =
                    $(selector);

                if (!ring) return;

                ring.style
                    .setProperty(
                        "--mine-progress",
                        `${degrees}deg`
                    );

                ring.style
                    .setProperty(
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
    }


    function updateMiningUI() {

        const active =
            state.miningActive;

        const remaining =
            state.miningRemaining;


        const timer =
            formatTime(
                remaining
            );


        const status =
            active
                ? "Mining Active"
                : remaining <= 0 &&
                  state.sessions > 0
                    ? "يمكن استلام المكافأة"
                    : "جاهز للتعدين";


        setText(
            "#miningState",
            status
        );

        setText(
            "#miningPageState",
            status
        );


        setText(
            "#miningTimer",
            timer
        );

        setText(
            "#miningPageTimer",
            timer
        );


        setText(
            "#miningPageStatus",
            active
                ? "ACTIVE"
                : "READY"
        );


        const buttonText =
            active
                ? "Mining Active"
                : remaining <= 0 &&
                  state.miningRemaining !== 0
                    ? "استلام المكافأة"
                    : "ابدأ التعدين";


        setText(
            "#mineBtnText",
            buttonText
        );

        setText(
            "#mineBtnPageText",
            buttonText
        );


        updateMiningProgressVisual();
    }


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

                    state.miningActive =
                        false;

                    updateMiningUI();

                    toast(
                        "اكتملت دورة التعدين. يمكنك استلام المكافأة."
                    );
                }

            }, 1000);
    }


    async function startMining() {

        if (
            state.miningRequestPending
        ) return;


        if (
            state.miningActive
        ) {

            toast(
                "التعدين يعمل بالفعل."
            );

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


    async function claimMining() {

        if (
            state.miningRequestPending
        ) return;


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


            state.balance += reward;

            state.total += reward;

            state.today += reward;

            state.sessions += 1;


            state.miningActive =
                false;

            state.miningRemaining =
                0;


            updateBalanceUI();

            updateMiningUI();


            await Promise.allSettled([
                loadEconomic(),
                loadTransactions()
            ]);


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


    function setupMiningButtons() {

        const buttons =
            [
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
                    async event => {

                        event.preventDefault();

                        if (
                            state.miningActive
                        ) {

                            return;
                        }


                        if (
                            state.miningRemaining <= 0 &&
                            state.miningRemaining !== 0
                        ) {

                            await claimMining();

                            return;
                        }


                        /*
                         * Backend remains the source of truth.
                         * If a previous cycle completed, try claim.
                         */
                        if (
                            !state.miningActive &&
                            state.miningRemaining === 0 &&
                            button.dataset.claimReady === "true"
                        ) {

                            await claimMining();

                            return;
                        }


                        await startMining();
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


            renderTasks();

        } catch (error) {

            console.log(
                "loadTasks:",
                error
            );

            state.tasks = [];

            renderTasksError();
        }
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
                        <article class="task-card">

                            <div class="task-card-title">
                                ${title}
                            </div>

                            <div class="task-card-description">
                                ${description}
                            </div>

                            <div class="task-card-footer">

                                <span class="task-reward">
                                    +${formatNumber(reward)} 3M
                                </span>

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

                        </article>
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


            if (reward > 0) {

                state.balance += reward;

                state.total += reward;

                state.today += reward;

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


            if (reward > 0) {

                state.balance += reward;

                state.total += reward;

                state.today += reward;

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
    }


    function createReferralLink(code) {

        return `https://t.me/${BOT_USERNAME}?start=ref_${encodeURIComponent(code)}`;
    }


    function updateReferralUI() {

        setText(
            "#referralCode",
            state.referralCode
        );


        setValue(
            "#referralLink",
            state.referralLink
        );


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

        if (!state.referralLink) {
            return;
        }


        const shareUrl =
            `https://t.me/share/url?url=${encodeURIComponent(
                state.referralLink
            )}&text=${encodeURIComponent(
                "انضم إلى 3Migo Coin عبر رابط الإحالة"
            )}`;


        if (tg?.openTelegramLink) {

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
                current = level;
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

        if (experienceProgress) {

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

        if (profileProgress) {

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

            viewName = "home";
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
            behavior: "smooth"
        });


        loadViewData(
            viewName
        );
    }


    async function loadViewData(viewName) {

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

        modal.hidden = false;

        document.body.classList.add(
            "modal-open"
        );
    }


    function closeModal(modal) {

        if (!modal) return;

        modal.hidden = true;

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
                    modal.hidden = true;
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

            return `
التعدين يعمل على دورة مدتها 12 ساعة.
عند بدء الدورة يعمل المؤقت، وعند اكتمالها تصبح المكافأة قابلة للاستلام وفق حالة الخادم.
المكافأة الحالية في النموذج هي 10 3M.
            `.trim();
        }


        if (
            text.includes("محفظ") ||
            text.includes("رصيد")
        ) {

            return `
المحفظة تعرض رصيد 3M الخاص بك، والإجمالي، وأرباح اليوم، وسجل العمليات.
الصفحة الاقتصادية منفصلة عن البطاقة حتى يبقى العرض واضحاً.
            `.trim();
        }


        if (
            text.includes("إحال") ||
            text.includes("ref")
        ) {

            return `
لك كود إحالة ورابط خاص بك.
يمكنك نسخ الرابط أو مشاركته مباشرة، وتظهر الإحالات والمكافآت المرتبطة بحسابك.
            `.trim();
        }


        if (
            text.includes("اقتصاد") ||
            text.includes("إيردروب") ||
            text.includes("airdrop")
        ) {

            return `
اقتصاد 3Migo يجمع نشاط المستخدم والمكافآت والمعلومات الاقتصادية في منظومة واحدة.
الإيردروب مرتبط بالاقتصاد وليس نظاماً منفصلاً عن المنظومة.
            `.trim();
        }


        if (
            text.includes("مهم") ||
            text.includes("task")
        ) {

            return `
صفحة المهام تعرض الأنشطة المتاحة والمكافآت المرتبطة بها.
بعد تنفيذ المهمة يتم تحديث الرصيد والاقتصاد.
            `.trim();
        }


        return `
أنا مساعد 3Migo.
يمكنني شرح التعدين، المحفظة، الإحالات، المهام، والاقتصاد داخل التطبيق.
        `.trim();
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


        input.value = "";


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

        /*
         * Navigation
         */
        document.addEventListener(
            "click",
            async event => {

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


                    if (taskId) {

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

        if (aiSend) {

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

        if (aiInput) {

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
         * Close modal by clicking backdrop
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
                    event.key === "Escape"
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
            "3Migo Coin — App V5.4 initializing..."
        );


        initializeTelegramUser();


        /*
         * Register/load user first.
         * This preserves backend source of truth.
         */
        await registerUser();


        /*
         * Load core data.
         */
        await Promise.allSettled([

            loadUser(),

            loadMiningStatus(),

            loadReferral(),

            loadEconomic()

        ]);


        /*
         * UI
         */
        updateBalanceUI();

        updateProfileUI();

        updateReferralUI();

        updateEconomicUI();

        updateMiningUI();


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
            "3Migo Coin — App V5.4 ready."
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
       OPTIONAL GLOBAL ACCESS
       Preserves compatibility with older code.
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

        toast
    };


})();
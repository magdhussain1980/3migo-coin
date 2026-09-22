/* =========================================================
   3Migo Coin - Telegram Mini App
   Version: 2.1.0
   Mining Cycle: 12 Hours
   Token: 3M

   إصلاحات:
   - تسجيل مستخدم Telegram قبل تحميل البيانات
   - إصلاح تحميل المهام
   - إصلاح الإحالة
   - إنشاء رابط Telegram Referral
   - نسخ رابط الإحالة
   - مشاركة رابط الإحالة
   - الحفاظ على التعدين 12 ساعة
   ========================================================= */

const tg = window.Telegram?.WebApp || null;


/* =========================================================
   TELEGRAM INITIALIZATION
   ========================================================= */

if (tg) {
    try {
        tg.ready();
        tg.expand();

        try {
            tg.setHeaderColor("#04142a");
            tg.setBackgroundColor("#031024");
        } catch (error) {
            console.log("Telegram UI settings unavailable");
        }

    } catch (error) {
        console.error("Telegram initialization error:", error);
    }
}


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let telegramUser = null;

let state = {
    balance: 0,
    total: 0,
    today: 0,
    sessions: 0,

    miningStatus: "idle",
    miningRemaining: 0,
    miningReward: 10,

    loadingUser: false,
    loadingMining: false,

    userReady: false,

    miningTimer: null
};


/* =========================================================
   TELEGRAM USER
   ========================================================= */

function getTelegramUser() {

    try {

        if (
            tg &&
            tg.initDataUnsafe &&
            tg.initDataUnsafe.user
        ) {
            return tg.initDataUnsafe.user;
        }

    } catch (error) {

        console.error(
            "Telegram user error:",
            error
        );
    }

    return null;
}


function getTelegramId() {

    const user = getTelegramUser();

    if (user && user.id) {
        return Number(user.id);
    }

    /*
        مستخدم تجريبي عند فتح التطبيق
        خارج Telegram.
    */

    return 1;
}


/* =========================================================
   HELPERS
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}


function showToast(message) {

    const toast = $("toast");

    if (!toast) {
        console.log(message);
        return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(window.__toastTimer);

    window.__toastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 2500);
}


function haptic(type = "medium") {

    try {

        if (
            tg &&
            tg.HapticFeedback
        ) {

            tg.HapticFeedback.impactOccurred(type);
        }

    } catch (error) {

        console.log(
            "Haptic unavailable"
        );
    }
}


function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function escapeAttribute(value) {

    return escapeHTML(value)
        .replace(/`/g, "&#096;");
}


function formatNumber(value) {

    const number = Number(value || 0);

    return Math.floor(number)
        .toLocaleString();
}


/* =========================================================
   API HELPER
   ========================================================= */

async function apiRequest(
    url,
    options = {}
) {

    const response = await fetch(
        url,
        {
            ...options,

            headers: {
                "Accept": "application/json",

                ...(options.body
                    ? {
                        "Content-Type":
                            "application/json"
                    }
                    : {}),

                ...(options.headers || {})
            }
        }
    );

    let data = {};

    try {

        data = await response.json();

    } catch (error) {

        data = {};
    }

    if (!response.ok) {

        const errorMessage =
            data?.error ||
            data?.message ||
            `HTTP ${response.status}`;

        const error =
            new Error(errorMessage);

        error.status =
            response.status;

        error.data = data;

        throw error;
    }

    return data;
}


/* =========================================================
   ENSURE USER REGISTERED
   ========================================================= */

async function ensureUserRegistered() {

    const telegramId =
        getTelegramId();

    try {

        const user =
            await apiRequest(
                `/user/${telegramId}`
            );

        if (
            user &&
            !user.error
        ) {

            state.userReady = true;

            return user;
        }

    } catch (error) {

        console.log(
            "User not registered yet:",
            error.message
        );
    }


    /*
        إذا لم يكن المستخدم موجودًا
        نقوم بتسجيله.
    */

    const registered =
        await registerUser(
            telegramId
        );

    if (!registered) {

        state.userReady = false;

        throw new Error(
            "Unable to register user"
        );
    }


    const user =
        await apiRequest(
            `/user/${telegramId}`
        );

    state.userReady = true;

    return user;
}


/* =========================================================
   REGISTER USER
   ========================================================= */

async function registerUser(
    telegramId
) {

    try {

        const response =
            await fetch(
                "/register",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            telegram_id:
                                telegramId,

                            username:
                                telegramUser?.username ||
                                "",

                            referral_code:
                                ""
                        })
                }
            );


        const data =
            await response
                .json()
                .catch(() => ({}));


        /*
            بعض نسخ Backend قد تعيد
            200 مع مستخدم موجود.
        */

        if (
            response.ok &&
            !data.error
        ) {

            state.userReady = true;

            return true;
        }


        /*
            إذا كان المستخدم موجودًا
            بالفعل نعتبر التسجيل ناجحًا.
        */

        if (
            data.status ===
            "already_registered"
        ) {

            state.userReady = true;

            return true;
        }


        console.error(
            "Register failed:",
            data
        );

        return false;

    } catch (error) {

        console.error(
            "Register error:",
            error
        );

        return false;
    }
}


/* =========================================================
   USER DISPLAY
   ========================================================= */

function updateTelegramUserDisplay() {

    if (!telegramUser) {
        return;
    }


    const displayName =
        telegramUser.username ||
        telegramUser.first_name ||
        "3Migo User";


    [
        "username",
        "userName",
        "profileName"
    ].forEach(id => {

        const element =
            $(id);

        if (element) {

            element.textContent =
                displayName;
        }
    });
}


/* =========================================================
   MINING TIME
   ========================================================= */

function formatMiningTime(seconds) {

    seconds =
        Math.max(
            0,
            Math.floor(
                Number(seconds || 0)
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


/* =========================================================
   RENDER
   ========================================================= */

function render() {

    if ($("balance")) {

        $("balance").innerHTML =
            `${formatNumber(
                state.balance
            )} <span>3M</span>`;
    }


    if ($("total")) {

        $("total").textContent =
            `${formatNumber(
                state.total
            )} 3M`;
    }


    if ($("today")) {

        $("today").textContent =
            `${formatNumber(
                state.today
            )} 3M`;
    }


    if ($("sessions")) {

        $("sessions").textContent =
            Number(
                state.sessions || 0
            );
    }


    /*
        Mining state
    */

    if ($("miningState")) {

        if (
            state.miningStatus ===
            "mining"
        ) {

            $("miningState").textContent =
                `يعمل ${formatMiningTime(
                    state.miningRemaining
                )}`;

        } else if (
            state.miningStatus ===
            "ready_to_claim"
        ) {

            $("miningState").textContent =
                "جاهز للاستلام";

        } else {

            $("miningState").textContent =
                "جاهز";
        }
    }


    /*
        Mining button
    */

    const button =
        $("mineBtn");

    if (!button) {
        return;
    }


    if (
        state.miningStatus ===
        "mining"
    ) {

        button.textContent =
            `⏳ التعدين ${formatMiningTime(
                state.miningRemaining
            )}`;

        button.disabled = true;

        button.style.opacity =
            "0.75";

    } else if (
        state.miningStatus ===
        "ready_to_claim"
    ) {

        button.textContent =
            `🎁 استلام ${formatNumber(
                state.miningReward
            )} 3M`;

        button.disabled = false;

        button.style.opacity =
            "1";

    } else {

        button.textContent =
            "⛏️ بدء التعدين";

        button.disabled = false;

        button.style.opacity =
            "1";
    }
}


/* =========================================================
   MINING COUNTDOWN
   ========================================================= */

function stopMiningTimer() {

    if (state.miningTimer) {

        clearInterval(
            state.miningTimer
        );

        state.miningTimer =
            null;
    }
}


function startMiningTimer() {

    stopMiningTimer();


    state.miningTimer =
        setInterval(() => {

            if (
                state.miningStatus !==
                "mining"
            ) {

                stopMiningTimer();

                return;
            }


            state.miningRemaining =
                Math.max(
                    0,
                    Number(
                        state.miningRemaining ||
                        0
                    ) - 1
                );


            render();


            if (
                state.miningRemaining <=
                0
            ) {

                stopMiningTimer();

                state.miningStatus =
                    "ready_to_claim";

                render();

                showToast(
                    "🎉 انتهت دورة التعدين — يمكنك استلام المكافأة"
                );

                haptic("light");
            }

        }, 1000);
}


/* =========================================================
   CALCULATE REMAINING
   ========================================================= */

function calculateRemainingSeconds(
    session
) {

    if (!session) {
        return 0;
    }


    if (
        session.remaining_seconds !==
        undefined
    ) {

        return Math.max(
            0,
            Number(
                session.remaining_seconds
            )
        );
    }


    const expiresAt =
        session.expires_at ||
        session.end_time ||
        session.ends_at;


    if (!expiresAt) {
        return 0;
    }


    const timestamp =
        new Date(
            expiresAt
        ).getTime();


    if (
        Number.isNaN(timestamp)
    ) {
        return 0;
    }


    return Math.max(
        0,
        Math.floor(
            (
                timestamp -
                Date.now()
            ) / 1000
        )
    );
}


/* =========================================================
   LOAD MINING STATUS
   ========================================================= */

async function loadMiningStatus() {

    if (state.loadingMining) {
        return;
    }

    state.loadingMining = true;


    try {

        const telegramId =
            getTelegramId();


        const data =
            await apiRequest(
                `/mining/${telegramId}/status`
            );


        if (
            data.status ===
            "user_not_found"
        ) {

            state.miningStatus =
                "idle";

            state.miningRemaining =
                0;

            render();

            return;
        }


        const status =
            data.status ||
            data.mining_status ||
            "idle";


        state.miningStatus =
            status;


        if (
            data.reward !==
            undefined
        ) {

            state.miningReward =
                Number(
                    data.reward
                );
        }


        if (
            data.mining_reward !==
            undefined
        ) {

            state.miningReward =
                Number(
                    data.mining_reward
                );
        }


        const session =
            data.session ||
            data;


        if (
            session.reward !==
            undefined
        ) {

            state.miningReward =
                Number(
                    session.reward
                );
        }


        if (
            session.mining_reward !==
            undefined
        ) {

            state.miningReward =
                Number(
                    session.mining_reward
                );
        }


        if (
            status ===
            "mining"
        ) {

            state.miningRemaining =
                calculateRemainingSeconds(
                    session
                );

            startMiningTimer();

        } else {

            state.miningRemaining =
                0;

            stopMiningTimer();
        }


        render();

    } catch (error) {

        console.error(
            "Mining status error:",
            error
        );

    } finally {

        state.loadingMining =
            false;
    }
}


/* =========================================================
   LOAD TRANSACTIONS
   ========================================================= */

async function loadTransactions(
    telegramId
) {

    try {

        const transactions =
            await apiRequest(
                `/transactions/${telegramId}`
            );


        if (
            !Array.isArray(
                transactions
            )
        ) {
            return;
        }


        let total = 0;
        let today = 0;
        let sessions = 0;


        const currentDate =
            new Date()
                .toISOString()
                .slice(0, 10);


        transactions.forEach(
            transaction => {

                const amount =
                    Number(
                        transaction.amount ||
                        0
                    );


                total += amount;


                if (
                    transaction.created_at &&
                    String(
                        transaction.created_at
                    ).startsWith(
                        currentDate
                    )
                ) {

                    today += amount;
                }


                if (
                    transaction.transaction_type ===
                        "mining_reward" ||

                    transaction.transaction_type ===
                        "engagement_reward"
                ) {

                    sessions++;
                }
            }
        );


        state.total =
            total;

        state.today =
            today;

        state.sessions =
            sessions;


        render();

    } catch (error) {

        console.error(
            "Transactions error:",
            error
        );
    }
}


/* =========================================================
   LOAD USER
   ========================================================= */

async function loadUser() {

    if (state.loadingUser) {
        return;
    }


    state.loadingUser =
        true;


    telegramUser =
        getTelegramUser();


    const telegramId =
        getTelegramId();


    try {

        const user =
            await ensureUserRegistered();


        state.balance =
            Number(
                user.balance_3m ||
                0
            );


        render();


        await Promise.all([
            loadTransactions(
                telegramId
            ),

            loadMiningStatus()
        ]);


        updateTelegramUserDisplay();


    } catch (error) {

        console.error(
            "Load user error:",
            error
        );


        showToast(
            "⚠️ تعذر الاتصال بالخادم"
        );

    } finally {

        state.loadingUser =
            false;

        render();
    }
}


/* =========================================================
   START MINING
   ========================================================= */

async function startMining() {

    haptic();


    if (
        state.miningStatus ===
        "ready_to_claim"
    ) {

        await claimMining();

        return;
    }


    if (
        state.miningStatus ===
        "mining"
    ) {

        showToast(
            `⏳ التعدين يعمل — ${formatMiningTime(
                state.miningRemaining
            )}`
        );

        return;
    }


    const button =
        $("mineBtn");


    if (button) {

        button.disabled =
            true;

        button.style.opacity =
            "0.7";
    }


    showToast(
        "⛏️ جاري بدء دورة التعدين..."
    );


    try {

        await ensureUserRegistered();


        const telegramId =
            getTelegramId();


        const data =
            await apiRequest(
                `/mining/${telegramId}/start`,
                {
                    method: "POST"
                }
            );


        if (
            data.status ===
            "started"
        ) {

            state.miningStatus =
                "mining";


            const session =
                data.session ||
                data;


            state.miningReward =
                Number(
                    session.reward ||
                    session.mining_reward ||
                    data.reward ||
                    state.miningReward
                );


            state.miningRemaining =
                calculateRemainingSeconds(
                    session
                );


            startMiningTimer();

            render();


            showToast(
                "⛏️ بدأت دورة التعدين لمدة 12 ساعة"
            );

            return;
        }


        if (
            data.status ===
            "already_mining"
        ) {

            state.miningStatus =
                "mining";


            const session =
                data.session ||
                data;


            state.miningRemaining =
                calculateRemainingSeconds(
                    session
                );


            startMiningTimer();

            render();


            showToast(
                "⏳ التعدين يعمل بالفعل"
            );

            return;
        }


        if (
            data.status ===
            "ready_to_claim"
        ) {

            state.miningStatus =
                "ready_to_claim";

            render();


            showToast(
                "🎁 المكافأة جاهزة للاستلام"
            );

            return;
        }


        showToast(
            "⚠️ لم تبدأ دورة التعدين"
        );


    } catch (error) {

        console.error(
            "Mining start error:",
            error
        );


        showToast(
            "⚠️ تعذر بدء التعدين"
        );

    } finally {

        if (
            state.miningStatus !==
            "mining"
        ) {

            if (button) {

                button.disabled =
                    false;

                button.style.opacity =
                    "1";
            }
        }

        render();
    }
}


/* =========================================================
   CLAIM MINING
   ========================================================= */

async function claimMining() {

    haptic();


    if (
        state.miningStatus !==
        "ready_to_claim"
    ) {

        showToast(
            "⏳ لم تنتهِ دورة التعدين بعد"
        );

        return;
    }


    const button =
        $("mineBtn");


    if (button) {
        button.disabled = true;
    }


    showToast(
        "🎁 جاري استلام مكافأة التعدين..."
    );


    try {

        const telegramId =
            getTelegramId();


        const data =
            await apiRequest(
                `/mining/${telegramId}/claim`,
                {
                    method: "POST"
                }
            );


        if (
            data.status ===
            "claimed"
        ) {

            if (data.user) {

                state.balance =
                    Number(
                        data.user.balance_3m ||
                        state.balance
                    );
            }


            state.miningStatus =
                "idle";


            state.miningRemaining =
                0;


            stopMiningTimer();


            await loadTransactions(
                telegramId
            );


            render();


            showToast(
                `🎉 تم استلام ${formatNumber(
                    data.reward ||
                    state.miningReward
                )} 3M`
            );


            haptic("light");


            setTimeout(
                () => {
                    openTasks();
                },
                700
            );


            return;
        }


        if (
            data.status ===
            "not_ready"
        ) {

            showToast(
                "⏳ دورة التعدين لم تنتهِ بعد"
            );

            await loadMiningStatus();

            return;
        }


        if (
            data.status ===
            "already_claimed"
        ) {

            state.miningStatus =
                "idle";

            render();


            showToast(
                "✓ تم استلام هذه الدورة مسبقاً"
            );

            return;
        }


        showToast(
            "⚠️ تعذر استلام المكافأة"
        );


    } catch (error) {

        console.error(
            "Mining claim error:",
            error
        );


        showToast(
            "⚠️ تعذر الاتصال بالخادم"
        );

    } finally {

        render();
    }
}


/* =========================================================
   DAILY REWARD
   ========================================================= */

async function dailyReward() {

    haptic();


    const telegramId =
        getTelegramId();


    showToast(
        "🎁 جاري التحقق..."
    );


    try {

        await ensureUserRegistered();


        const data =
            await apiRequest(
                `/user/${telegramId}/daily`,
                {
                    method: "POST"
                }
            );


        if (
            data.error ===
            "already_claimed"
        ) {

            state.balance =
                Number(
                    data.user?.balance_3m ||
                    state.balance
                );


            render();


            showToast(
                "🎁 استلمت المكافأة اليومية مسبقاً"
            );

            return;
        }


        state.balance =
            Number(
                data.balance_3m ||
                data.balance ||
                data.user?.balance_3m ||
                state.balance
            );


        await loadTransactions(
            telegramId
        );


        render();


        showToast(
            "🎁 تمت إضافة المكافأة اليومية"
        );


    } catch (error) {

        console.error(
            "Daily error:",
            error
        );


        showToast(
            "⚠️ تعذر الاتصال بالخادم"
        );
    }
}


/* =========================================================
   TASKS
   ========================================================= */

async function openTasks() {

    haptic();


    const telegramId =
        getTelegramId();


    showToast(
        "☑️ جاري تحميل المهام..."
    );


    try {

        /*
            أهم إصلاح:
            التأكد من تسجيل المستخدم
            قبل طلب المهام.
        */

        await ensureUserRegistered();


        const tasks =
            await apiRequest(
                `/tasks/${telegramId}`
            );


        /*
            حذف نافذة قديمة
        */

        const oldTasks =
            $("tasksModal");


        if (oldTasks) {
            oldTasks.remove();
        }


        let tasksHTML =
            "";


        if (
            !Array.isArray(tasks) ||
            tasks.length === 0
        ) {

            tasksHTML = `
                <div class="tasks-empty">
                    لا توجد مهام متاحة حاليًا
                </div>
            `;

        } else {

            tasks.forEach(
                task => {

                    const taskId =
                        Number(
                            task.id
                        );


                    const completed =
                        Number(
                            task.completed
                        ) === 1 ||
                        task.completed === true;


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
                        Number(
                            task.reward_3m ||
                            0
                        );


                    const rawURL =
                        task.task_url ||
                        "";


                    const safeURL =
                        escapeAttribute(
                            rawURL
                        );


                    tasksHTML += `
                        <div class="task-card">

                            <div class="task-info">

                                <div class="task-title">
                                    ${title}
                                </div>

                                <div class="task-description">
                                    ${description}
                                </div>

                                <div class="task-reward">
                                    🎁 +${formatNumber(
                                        reward
                                    )} 3M
                                </div>

                            </div>


                            <div class="task-actions">

                                ${
                                    rawURL
                                    ? `
                                        <button
                                            class="task-button task-open-button"
                                            data-task-url="${safeURL}"
                                        >
                                            فتح
                                        </button>
                                    `
                                    : ""
                                }


                                <button
                                    class="task-button ${
                                        completed
                                            ? "completed"
                                            : ""
                                    }"
                                    ${
                                        completed
                                            ? "disabled"
                                            : ""
                                    }
                                    data-task-id="${taskId}"
                                >
                                    ${
                                        completed
                                            ? "✓ مكتملة"
                                            : "احصل على المكافأة"
                                    }
                                </button>

                            </div>

                        </div>
                    `;
                }
            );
        }


        const modal =
            document.createElement(
                "div"
            );


        modal.id =
            "tasksModal";


        modal.innerHTML = `
            <div class="tasks-overlay">

                <div class="tasks-modal">

                    <button
                        class="tasks-close"
                        id="tasksClose"
                    >
                        ×
                    </button>


                    <div class="tasks-header">

                        <div class="tasks-icon">
                            ☑️
                        </div>

                        <div>

                            <h2>
                                مهام 3Migo
                            </h2>

                            <small>
                                أكمل المهام واحصل على 3M
                            </small>

                        </div>

                    </div>


                    <div class="tasks-list">
                        ${tasksHTML}
                    </div>


                    <div class="tasks-note">
                        🎯 أكمل المهام للحصول على مكافآت 3M
                    </div>

                </div>

            </div>
        `;


        document.body.appendChild(
            modal
        );


        /*
            إغلاق
        */

        const closeButton =
            $("tasksClose");


        if (closeButton) {

            closeButton.addEventListener(
                "click",
                () => {
                    modal.remove();
                }
            );
        }


        const overlay =
            modal.querySelector(
                ".tasks-overlay"
            );


        if (overlay) {

            overlay.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        overlay
                    ) {

                        modal.remove();
                    }
                }
            );
        }


        /*
            روابط المهام
        */

        modal
            .querySelectorAll(
                "[data-task-url]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const url =
                            button.getAttribute(
                                "data-task-url"
                            );

                        openTaskLink(
                            url
                        );
                    }
                );
            });


        /*
            أزرار إكمال المهام
        */

        modal
            .querySelectorAll(
                "[data-task-id]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const taskId =
                            Number(
                                button.getAttribute(
                                    "data-task-id"
                                )
                            );

                        if (
                            !button.disabled
                        ) {

                            completeTask(
                                taskId
                            );
                        }
                    }
                );
            });


    } catch (error) {

        console.error(
            "Tasks error:",
            error
        );


        showToast(
            "⚠️ تعذر تحميل المهام"
        );
    }
}


/* =========================================================
   OPEN TASK LINK
   ========================================================= */

function openTaskLink(url) {

    if (!url) {
        return;
    }


    try {

        if (
            tg &&
            tg.openLink
        ) {

            tg.openLink(
                url
            );

        } else {

            window.open(
                url,
                "_blank"
            );
        }

    } catch (error) {

        console.error(
            "Open task link error:",
            error
        );
    }
}


/* =========================================================
   COMPLETE TASK
   ========================================================= */

async function completeTask(
    taskId
) {

    haptic();


    const telegramId =
        getTelegramId();


    if (!taskId) {

        showToast(
            "⚠️ مهمة غير صالحة"
        );

        return;
    }


    try {

        await ensureUserRegistered();


        showToast(
            "⏳ جاري تنفيذ المهمة..."
        );


        const data =
            await apiRequest(
                `/tasks/${telegramId}/complete/${taskId}`,
                {
                    method: "POST"
                }
            );


        if (
            data.status ===
            "already_completed"
        ) {

            showToast(
                "✓ هذه المهمة مكتملة مسبقاً"
            );

            await openTasks();

            return;
        }


        if (
            data.status ===
            "task_not_found"
        ) {

            showToast(
                "⚠️ المهمة غير موجودة"
            );

            return;
        }


        if (
            data.status !==
            "completed"
        ) {

            showToast(
                "⚠️ تعذر إكمال المهمة"
            );

            return;
        }


        if (data.user) {

            state.balance =
                Number(
                    data.user.balance_3m ||
                    state.balance
                );
        }


        await loadTransactions(
            telegramId
        );


        render();


        showToast(
            `🎉 تمت المهمة +${formatNumber(
                data.reward || 0
            )} 3M`
        );


        setTimeout(
            () => {
                openTasks();
            },
            600
        );


    } catch (error) {

        console.error(
            "Complete task error:",
            error
        );


        showToast(
            "⚠️ تعذر الاتصال بالخادم"
        );
    }
}


/* =========================================================
   REFERRAL LINK
   ========================================================= */

function buildReferralLink(
    referralCode
) {

    if (!referralCode) {
        return "";
    }


    return (
        "https://t.me/" +
        "threemigosmart_bot" +
        "?start=ref_" +
        encodeURIComponent(
            referralCode
        )
    );
}


/* =========================================================
   COPY REFERRAL LINK
   ========================================================= */

async function copyReferralLink(
    link
) {

    if (!link) {

        showToast(
            "⚠️ رابط الإحالة غير متاح"
        );

        return;
    }


    try {

        if (
            navigator.clipboard &&
            navigator.clipboard.writeText
        ) {

            await navigator
                .clipboard
                .writeText(
                    link
                );

        } else {

            const input =
                document.createElement(
                    "textarea"
                );

            input.value =
                link;

            input.style.position =
                "fixed";

            input.style.opacity =
                "0";

            document.body.appendChild(
                input
            );

            input.focus();

            input.select();

            document.execCommand(
                "copy"
            );

            input.remove();
        }


        haptic("light");

        showToast(
            "✅ تم نسخ رابط الإحالة"
        );

    } catch (error) {

        console.error(
            "Copy referral error:",
            error
        );

        showToast(
            "⚠️ تعذر نسخ الرابط"
        );
    }
}


/* =========================================================
   SHARE REFERRAL LINK
   ========================================================= */

function shareReferralLink(
    link
) {

    if (!link) {
        return;
    }


    const shareText =
        "🚀 انضم إلى 3Migo Coin واحصل على مكافآت 3M\n\n" +
        link;


    try {

        if (
            tg &&
            tg.openTelegramLink
        ) {

            const shareURL =
                "https://t.me/share/url" +
                "?url=" +
                encodeURIComponent(link) +
                "&text=" +
                encodeURIComponent(
                    "🚀 انضم إلى 3Migo Coin واحصل على مكافآت 3M"
                );


            tg.openTelegramLink(
                shareURL
            );

            return;
        }


        if (
            navigator.share
        ) {

            navigator.share({
                title:
                    "3Migo Coin",

                text:
                    "🚀 انضم إلى 3Migo Coin واحصل على مكافآت 3M",

                url:
                    link
            });

            return;
        }


        copyReferralLink(
            shareText
        );

    } catch (error) {

        console.error(
            "Share referral error:",
            error
        );
    }
}


/* =========================================================
   REFERRAL
   ========================================================= */

async function openReferral() {

    haptic();


    const telegramId =
        getTelegramId();


    try {

        showToast(
            "👥 جاري تحميل بيانات الإحالة..."
        );


        /*
            أهم إصلاح:
            التأكد من تسجيل المستخدم الحقيقي
            قبل طلب بيانات الإحالة.
        */

        await ensureUserRegistered();


        const data =
            await apiRequest(
                `/referral/${telegramId}`
            );


        if (
            data.error
        ) {

            throw new Error(
                data.error
            );
        }


        const referralCode =
            data.referral_code ||
            "";


        const referralCount =
            Number(
                data.referral_count ||
                0
            );


        const referralRewards =
            Number(
                data.referral_rewards ||
                0
            );


        const referralLink =
            buildReferralLink(
                referralCode
            );


        if (!referralLink) {

            throw new Error(
                "Referral code unavailable"
            );
        }


        /*
            حذف نافذة إحالة قديمة
        */

        const oldModal =
            $("referralModal");


        if (oldModal) {
            oldModal.remove();
        }


        const modal =
            document.createElement(
                "div"
            );


        modal.id =
            "referralModal";


        modal.innerHTML = `
            <div class="tasks-overlay">

                <div class="tasks-modal">

                    <button
                        class="tasks-close"
                        id="referralClose"
                    >
                        ×
                    </button>


                    <div class="tasks-header">

                        <div class="tasks-icon">
                            👥
                        </div>

                        <div>

                            <h2>
                                نظام الإحالات
                            </h2>

                            <small>
                                ادعُ أصدقاءك واحصل على مكافآت 3M
                            </small>

                        </div>

                    </div>


                    <div style="
                        margin-top:18px;
                        padding:16px;
                        border-radius:14px;
                        background:rgba(255,255,255,0.06);
                    ">

                        <div style="
                            font-size:13px;
                            opacity:.75;
                            margin-bottom:7px;
                        ">
                            🔑 كود الإحالة
                        </div>

                        <div style="
                            font-size:22px;
                            font-weight:700;
                            letter-spacing:1px;
                        ">
                            ${escapeHTML(
                                referralCode
                            )}
                        </div>

                    </div>


                    <div style="
                        margin-top:14px;
                        padding:16px;
                        border-radius:14px;
                        background:rgba(255,255,255,0.06);
                    ">

                        <div style="
                            font-size:13px;
                            opacity:.75;
                            margin-bottom:8px;
                        ">
                            🔗 رابط الدعوة
                        </div>

                        <div
                            style="
                                font-size:13px;
                                line-height:1.6;
                                word-break:break-all;
                                direction:ltr;
                                text-align:left;
                                padding:10px;
                                border-radius:10px;
                                background:rgba(0,0,0,.20);
                            "
                        >
                            ${escapeHTML(
                                referralLink
                            )}
                        </div>


                        <div style="
                            display:flex;
                            gap:8px;
                            margin-top:12px;
                        ">

                            <button
                                id="copyReferralButton"
                                class="task-button"
                                style="flex:1;"
                            >
                                📋 نسخ الرابط
                            </button>

                            <button
                                id="shareReferralButton"
                                class="task-button task-open-button"
                                style="flex:1;"
                            >
                                📤 مشاركة
                            </button>

                        </div>

                    </div>


                    <div style="
                        display:grid;
                        grid-template-columns:1fr 1fr;
                        gap:10px;
                        margin-top:14px;
                    ">

                        <div style="
                            padding:14px;
                            border-radius:14px;
                            background:rgba(255,255,255,.05);
                            text-align:center;
                        ">

                            <div style="
                                font-size:12px;
                                opacity:.7;
                            ">
                                👤 الإحالات
                            </div>

                            <strong style="
                                display:block;
                                font-size:22px;
                                margin-top:5px;
                            ">
                                ${formatNumber(
                                    referralCount
                                )}
                            </strong>

                        </div>


                        <div style="
                            padding:14px;
                            border-radius:14px;
                            background:rgba(255,255,255,.05);
                            text-align:center;
                        ">

                            <div style="
                                font-size:12px;
                                opacity:.7;
                            ">
                                🎁 المكافآت
                            </div>

                            <strong style="
                                display:block;
                                font-size:22px;
                                margin-top:5px;
                            ">
                                ${formatNumber(
                                    referralRewards
                                )} 3M
                            </strong>

                        </div>

                    </div>


                    <div class="tasks-note">
                        🚀 شارك الرابط مع أصدقائك للانضمام إلى 3Migo Coin
                    </div>

                </div>

            </div>
        `;


        document.body.appendChild(
            modal
        );


        const closeButton =
            $("referralClose");


        if (closeButton) {

            closeButton.addEventListener(
                "click",
                () => {

                    modal.remove();
                }
            );
        }


        const copyButton =
            $("copyReferralButton");


        if (copyButton) {

            copyButton.addEventListener(
                "click",
                () => {

                    copyReferralLink(
                        referralLink
                    );
                }
            );
        }


        const shareButton =
            $("shareReferralButton");


        if (shareButton) {

            shareButton.addEventListener(
                "click",
                () => {

                    shareReferralLink(
                        referralLink
                    );
                }
            );
        }


        const overlay =
            modal.querySelector(
                ".tasks-overlay"
            );


        if (overlay) {

            overlay.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        overlay
                    ) {

                        modal.remove();
                    }
                }
            );
        }


    } catch (error) {

        console.error(
            "Referral error:",
            error
        );


        showToast(
            "⚠️ تعذر تحميل بيانات الإحالة"
        );
    }
}


/* =========================================================
   WALLET
   ========================================================= */

async function openWallet() {

    haptic();


    const telegramId =
        getTelegramId();


    try {

        await ensureUserRegistered();


        showToast(
            "💼 جاري تحميل المحفظة..."
        );


        const user =
            await apiRequest(
                `/user/${telegramId}`
            );


        const transactionsData =
            await apiRequest(
                `/transactions/${telegramId}`
            );


        const transactions =
            Array.isArray(
                transactionsData
            )
                ? transactionsData
                : [];


        const balance =
            Number(
                user.balance_3m ||
                0
            );


        let totalRewards = 0;


        transactions.forEach(
            transaction => {

                const amount =
                    Number(
                        transaction.amount ||
                        0
                    );


                if (
                    amount > 0
                ) {

                    totalRewards +=
                        amount;
                }
            }
        );


        const transactionNames = {

            mining_reward:
                "⛏️ مكافأة التعدين",

            engagement_reward:
                "⛏️ مكافأة التعدين",

            daily_reward:
                "🎁 المكافأة اليومية",

            task_reward:
                "☑️ مكافأة مهمة",

            referral_reward:
                "👥 مكافأة إحالة"
        };


        let transactionHTML =
            "";


        if (
            transactions.length ===
            0
        ) {

            transactionHTML = `
                <div class="wallet-empty">
                    لا توجد معاملات حتى الآن
                </div>
            `;

        } else {

            transactions
                .slice(0, 20)
                .forEach(
                    transaction => {

                        const amount =
                            Number(
                                transaction.amount ||
                                0
                            );


                        const name =
                            transactionNames[
                                transaction
                                    .transaction_type
                            ] ||
                            "💠 عملية 3M";


                        transactionHTML += `
                            <div
                                class="wallet-transaction"
                            >

                                <div>

                                    <strong>
                                        ${name}
                                    </strong>

                                    <small>
                                        ${
                                            escapeHTML(
                                                transaction.created_at ||
                                                ""
                                            )
                                        }
                                    </small>

                                </div>

                                <strong>
                                    ${
                                        amount >= 0
                                            ? "+"
                                            : ""
                                    }${formatNumber(
                                        amount
                                    )} 3M
                                </strong>

                            </div>
                        `;
                    }
                );
        }


        const oldModal =
            $("walletModal");


        if (oldModal) {
            oldModal.remove();
        }


        const modal =
            document.createElement(
                "div"
            );


        modal.id =
            "walletModal";


        modal.innerHTML = `
            <div class="wallet-overlay">

                <div class="wallet-modal">

                    <button
                        class="wallet-close"
                        id="walletClose"
                    >
                        ×
                    </button>


                    <div class="wallet-header">

                        <div class="wallet-icon">
                            💼
                        </div>

                        <div>

                            <h2>
                                محفظة 3M
                            </h2>

                            <small>
                                3Migo Coin
                            </small>

                        </div>

                    </div>


                    <div class="wallet-balance">

                        <small>
                            الرصيد الحالي
                        </small>

                        <strong>
                            ${formatNumber(
                                balance
                            )}
                            <span>3M</span>
                        </strong>

                        <p>
                            رصيد تجريبي داخلي
                        </p>

                    </div>


                    <div class="wallet-stats">

                        <div>

                            <small>
                                إجمالي المكافآت
                            </small>

                            <strong>
                                ${formatNumber(
                                    totalRewards
                                )} 3M
                            </strong>

                        </div>


                        <div>

                            <small>
                                المعاملات
                            </small>

                            <strong>
                                ${transactions.length}
                            </strong>

                        </div>

                    </div>


                    <div class="wallet-section-title">
                        📜 آخر العمليات
                    </div>


                    <div class="wallet-transactions">
                        ${transactionHTML}
                    </div>


                    <div class="wallet-note">
                        ⚠️ 3M حاليًا عملة تجريبية داخل النظام وغير قابلة للتداول.
                    </div>

                </div>

            </div>
        `;


        document.body.appendChild(
            modal
        );


        const closeButton =
            $("walletClose");


        if (closeButton) {

            closeButton.addEventListener(
                "click",
                () => {
                    modal.remove();
                }
            );
        }


        const overlay =
            modal.querySelector(
                ".wallet-overlay"
            );


        if (overlay) {

            overlay.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        overlay
                    ) {

                        modal.remove();
                    }
                }
            );
        }


    } catch (error) {

        console.error(
            "Wallet error:",
            error
        );


        showToast(
            "⚠️ تعذر الاتصال بالخادم"
        );
    }
}


/* =========================================================
   PROFILE
   ========================================================= */

function openProfile() {

    haptic();


    const user =
        getTelegramUser();


    if (
        user &&
        tg &&
        tg.showPopup
    ) {

        const name =
            [
                user.first_name,
                user.last_name
            ]
            .filter(Boolean)
            .join(" ") ||
            "مستخدم 3Migo";


        const username =
            user.username
                ? `@${user.username}`
                : "بدون Username";


        tg.showPopup({

            title:
                "👤 حساب 3Migo",

            message:
                `الاسم: ${name}\n` +
                `المعرف: ${username}\n` +
                `Telegram ID: ${user.id}`,

            buttons: [
                {
                    id: "ok",

                    type: "ok",

                    text:
                        "حسناً"
                }
            ]
        });


        return;
    }


    showToast(
        "👤 الحساب قيد التطوير"
    );
}


/* =========================================================
   ACTION HANDLER
   ========================================================= */

function handleAction(
    action
) {

    switch (action) {

        case "mine":
            startMining();
            break;

        case "daily":
            dailyReward();
            break;

        case "tasks":
            openTasks();
            break;

        case "referral":
            openReferral();
            break;

        case "wallet":
            openWallet();
            break;

        case "profile":
            openProfile();
            break;

        default:

            console.log(
                "Unknown action:",
                action
            );
    }
}


/* =========================================================
   BUTTON EVENTS
   ========================================================= */

function bindActionButtons() {

    document
        .querySelectorAll(
            "[data-action]"
        )
        .forEach(
            button => {

                /*
                    منع ربط الزر أكثر من مرة
                */

                if (
                    button.dataset.bound ===
                    "1"
                ) {
                    return;
                }


                button.dataset.bound =
                    "1";


                button.addEventListener(
                    "click",
                    () => {

                        const action =
                            button.getAttribute(
                                "data-action"
                            );


                        handleAction(
                            action
                        );
                    }
                );
            }
        );
}


/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

window.startMining =
    startMining;

window.claimMining =
    claimMining;

window.dailyReward =
    dailyReward;

window.openTasks =
    openTasks;

window.completeTask =
    completeTask;

window.openTaskLink =
    openTaskLink;

window.openReferral =
    openReferral;

window.openWallet =
    openWallet;

window.openProfile =
    openProfile;

window.handleAction =
    handleAction;

window.copyReferralLink =
    copyReferralLink;

window.shareReferralLink =
    shareReferralLink;


/* =========================================================
   START APPLICATION
   ========================================================= */

render();

bindActionButtons();

loadUser();


/* =========================================================
   DEBUG
   ========================================================= */

console.log(
    "================================="
);

console.log(
    "3Migo Coin Mini App"
);

console.log(
    "Version: 2.1.0"
);

console.log(
    "Mining Cycle: 12 Hours"
);

console.log(
    "Token: 3M"
);

console.log(
    "Telegram:",
    Boolean(tg)
);

console.log(
    "Telegram User:",
    getTelegramUser()
);

console.log(
    "Telegram ID:",
    getTelegramId()
);

console.log(
    "================================="
);
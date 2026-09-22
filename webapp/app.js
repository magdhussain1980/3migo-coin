/* =========================================================
   3Migo Coin - Telegram Mini App
   Version: 2.0
   Mining Cycle: 12 Hours
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
        console.error("Telegram user error:", error);
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
        console.log("Haptic unavailable");
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


function formatNumber(value) {
    return Math.floor(
        Number(value || 0)
    ).toLocaleString();
}


/* =========================================================
   MINING TIME
========================================================= */

function formatMiningTime(seconds) {

    seconds = Math.max(
        0,
        Math.floor(Number(seconds || 0))
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


/* =========================================================
   RENDER
========================================================= */

function render() {

    /* Balance */

    if ($("balance")) {
        $("balance").innerHTML =
            `${formatNumber(state.balance)}
             <span>3M</span>`;
    }


    /* Total */

    if ($("total")) {
        $("total").textContent =
            `${formatNumber(state.total)} 3M`;
    }


    /* Today */

    if ($("today")) {
        $("today").textContent =
            `${formatNumber(state.today)} 3M`;
    }


    /* Sessions */

    if ($("sessions")) {
        $("sessions").textContent =
            Number(state.sessions || 0);
    }


    /* Mining state */

    if ($("miningState")) {

        if (
            state.miningStatus === "mining"
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


    /* Mining button */

    const button =
        $("mineBtn");

    if (button) {

        if (
            state.miningStatus === "mining"
        ) {

            button.textContent =
                `⏳ التعدين ${formatMiningTime(
                    state.miningRemaining
                )}`;

            button.disabled = true;
            button.style.opacity = "0.75";

        } else if (
            state.miningStatus ===
            "ready_to_claim"
        ) {

            button.textContent =
                `🎁 استلام ${formatNumber(
                    state.miningReward
                )} 3M`;

            button.disabled = false;
            button.style.opacity = "1";

        } else {

            button.textContent =
                "⛏️ بدء التعدين";

            button.disabled = false;
            button.style.opacity = "1";
        }
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

        state.miningTimer = null;
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
                        state.miningRemaining || 0
                    ) - 1
                );

            render();


            if (
                state.miningRemaining <= 0
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
   CALCULATE REMAINING TIME
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
        new Date(expiresAt).getTime();


    if (
        Number.isNaN(timestamp)
    ) {
        return 0;
    }


    return Math.max(
        0,
        Math.floor(
            (timestamp - Date.now()) / 1000
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


        const response =
            await fetch(
                `/mining/${telegramId}/status`
            );


        const data =
            await response.json()
                .catch(() => ({}));


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Mining status failed"
            );
        }


        if (
            data.status ===
            "user_not_found"
        ) {

            state.miningStatus =
                "idle";

            render();

            return;
        }


        /*
            دعم أكثر من شكل لرد Backend
        */

        const status =
            data.status ||
            data.mining_status ||
            "idle";


        state.miningStatus =
            status;


        if (
            data.reward !== undefined
        ) {

            state.miningReward =
                Number(data.reward);

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
            status === "mining"
        ) {

            state.miningRemaining =
                calculateRemainingSeconds(
                    session
                );

            startMiningTimer();

        } else {

            state.miningRemaining = 0;

            stopMiningTimer();
        }


        render();


    } catch (error) {

        console.error(
            "Mining status error:",
            error
        );

        /*
            لا نوقف التطبيق كله إذا فشل
            تحميل حالة التعدين.
        */

    } finally {

        state.loadingMining = false;
    }
}


/* =========================================================
   LOAD USER
========================================================= */

async function loadUser() {

    if (state.loadingUser) {
        return;
    }

    state.loadingUser = true;

    telegramUser =
        getTelegramUser();

    const telegramId =
        getTelegramId();


    try {

        const response =
            await fetch(
                `/user/${telegramId}`
            );


        if (!response.ok) {

            throw new Error(
                `User request failed: ${response.status}`
            );
        }


        const user =
            await response.json();


        if (user.error) {

            const registered =
                await registerUser(
                    telegramId
                );


            if (!registered) {

                throw new Error(
                    user.error
                );
            }


            state.loadingUser = false;

            return loadUser();
        }


        state.balance =
            Number(
                user.balance_3m || 0
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

        state.loadingUser = false;

        render();
    }
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
                            "application/json"
                    },

                    body: JSON.stringify({
                        telegram_id:
                            telegramId,

                        username:
                            telegramUser?.username || "",

                        referral_code:
                            ""
                    })
                }
            );


        const data =
            await response.json()
                .catch(() => ({}));


        if (!response.ok) {

            console.error(
                "Register failed:",
                data
            );

            return false;
        }


        if (
            data.error
        ) {

            console.error(
                "Register error:",
                data.error
            );

            return false;
        }


        return true;


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
   TRANSACTIONS
========================================================= */

async function loadTransactions(
    telegramId
) {

    try {

        const response =
            await fetch(
                `/transactions/${telegramId}`
            );


        if (!response.ok) {
            return;
        }


        const transactions =
            await response.json();


        if (!Array.isArray(transactions)) {
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
                        transaction.amount || 0
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
   START MINING
========================================================= */

async function startMining() {

    haptic();


    /*
        إذا كانت الدورة انتهت
        ننتقل للاستلام.
    */

    if (
        state.miningStatus ===
        "ready_to_claim"
    ) {

        await claimMining();

        return;
    }


    /*
        إذا كانت الدورة تعمل بالفعل
    */

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

        button.disabled = true;
        button.style.opacity = "0.7";
    }


    showToast(
        "⛏️ جاري بدء دورة التعدين..."
    );


    try {

        const telegramId =
            getTelegramId();


        const response =
            await fetch(
                `/mining/${telegramId}/start`,
                {
                    method: "POST"
                }
            );


        const data =
            await response.json()
                .catch(() => ({}));


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Mining start failed"
            );
        }


        if (
            data.status ===
            "started"
        ) {

            state.miningStatus =
                "mining";


            const session =
                data.session || data;


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
                data.session || data;


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


        const response =
            await fetch(
                `/mining/${telegramId}/claim`,
                {
                    method: "POST"
                }
            );


        const data =
            await response.json()
                .catch(() => ({}));


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Mining claim failed"
            );
        }


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


            /*
                بعد استلام المكافأة نعرض المهام
                لتشجيع المستخدم على الاستمرار.
            */

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

        const response =
            await fetch(
                `/user/${telegramId}/daily`,
                {
                    method: "POST"
                }
            );


        const data =
            await response.json()
                .catch(() => ({}));


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


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Daily request failed"
            );
        }


        if (data.error) {

            showToast(
                "⚠️ تعذر الحصول على المكافأة"
            );

            return;
        }


        state.balance =
            Number(
                data.balance_3m ||
                data.balance ||
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

        const response =
            await fetch(
                `/tasks/${telegramId}`
            );


        const tasks =
            await response.json()
                .catch(() => []);


        if (!response.ok) {

            throw new Error(
                "Tasks request failed"
            );
        }


        const oldTasks =
            $("tasksModal");


        if (oldTasks) {
            oldTasks.remove();
        }


        let tasksHTML = "";


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
                        Number(task.id);


                    const completed =
                        Number(task.completed) === 1 ||
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
                            task.reward_3m || 0
                        );


                    const taskURL =
                        escapeHTML(
                            task.task_url || ""
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
                                    taskURL
                                    ? `
                                        <button
                                            class="task-button task-open-button"
                                            onclick="openTaskLink('${taskURL}')"
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
                                    onclick="completeTask(${taskId})"
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
            document.createElement("div");


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

            tg.openLink(url);

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

        showToast(
            "⏳ جاري تنفيذ المهمة..."
        );


        const response =
            await fetch(
                `/tasks/${telegramId}/complete/${taskId}`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );


        const data =
            await response.json()
                .catch(() => ({}));


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Task completion failed"
            );
        }


        if (
            data.status ===
            "already_completed"
        ) {

            showToast(
                "✓ هذه المهمة مكتملة مسبقاً"
            );

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


        const response =
            await fetch(
                `/referral/${telegramId}`
            );


        const data =
            await response.json()
                .catch(() => ({}));


        if (!response.ok) {

            throw new Error(
                "Referral request failed"
            );
        }


        if (data.error) {

            showToast(
                "⚠️ تعذر تحميل بيانات الإحالة"
            );

            return;
        }


        const referralCode =
            data.referral_code || "";


        const referralCount =
            Number(
                data.referral_count || 0
            );


        const referralRewards =
            Number(
                data.referral_rewards || 0
            );


        const referralLink =
            `https://t.me/threemigosmart_bot?start=ref_${encodeURIComponent(
                referralCode
            )}`;


        const message =
            `🔑 كود الإحالة:\n${referralCode}\n\n` +
            `🔗 رابط الدعوة:\n${referralLink}\n\n` +
            `👤 عدد الإحالات: ${referralCount}\n` +
            `🎁 مكافآت الإحالة: ${formatNumber(
                referralRewards
            )} 3M`;


        if (
            tg &&
            tg.showPopup
        ) {

            tg.showPopup({
                title:
                    "👥 نظام الإحالات",

                message:
                    message,

                buttons: [
                    {
                        id: "ok",
                        type: "ok",
                        text: "حسناً"
                    }
                ]
            });

        } else {

            alert(message);
        }


    } catch (error) {

        console.error(
            "Referral error:",
            error
        );


        showToast(
            "⚠️ تعذر الاتصال بالخادم"
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

        showToast(
            "💼 جاري تحميل المحفظة..."
        );


        const userResponse =
            await fetch(
                `/user/${telegramId}`
            );


        const user =
            await userResponse.json()
                .catch(() => ({}));


        if (
            !userResponse.ok ||
            user.error
        ) {

            throw new Error(
                "User request failed"
            );
        }


        const transactionsResponse =
            await fetch(
                `/transactions/${telegramId}`
            );


        let transactions = [];


        if (
            transactionsResponse.ok
        ) {

            transactions =
                await transactionsResponse
                    .json();

            if (
                !Array.isArray(
                    transactions
                )
            ) {
                transactions = [];
            }
        }


        const balance =
            Number(
                user.balance_3m || 0
            );


        let totalRewards = 0;


        transactions.forEach(
            transaction => {

                const amount =
                    Number(
                        transaction.amount || 0
                    );


                if (amount > 0) {
                    totalRewards += amount;
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

            referral_reward:
                "👥 مكافأة إحالة",

            task_reward:
                "☑️ مكافأة مهمة"
        };


        const recentTransactions =
            transactions
                .slice(-8)
                .reverse();


        let transactionHTML = "";


        if (
            recentTransactions.length === 0
        ) {

            transactionHTML = `
                <div class="wallet-empty">
                    لا توجد معاملات حتى الآن
                </div>
            `;

        } else {

            recentTransactions.forEach(
                transaction => {

                    const amount =
                        Number(
                            transaction.amount || 0
                        );


                    const type =
                        transactionNames[
                            transaction.transaction_type
                        ] ||
                        "💰 مكافأة 3M";


                    let transactionDate = "";


                    if (
                        transaction.created_at
                    ) {

                        transactionDate =
                            new Date(
                                transaction.created_at
                            ).toLocaleDateString(
                                "ar"
                            );
                    }


                    transactionHTML += `
                        <div class="wallet-transaction">

                            <div>

                                <strong>
                                    ${escapeHTML(
                                        type
                                    )}
                                </strong>

                                <small>
                                    ${escapeHTML(
                                        transactionDate
                                    )}
                                </small>

                            </div>

                            <b>
                                +${formatNumber(
                                    amount
                                )} 3M
                            </b>

                        </div>
                    `;
                }
            );
        }


        const oldWallet =
            $("walletModal");


        if (oldWallet) {
            oldWallet.remove();
        }


        const modal =
            document.createElement("div");


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
                        ⚠️ 3M حاليًا عملة تجريبية داخل النظام
                        وغير قابلة للتداول.
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
                    text: "حسناً"
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

function handleAction(action) {

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

document
    .querySelectorAll("[data-action]")
    .forEach(button => {

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
    });


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


/* =========================================================
   START APPLICATION
========================================================= */

render();

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
    "Version: 2.0"
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
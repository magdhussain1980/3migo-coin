/* =========================================================
   3Migo Coin - Telegram Mini App
   Version: 1.2
   Backend Connected
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
    mining: false,
    loadingUser: false
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


/* =========================================================
   TELEGRAM ID
========================================================= */

function getTelegramId() {

    const user = getTelegramUser();

    if (user && user.id) {
        return Number(user.id);
    }

    /*
        المستخدم التجريبي يستخدم فقط عند فتح
        التطبيق خارج Telegram أثناء الاختبار.
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

    clearTimeout(
        window.__toastTimer
    );

    window.__toastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 2200);
}


function haptic() {

    try {

        if (
            tg &&
            tg.HapticFeedback
        ) {

            tg.HapticFeedback
                .impactOccurred("medium");

        }

    } catch (error) {

        console.log(
            "Haptic unavailable"
        );

    }
}


/*
    حماية النصوص القادمة من Backend
*/

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   RENDER
========================================================= */

function render() {

    if ($("balance")) {

        $("balance").innerHTML =
            `${Math.floor(
                Number(state.balance || 0)
            ).toLocaleString()}
            <span>3M</span>`;

    }


    if ($("total")) {

        $("total").textContent =
            `${Math.floor(
                Number(state.total || 0)
            ).toLocaleString()} 3M`;

    }


    if ($("today")) {

        $("today").textContent =
            `${Math.floor(
                Number(state.today || 0)
            ).toLocaleString()} 3M`;

    }


    if ($("sessions")) {

        $("sessions").textContent =
            Number(state.sessions || 0);

    }


    if ($("miningState")) {

        $("miningState").textContent =
            state.mining
                ? "يعمل"
                : "جاهز";

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

    telegramUser = getTelegramUser();

    const telegramId = getTelegramId();

    console.log(
        "Telegram User:",
        telegramUser
    );

    console.log(
        "Telegram ID:",
        telegramId
    );

    try {

        const response =
            await fetch(
                `/user/${telegramId}`
            );

        /*
            المستخدم غير موجود
        */

        if (
            response.status === 404
        ) {

            const registered =
                await registerUser(
                    telegramId
                );

            if (registered) {

                state.loadingUser = false;

                return loadUser();

            }

            throw new Error(
                "تعذر تسجيل المستخدم"
            );
        }


        if (!response.ok) {

            throw new Error(
                "تعذر تحميل المستخدم"
            );

        }


        const user =
            await response.json();


        if (user.error) {

            /*
                محاولة تسجيل المستخدم
                إذا كان Backend يعيد error
                بدلاً من 404.
            */

            const registered =
                await registerUser(
                    telegramId
                );

            if (registered) {

                state.loadingUser = false;

                return loadUser();

            }

            throw new Error(
                user.error
            );
        }


        state.balance =
            Number(
                user.balance_3m || 0
            );


        render();


        /*
            تحميل سجل العمليات
        */

        await loadTransactions(
            telegramId
        );


        /*
            تحديث اسم المستخدم إن وجد
        */

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

        const username =
            telegramUser?.username || "";

        const firstName =
            telegramUser?.first_name || "";

        const lastName =
            telegramUser?.last_name || "";


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
                            username,

                        first_name:
                            firstName,

                        last_name:
                            lastName,

                        referral_code:
                            ""

                    })
                }
            );


        if (!response.ok) {

            console.error(
                "Register failed:",
                response.status
            );

            return false;
        }


        const data =
            await response.json();


        if (
            data &&
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

    const possibleNames = [
        "username",
        "userName",
        "profileName"
    ];

    const displayName =
        telegramUser.username ||
        telegramUser.first_name ||
        "3Migo User";


    possibleNames.forEach(id => {

        const element = $(id);

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
                    ).startsWith(currentDate)
                ) {

                    today += amount;

                }


                if (
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
   MINING
========================================================= */

async function startMining() {

    if (state.mining) {

        showToast(
            "⛏️ التعدين يعمل حالياً"
        );

        return;
    }


    const button =
        $("mineBtn");


    state.mining =
        true;


    if (button) {

        button.disabled =
            true;

        button.style.opacity =
            "0.75";

    }


    render();

    haptic();


    showToast(
        "⛏️ جاري تشغيل التعدين..."
    );


    const telegramId =
        getTelegramId();


    try {

        const response =
            await fetch(
                `/user/${telegramId}/mine`,
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
                "Mining request failed"
            );

        }


        if (data.error) {

            showToast(
                "⚠️ تعذر تنفيذ العملية"
            );

            return;
        }


        /*
            Backend قد يعيد user
            أو يعيد balance مباشرة.
        */

        if (data.user) {

            state.balance =
                Number(
                    data.user.balance_3m ||
                    state.balance
                );

        } else {

            state.balance =
                Number(
                    data.balance_3m ||
                    data.balance ||
                    state.balance
                );

        }


        await loadTransactions(
            telegramId
        );


        render();


        showToast(
            "⛏️ تمت إضافة مكافأة التعدين"
        );


    } catch (error) {

        console.error(
            "Mining error:",
            error
        );

        showToast(
            "⚠️ تعذر الاتصال بالخادم"
        );


    } finally {

        state.mining =
            false;


        if (button) {

            button.disabled =
                false;

            button.style.opacity =
                "1";

        }


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
                    data.balance_3m ||
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
                data.user?.balance_3m ||
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


    try {

        showToast(
            "☑️ جاري تحميل المهام..."
        );


        const response =
            await fetch(
                `/tasks/${telegramId}`
            );


        if (!response.ok) {

            throw new Error(
                "Tasks request failed"
            );

        }


        const tasks =
            await response.json();


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
                                    🎁 +${reward.toLocaleString()} 3M
                                </div>

                            </div>

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
            "⚠️ تعذر الاتصال بالخادم"
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


        /*
            Endpoint الخاص بإكمال المهمة.
        */

        const response =
            await fetch(
                `/tasks/${telegramId}/complete/${taskId}
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


        if (data.error) {

            if (
                data.error ===
                "already_completed"
            ) {

                showToast(
                    "✓ هذه المهمة مكتملة مسبقاً"
                );

            } else {

                showToast(
                    "⚠️ تعذر إكمال المهمة"
                );

            }

            return;
        }


        /*
            تحديث الرصيد
        */

        if (data.user) {

            state.balance =
                Number(
                    data.user.balance_3m ||
                    state.balance
                );

        } else {

            state.balance =
                Number(
                    data.balance_3m ||
                    data.balance ||
                    state.balance
                );

        }


        await loadTransactions(
            telegramId
        );


        render();


        showToast(
            "🎉 تمت المهمة وإضافة المكافأة"
        );


        /*
            إعادة تحميل قائمة المهام
            لإظهار المهمة كمكتملة.
        */

        setTimeout(
            () => {
                openTasks();
            },
            500
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


        if (!response.ok) {

            throw new Error(
                "Referral request failed"
            );

        }


        const data =
            await response.json();


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


        if (
            tg &&
            tg.showPopup
        ) {

            tg.showPopup(
                {
                    title:
                        "👥 نظام الإحالات",

                    message:
                        `🔑 كود الإحالة:\n${referralCode}\n\n` +
                        `🔗 رابط الدعوة:\n${referralLink}\n\n` +
                        `👤 عدد الإحالات: ${referralCount}\n` +
                        `🎁 مكافآت الإحالة: ${referralRewards} 3M`,

                    buttons: [
                        {
                            id: "ok",
                            type: "ok",
                            text: "حسناً"
                        }
                    ]
                }
            );

        } else {

            alert(
                `👥 نظام الإحالات\n\n` +
                `🔑 كود الإحالة:\n${referralCode}\n\n` +
                `🔗 رابط الدعوة:\n${referralLink}\n\n` +
                `👤 عدد الإحالات: ${referralCount}\n` +
                `🎁 مكافآت الإحالة: ${referralRewards} 3M`
            );

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


        if (!userResponse.ok) {

            throw new Error(
                "User request failed"
            );

        }


        const user =
            await userResponse.json();


        if (user.error) {

            showToast(
                "⚠️ تعذر تحميل بيانات المحفظة"
            );

            return;
        }


        const transactionsResponse =
            await fetch(
                `/transactions/${telegramId}`
            );


        let transactions = [];


        if (transactionsResponse.ok) {

            transactions =
                await transactionsResponse.json();


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

            engagement_reward:
                "⛏️ مكافأة التعدين",

            daily_reward:
                "🎁 المكافأة اليومية",

            referral_reward:
                "👥 مكافأة إحالة",

            task_reward:
                "☑️ مكافأة مهمة"

        };


        let transactionHTML =
            "";


        const recentTransactions =
            transactions
                .slice(-8)
                .reverse();


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


                    let transactionDate =
                        "";


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
                                    ${escapeHTML(type)}
                                </strong>

                                <small>
                                    ${escapeHTML(transactionDate)}
                                </small>

                            </div>

                            <b>
                                +${amount.toLocaleString()} 3M
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
                            ${balance.toLocaleString()}
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
                                ${totalRewards.toLocaleString()} 3M
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


/*
    مهم:
    لا نضيف listener آخر لـ mineBtn هنا،
    لأن data-action="mine" يعالج الزر بالفعل.
    هذا يمنع تنفيذ التعدين مرتين.
*/


/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

/*
    نضع الدوال على window لأن أزرار المهام
    تستخدم onclick="completeTask(...)"
*/

window.startMining =
    startMining;

window.dailyReward =
    dailyReward;

window.openTasks =
    openTasks;

window.completeTask =
    completeTask;

window.openReferral =
    openReferral;

window.openWallet =
    openWallet;

window.openProfile =
    openProfile;

window.handleAction =
    handleAction;


/* =========================================================
   START APP
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
    "Version: 1.2 Backend Connected"
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
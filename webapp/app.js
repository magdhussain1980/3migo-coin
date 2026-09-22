const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();

    try {
        tg.setHeaderColor("#04142a");
        tg.setBackgroundColor("#031024");
    } catch (error) {
        console.log("Telegram UI settings unavailable");
    }
}

/*
    3Migo Mini App
    Backend:
    /user/{telegram_id}
/user/{telegram_id}/mine
    /user/{telegram_id}/daily
*/

let telegramUser = null;

let state = {
    balance: 0,
    total: 0,
    today: 0,
    sessions: 0,
    mining: false
};


/* =========================
   TELEGRAM USER
========================= */

function getTelegramUser() {

    if (
        tg &&
        tg.initDataUnsafe &&
        tg.initDataUnsafe.user
    ) {
        return tg.initDataUnsafe.user;
    }

    return null;
}


/* =========================
   HELPERS
========================= */

function $(id) {
    return document.getElementById(id);
}


function showToast(message) {

    const toast = $("toast");

    if (!toast) return;

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {
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
        console.log("Haptic unavailable");
    }
}


/* =========================
   RENDER
========================= */

function render() {

    if ($("balance")) {

        $("balance").innerHTML =
            `${Math.floor(state.balance).toLocaleString()}
             <span>3M</span>`;

    }

    if ($("total")) {

        $("total").textContent =
            `${Math.floor(state.total).toLocaleString()} 3M`;

    }

    if ($("today")) {

        $("today").textContent =
            `${Math.floor(state.today).toLocaleString()} 3M`;

    }

    if ($("sessions")) {

        $("sessions").textContent =
            state.sessions;

    }

    if ($("miningState")) {

        $("miningState").textContent =
            state.mining
                ? "يعمل"
                : "جاهز";

    }
}


/* =========================
   LOAD USER
========================= */

async function loadUser() {

    telegramUser = getTelegramUser();

    /*
       خارج Telegram:
       نستخدم مستخدم تجريبي للتأكد
       من عمل الواجهة.
    */

    const telegramId =
        telegramUser?.id || 1;

    try {

        const response =
            await fetch(
                `/user/${telegramId}`
            );

        if (!response.ok) {
            throw new Error(
                "تعذر تحميل المستخدم"
            );
        }

        const user =
            await response.json();

        if (user.error) {

            /*
                إذا لم يكن المستخدم موجوداً
                نسجله تلقائياً.
            */

            await registerUser(
                telegramId
            );

            return loadUser();
        }

        state.balance =
            Number(user.balance_3m || 0);

        render();

        /*
            نحمّل سجل العمليات لحساب
            الإحصائيات.
        */

        await loadTransactions(
            telegramId
        );

    } catch (error) {

        console.error(error);

        showToast(
            "⚠️ تعذر الاتصال بالخادم"
        );
    }
}


/* =========================
   REGISTER
========================= */

async function registerUser(
    telegramId
) {

    try {

        const username =
            telegramUser?.username || "";

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

                        referral_code:
                            ""

                    })
                }
            );

        return await response.json();

    } catch (error) {

        console.error(error);

        return null;
    }
}


/* =========================
   TRANSACTIONS
========================= */

async function loadTransactions(
    telegramId
) {

    try {

        const response =
            await fetch(
                `/transactions/${telegramId}`
            );

        if (!response.ok) return;

        const transactions =
            await response.json();

        if (!Array.isArray(transactions))
            return;

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
                    transaction.created_at
                        .startsWith(currentDate)
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

        state.total = total;
        state.today = today;
        state.sessions = sessions;

        render();

    } catch (error) {

        console.error(
            "Transactions error:",
            error
        );

    }
}


/* =========================
   MINING
========================= */

async function startMining() {

    if (state.mining) {

        showToast(
            "⛏️ التعدين يعمل حالياً"
        );

        return;
    }

    const button =
        $("mineBtn");

    state.mining = true;

    if (button) {

        button.disabled = true;
        button.style.opacity = "0.75";

    }

    render();

    haptic();

    showToast(
        "⛏️ جاري تشغيل التعدين..."
    );

    const telegramId =
        telegramUser?.id || 1;

    try {

        const response =
            await fetch(
                `/user/${telegramId}/mine`,
                {
                    method: "POST"
                }
            );

        if (!response.ok) {

            throw new Error(
                "Mining request failed"
            );

        }

        const user =
            await response.json();

        if (user.error) {

            showToast(
                "⚠️ تعذر تنفيذ العملية"
            );

            return;
        }

        state.balance =
            Number(
                user.balance_3m || 0
            );

        await loadTransactions(
            telegramId
        );

        render();

        showToast(
            "⛏️ تمت إضافة 10 3M"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "⚠️ تعذر الاتصال بالخادم"
        );

    } finally {

        state.mining = false;

        if (button) {

            button.disabled = false;
            button.style.opacity = "1";

        }

        render();
    }
}


/* =========================
   DAILY
========================= */

async function dailyReward() {

    haptic();

    const telegramId =
        telegramUser?.id || 1;

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
            await response.json();

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

        if (data.error) {

            showToast(
                "⚠️ تعذر الحصول على المكافأة"
            );

            return;
        }

        state.balance =
            Number(
                data.balance_3m ||
                state.balance
            );

        await loadTransactions(
            telegramId
        );

        render();

        showToast(
            "🎁 تمت إضافة 50 3M"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "⚠️ تعذر الاتصال بالخادم"
        );
    }
}


/* =========================
   FEATURES
========================= */

async function openTasks() {
    haptic();

    const telegramId = telegramUser?.id || 1;

    try {
        showToast("☑️ جاري تحميل المهام...");

        const response = await fetch(
            `/tasks/${telegramId}`
        );

        if (!response.ok) {
            throw new Error("Tasks request failed");
        }

        const tasks = await response.json();

        const oldTasks =
            document.getElementById("tasksModal");

        if (oldTasks) {
            oldTasks.remove();
        }

        let tasksHTML = "";

        if (!Array.isArray(tasks) || tasks.length === 0) {

            tasksHTML = `
                <div class="tasks-empty">
                    لا توجد مهام متاحة حاليًا
                </div>
            `;

        } else {

            tasks.forEach(task => {

                const completed =
                    Number(task.completed) === 1;

                tasksHTML += `
                    <div class="task-card">

                        <div class="task-info">

                            <div class="task-title">
                                ${task.title}
                            </div>

                            <div class="task-description">
                                ${task.description || ""}
                            </div>

                            <div class="task-reward">
                                🎁 +${Number(
                                    task.reward_3m || 0
                                ).toLocaleString()} 3M
                            </div>

                        </div>

                        <button
                            class="task-button ${completed ? "completed" : ""}"
                            ${completed ? "disabled" : ""}
                            onclick="completeTask(${task.id})"
                        >
                            ${
                                completed
                                ? "✓ مكتملة"
                                : "احصل على المكافأة"
                            }
                        </button>

                    </div>
                `;
            });
        }

        const modal =
            document.createElement("div");

        modal.id = "tasksModal";

        modal.innerHTML = `
            <div class="tasks-overlay">

                <div class="tasks-modal">

                    <button
                        class="tasks-close"
                        onclick="document.getElementById('tasksModal').remove()"
                    >
                        ×
                    </button>

                    <div class="tasks-header">
                        <div class="tasks-icon">
                            ☑️
                        </div>

                        <div>
                            <h2>مهام 3Migo</h2>
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

        document.body.appendChild(modal);

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


async function openReferral() {
    haptic();

    const telegramId = telegramUser?.id || 1;

    try {
        showToast("👥 جاري تحميل بيانات الإحالة...");

        const response = await fetch(
            `/referral/${telegramId}`
        );

        if (!response.ok) {
            throw new Error("Referral request failed");
        }

        const data = await response.json();

        if (data.error) {
            showToast("⚠️ تعذر تحميل بيانات الإحالة");
            return;
        }

        const referralCode = data.referral_code || "";
        const referralCount = Number(data.referral_count || 0);
        const referralRewards = Number(data.referral_rewards || 0);

        const referralLink =
            `https://t.me/threemigosmart_bot?start=ref_${referralCode}`;

        alert(
            `👥 نظام الإحالات\n\n` +
            `🔑 كود الإحالة:\n${referralCode}\n\n` +
            `🔗 رابط الدعوة:\n${referralLink}\n\n` +
            `👤 عدد الإحالات: ${referralCount}\n` +
            `🎁 مكافآت الإحالة: ${referralRewards} 3M`
        );

    } catch (error) {
        console.error(error);
        showToast("⚠️ تعذر الاتصال بالخادم");
    }
}


async function openWallet() {
    haptic();

    const telegramId = telegramUser?.id || 1;

    try {
        showToast("💼 جاري تحميل المحفظة...");

        const userResponse = await fetch(
            `/user/${telegramId}`
        );

        if (!userResponse.ok) {
            throw new Error("User request failed");
        }

        const user = await userResponse.json();

        if (user.error) {
            showToast("⚠️ تعذر تحميل بيانات المحفظة");
            return;
        }

        const transactionsResponse = await fetch(
            `/transactions/${telegramId}`
        );

        let transactions = [];

        if (transactionsResponse.ok) {
            transactions = await transactionsResponse.json();

            if (!Array.isArray(transactions)) {
                transactions = [];
            }
        }

        const balance = Number(user.balance_3m || 0);

        let totalRewards = 0;

        transactions.forEach(transaction => {
            const amount = Number(transaction.amount || 0);

            if (amount > 0) {
                totalRewards += amount;
            }
        });

        const transactionNames = {
            engagement_reward: "⛏️ مكافأة التعدين",
            daily_reward: "🎁 المكافأة اليومية",
            referral_reward: "👥 مكافأة إحالة"
        };

        let transactionHTML = "";

        const recentTransactions =
            transactions.slice(-8).reverse();

        if (recentTransactions.length === 0) {
            transactionHTML = `
                <div class="wallet-empty">
                    لا توجد معاملات حتى الآن
                </div>
            `;
        } else {
            recentTransactions.forEach(transaction => {

                const amount =
                    Number(transaction.amount || 0);

                const type =
                    transactionNames[
                        transaction.transaction_type
                    ] || "💰 مكافأة 3M";

                let transactionDate = "";

                if (transaction.created_at) {
                    transactionDate =
                        new Date(
                            transaction.created_at
                        ).toLocaleDateString("ar");
                }

                transactionHTML += `
                    <div class="wallet-transaction">
                        <div>
                            <strong>${type}</strong>
                            <small>${transactionDate}</small>
                        </div>
                        <b>+${amount.toLocaleString()} 3M</b>
                    </div>
                `;
            });
        }

        const oldWallet =
            document.getElementById("walletModal");

        if (oldWallet) {
            oldWallet.remove();
        }

        const modal =
            document.createElement("div");

        modal.id = "walletModal";

        modal.innerHTML = `
            <div class="wallet-overlay">

                <div class="wallet-modal">

                    <button
                        class="wallet-close"
                        id="walletClose"
                    >×</button>

                    <div class="wallet-header">
                        <div class="wallet-icon">💼</div>
                        <div>
                            <h2>محفظة 3M</h2>
                            <small>3Migo Coin</small>
                        </div>
                    </div>

                    <div class="wallet-balance">
                        <small>الرصيد الحالي</small>

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
                            <small>إجمالي المكافآت</small>
                            <strong>
                                ${totalRewards.toLocaleString()} 3M
                            </strong>
                        </div>

                        <div>
                            <small>المعاملات</small>
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

        document.body.appendChild(modal);

        document
            .getElementById("walletClose")
            .addEventListener("click", () => {
                modal.remove();
            });

        modal
            .querySelector(".wallet-overlay")
            .addEventListener("click", (event) => {
                if (
                    event.target.classList.contains(
                        "wallet-overlay"
                    )
                ) {
                    modal.remove();
                }
            });

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


function openProfile() {

    haptic();

    showToast(
        "👤 الحساب قيد التطوير"
    );
}


/* =========================
   ACTION HANDLER
========================= */

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


/* =========================
   BUTTON EVENTS
========================= */

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

                handleAction(action);

            }
        );

    });


const miningButton =
    $("mineBtn");

if (miningButton) {

    miningButton.addEventListener(
        "click",
        startMining
    );

}


/* =========================
   START APP
========================= */

render();

loadUser();


console.log(
    "================================="
);

console.log(
    "3Migo Coin Mini App"
);

console.log(
    "Version: 1.1 Backend Connected"
);

console.log(
    "Token: 3M"
);

console.log(
    "================================="
);
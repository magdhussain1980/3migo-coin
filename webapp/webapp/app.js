/* =========================================================
   3MIGO COIN — MINI APP
   Application Logic
   ========================================================= */

const tg = window.Telegram?.WebApp;


/* =========================================================
   TELEGRAM INITIALIZATION
   ========================================================= */

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


/* =========================================================
   LOCAL DEMO STATE
   ========================================================= */

let state = {

    balance: 0,

    total: 0,

    today: 0,

    sessions: 0,

    mining: false

};


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(id) {

    return document.getElementById(id);

}


/* =========================================================
   RENDER BALANCE
   ========================================================= */

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
            state.mining ? "يعمل" : "جاهز";

    }

}


/* =========================================================
   TOAST MESSAGE
   ========================================================= */

function showToast(message) {

    const toast = $("toast");

    if (!toast) return;

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {

        toast.classList.remove("show");

    }, 2200);

}


/* =========================================================
   TELEGRAM HAPTIC FEEDBACK
   ========================================================= */

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


    const button = $("mineBtn");

    state.mining = true;

    if (button) {

        button.disabled = true;

        button.style.opacity = "0.75";

    }


    if ($("miningState")) {

        $("miningState").textContent =
            "يعمل";

    }


    haptic();


    showToast(
        "⛏️ جاري تشغيل التعدين..."
    );


    /*
       ----------------------------------------------------
       DEMO MODE

       سيتم استبدال هذا الجزء لاحقاً
       بطلب API حقيقي إلى Render:

       POST /api/mine

       ----------------------------------------------------
    */


    await new Promise(
        resolve =>
            setTimeout(resolve, 1200)
    );


    const reward = 10;


    state.balance += reward;

    state.total += reward;

    state.today += reward;

    state.sessions += 1;


    render();


    showToast(
        `⛏️ تمت إضافة ${reward} 3M`
    );


    state.mining = false;


    if (button) {

        button.disabled = false;

        button.style.opacity = "1";

    }


    if ($("miningState")) {

        $("miningState").textContent =
            "جاهز";

    }

}


/* =========================================================
   DAILY REWARD
   ========================================================= */

async function dailyReward() {

    haptic();


    showToast(
        "🎁 جاري التحقق من المكافأة..."
    );


    /*
       سيتم ربط هذه الوظيفة لاحقاً
       بـ:

       POST /api/daily
    */


    await new Promise(
        resolve =>
            setTimeout(resolve, 700)
    );


    showToast(
        "🎁 نظام المكافأة اليومية سيتم ربطه بالقاعدة"
    );

}


/* =========================================================
   TASKS
   ========================================================= */

function openTasks() {

    haptic();

    showToast(
        "☑️ نظام المهام قيد التطوير"
    );

}


/* =========================================================
   REFERRALS
   ========================================================= */

function openReferral() {

    haptic();

    showToast(
        "👥 نظام الإحالات قيد التطوير"
    );

}


/* =========================================================
   WALLET
   ========================================================= */

function openWallet() {

    haptic();

    showToast(
        "💼 المحفظة قيد التطوير"
    );

}


/* =========================================================
   PROFILE
   ========================================================= */

function openProfile() {

    haptic();

    showToast(
        "👤 الحساب قيد التطوير"
    );

}


/* =========================================================
   BUTTON ROUTER
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
   CONNECT FEATURE BUTTONS
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

                handleAction(action);

            }
        );

    });


/* =========================================================
   MAIN MINING BUTTON
   ========================================================= */

const miningButton =
    $("mineBtn");


if (miningButton) {

    miningButton.addEventListener(
        "click",
        startMining
    );

}


/* =========================================================
   INITIAL DISPLAY
   ========================================================= */

render();


/* =========================================================
   USER INFORMATION FROM TELEGRAM
   ========================================================= */

if (
    tg &&
    tg.initDataUnsafe &&
    tg.initDataUnsafe.user
) {

    const user =
        tg.initDataUnsafe.user;

    console.log(
        "3Migo Telegram User:",
        user.id
    );

}


/* =========================================================
   DEVELOPMENT MESSAGE
   ========================================================= */

console.log(
    "================================="
);

console.log(
    "3Migo Coin Mini App"
);

console.log(
    "Version: 1.0 Prototype"
);

console.log(
    "Token: 3M"
);

console.log(
    "================================="
);
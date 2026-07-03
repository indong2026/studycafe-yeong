import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDXwy3-7MWWiQiRarngifBX1cq2R9t8VxI",
  authDomain: "studycafe-yeong.firebaseapp.com",
  projectId: "studycafe-yeong",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// UI
const popup = document.getElementById("popup");
const popupText = document.getElementById("popupText");
const reserveBtn = document.getElementById("reserveBtn");
const cancelBtn = document.getElementById("cancelBtn");

const idInput = document.getElementById("idInput");
const pwInput = document.getElementById("pwInput");

const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const changePwBtn = document.getElementById("changePwBtn");

const mySeatText = document.getElementById("mySeatText");
const sessionSelect = document.getElementById("sessionSelect");

const reserveTimeInfo = document.getElementById("reserveTimeInfo");

const adminPopup = document.getElementById("adminPopup");

const adminCloseBtn = document.getElementById("adminCloseBtn");

reserveTimeInfo.textContent = "예약 가능 시간 : 12:30 ~ 21:30";

// 상태
let currentUser = null;
let selectedSeat = null;

let seats = [];

let isAdmin = false;

for (let i = 1; i <= 8; i++) {
  seats.push({
    num: i,
    owner: "",
    session: "",
  });
}

async function updateMonthlyTicket(userRef, userData) {
  const now = new Date();

  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (userData.ticketMonth !== currentMonth) {
    await updateDoc(userRef, {
      ticketCount: 10,
      ticketMonth: currentMonth,
    });

    userData.ticketCount = 10;
    userData.ticketMonth = currentMonth;
  }

  return userData;
}

async function updateMyInfo() {
  if (!currentUser) return;

  const userRef = doc(db, "users", currentUser);

  const userSnap = await getDoc(userRef);

  const ticketCount = userSnap.data()?.ticketCount ?? 10;

  const mine = seats.find((s) => s.owner === currentUser);

  if (mine) {
    mySeatText.textContent = `${currentUser}님 | ${mine.num}번 자리 | 예약권 ${ticketCount}/10`;
  } else {
    mySeatText.textContent = `${currentUser}님 | 예약권 ${ticketCount}/10`;
  }
}

// 🔥 남은 시간 계산
function getRemainingMinutes(endTime) {
  const diff = endTime - Date.now();
  return Math.max(0, Math.floor(diff / 60000));
}

// 🔥 렌더
function render() {
  document.querySelectorAll(".desk").forEach((div, index) => {
    const seat = seats[index];

    const reserved = seat.owner && seat.date === todayString();

    if (reserved) {
      div.classList.add("used");
    } else {
      div.classList.remove("used");
    }

    let statusText = "";

    if (reserved) {
      if (seat.session === "part1") {
        statusText = '<span class="session-text part1">야자 1부</span>';
      } else if (seat.session === "part2") {
        statusText = '<span class="session-text part2">야자 2부</span>';
      } else if (seat.session === "both") {
        statusText = '<span class="session-text both">야자 1·2부</span>';
      }
    }

    let userText = "";

    if (reserved) {
      userText = `<span class="user-text">${seat.owner}</span>`;
    }

    div.innerHTML = `${seat.num}번<br>${statusText}<br>${userText}`;

    div.onclick = async () => {
      if (!currentUser) {
        alert("로그인 먼저");
        return;
      }

      if (seat.owner === currentUser) {
        const ok = confirm("취소하시겠습니까?");

        if (!ok) return;

        const ref = doc(db, "seats", String(seat.num));

        await setDoc(ref, {
          owner: "",
          session: "",
          date: "",
        });

        const userRef = doc(db, "users", currentUser);

        const userSnap = await getDoc(userRef);

        const userData = userSnap.data();

        await updateDoc(userRef, {
          ticketCount: Math.min((userData.ticketCount ?? 10) + 1, 10),
        });

        alert("예약이 취소되었습니다.");

        await updateMyInfo();

        return;
      }

      if (reserved && seat.owner !== currentUser) {
        return;
      }

      const mine = seats.find(
        (s) => s.owner === currentUser && s.date === todayString(),
      );

      if (mine) {
        alert(`이미 ${mine.num}번 자리를 예약했습니다`);
        return;
      }

      selectedSeat = seat.num;

      popupText.textContent = `${seat.num}번 자리를 예약하시겠습니까?`;

      popup.classList.remove("hidden");
    };
  });
}

// 🔥 로그인
loginBtn.onclick = async () => {
  const id = idInput.value.trim();
  const pw = pwInput.value.trim();

  const idRule = /^[0-9]{5}$/;

  if (!idRule.test(id)) {
    alert("학번 5자리 입력");
    return;
  }

  try {
    const ref = doc(db, "users", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      alert("계정 없음");
      return;
    }

    if (snap.data().password !== pw) {
      alert("비밀번호 틀림");
      return;
    }

    const userData = snap.data();

    console.log(userData);

    currentUser = id;

    isAdmin = userData.isAdmin || false;

    await updateMyInfo();

    if (isAdmin) {
      document.getElementById("adminBtn").style.display = "block";
    }

    const now = new Date();

    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    if (userData.ticketMonth !== currentMonth) {
      await updateDoc(ref, {
        ticketCount: 10,
        ticketMonth: currentMonth,
      });

      userData.ticketCount = 10;
      userData.ticketMonth = currentMonth;
    }

    mySeatText.textContent = `${currentUser}님 | 남은 예약권 : ${userData.ticketCount}/10`;

    render();
  } catch (e) {
    console.error(e);
    alert("로그인 실패");
  }
};

// 🔥 회원가입
signupBtn.onclick = async () => {
  const id = idInput.value.trim();
  const pw = pwInput.value.trim();

  const idRule = /^[0-9]{5}$/;
  const pwRule = /^(?=.*[!@#$%^&*])(?=.*[A-Za-z])(?=.*\d).{8,}$/;

  if (!idRule.test(id)) {
    alert("학번 5자리 입력");
    return;
  }

  if (!pwRule.test(pw)) {
    alert("비밀번호 8자 이상 / 영문 / 숫자 / 특수문자");
    return;
  }

  try {
    const ref = doc(db, "users", id);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      alert("이미 가입됨");
      return;
    }

    const now = new Date();

    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    await setDoc(ref, {
      password: pw,
      ticketCount: 10,
      ticketMonth: currentMonth,
      isAdmin: false,
    });

    alert("회원가입 완료");
  } catch (e) {
    console.error(e);
    alert("회원가입 실패");
  }
};

// 🔥 좌석 데이터 실시간 반영
seats.forEach((seat) => {
  const ref = doc(db, "seats", String(seat.num));

  onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const data = snap.data();

      seat.owner = data.owner || "";
      seat.session = data.session || "";
      seat.date = data.date || "";
    } else {
      seat.owner = "";
      seat.session = "";
      seat.date = "";
    }

    if (currentUser) {
      updateMyInfo();
    }

    render();
  });
});

// 🔥 예약
reserveBtn.onclick = async () => {
  if (!canReserve()) {
    alert("현재 예약할 수 없습니다.");
    return;
  }

  if (!selectedSeat || !currentUser) return;

  // 예약권 확인
  const userRef = doc(db, "users", currentUser);

  const userSnap = await getDoc(userRef);

  const userData = userSnap.data();

  if ((userData.ticketCount ?? 10) <= 0) {
    alert("이번 달 예약권을 모두 사용했습니다.");
    return;
  }

  const ref = doc(db, "seats", String(selectedSeat));

  await setDoc(ref, {
    owner: currentUser,
    session: sessionSelect.value,
    date: todayString(),
  });

  // 예약권 차감
  await updateDoc(userRef, {
    ticketCount: (userData.ticketCount ?? 10) - 1,
  });

  await updateMyInfo();

  popup.classList.add("hidden");

  selectedSeat = null;
};

// 🔥 비밀번호 변경
changePwBtn.onclick = async () => {
  if (!currentUser) {
    alert("로그인 먼저");
    return;
  }

  const oldPw = prompt("현재 비밀번호");
  const newPw = prompt("새 비밀번호");

  const pwRule = /^(?=.*[!@#$%^&*])(?=.*[A-Za-z])(?=.*\d).{4,}$/;

  if (!oldPw || !newPw) return;

  if (!pwRule.test(newPw)) {
    alert("비밀번호 형식 오류");
    return;
  }

  try {
    const ref = doc(db, "users", currentUser);
    const snap = await getDoc(ref);

    if (snap.data().password !== oldPw) {
      alert("현재 비밀번호 틀림");
      return;
    }

    await updateDoc(ref, {
      password: newPw,
    });

    alert("변경 완료");
  } catch (e) {
    console.error(e);
    alert("변경 실패");
  }
};

render();

function sessionText(session) {
  if (session === "part1") return "1부";

  if (session === "part2") return "2부";

  if (session === "both") return "1+2부";

  return "";
}

function todayString() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(now.getDate()).padStart(2, "0")}`;
}

function canReserve() {
  const now = new Date();

  const minute = now.getHours() * 60 + now.getMinutes();

  // 12:30 ~ 21:30

  return minute true;
}

cancelBtn.onclick = () => {
  popup.classList.add("hidden");
  selectedSeat = null;
};

const adminBtn = document.getElementById("adminBtn");

adminBtn.onclick = () => {
  adminPopup.classList.remove("hidden");
};

adminCloseBtn.onclick = () => {
  adminPopup.classList.add("hidden");
};

adminCancelSeatBtn.onclick = async () => {
  const seatNum = prompt("좌석 번호");

  if (!seatNum) return;

  await setDoc(doc(db, "seats", seatNum), {
    owner: "",
    session: "",
    date: "",
  });

  alert("취소 완료");
};

adminAddTicketBtn.onclick = async () => {
  const id = prompt("학번");

  const amount = Number(prompt("추가 수량"));

  if (!id || !amount) return;

  const userRef = doc(db, "users", id);

  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    alert("계정 없음");
    return;
  }

  const userData = userSnap.data();

  await updateDoc(userRef, {
    ticketCount: (userData.ticketCount ?? 0) + amount,
  });

  alert("추가 완료");
};

adminDeleteUserBtn.onclick = async () => {
  const id = prompt("삭제할 학번");

  if (!id) return;

  const ok = confirm(`${id} 삭제?`);

  if (!ok) return;

  await deleteDoc(doc(db, "users", id));

  alert("삭제 완료");
};

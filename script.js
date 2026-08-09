import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
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

const reserveTimeInfo = document.getElementById("reserveTimeInfo");

const adminPopup = document.getElementById("adminPopup");

const adminCloseBtn = document.getElementById("adminCloseBtn");

// 예약 날짜 입력창
const reserveDate = document.getElementById("reserveDate");

const lunchCheck = document.getElementById("lunchCheck");

const dinnerCheck = document.getElementById("dinnerCheck");

const part1Check = document.getElementById("part1Check");

const part2Check = document.getElementById("part2Check");

// =============================
// 예약 취소 팝업 요소
// =============================

const cancelReservationPopup =
  document.getElementById("cancelReservationPopup");

const cancelTimeButtons =
  document.getElementById("cancelTimeButtons");

const cancelReservationCloseBtn =
  document.getElementById("cancelReservationCloseBtn");

reserveTimeInfo.textContent = "예약 가능 시간 : 12:30 ~ 21:30";

// 처음 사이트에 들어오면 오늘 날짜의 예약을 감시


// 🔥 예약 날짜가 바뀌면 해당 날짜의 예약을 다시 불러옴
reserveDate.addEventListener("change", () => {

  const selectedDate = reserveDate.value;

  if (!selectedDate) return;

  listenReservations(selectedDate);

});

//해시 코드 함수
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);

  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

// ==========================================
// 날짜에 따른 예약 시간 선택 제한
// ==========================================
function updateTimeOptions() {

  const selectedDate = reserveDate.value;

  // 날짜를 선택하지 않았으면 전부 활성화
  if (!selectedDate) {

    lunchCheck.disabled = false;
    dinnerCheck.disabled = false;
    part1Check.disabled = false;
    part2Check.disabled = false;

    return;
  }


  // 선택한 날짜의 요일 확인
  const date = new Date(
    selectedDate + "T00:00:00"
  );

  const day = date.getDay();

  // ==========================================
  // 금요일
  // ==========================================

  if (day === 5) {

    // 점심은 가능
    lunchCheck.disabled = false;

    // 저녁 / 야자는 불가능
    dinnerCheck.disabled = true;
    part1Check.disabled = true;
    part2Check.disabled = true;

    // 혹시 이미 체크되어 있었다면 해제
    dinnerCheck.checked = false;
    part1Check.checked = false;
    part2Check.checked = false;

  } else {

    // 금요일이 아니면 전부 가능
    lunchCheck.disabled = false;
    dinnerCheck.disabled = false;
    part1Check.disabled = false;
    part2Check.disabled = false;

  }

}

// ==========================================
// 예약 날짜가 바뀌었을 때
// ==========================================

reserveDate.addEventListener("change", async () => {

  // 날짜가 바뀌었으므로
  // 기존에 비활성화되어 있던 체크박스를 전부 초기화
  lunchCheck.disabled = false;
  dinnerCheck.disabled = false;
  part1Check.disabled = false;
  part2Check.disabled = false;

  // 기존 체크도 초기화
  lunchCheck.checked = false;
  dinnerCheck.checked = false;
  part1Check.checked = false;
  part2Check.checked = false;


  // ==========================================
  // 금요일 등의 날짜 규칙 다시 적용
  // ==========================================

  updateTimeOptions();


  // ==========================================
  // 좌석을 아직 선택하지 않았다면 여기서 종료
  // ==========================================

  if (!selectedSeat) {
    return;
  }


  // ==========================================
  // 새로 선택한 날짜의 예약 정보 가져오기
  // ==========================================

  const selectedDate = reserveDate.value;

  const ref = doc(
    db,
    "reservations",
    selectedDate,
    "seats",
    String(selectedSeat)
  );

  const snap = await getDoc(ref);


  // ==========================================
  // 해당 날짜에 예약이 없다면
  // 모든 시간대 예약 가능
  // ==========================================

  if (!snap.exists()) {
    return;
  }


  // ==========================================
  // 해당 날짜의 예약 정보 확인
  // ==========================================

  const data = snap.data();

  const times = data.times || {};


  // ==========================================
  // 이미 예약된 시간대만 비활성화
  // ==========================================

  if (times.lunch?.owner) {
    lunchCheck.disabled = true;
  }

  if (times.dinner?.owner) {
    dinnerCheck.disabled = true;
  }

  if (times.part1?.owner) {
    part1Check.disabled = true;
  }

  if (times.part2?.owner) {
    part2Check.disabled = true;
  }

});

// 🔥 렌더
// 🔥 좌석 화면 표시
function render() {
  // 현재 보고 있는 날짜
  const selectedDate = reserveDate.value || todayString();

  // 현재 시간
  const now = new Date();

  const minute = now.getHours() * 60 + now.getMinutes();

  // 현재 시간대
  let currentSession = "";

  // 점심 12:30 ~ 13:30
  if (minute >= 750 && minute < 810) {
    currentSession = "lunch";
  }

  // 저녁 17:30 ~ 18:30
  else if (minute >= 1050 && minute < 1110) {
    currentSession = "dinner";
  }

  // 야자 1부 18:00 ~ 20:00
  else if (minute >= 1080 && minute < 1200) {
    currentSession = "part1";
  }

  // 야자 2부 20:10 ~ 21:30
  else if (minute >= 1210 && minute < 1290) {
    currentSession = "part2";
  }

  document.querySelectorAll(".desk").forEach((div, index) => {
    const seat = seats[index];

    // 현재 시간대에 예약된 사람
    let owner = "";

    if (currentSession === "lunch") {
      owner = seat.times?.lunch?.owner || "";
    } else if (currentSession === "dinner") {
      owner = seat.times?.dinner?.owner || "";
    } else if (currentSession === "part1") {
      owner = seat.times?.part1?.owner || "";
    } else if (currentSession === "part2") {
      owner = seat.times?.part2?.owner || "";
    }

    // 예약되어 있으면 좌석 사용중 표시
    if (owner) {
      div.classList.add("used");
    } else {
      div.classList.remove("used");
    }

    // 좌석에 표시할 시간대 이름
    let sessionText = "";

    if (currentSession === "lunch") {
      sessionText = "점심";
    } else if (currentSession === "dinner") {
      sessionText = "저녁";
    } else if (currentSession === "part1") {
      sessionText = "야자 1부";
    } else if (currentSession === "part2") {
      sessionText = "야자 2부";
    }

    // 좌석 내용
    div.innerHTML = `
        ${seat.num}번
        ${
          owner
            ? `<span class="session-text">${sessionText}</span>
               <span class="user-text">${owner}</span>`
            : ""
        }
      `;

    // ==========================================
    // 좌석 클릭
    // ==========================================

    div.onclick = async () => {
      // 로그인 확인
      if (!currentUser) {
        alert("로그인 먼저");
        return;
      }

      // ==========================================
      // 선택한 날짜
      // ==========================================

      const selectedDate = reserveDate.value || todayString();

      // ==========================================
      // 날짜 + 좌석 예약 문서
      // ==========================================

      const ref = doc(
        db,
        "reservations",
        selectedDate,
        "seats",
        String(seat.num),
      );

      // Firestore에서 예약 정보 가져오기
      const snap = await getDoc(ref);

      // ==========================================
      // 기존 예약 시간 정보
      // ==========================================

      let times = {};

      if (snap.exists()) {
        const data = snap.data();

        times = data.times || {};
      }

      // ==========================================
      // 내가 이미 예약한 시간 확인
      // ==========================================

      const myTimes = [];

      if (times.lunch?.owner === currentUser) {
        myTimes.push("점심");
      }

      if (times.dinner?.owner === currentUser) {
        myTimes.push("저녁");
      }

      if (times.part1?.owner === currentUser) {
        myTimes.push("야자 1부");
      }

      if (times.part2?.owner === currentUser) {
        myTimes.push("야자 2부");
      }

      // ==========================================
      // 내가 예약한 시간이 있다면
      // 예약 취소/관리 팝업 열기
      // ==========================================

      if (myTimes.length > 0) {
        openCancelReservationPopup(selectedDate, seat.num, times);

        return;
      }

      // ==========================================
      // 예약 팝업 열기
      // ==========================================

      selectedSeat = seat.num;

      popupText.textContent = `${seat.num}번 자리를 예약하시겠습니까?`;

      // 선택한 날짜 표시
      reserveDate.value = selectedDate;

      // 날짜에 따른 예약 가능 시간 업데이트
      updateTimeOptions();

      // ==========================================
      // 시간 체크박스 초기화
      // ==========================================

      lunchCheck.checked = false;
      dinnerCheck.checked = false;
      part1Check.checked = false;
      part2Check.checked = false;

      // ==========================================
      // 모든 시간대 일단 활성화
      // ==========================================

      lunchCheck.disabled = false;
      dinnerCheck.disabled = false;
      part1Check.disabled = false;
      part2Check.disabled = false;

      // ==========================================
      // 기존 예약이 있는 시간대는 비활성화
      // ==========================================

      if (times.lunch?.owner) {
        lunchCheck.disabled = true;
      }

      if (times.dinner?.owner) {
        dinnerCheck.disabled = true;
      }

      if (times.part1?.owner) {
        part1Check.disabled = true;
      }

      if (times.part2?.owner) {
        part2Check.disabled = true;
      }

      // ==========================================
      // 예약 팝업 표시
      // ==========================================

      popup.classList.remove("hidden");
    };
  });
}

// ==========================================
// 예약 취소 팝업 열기
// ==========================================

function openCancelReservationPopup(
  selectedDate,
  seatNum,
  times
) {

  // 기존 버튼 제거
  cancelTimeButtons.innerHTML = "";


  // ========================================
  // 시간대 정보
  // ========================================

  const timeInfo = [

    {
      key: "lunch",
      text: "점심",
      time: "12:30 ~ 13:30"
    },

    {
      key: "dinner",
      text: "저녁",
      time: "17:30 ~ 18:30"
    },

    {
      key: "part1",
      text: "야자 1부",
      time: "18:00 ~ 20:00"
    },

    {
      key: "part2",
      text: "야자 2부",
      time: "20:10 ~ 21:30"
    }

  ];


  // ========================================
  // 내가 예약한 시간만 버튼으로 표시
  // ========================================

  timeInfo.forEach((time) => {

    // 내가 예약한 시간이 아니면 표시하지 않음
    if (
      times[time.key]?.owner !== currentUser
    ) {
      return;
    }


    // 버튼 생성
    const button =
      document.createElement("button");


    button.textContent =
      `${time.text} (${time.time}) 예약 취소`;


    // 버튼 클릭
    button.onclick = async () => {

      const ok = confirm(
        `${time.text} 예약을 취소하시겠습니까?`
      );

      if (!ok) {
        return;
      }


      // ====================================
      // 예약 문서 가져오기
      // ====================================

      const ref = doc(
        db,
        "reservations",
        selectedDate,
        "seats",
        String(seatNum)
      );


      const snap =
        await getDoc(ref);


      if (!snap.exists()) {

        alert(
          "예약 정보를 찾을 수 없습니다."
        );

        return;

      }


      const data = snap.data();

      const currentTimes =
        data.times || {};


      // ====================================
      // 실제로 내 예약인지 다시 확인
      // ====================================

      if (
        currentTimes[time.key]?.owner
        !== currentUser
      ) {

        alert(
          "이미 취소되었거나 다른 예약으로 변경되었습니다."
        );

        return;

      }


      // ====================================
      // 기존 예약 유지
      // ====================================

      const newTimes = {

        lunch:
          currentTimes.lunch || {
            owner: ""
          },

        dinner:
          currentTimes.dinner || {
            owner: ""
          },

        part1:
          currentTimes.part1 || {
            owner: ""
          },

        part2:
          currentTimes.part2 || {
            owner: ""
          }

      };


      // ====================================
      // 선택한 시간만 취소
      // ====================================

      newTimes[time.key] = {
        owner: ""
      };


      // ====================================
      // Firestore 저장
      // ====================================

      await setDoc(ref, {

        date: selectedDate,

        times: newTimes

      });


      // ====================================
      // 예약권 1개 반환
      // ====================================

      const userRef =
        doc(db, "users", currentUser);


      const userSnap =
        await getDoc(userRef);


      if (userSnap.exists()) {

        const userData =
          userSnap.data();


        const currentTicket =
          userData.ticketCount ?? 0;


        await updateDoc(userRef, {

          ticketCount:
            Math.min(
              currentTicket + 1,
              10
            )

        });

      }


      // ====================================
      // 완료
      // ====================================

      alert(
        `${time.text} 예약이 취소되었습니다.`
      );


      // 팝업 닫기
      cancelReservationPopup
        .classList
        .add("hidden");


      // 내 정보 갱신
      await updateMyInfo();


      // 좌석 화면 갱신
      render();

      // 1분마다 현재 시간대와 좌석 사용자를 갱신
      setInterval(() => {
        render();
      }, 60000);

    };


    // 버튼 클래스
    button.classList.add(
      "cancel-time-btn"
    );


    // 버튼 추가
    cancelTimeButtons.appendChild(
      button
    );

  });


  // ========================================
  // 팝업 표시
  // ========================================

  cancelReservationPopup
    .classList
    .remove("hidden");

}

// ==========================================
// 예약 취소 팝업 닫기
// ==========================================

cancelReservationCloseBtn.onclick = () => {

  cancelReservationPopup
    .classList
    .add("hidden");

};

// 🔥 로그인
loginBtn.onclick = async () => {
  const id = idInput.value.trim();
  const pw = pwInput.value.trim();
  const hashedPw = await hashPassword(pw);

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

    if (snap.data().password !== hashedPw) {
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

    // 처음 사이트에 들어오면 오늘 날짜의 예약을 감시
    // 현재 실행 중인 Firestore 실시간 감시 목록
    let reservationUnsubscribers = [];

    // 🔥 특정 날짜의 예약을 실시간으로 감시
    function listenReservations(date) {
      // 기존 날짜의 실시간 감시 중지
      reservationUnsubscribers.forEach((unsubscribe) => {
        unsubscribe();
      });

      reservationUnsubscribers = [];

      // 좌석 1~8 감시
      seats.forEach((seat) => {
        const ref = doc(db, "reservations", date, "seats", String(seat.num));

        const unsubscribe = onSnapshot(ref, (snap) => {
          if (snap.exists()) {
            const data = snap.data();

            // Firestore에 저장된 시간대별 예약 정보
            const times = data.times || {};

            seat.times = {
              lunch: times.lunch?.owner || "",
              dinner: times.dinner?.owner || "",
              part1: times.part1?.owner || "",
              part2: times.part2?.owner || "",
            };

            seat.owner = "";
            seat.session = "";
            seat.date = data.date || "";
          } else {
            // 해당 날짜에 예약이 없을 때
            seat.times = {
              lunch: "",
              dinner: "",
              part1: "",
              part2: "",
            };

            seat.owner = "";
            seat.session = "";
            seat.date = "";
          }

          if (currentUser) {
            updateMyInfo();
          }

          render();
        });

        // 나중에 날짜가 바뀌면 이 감시를 종료할 수 있도록 저장
        reservationUnsubscribers.push(unsubscribe);
      });
    }

    render();

    // 처음에는 오늘 날짜 예약 감시
    listenReservations(todayString());

    // 🔥 예약 날짜가 바뀌면 해당 날짜의 예약을 다시 불러옴
    reserveDate.addEventListener("change", () => {
      const selectedDate = reserveDate.value;

      if (!selectedDate) return;

      listenReservations(selectedDate);
    });

  } catch (e) {
    console.error(e);
    alert("로그인 실패");
  }
};

// 🔥 회원가입
signupBtn.onclick = async () => {
  const id = idInput.value.trim();
  const pw = pwInput.value.trim();
  const hashedPw = await hashPassword(pw);

  const pwRule = /^(?=.*[!@#$%^&*])(?=.*[A-Za-z])(?=.*\d).{8,}$/;

  // 인동고 학번 검사
  function isValidStudentId(id) {
    if (!/^\d{5}$/.test(id)) return false;

    const grade = Number(id[0]); // 1~2학년
    const classroom = Number(id.slice(1, 3)); // 01~10반
    const number = Number(id.slice(3, 5)); // 01~28번

    if (grade < 1 || grade > 2) return false;
    if (classroom < 1 || classroom > 10) return false;
    if (number < 1 || number > 28) return false;

    return true;
  }

  // 학번 검사
  if (!isValidStudentId(id)) {
    alert("올바른 인동고 학번만 입력할 수 있습니다.");
    return;
  }

  // 비밀번호 검사
  if (!pwRule.test(pw)) {
    alert("비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 포함해야 합니다.");
    return;
  }

  try {
    const ref = doc(db, "users", id);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      alert("이미 가입된 계정입니다.");
      return;
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    await setDoc(ref, {
      password: hashedPw,
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
// 🔥 선택한 날짜의 좌석 예약을 실시간으로 감시
// 현재 실행 중인 Firestore 실시간 감시 목록
let reservationUnsubscribers = [];

// 🔥 특정 날짜의 예약을 실시간으로 감시
function listenReservations(date) {

  // 기존 날짜의 실시간 감시 중지
  reservationUnsubscribers.forEach((unsubscribe) => {
    unsubscribe();
  });

  reservationUnsubscribers = [];

  // 좌석 1~8 감시
  seats.forEach((seat) => {

    const ref = doc(
      db,
      "reservations",
      date,
      "seats",
      String(seat.num)
    );

    const unsubscribe = onSnapshot(ref, (snap) => {

      if (snap.exists()) {
        const data = snap.data();

        // Firestore에 저장된 시간대별 예약 정보
        const times = data.times || {};

        seat.times = {
          lunch: times.lunch?.owner || "",
          dinner: times.dinner?.owner || "",
          part1: times.part1?.owner || "",
          part2: times.part2?.owner || "",
        };

        seat.owner = "";
        seat.session = "";
        seat.date = data.date || "";
      } else {
        // 해당 날짜에 예약이 없을 때
        seat.times = {
          lunch: "",
          dinner: "",
          part1: "",
          part2: "",
        };

        seat.owner = "";
        seat.session = "";
        seat.date = "";
      }

      if (currentUser) {
        updateMyInfo();
      }

      render();

      // 처음에는 오늘 날짜 예약 감시
    listenReservations(todayString());

    // 🔥 예약 날짜가 바뀌면 해당 날짜의 예약을 다시 불러옴
    reserveDate.addEventListener("change", () => {
      const selectedDate = reserveDate.value;

      if (!selectedDate) return;

      listenReservations(selectedDate);
    });

    });

    // 나중에 날짜가 바뀌면 이 감시를 종료할 수 있도록 저장
    reservationUnsubscribers.push(unsubscribe);

  });
}

// 🔥 예약
// 🔥 예약하기
// 🔥 예약하기
reserveBtn.onclick = async () => {
  // 로그인 확인
  if (!currentUser) {
    alert("로그인 먼저 해주세요.");
    return;
  }

  // 좌석 선택 확인
  if (!selectedSeat) {
    alert("좌석을 선택해주세요.");
    return;
  }

  // 날짜 확인
  const selectedDate = reserveDate.value;

  if (!selectedDate) {
    alert("예약 날짜를 선택해주세요.");
    return;
  }

  // 선택한 시간 확인
  const selectedTimes = {
    lunch: lunchCheck.checked,
    dinner: dinnerCheck.checked,
    part1: part1Check.checked,
    part2: part2Check.checked,
  };

  const selectedCount = Object.values(selectedTimes).filter(Boolean).length;

  // ==========================================
  // 요일별 예약 제한
  // ==========================================

  // 선택한 날짜의 요일 확인
  const selectedDateObject = new Date(selectedDate + "T00:00:00");

  const dayOfWeek = selectedDateObject.getDay();

  // 금요일 = 5
  if (dayOfWeek === 5) {
    // 금요일에는 점심만 가능
    if (dinnerCheck.checked || part1Check.checked || part2Check.checked) {
      alert("금요일에는 점심시간(12:30~13:30)만 예약할 수 있습니다.");

      return;
    }
  }

  if (selectedCount === 0) {
    alert("사용할 시간을 하나 이상 선택해주세요.");
    return;
  }

  // ==========================================
  // 예약권 확인
  // ==========================================

  const userRef = doc(db, "users", currentUser);

  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    alert("계정을 찾을 수 없습니다.");
    return;
  }

  const userData = userSnap.data();

  const ticketCount = userData.ticketCount ?? 10;

  if (ticketCount < selectedCount) {
    alert(`예약권이 부족합니다.\n현재 예약권: ${ticketCount}개`);

    return;
  }

  // ==========================================
  // 날짜 + 좌석에 해당하는 예약 문서
  // ==========================================

  const seatRef = doc(
    db,
    "reservations",
    selectedDate,
    "seats",
    String(selectedSeat),
  );

  // ==========================================
  // 기존 예약 확인
  // ==========================================

  const seatSnap = await getDoc(seatRef);

  let existingTimes = {};

  if (seatSnap.exists()) {
    const data = seatSnap.data();

    existingTimes = data.times || {};
  }

  // ==========================================
  // 같은 날짜에 다른 좌석으로
  // 같은 시간대를 이미 예약했는지 확인
  // ==========================================

  const reservationsRef = collection(db, "reservations", selectedDate, "seats");

  const reservationsSnap = await getDocs(reservationsRef);

  for (const seatDoc of reservationsSnap.docs) {
    // 현재 선택한 좌석은 제외
    if (seatDoc.id === String(selectedSeat)) {
      continue;
    }

    const otherSeatData = seatDoc.data();
    const otherTimes = otherSeatData.times || {};

    // 내가 선택한 시간대만 검사
    for (const timeName of Object.keys(selectedTimes)) {
      if (!selectedTimes[timeName]) {
        continue;
      }

      const owner = otherTimes[timeName]?.owner || "";

      // 내가 다른 좌석에서 이미 예약한 경우
      if (owner === currentUser) {
        let timeText = "";

        if (timeName === "lunch") {
          timeText = "점심";
        } else if (timeName === "dinner") {
          timeText = "저녁";
        } else if (timeName === "part1") {
          timeText = "야자 1부";
        } else if (timeName === "part2") {
          timeText = "야자 2부";
        }

        alert(
          `이미 ${selectedDate} ${timeText}에 다른 좌석을 예약했습니다.\n\n` +
            `같은 시간에는 한 좌석만 예약할 수 있습니다.`,
        );

        return;
      }
    }
  }

  // ==========================================
  // 내가 이미 예약한 시간인지 확인
  // ==========================================

  for (const timeName of Object.keys(selectedTimes)) {
    // 선택하지 않은 시간은 검사하지 않음
    if (!selectedTimes[timeName]) {
      continue;
    }

    const existingOwner = existingTimes[timeName]?.owner || "";

    // 이미 내가 예약한 시간이라면 중복 예약 방지
    if (existingOwner === currentUser) {
      let timeText = "";

      if (timeName === "lunch") {
        timeText = "점심";
      } else if (timeName === "dinner") {
        timeText = "저녁";
      } else if (timeName === "part1") {
        timeText = "야자 1부";
      } else if (timeName === "part2") {
        timeText = "야자 2부";
      }

      alert(`이미 ${selectedDate} ${timeText}을(를) 예약했습니다.`);

      return;
    }
  }

  // ==========================================
  // 선택한 시간에 이미 예약자가 있는지 확인
  // ==========================================

  for (const timeName of Object.keys(selectedTimes)) {
    if (!selectedTimes[timeName]) {
      continue;
    }

    const existingOwner = existingTimes[timeName]?.owner || "";

    // 다른 사람이 예약한 경우
    if (existingOwner && existingOwner !== currentUser) {
      let timeText = "";

      if (timeName === "lunch") {
        timeText = "점심";
      }

      if (timeName === "dinner") {
        timeText = "저녁";
      }

      if (timeName === "part1") {
        timeText = "야자 1부";
      }

      if (timeName === "part2") {
        timeText = "야자 2부";
      }

      alert(`${timeText} 시간은 이미 ${existingOwner}님이 예약했습니다.`);

      return;
    }
  }

  // ==========================================
  // 기존 예약을 유지하면서
  // 새로 선택한 시간만 추가
  // ==========================================

  const reserveData = {
    date: selectedDate,

    times: {
      lunch: existingTimes.lunch || {
        owner: "",
      },

      dinner: existingTimes.dinner || {
        owner: "",
      },

      part1: existingTimes.part1 || {
        owner: "",
      },

      part2: existingTimes.part2 || {
        owner: "",
      },
    },
  };

  // 선택한 시간만 현재 사용자로 저장
  for (const timeName of Object.keys(selectedTimes)) {
    if (selectedTimes[timeName]) {
      reserveData.times[timeName] = {
        owner: currentUser,
      };
    }
  }

  try {
    // ==========================================
    // Firestore 저장
    // ==========================================

    await setDoc(seatRef, reserveData);

    // ==========================================
    // 예약권 차감
    // ==========================================

    await updateDoc(userRef, {
      ticketCount: ticketCount - selectedCount,
    });

    // 내 정보 업데이트
    await updateMyInfo();

    alert("예약이 완료되었습니다.");

    // 팝업 닫기
    popup.classList.add("hidden");

    selectedSeat = null;

    // 체크박스 초기화
    lunchCheck.checked = false;
    dinnerCheck.checked = false;
    part1Check.checked = false;
    part2Check.checked = false;
  } catch (error) {
    console.error(error);

    alert("예약 중 오류가 발생했습니다.");
  }
};;;;

// 🔥 비밀번호 변경
changePwBtn.onclick = async () => {
  if (!currentUser) {
    alert("로그인 먼저");
    return;
  }

  const oldPw = prompt("현재 비밀번호");
  const newPw = prompt("새 비밀번호");
  const oldHash = await hashPassword(oldPw);
  const newHash = await hashPassword(newPw);

  const pwRule = /^(?=.*[!@#$%^&*])(?=.*[A-Za-z])(?=.*\d).{4,}$/;

  if (!oldPw || !newPw) return;

  if (!pwRule.test(newPw)) {
    alert("비밀번호 형식 오류");
    return;
  }

  try {
    const ref = doc(db, "users", currentUser);
    const snap = await getDoc(ref);

    if (snap.data().password !== oldHash) {
      alert("현재 비밀번호 틀림");
      return;
    }

    await updateDoc(ref, {
      password: newHash,
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

// 🔥 예약 가능 여부 확인
function canReserve() {
  const now = new Date();

  const today = todayString();

  const selectedDate = reserveDate.value;

  // 날짜가 선택되지 않았으면 예약 불가
  if (!selectedDate) {
    return false;
  }

  // ==========================================
  // 미래 날짜 예약
  // ==========================================

  if (selectedDate > today) {
    // 미래 날짜라면 현재 시간이 언제든 예약 가능
    return true;
  }

  // ==========================================
  // 오늘 날짜 예약
  // ==========================================

  if (selectedDate === today) {
    const minute = now.getHours() * 60 + now.getMinutes();

    // 오늘은 12:30부터 예약 가능
    // 21:30이 지나면 예약 불가

    return minute >= 750 && minute < 1290;
  }

  // ==========================================
  // 날짜가 지난 예약 데이터 자동 삭제
  // ==========================================
  async function deletePastReservations() {
    try {
      const today = todayString();

      const reservationsRef = collection(db, "reservations");
      const snapshot = await getDocs(reservationsRef);

      for (const dateDoc of snapshot.docs) {
        const date = dateDoc.id;

        // 오늘보다 과거인 날짜만 삭제
        if (date >= today) {
          continue;
        }

        // 해당 날짜의 좌석 가져오기
        const seatsRef = collection(db, "reservations", date, "seats");

        const seatsSnapshot = await getDocs(seatsRef);

        // 좌석 문서 전부 삭제
        for (const seatDoc of seatsSnapshot.docs) {
          await deleteDoc(seatDoc.ref);
        }

        // 날짜 문서는 좌석을 전부 삭제하면
        // Firestore에서 자동으로 사라짐

        console.log(`지난 예약 데이터 삭제 완료: ${date}`);
      }
    } catch (error) {
      console.error("지난 예약 데이터 삭제 실패:", error);
    }
  }

  // ==========================================
  // 과거 날짜
  // ==========================================

  return false;
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

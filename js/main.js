/**
 * main.js
 * 애플리케이션 진입점 및 게임 매니저
 */

// 전역 변수
let poseEngine;
let activeGame = null; // 현재 실행 중인 게임 인스턴스
let stabilizer;
let ctx; // Canvas 2D Context
let labelContainer;

// 게임 인스턴스 보관
const games = {
  money: null,
  cactus: null
};

/**
 * 페이지 로드 시 초기화 (PoseEngine만 미리 로드하거나, 게임 시작 시 로드)
 * 여기서는 사용자가 '게임 선택'을 먼저 하도록 유도
 */
window.onload = function () {
  // 캔버스 컨텍스트는 미리 가져옴
  const canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");

  // 라벨 컨테이너
  labelContainer = document.getElementById("label-container");
};

/**
 * 게임 선택 처리
 * @param {string} type - 'money' or 'new'
 */
async function selectGame(type) {
  // 1. PoseEngine이 없으면 초기화 (최초 1회)
  if (!poseEngine) {
    try {
      await initPoseEngine();
    } catch (e) {
      console.error(e);
      alert("카메라/모델 로딩 실패");
      return;
    }
  }

  // 2. UI 전환
  document.getElementById("main-menu").classList.add("hidden");
  document.getElementById("game-container").classList.remove("hidden");

  // 3. 게임 인스턴스 준비
  if (type === 'money') {
    if (!games.money) {
      games.money = new MoneyGame();
      games.money.init(ctx);
    }
    activeGame = games.money;
    document.getElementById("game-title").innerText = "💰 돈을 잡아라!";
  } else if (type === 'new') {
    if (!games.cactus) {
      games.cactus = new CactusGame(); // NewGame -> CactusGame
      games.cactus.init(ctx);
    }
    activeGame = games.cactus;
    document.getElementById("game-title").innerText = "🌵 선인장 질주";
  }

  // 4. 게임 시작 준비 상태 알림
  document.getElementById("startBtn").disabled = false;
  document.getElementById("stopBtn").disabled = true;
}

/**
 * PoseEngine 초기화 (웹캠, 모델 로드)
 */
async function initPoseEngine() {
  document.getElementById("max-prediction").innerText = "모델 로딩 중...";

  poseEngine = new PoseEngine("./my_model/");
  const { maxPredictions, webcam } = await poseEngine.init({
    size: 400,
    flip: true
  });

  // Stabilizer 초기화
  stabilizer = new PredictionStabilizer({
    threshold: 0.85,
    smoothingFrames: 5
  });

  // Label Container 설정
  labelContainer.innerHTML = "";
  for (let i = 0; i < maxPredictions; i++) {
    labelContainer.appendChild(document.createElement("div"));
  }

  // Callbacks
  poseEngine.setPredictionCallback(handlePrediction);
  poseEngine.setDrawCallback(drawGameLoop);

  // Start Pose Loop
  poseEngine.start();
}

/**
 * [Start] 버튼 클릭 시
 */
function startGame() {
  if (activeGame) {
    activeGame.start();
    document.getElementById("startBtn").disabled = true;
    document.getElementById("stopBtn").disabled = false;
  }
}

/**
 * [Stop] 버튼 클릭 시
 */
function stopGame() {
  if (activeGame) {
    activeGame.stop();
    document.getElementById("startBtn").disabled = false;
    document.getElementById("stopBtn").disabled = true;
  }
}

/**
 * [메뉴로] 버튼 클릭 시
 */
function goToMenu() {
  stopGame(); // 게임 중지
  activeGame = null;

  document.getElementById("game-container").classList.add("hidden");
  document.getElementById("main-menu").classList.remove("hidden");
  document.getElementById("max-prediction").innerText = "준비 중...";
}

/**
 * 예측 결과 처리 콜백
 */
function handlePrediction(predictions, pose) {
  if (!stabilizer) return;

  // 1. Stabilizer로 예측 안정화
  const stabilized = stabilizer.stabilize(predictions);

  // 2. Label Container 업데이트
  if (labelContainer) {
    for (let i = 0; i < predictions.length; i++) {
      const classPrediction =
        predictions[i].className + ": " + predictions[i].probability.toFixed(2);
      if (labelContainer.childNodes[i]) {
        labelContainer.childNodes[i].innerHTML = classPrediction;
      }
    }
  }

  // 3. 최고 확률 예측 표시
  const maxPredictionDiv = document.getElementById("max-prediction");
  if (maxPredictionDiv) {
    maxPredictionDiv.innerText = stabilized.className || "감지 중...";
  }

  // 4. Active Game에 포즈 전달
  if (activeGame && activeGame.isGameActive && stabilized.className) {
    if (activeGame.onPoseDetected) {
      activeGame.onPoseDetected(stabilized.className);
    }
  }
}

/**
 * 게임 루프 그리기 (PoseEngine에서 매 프레임 호출됨)
 */
function drawGameLoop(pose) {
  // 1. 웹캠 배경 그리기
  if (poseEngine && poseEngine.webcam && poseEngine.webcam.canvas) {
    ctx.globalAlpha = 0.3;
    ctx.drawImage(poseEngine.webcam.canvas, 0, 0, 400, 400);
    ctx.globalAlpha = 1.0;
  }

  // 2. Active Game이 있으면 자체 loop/draw가 돌고 있겠지만,
  //    만약 동기화가 필요하면 여기서 draw를 호출할 수도 있음.
  //    현재 구조는 Game 클래스들이 자체 requestAnimationFrame을 사용하므로
  //    여기서는 배경만 그려주면 됨.
}

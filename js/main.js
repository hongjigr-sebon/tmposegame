/**
 * main.js
 * 포즈 인식과 게임 로직을 초기화하고 서로 연결하는 진입점
 */

// 전역 변수
let poseEngine;
let gameEngine;
let stabilizer;
let ctx; // Canvas 2D Context
let labelContainer;

/**
 * 애플리케이션 초기화
 */
async function init() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  startBtn.disabled = true;

  try {
    // 1. PoseEngine 초기화 (모델 로드)
    poseEngine = new PoseEngine("./my_model/");
    // 웹캠 설정 (기본적으로 PoseEngine이 웹캠을 만들지만, 우리는 캔버스에 게임을 그려야 함)
    // 여기서는 TM의 웹캠을 가져와서 loop 돌리는 구조를 유지하되, 그리기 로직만 수정
    const { maxPredictions, webcam } = await poseEngine.init({
      size: 400, // 게임 화면 크기를 좀 키움
      flip: true
    });

    // 2. Stabilizer 초기화
    stabilizer = new PredictionStabilizer({
      threshold: 0.85, // 오작동 방지를 위해 임계값 높임
      smoothingFrames: 5 // 부드럽게
    });

    // 3. GameEngine 초기화
    gameEngine = new GameEngine();

    // 4. 캔버스 설정
    // HTML의 canvas 요소를 가져와서 크기 맞춤
    const canvas = document.getElementById("canvas");
    canvas.width = 400; // 게임 해상도
    canvas.height = 400;
    ctx = canvas.getContext("2d");

    // 게임 엔진에 컨텍스트 주입 (자산 로드 등)
    gameEngine.init(ctx);

    // 5. Label Container 설정
    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = "";
    for (let i = 0; i < maxPredictions; i++) {
      labelContainer.appendChild(document.createElement("div"));
    }

    // 6. PoseEngine 콜백 설정
    poseEngine.setPredictionCallback(handlePrediction);

    // 중요: PoseEngine의 drawLoop를 끄고, 우리가 직접 그릴지 결정해야 함.
    // TM 템플릿 구조상 PoseEngine이 loop를 돌며 drawCallback을 호출해줌.
    // 우리는 GameEngine의 draw를 호출해야 함.
    poseEngine.setDrawCallback(drawGameLoop);

    // 7. PoseEngine 시작
    poseEngine.start();

    // 8. 게임 바로 시작 (또는 버튼 클릭 시 시작하도록 변경 가능)
    // 여기서는 Start 버튼을 누르면 "앱 초기화"가 되는 구조이므로
    // 초기화 후 바로 게임 로직도 시작시킴
    startGame();

    stopBtn.disabled = false;

  } catch (error) {
    console.error("초기화 중 오류 발생:", error);
    alert("초기화에 실패했습니다. 콘솔을 확인하세요.");
    startBtn.disabled = false;
  }
}

function startGame() {
  if (gameEngine) {
    // UI 콜백 연결
    gameEngine.setScoreChangeCallback((score, level) => {
      // 화면 어딘가에 점수판이 있다면 업데이트
      console.log(`Score: ${score}, Level: ${level}`);
      // 예: document.getElementById('scoreBoard').innerText = score;
    });

    gameEngine.start();
  }
}

/**
 * 애플리케이션 중지
 */
function stop() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  if (poseEngine) {
    poseEngine.stop();
  }

  if (gameEngine) {
    gameEngine.stop();
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
}

/**
 * 예측 결과 처리 콜백
 * @param {Array} predictions - TM 모델의 예측 결과
 * @param {Object} pose - PoseNet 포즈 데이터
 */
function handlePrediction(predictions, pose) {
  // 1. Stabilizer로 예측 안정화
  const stabilized = stabilizer.stabilize(predictions);

  // 2. Label Container 업데이트 (디버깅용)
  for (let i = 0; i < predictions.length; i++) {
    const classPrediction =
      predictions[i].className + ": " + predictions[i].probability.toFixed(2);
    labelContainer.childNodes[i].innerHTML = classPrediction;
  }

  // 3. 최고 확률 예측 표시
  const maxPredictionDiv = document.getElementById("max-prediction");
  maxPredictionDiv.innerHTML = stabilized.className || "감지 중...";

  // 4. GameEngine에 포즈 전달
  // Stabilizer가 반환하는 className (예: "왼쪽", "Left")을 그대로 전달
  if (gameEngine && gameEngine.isGameActive && stabilized.className) {
    gameEngine.onPoseDetected(stabilized.className);
  }
}

/**
 * 게임 루프 그리기 (PoseEngine에서 매 프레임 호출됨)
 * @param {Object} pose - PoseNet 포즈 데이터
 */
function drawGameLoop(pose) {
  // 1. 웹캠 배경 그리기 (선택사항: 게임 몰입감을 위해 끄거나, 흐리게 처리 가능)
  // 여기서는 배경으로 깔아줌
  if (poseEngine.webcam && poseEngine.webcam.canvas) {
    // 투명도를 줘서 게임 요소가 잘 보이게
    ctx.globalAlpha = 0.3;
    ctx.drawImage(poseEngine.webcam.canvas, 0, 0, 400, 400); // 캔버스 크기에 맞춤
    ctx.globalAlpha = 1.0;
  }

  // 2. 포즈 스켈레톤 그리기 (디버깅용, 게임 중엔 꺼도 됨)
  // if (pose) {
  //   tmPose.drawSkeleton(pose.keypoints, 0.5, ctx);
  // }

  // 3. GameEngine 그리기 (아이템, 바구니 등)
  // gameEngine.loop()가 별도로 돌고 있지만, draw는 동기화 문제를 피하기 위해 
  // 여기서 한 번에 처리하거나, gameEngine 내부에서 처리하게 할 수 있음.
  // 현재 구조: gameEngine.loop() 내에서 draw()를 호출하고 있음. 
  // 따라서 여기서는 웹캠 배경만 그려주면 됨.

  // BUT! 캔버스 컨텍스트 경합(지우고 그리고) 문제가 생길 수 있음.
  // 해결책: GameEngine.loop()에서는 update만 하고, draw는 여기서 통합 호출하는 것이 깔끔함.
  // 하지만 GameEngine 코드를 이미 작성했으므로, 
  // GameEngine.draw()가 매끄럽게 동작하도록 놔두고,
  // 여기서는 '배경'만 먼저 그리는 식으로 가거나, GameEngine에 배경 그리기 위임.
}

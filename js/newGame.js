/**
 * newGame.js
 * 새로운 게임 (준비중) 플레이스홀더
 */

class NewGame {
    constructor() {
        this.isGameActive = false;
        this.ctx = null;
        this.canvasWidth = 200;
        this.canvasHeight = 200;
        this.requestId = null;
    }

    init(ctx) {
        this.ctx = ctx;
        this.canvasWidth = ctx.canvas.width;
        this.canvasHeight = ctx.canvas.height;
    }

    start() {
        if (this.isGameActive) return;
        this.isGameActive = true;
        this.loop();
    }

    stop() {
        this.isGameActive = false;
        if (this.requestId) {
            cancelAnimationFrame(this.requestId);
        }
    }

    loop() {
        if (!this.isGameActive) return;

        this.update();
        this.draw();

        this.requestId = requestAnimationFrame(() => this.loop());
    }

    update() {
        // 게임 로직 업데이트
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        // 배경
        this.ctx.fillStyle = "#f0f8ff";
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        // 텍스트
        this.ctx.fillStyle = "#333";
        this.ctx.font = "24px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("새로운 게임 준비중...", this.canvasWidth / 2, this.canvasHeight / 2);

        this.ctx.font = "16px Arial";
        this.ctx.fillText("Coming Soon", this.canvasWidth / 2, this.canvasHeight / 2 + 30);
    }

    onPoseDetected(poseName) {
        // 포즈 입력 처리
        console.log("NewGame received pose:", poseName);
    }
}

window.NewGame = NewGame;

/**
 * gameEngine.js
 * Catch the Money (돈을 잡아라!) 게임 로직 구현
 */

class GameEngine {
    constructor() {
        this.score = 0;
        this.level = 1;
        this.timeLimit = 60;
        this.isGameActive = false;
        this.animationId = null;
        this.lastTime = 0;

        // 게임 객체
        this.player = { x: 0, width: 60, height: 40 }; // 바구니
        this.items = []; // 떨어지는 아이템들
        this.itemSpeed = 150; // 기본 낙하 속도 (px/sec)
        this.spawnTimer = 0;
        this.spawnInterval = 1000; // 아이템 생성 주기 (ms)

        // 자산
        this.images = {};

        // 콜백
        this.onScoreChange = null;
        this.onGameEnd = null;

        // 캔버스 컨텍스트
        this.ctx = null;
        this.canvasWidth = 200;
        this.canvasHeight = 200;
    }

    /**
     * 초기화 및 자산 로드
     */
    init(ctx) {
        this.ctx = ctx;
        this.canvasWidth = ctx.canvas.width;
        this.canvasHeight = ctx.canvas.height;

        // 플레이어 초기 위치
        this.player.x = (this.canvasWidth - this.player.width) / 2;

        // 이미지 로드 시도 (실패 시 대체 도형 사용)
        this.loadImage('1k', './image.png');
        this.loadImage('5k', './5000won.png');
        this.loadImage('10k', './10000won.png');
        this.loadImage('50k', './50000won.png');
    }

    loadImage(key, src) {
        const img = new Image();
        img.src = src;
        img.onload = () => { this.images[key] = img; };
        // 에러 처리는 생략 (없으면 그리지 않거나 대체)
    }

    /**
     * 게임 시작
     */
    start() {
        if (this.isGameActive) return;

        this.isGameActive = true;
        this.score = 0;
        this.level = 1;
        this.timeLimit = 60;
        this.items = [];
        this.lastTime = performance.now();

        // 게임 루프 시작
        this.loop();

        // 타이머 시작 (1초마다 감소)
        this.timerId = setInterval(() => {
            this.timeLimit--;
            if (this.timeLimit <= 0) this.gameOver();
        }, 1000);
    }

    stop() {
        this.isGameActive = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);
        if (this.timerId) clearInterval(this.timerId);
        // 종료 콜백
        if (this.onGameEnd) this.onGameEnd(this.score, this.level);
    }

    gameOver() {
        this.stop();
        alert(`게임 종료! 최종 점수: ${this.score.toLocaleString()}원`);
    }

    /**
     * 게임 루프
     */
    loop(timestamp) {
        if (!this.isGameActive) return;

        const deltaTime = (timestamp - this.lastTime) / 1000; // 초 단위
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.draw();

        this.animationId = requestAnimationFrame((t) => this.loop(t));
    }

    /**
     * 상태 업데이트
     */
    update(dt) {
        if (!dt) return;

        // 1. 아이템 생성
        this.spawnTimer += dt * 1000;
        if (this.spawnTimer > this.spawnInterval) {
            this.spawnItem();
            this.spawnTimer = 0;
            // 레벨에 따라 속도/생성주기 조절 가능
            this.spawnInterval = Math.max(400, 1000 - (this.level * 50));
        }

        // 2. 아이템 이동 및 충돌 체크
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            item.y += item.speed * dt;

            // 바닥에 닿음
            if (item.y > this.canvasHeight) {
                this.items.splice(i, 1);
                continue;
            }

            // 충돌 체크 (AABB)
            if (
                item.x < this.player.x + this.player.width &&
                item.x + item.width > this.player.x &&
                item.y < this.canvasHeight - 10 && // 바구니 높이(가정)
                item.y + item.height > this.canvasHeight - 40
            ) {
                this.handleCollision(item);
                this.items.splice(i, 1);
            }
        }
    }

    spawnItem() {
        const types = [
            { key: '1k', value: 1000, prob: 0.6, speed: 100 },
            { key: '5k', value: 5000, prob: 0.25, speed: 150 },
            { key: '10k', value: 10000, prob: 0.1, speed: 200 },
            { key: '50k', value: 50000, prob: 0.04, speed: 300 },
            { key: 'scammer', value: -1, prob: 0.1, speed: 200 } // 사기꾼 (출현 확률 1% -> 10% 증가)
        ];

        const rand = Math.random();
        let acc = 0;
        let selected = types[0];

        for (let t of types) {
            acc += t.prob;
            if (rand < acc) {
                selected = t;
                break;
            }
        }

        // 3줄 낙하 로직 (왼쪽, 가운데, 오른쪽)
        const laneWidth = this.canvasWidth / 3;
        const laneIndex = Math.floor(Math.random() * 3); // 0, 1, 2 중 하나
        const laneCenter = laneWidth * laneIndex + laneWidth / 2;

        this.items.push({
            ...selected,
            x: laneCenter - 15, // 아이템 너비(30)의 절반만큼 왼쪽으로 이동하여 중앙 정렬
            y: -30,
            width: 30,
            height: 15,
            speed: selected.speed * (1 + this.level * 0.1) // 레벨비례 속도 증가
        });
    }

    handleCollision(item) {
        if (item.key === 'scammer') {
            this.playGameOverSound();
            this.gameOver();
        } else {
            this.playCoinSound();
            this.addScore(item.value);
        }
    }

    // --- Sound Effects using Web Audio API ---
    playCoinSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
            osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // A6

            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) {
            console.error("Audio play failed", e);
        }
    }

    playGameOverSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.5); // Slide down

            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.5);

            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.error("Audio play failed", e);
        }
    }

    addScore(val) {
        this.score += val;
        // 레벨업: 5만원마다
        if (this.score > this.level * 50000) {
            this.level++;
        }
        if (this.onScoreChange) this.onScoreChange(this.score, this.level);
    }

    /**
     * 화면 그리기
     */
    draw() {
        // 캔버스 지우기 (배경은 투명 or CSS처리)
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        // 레인 구분선 그리기 (희미하게)
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvasWidth / 3, 0);
        this.ctx.lineTo(this.canvasWidth / 3, this.canvasHeight);
        this.ctx.moveTo(this.canvasWidth / 3 * 2, 0);
        this.ctx.lineTo(this.canvasWidth / 3 * 2, this.canvasHeight);
        this.ctx.stroke();

        // 1. 플레이어(피크닉 가방/바구니) 그리기
        const px = this.player.x;
        const py = this.canvasHeight - 40; // 바닥에서 조금 위
        const pw = this.player.width;
        const ph = 30; // 가방 높이

        // 손잡이 (아치형)
        this.ctx.beginPath();
        this.ctx.arc(px + pw / 2, py, pw / 2 - 5, Math.PI, 0);
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = '#8B4513'; // SaddleBrown
        this.ctx.stroke();

        // 가방 몸체 (사각형 + 약간의 둥근 모서리 느낌)
        this.ctx.fillStyle = '#D2B48C'; // Tan (연한 갈색)
        this.ctx.fillRect(px, py, pw, ph);

        // 가방 패턴 (체크무늬 느낌의 줄무늬)
        this.ctx.fillStyle = '#A0522D'; // Sienna (진한 갈색)
        this.ctx.fillRect(px + 10, py, 10, ph);
        this.ctx.fillRect(px + 30, py, 10, ph);
        this.ctx.fillRect(px + 50, py, 10, ph);

        // 가방 덮개/장식
        this.ctx.fillStyle = '#CD853F'; // Peru
        this.ctx.fillRect(px, py + 10, pw, 5);

        // 2. 아이템 그리기
        for (const item of this.items) {
            if (item.key === 'scammer') {
                this.ctx.font = "20px Arial";
                this.ctx.fillText("😈", item.x, item.y + 20);
                continue;
            }

            const img = this.images[item.key];
            if (img) {
                this.ctx.drawImage(img, item.x, item.y, item.width, item.height);
            } else {
                // 이미지 없으면 색상 박스
                this.ctx.fillStyle = this.getColor(item.key);
                this.ctx.fillRect(item.x, item.y, item.width, item.height);
                this.ctx.fillStyle = 'black';
                this.ctx.font = "10px Arial";
                this.ctx.fillText(item.value / 1000 + "k", item.x, item.y + 10);
            }
        }
    }

    getColor(key) {
        switch (key) {
            case '1k': return '#87CEEB'; // Sky Blue
            case '5k': return '#FFA07A'; // Light Salmon
            case '10k': return '#90EE90'; // Light Green
            case '50k': return '#FFD700'; // Gold
            default: return 'gray';
        }
    }

    /**
     * 포즈 입력 처리
     * @param {string} poseName 
     */
    onPoseDetected(poseName) {
        if (!this.isGameActive) return;

        const laneWidth = this.canvasWidth / 3;

        // 사용자 포즈 매핑 (metadata.json 라벨 -> 3개 레인)
        if (poseName === "Left" || poseName === "왼쪽" || poseName.includes("Left")) {
            // 왼쪽 레인 (0번)
            this.player.x = (laneWidth * 0) + (laneWidth - this.player.width) / 2;
        } else if (poseName === "Right" || poseName === "오른쪽" || poseName.includes("Right")) {
            // 오른쪽 레인 (2번)
            this.player.x = (laneWidth * 2) + (laneWidth - this.player.width) / 2;
        } else if (poseName === "Center" || poseName === "정면" || poseName.includes("Center")) {
            // 가운데 레인 (1번)
            this.player.x = (laneWidth * 1) + (laneWidth - this.player.width) / 2;
        }
    }

    // Callbacks
    setScoreChangeCallback(cb) { this.onScoreChange = cb; }
    setGameEndCallback(cb) { this.onGameEnd = cb; }

    getGameState() {
        return {
            score: this.score,
            level: this.level,
            timeRemaining: this.timeLimit
        };
    }
}

// 전역 내보내기
window.GameEngine = GameEngine;

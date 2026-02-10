/**
 * cactusGame.js
 * Cactus Runner (선인장 질주) 게임 로직
 */

class CactusGame {
    constructor() {
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.isGameActive = false;
        this.animationId = null;
        this.lastTime = 0;

        // 게임 객체
        this.player = { lane: 1, y: 0, width: 40, height: 60, color: 'blue' }; // Lane: 0(Left), 1(Center), 2(Right)
        this.objects = []; // 선인장, 코인 등
        this.speed = 200; // 기본 이동 속도 (px/sec)
        this.spawnTimer = 0;
        this.spawnInterval = 1500;
        this.distance = 0; // 달린 거리

        // 자산 (이미지 대신 이모지 사용 예정, 필요시 이미지 로드 추가)
        this.assets = {
            cactus: '🌵',
            coin: '🪙',
            player: '🐰' // 귀여운 토끼
        };

        // 캔버스 컨텍스트
        this.ctx = null;
        this.canvasWidth = 400;
        this.canvasHeight = 400;
    }


    init(ctx) {
        this.ctx = ctx;
        this.canvasWidth = ctx.canvas.width;
        this.canvasHeight = ctx.canvas.height;
        this.groundY = this.canvasHeight - 50; // 바닥 y좌표
        this.player.width = 40;
        this.player.height = 40;
        this.player.x = 50; // 왼쪽 고정
        this.player.y = this.groundY - this.player.height;
    }


    start() {
        if (this.isGameActive) return;

        this.initAudio(); // 오디오 초기화

        this.isGameActive = true;
        this.score = 0;
        this.warnings = 0; // 경고 시스템
        this.maxWarnings = 5;
        this.level = 1;
        this.distance = 0;
        this.speed = 200;
        this.objects = [];
        this.player.z = 0; // Jump height (0 is ground)
        this.isSpacePressed = false;
        this.lastTime = performance.now();

        // 키보드 이벤트 리스너 등록
        this.handleKeyDown = (e) => {
            if (e.code === 'Space') {
                this.isSpacePressed = true;
                e.preventDefault(); // 스크롤 방지
            }
        };
        this.handleKeyUp = (e) => {
            if (e.code === 'Space') {
                this.isSpacePressed = false;
            }
        };
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);

        this.loop();
    }

    // 간단한 효과음 생성 (Web Audio API)
    initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playCoinSound() {
        if (!this.audioCtx) return;
        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, this.audioCtx.currentTime); // High pitch
        oscillator.frequency.exponentialRampToValueAtTime(1200, this.audioCtx.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);

        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        oscillator.start();
        oscillator.stop(this.audioCtx.currentTime + 0.1);
    }

    playCactusSound() {
        if (!this.audioCtx) return;
        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(150, this.audioCtx.currentTime); // Low pitch
        oscillator.frequency.linearRampToValueAtTime(50, this.audioCtx.currentTime + 0.3);

        gainNode.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);

        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        oscillator.start();
        oscillator.stop(this.audioCtx.currentTime + 0.3);
    }

    stop() {
        this.isGameActive = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);

        // 리스너 제거
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
    }

    gameOver() {
        this.stop();
        alert(`게임 오버!\n달린 거리: ${Math.floor(this.distance)}m\n점수: ${this.score}\n최종 경고: ${this.warnings}회`);
    }

    loop(timestamp) {
        if (!this.isGameActive) return;

        const deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.draw();

        this.animationId = requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (!dt) return;

        // 난이도 조절
        this.distance += this.speed * dt * 0.01;
        this.speed = 200 + (this.distance * 1.5); // 속도 증가 폭 5 -> 1.5로 대폭 하향

        // 점프 로직 (z축 = y축 이동으로 시각화)
        // 반응성을 높이기 위해 점프 속도 상향
        const jumpSpeed = 600;
        if (this.isSpacePressed) {
            this.player.z += jumpSpeed * dt;
            if (this.player.z > 120) this.player.z = 120; // 최대 높이
        } else {
            this.player.z -= jumpSpeed * dt;
            if (this.player.z < 0) this.player.z = 0; // 바닥
        }

        // 1. 오브젝트 생성
        this.spawnTimer += dt * 1000;
        if (this.spawnTimer > this.spawnInterval) {
            this.spawnObject();
            this.spawnTimer = 0;
            this.spawnInterval = Math.max(600, 1500 - (this.distance * 10));
        }

        // 2. 오브젝트 이동 및 충돌
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];

            // 오른쪽에서 왼쪽으로 이동
            obj.x -= this.speed * dt;

            // 화면 밖으로 나감 (왼쪽)
            if (obj.x + obj.width < 0) {
                this.objects.splice(i, 1);
                continue;
            }

            // 충돌 체크 (횡스크롤 기준)
            // X축 겹침 확인
            if (
                this.player.x < obj.x + obj.width &&
                this.player.x + this.player.width > obj.x
            ) {
                // 선인장일 때: 점프 높이 체크
                // 선인장 높이는 40, 판정 완화 (20 이상시 회피)
                if (obj.type === 'cactus') {
                    if (this.player.z > 20) {
                        continue; // 회피 성공
                    }
                }

                // 코인은 점프랑 상관없이 닿으면 먹음 (사실상 x축만 맞으면 획득)
                // 혹은 코인도 높이를 둬서 '점프해서 먹는 코인'을 만들 수도 있지만,
                // 현재는 바닥 코인 기준 -> 점프하면 못 먹는게 맞을 수도?
                // 하지만 게임성을 위해 x축만 맞으면(지나가면) 먹는 걸로 하거나
                // 점프 안 했을 때만 먹는 걸로? -> 보통 런게임은 위치가 중요함.
                // 여기서는 간단히 '코인은 몸체 판정'이므로 점프해도 닿는다고 가정 (2D projection)
                // 또는 코인을 공중에 띄울 수 있음. 일단 바닥 코인만 구현.

                this.handleCollision(obj, i);
            }
        }
    }

    spawnObject() {
        const type = Math.random() < 0.7 ? 'cactus' : 'coin';

        // 뭉쳐서 나올 확률 (선인장일 경우 30%)
        let count = 1;
        if (type === 'cactus' && Math.random() < 0.3) {
            count = Math.floor(Math.random() * 2) + 2; // 2~3개
        }

        for (let i = 0; i < count; i++) {
            const spacing = 30; // 선인장 간격 (살짝 겹치거나 붙어서 나오게)
            this.objects.push({
                type: type,
                // 오른쪽 끝에서 생성 + 연속 생성 시 간격 추가
                x: this.canvasWidth + (i * spacing),
                y: this.groundY - 40,
                width: 40,
                height: 40,
                symbol: this.assets[type]
            });
        }
    }

    handleCollision(obj, index) {
        if (obj.type === 'cactus') {
            this.playCactusSound(); // 효과음
            this.warnings++;
            this.objects.splice(index, 1); // 충돌한 선인장 제거
            // 효과음이나 시각효과 추가 가능
            // 경고 누적 시 게임 오버
            if (this.warnings >= this.maxWarnings) {
                this.gameOver();
            }
        } else if (obj.type === 'coin') {
            this.playCoinSound(); // 효과음
            this.score += 1000;
            this.objects.splice(index, 1); // 먹은 코인 제거
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        // 0. 배경
        this.ctx.fillStyle = "#87CEEB"; // SkyBlue (하늘)
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        // 바닥 그리기
        this.ctx.fillStyle = "#F4A460"; // SandyBrown (사막)
        this.ctx.fillRect(0, this.groundY, this.canvasWidth, this.canvasHeight - this.groundY);

        // 지평선 선
        this.ctx.strokeStyle = "#8B4513";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.groundY);
        this.ctx.lineTo(this.canvasWidth, this.groundY);
        this.ctx.stroke();

        // 2. 오브젝트 그리기
        this.ctx.font = "30px Arial";
        this.ctx.textAlign = "center";
        for (const obj of this.objects) {
            this.ctx.fillText(obj.symbol, obj.x + 20, obj.y + 35);
        }

        // 3. 플레이어 그리기
        const px = this.player.x + 20;
        const py = this.player.y - (this.player.z || 0); // 점프 높이 반영

        // 그림자 (점프 시 바닥에 남음)
        this.ctx.fillStyle = "rgba(0,0,0,0.2)";
        this.ctx.beginPath();
        this.ctx.ellipse(px, this.player.y + 35, 20, 5, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // 캐릭터 본체
        this.ctx.font = "40px Arial";
        this.ctx.textAlign = "center"; // 이모지 중앙 정렬을 위해

        // 이노스케가 오른쪽을 보고 달리므로, 필요시 flip (이모지는 기본적으로 방향 고정)
        // 멧돼지 이모지는 왼쪽을 보는 경우가 많음 (🐗).
        // 캔버스 scale(-1, 1)로 뒤집을 수 있음.

        this.ctx.save();
        this.ctx.translate(px, py + 20); // 중심점
        this.ctx.scale(-1, 1); // 좌우 반전 (오른쪽 보게 하기)
        this.ctx.fillText(this.assets.player, 0, 15);
        this.ctx.restore();

        // 점프 상태 표시
        if (this.player.z > 0) {
            this.ctx.font = "12px Arial";
            this.ctx.fillStyle = "blue";
            // 텍스트는 반전되면 안되므로 따로 그림
            this.ctx.fillText("JUMP!", px, py);
        }

        // 4. UI (점수, 경고)
        this.ctx.fillStyle = "black";
        this.ctx.font = "20px Arial";
        this.ctx.textAlign = "left";
        this.ctx.fillText(`점수: ${this.score}`, 10, 30);

        // 경고 표시 (빨간색)
        this.ctx.fillStyle = "red";
        this.ctx.fillText(`⚠️ 경고: ${this.warnings} / ${this.maxWarnings}`, 10, 60);

        if (this.warnings >= this.maxWarnings - 1) {
            this.ctx.font = "bold 20px Arial";
            this.ctx.fillText("위험!!", 150, 60);
        }
        this.ctx.textAlign = "right";
        this.ctx.fillText(`Dist: ${Math.floor(this.distance)}m`, this.canvasWidth - 10, 30);
    }

    onPoseDetected(poseName) {
        if (!this.isGameActive) return;
        // 단일 레인 모드에서는 포즈로 이동하지 않음
    }
}

window.CactusGame = CactusGame;

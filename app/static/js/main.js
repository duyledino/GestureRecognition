import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11";

class GestureApp {
    constructor() {
        this.video = document.getElementById('video-preview');
        this.skeletonCanvas = document.getElementById('skeleton-canvas');
        this.skeletonContext = this.skeletonCanvas.getContext('2d');
        this.statusEl = document.getElementById('gesture-text');
        
        this.handLandmarker = null;
        this.lastVideoTime = -1;
        this.results = null;

        // STATE
        this.currentGesture = "none";
        this.gestureBuffer = [];
        this.scrollSpeed = 0;
        this.hoveredElement = null;
        this.productIndex = -1;    // 🔥 Current selected product index
        this.wasPinching = false;  // 🔥 Track previous pinch state for edge detection
        this.wasNavigating = false; // 🔥 Prevent repeated palm navigation

        this.connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [9, 10], [10, 11], [11, 12],
            [13, 14], [14, 15], [15, 16],
            [0, 17], [17, 18], [18, 19], [19, 20],
            [5, 9], [9, 13], [13, 17]
        ];
        
        this.init();
    }

    async init() {
        console.log("GestureApp: Initializing...");
        await this.initHandLandmarker();
        await this.initCamera();
        this.detectLoop();
        this.controlLoop();
    }

    async initHandLandmarker() {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/wasm"
        );
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
        });
    }

    async initCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 }
            });
            this.video.srcObject = stream;
            
            return new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    this.skeletonCanvas.width = this.video.videoWidth;
                    this.skeletonCanvas.height = this.video.videoHeight;
                    resolve();
                };
            });
        } catch (err) {
            console.error("Camera error:", err);
            this.statusEl.textContent = "Camera error";
        }
    }

    detectLoop() {
        const now = performance.now();
        if (this.lastVideoTime !== this.video.currentTime) {
            this.lastVideoTime = this.video.currentTime;
            this.results = this.handLandmarker.detectForVideo(this.video, now);
        }

        this.skeletonContext.clearRect(0, 0, this.skeletonCanvas.width, this.skeletonCanvas.height);

        if (this.results?.landmarks?.length) {
            for (const landmarks of this.results.landmarks) {
                this.drawLandmarks(landmarks);
                const gesture = this.recognizeGesture(landmarks);
                this.updateGesture(gesture);
            }
        }
        requestAnimationFrame(() => this.detectLoop());
    }

    updateGesture(gesture) {
        const BUFFER_SIZE = 5;
        this.gestureBuffer.push(gesture);
        if (this.gestureBuffer.length > BUFFER_SIZE) this.gestureBuffer.shift();

        const stable = this.gestureBuffer.every(g => g === gesture);
        if (stable && gesture !== this.currentGesture) {
            this.currentGesture = gesture;
            this.statusEl.textContent = `Gesture: ${gesture.toUpperCase()}`;
        }
    }

    recognizeGesture(landmarks) {
        const thumb = landmarks[4];
        const indexTip = landmarks[8];
        const indexPip = landmarks[6];
        const indexMcp = landmarks[5];

        // 1. PINCH DISTANCE (Check this first)
        const pinchDist = Math.hypot(thumb.x - indexTip.x, thumb.y - indexTip.y);
        if (pinchDist < 0.05) return "pinch";

        // 2. FINGER EXTENSION STATES
        const isFingerUp = (tip, pip) => landmarks[tip].y < landmarks[pip].y;
        const isFingerExtended = (tip, pip, mcp) => {
            const distTip = Math.hypot(landmarks[tip].x - landmarks[mcp].x, landmarks[tip].y - landmarks[mcp].y);
            const distPip = Math.hypot(landmarks[pip].x - landmarks[mcp].x, landmarks[pip].y - landmarks[mcp].y);
            return distTip > distPip;
        };

        const fingers = [
            isFingerUp(8, 6),   // Index
            isFingerUp(12, 10),  // Middle
            isFingerUp(16, 14),  // Ring
            isFingerUp(20, 18),  // Pinky
        ];

        const indexExtended = isFingerExtended(8, 6, 5);

        // 3. LOGIC RULES
        // All fingers up = palm (stop)
        if (fingers.every(f => f)) return "palm";

        // Index + Middle + Ring up, Pinky down = trident (navigate)
        if (fingers[0] && fingers[1] && fingers[2] && !fingers[3]) return "trident";

        // All fingers down and index not extended = fist (stop)
        if (fingers.every(f => !f) && !indexExtended) return "fist";

        // Only index finger extended
        if (indexExtended && fingers.slice(1).every(f => !f)) {
            const dy = indexMcp.y - indexTip.y;
            const dx = indexMcp.x - indexTip.x;

            // Check if horizontal (pinch trigger for both hands)
            if (Math.abs(dx) > Math.abs(dy) * 1.5) {
                return "pinch";
            }

            if (dy > 0) {
                return "index_up";   // Pointing up → scroll up
            } else {
                return "index_down"; // Pointing down → scroll down
            }
        }

        return "none";
    }

    // 🔥 UPDATED CONTINUOUS CONTROL LOOP
    controlLoop() {
        const isPinching = this.currentGesture === 'pinch';
        const isTriding = this.currentGesture === 'trident';

        switch (this.currentGesture) {
            case 'index_up':
                this.scrollSpeed = -5; // Scroll up
                break;

            case 'index_down':
                this.scrollSpeed = 5;  // Scroll down
                break;

            case 'palm':
                this.scrollSpeed = 0;  // Stop scrolling
                break;

            case 'fist':
                this.scrollSpeed = 0;  // Stop scrolling
                break;

            case 'trident':
                this.scrollSpeed = 0;
                // 🔥 Navigate to the selected product on rising edge
                if (!this.wasNavigating && this.hoveredElement) {
                    this.navigateToProduct();
                }
                break;

            case 'pinch':
                this.scrollSpeed = 0;
                // 🔥 Only advance on the rising edge
                if (!this.wasPinching) {
                    this.moveToNextProduct();
                }
                break;

            default:
                this.scrollSpeed *= 0.9;
        }

        this.wasPinching = isPinching;
        this.wasNavigating = isTriding;

        // Only apply manual scroll when there's actual scroll speed
        if (Math.abs(this.scrollSpeed) > 0.1) {
            window.scrollBy({
                top: this.scrollSpeed * 10,
                behavior: 'auto'
            });
        }

        requestAnimationFrame(() => this.controlLoop());
    }

    // 🔥 Move selection to the next product card
    moveToNextProduct() {
        const products = document.querySelectorAll('.product-card');
        if (products.length === 0) return;

        // Advance to next card (wraps around)
        this.productIndex = (this.productIndex + 1) % products.length;
        const target = products[this.productIndex];

        // Remove class from old, add to new
        this.clearHover();
        this.hoveredElement = target;
        this.hoveredElement.classList.add('gesture-pinch');

        // Scroll the selected card into view
        this.hoveredElement.scrollIntoView({
            behavior: 'smooth',
        });

        console.log(`Selected product ${this.productIndex + 1}/${products.length}`);
    }

    // 🔥 Navigate to the selected product page
    navigateToProduct() {
        if (this.hoveredElement) {
            console.log("Navigating to product page...");
            this.hoveredElement.classList.add('gesture-active');
            setTimeout(() => {
                this.hoveredElement.click();
            }, 500);
        }
    }

    // 🔥 NEW HOVER LOGIC
    applyHover() {
        const elements = document.querySelectorAll('.product-card, .btn, .back-link');
        const centerY = window.innerHeight / 2;

        let closestTarget = null;
        let minDist = Infinity;

        elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            // Only consider elements visible in the viewport
            if (rect.top > 0 && rect.bottom < window.innerHeight) {
                const elCenter = rect.top + rect.height / 2;
                const dist = Math.abs(centerY - elCenter);

                if (dist < minDist) {
                    minDist = dist;
                    closestTarget = el;
                }
            }
        });

        // Update classes if the target changed
        if (closestTarget && closestTarget !== this.hoveredElement) {
            this.clearHover();
            this.hoveredElement = closestTarget;
            this.hoveredElement.classList.add('gesture-pinch');
            console.log("Gesture Pinch active on:", closestTarget);
        }
    }

    clearHover() {
        if (this.hoveredElement) {
            this.hoveredElement.classList.remove('gesture-pinch');
            this.hoveredElement = null;
        }
    }

    drawLandmarks(landmarks) {
        const w = this.skeletonCanvas.width;
        const h = this.skeletonCanvas.height;
        this.skeletonContext.strokeStyle = '#818cf8';
        this.skeletonContext.lineWidth = 2;
        this.skeletonContext.beginPath();
        for (const [s, e] of this.connections) {
            this.skeletonContext.moveTo(landmarks[s].x * w, landmarks[s].y * h);
            this.skeletonContext.lineTo(landmarks[e].x * w, landmarks[e].y * h);
        }
        this.skeletonContext.stroke();
        this.skeletonContext.fillStyle = '#f8fafc';
        for (const lm of landmarks) {
            this.skeletonContext.beginPath();
            this.skeletonContext.arc(lm.x * w, lm.y * h, 3, 0, 2 * Math.PI);
            this.skeletonContext.fill();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GestureApp();
});
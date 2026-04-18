import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11";

class ProductPageGestureApp {
    constructor() {
        this.video = document.getElementById("video-preview");
        this.skeletonCanvas = document.getElementById("skeleton-canvas");
        this.skeletonContext = this.skeletonCanvas.getContext("2d");
        this.statusEl = document.getElementById("gesture-text");
        this.addToCartButton = document.getElementById("add-to-cart-btn");

        this.handLandmarker = null;
        this.lastVideoTime = -1;
        this.results = null;

        this.currentGesture = "none";
        this.gestureBuffer = [];
        this.lastAddToCartAt = 0;

        this.connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [9, 10], [10, 11], [11, 12],
            [13, 14], [14, 15], [15, 16],
            [0, 17], [17, 18], [18, 19], [19, 20],
            [5, 9], [9, 13], [13, 17]
        ];

        this.cartProduct = this.readProductData();
        this.init();
    }

    readProductData() {
        return {
            id: this.addToCartButton?.dataset.productId || "",
            name: document.querySelector(".product-info h1")?.textContent?.trim() || "Product",
            price: document.querySelector(".price")?.textContent?.trim() || ""
        };
    }

    async init() {
        try {
            this.statusEl.textContent = "Loading gesture model...";
            await this.initHandLandmarker();
            await this.initCamera();
            this.statusEl.textContent = "Show a palm or shaka hand to add to cart";
            this.detectLoop();
        } catch (error) {
            console.error("Product gesture app failed to start:", error);
            this.statusEl.textContent = "Camera unavailable";
        }
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
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });

        this.video.srcObject = stream;

        await new Promise((resolve) => {
            this.video.onloadedmetadata = () => {
                this.video.play();
                this.skeletonCanvas.width = this.video.videoWidth;
                this.skeletonCanvas.height = this.video.videoHeight;
                resolve();
            };
        });
    }

    detectLoop() {
        const now = performance.now();

        if (this.lastVideoTime !== this.video.currentTime) {
            this.lastVideoTime = this.video.currentTime;
            this.results = this.handLandmarker.detectForVideo(this.video, now);
        }

        this.skeletonContext.clearRect(0, 0, this.skeletonCanvas.width, this.skeletonCanvas.height);

        if (this.results?.landmarks?.length) {
            const landmarks = this.results.landmarks[0];
            this.drawLandmarks(landmarks);
            this.updateGesture(this.recognizeGesture(landmarks));
        }

        requestAnimationFrame(() => this.detectLoop());
    }

    updateGesture(gesture) {
        const BUFFER_SIZE = 5;
        this.gestureBuffer.push(gesture);
        if (this.gestureBuffer.length > BUFFER_SIZE) this.gestureBuffer.shift();

        const stable = this.gestureBuffer.every((value) => value === gesture);
        if (!stable || gesture === this.currentGesture) return;

        this.currentGesture = gesture;
        this.statusEl.textContent =
            gesture === "none"
                ? "Show a palm or shaka hand to add to cart"
                : `Gesture: ${gesture.toUpperCase()}`;

        if (gesture === "shaka") {
            this.addToCart(`gesture:${gesture}`);
        }
    }

    recognizeGesture(landmarks) {
        const thumb = landmarks[4];
        const indexTip = landmarks[8];
        const indexPip = landmarks[6];
        const middleTip = landmarks[12];
        const middlePip = landmarks[10];
        const ringTip = landmarks[16];
        const ringPip = landmarks[14];
        const pinkyTip = landmarks[20];
        const pinkyPip = landmarks[18];

        const isFingerUp = (tip, pip) => tip.y < pip.y;
        const fingers = [
            isFingerUp(indexTip, indexPip),
            isFingerUp(middleTip, middlePip),
            isFingerUp(ringTip, ringPip),
            isFingerUp(pinkyTip, pinkyPip)
        ];

        const thumbSpread = Math.hypot(thumb.x - landmarks[0].x, thumb.y - landmarks[0].y);
        const thumbLoose = thumbSpread > 0.18;

        if (fingers.every((finger) => finger)) {
            return "palm";
        }

        if (thumbLoose && fingers[3] && !fingers[0] && !fingers[1] && !fingers[2]) {
            return "shaka";
        }

        return "none";
    }

    addToCart(source) {
        const now = Date.now();
        if (now - this.lastAddToCartAt < 1200) return;

        this.lastAddToCartAt = now;

        const cart = this.getCart();
        const existingItem = cart.find((item) => item.id === this.cartProduct.id);

        if (existingItem) {
            existingItem.quantity += 1;
            existingItem.addedAt = new Date().toISOString();
        } else {
            cart.push({
                ...this.cartProduct,
                quantity: 1,
                addedAt: new Date().toISOString()
            });
        }

        localStorage.setItem("gesture_cart", JSON.stringify(cart));
        this.showToast("Added to cart", `${this.cartProduct.name} was added via ${source}.`);

        if (this.addToCartButton) {
            this.addToCartButton.classList.add("is-added");
            this.addToCartButton.textContent = "Added to Cart";
        }
    }

    getCart() {
        try {
            return JSON.parse(localStorage.getItem("gesture_cart") || "[]");
        } catch {
            return [];
        }
    }

    showToast(title, message) {
        if (!window.Toastify) {
            console.warn("Toastify library is not loaded.");
            return;
        }

        const node = document.createElement("div");
        node.className = "toast toast-success";
        node.innerHTML = `
            <div class="toast-icon">OK</div>
            <div class="toast-content">
                <strong>${title}</strong>
                <span>${message}</span>
            </div>
        `;

        window.Toastify({
            node,
            duration: 3200,
            gravity: "top",
            position: "right",
            close: true,
            stopOnFocus: true,
            style: {
                background: "transparent",
                boxShadow: "none",
                padding: "0",
                minHeight: "unset"
            }
        }).showToast();
    }

    drawLandmarks(landmarks) {
        const width = this.skeletonCanvas.width;
        const height = this.skeletonCanvas.height;
        this.skeletonContext.strokeStyle = "#f472b6";
        this.skeletonContext.lineWidth = 2;
        this.skeletonContext.beginPath();

        for (const [start, end] of this.connections) {
            this.skeletonContext.moveTo(landmarks[start].x * width, landmarks[start].y * height);
            this.skeletonContext.lineTo(landmarks[end].x * width, landmarks[end].y * height);
        }

        this.skeletonContext.stroke();
        this.skeletonContext.fillStyle = "#f8fafc";

        for (const landmark of landmarks) {
            this.skeletonContext.beginPath();
            this.skeletonContext.arc(landmark.x * width, landmark.y * height, 3, 0, Math.PI * 2);
            this.skeletonContext.fill();
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new ProductPageGestureApp();
});

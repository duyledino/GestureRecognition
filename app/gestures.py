import cv2
import mediapipe as mp
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.vision import hand_landmarker
import numpy as np
import base64
import os
import urllib.request

# Correct path for RunningMode
RunningMode = vision.RunningMode

class GestureRecognizer:
    def __init__(self):
        # Model path
        self.model_path = "hand_landmarker.task"
        self._ensure_model_exists()

        # Initialize Hand Landmarker
        base_options = mp.tasks.BaseOptions(model_asset_path=self.model_path)
        options = hand_landmarker.HandLandmarkerOptions(
            base_options=base_options,
            running_mode=RunningMode.IMAGE,
            num_hands=1,
            min_hand_detection_confidence=0.7,
            min_hand_presence_confidence=0.7,
            min_tracking_confidence=0.5
        )
        self.detector = hand_landmarker.HandLandmarker.create_from_options(options)

    def _ensure_model_exists(self):
        if not os.path.exists(self.model_path):
            print(f"Downloading MediaPipe model to {self.model_path}...")
            url = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
            try:
                urllib.request.urlretrieve(url, self.model_path)
                print("Download complete.")
            except Exception as e:
                print(f"Failed to download model: {e}")

    def process_frame(self, image_data):
        # Decode base64 image
        try:
            if not image_data or ',' not in image_data:
                return "none"
                
            encoded_data = image_data.split(',')[1]
            nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                return "none"
            
            # Convert to RGB and MediaPipe Image
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
            
            # Detect landmarks
            result = self.detector.detect(mp_image)
            
            gesture = "none"
            
            landmarks_data = []
            if result.hand_landmarks:
                # Get landmarks for the first hand
                landmarks = result.hand_landmarks[0]
                
                # Format landmarks for sending back to frontend
                for lm in landmarks:
                    landmarks_data.append({"x": lm.x, "y": lm.y, "z": lm.z})

                # Logic for finger states (Y-coordinates are normalized 0-1)
                def is_finger_up(tip_idx, pip_idx):
                    return landmarks[tip_idx].y < landmarks[pip_idx].y

                fingers = [
                    is_finger_up(8, 6),   # Index
                    is_finger_up(12, 10), # Middle
                    is_finger_up(16, 14), # Ring
                    is_finger_up(20, 18), # Pinky
                ]
                
                # 1. Palm (All up)
                if all(fingers):
                    gesture = "palm"
                # 2. Fist (All down)
                elif not any(fingers):
                    gesture = "fist"
                # 3. Index up (Scroll up)
                elif fingers[0] and not any(fingers[1:]):
                    gesture = "index_up"
                # 4. Pinch (Thumb and Index)
                else:
                    thumb_tip = landmarks[4]
                    index_tip = landmarks[8]
                    dist = np.sqrt((thumb_tip.x - index_tip.x)**2 + (thumb_tip.y - index_tip.y)**2)
                    if dist < 0.05:
                        gesture = "pinch"

            return gesture, landmarks_data
        except Exception as e:
            # print(f"Error in process_frame: {e}")
            return "none", []

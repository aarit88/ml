from flask import Flask, render_template, Response, jsonify, request
import cv2
import numpy as np
import threading
import time
import os
from datetime import datetime
from collections import deque

app = Flask(__name__)

# ================= GLOBAL STATE =================

# Detection state (per-session/global simplicity)
eye_counter = 0
mouth_counter = 0
alarm_on = False
lock = threading.Lock()

# Latest processed frame (JPEG bytes) and detection data
latest_frame = None
latest_detection = {
    'ear': 0.0,
    'mar': 0.0,
    'eye_status': 'Unknown',
    'mouth_status': 'Unknown',
    'status': 'Waiting',
    'alarm_on': False,
    'face_detected': False,
    'timestamp': ''
}

# ================= MEDIAPIPE SETUP =================

import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# ================= OPENCV SETUP =================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ================= MEDIAPIPE TASKS SETUP =================

# Path to the task model file (must exist in current directory)
model_path = os.path.join(BASE_DIR, 'face_landmarker.task')

# Create the face landmarker option
base_options = python.BaseOptions(model_asset_path=model_path)
options = vision.FaceLandmarkerOptions(
    base_options=base_options,
    num_faces=1,
    min_face_detection_confidence=0.5,
    min_face_presence_confidence=0.5,
    min_tracking_confidence=0.5
)

# Initialize the landmarker safely
landmarker = None
try:
    landmarker = vision.FaceLandmarker.create_from_options(options)
    print("[MediaPipe] FaceLandmarker initialized successfully")
except Exception as e:
    print(f"[MediaPipe] ERROR initializing FaceLandmarker: {e}")
    print("[MediaPipe] The server will start, but detection will be disabled.")

# MediaPipe Face Mesh landmark indices (Standard indices)
LEFT_EYE = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33, 160, 158, 133, 153, 144]
# Lips for MAR
LIP_TOP = 13
LIP_BOTTOM = 14
LIP_LEFT = 78
LIP_RIGHT = 308
LIP_TOP_INNER = [82, 312]
LIP_BOTTOM_INNER = [87, 317]

# Tunable thresholds
EAR_THRESHOLD = 0.19       # Below this = eyes closed (adjusted for better accuracy)
MAR_THRESHOLD = 0.70       # Above this = yawning (adjusted to prevent false positives)

# Frame counters for alarm trigger
EYE_FRAMES = 25     # ~0.8s at 30fps
MOUTH_FRAMES = 20   # ~0.6s at 30fps

# Detection state
eye_counter = 0
mouth_counter = 0
alarm_on = False

# Temporal smoothing buffers
EAR_BUFFER_SIZE = 5
MAR_BUFFER_SIZE = 5
ear_buffer = deque(maxlen=EAR_BUFFER_SIZE)
mar_buffer = deque(maxlen=MAR_BUFFER_SIZE)

# ================= HELPER FUNCTIONS =================

def euclidean_dist(p1, p2):
    return np.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)

def compute_ear(landmarks, eye_indices, img_w, img_h):
    coords = []
    for idx in eye_indices:
        lm = landmarks[idx]
        coords.append((lm.x * img_w, lm.y * img_h))

    # p1=coords[0], p2=coords[1], p3=coords[2],
    # p4=coords[3], p5=coords[4], p6=coords[5]
    vertical1 = euclidean_dist(coords[1], coords[5])
    vertical2 = euclidean_dist(coords[2], coords[4])
    horizontal = euclidean_dist(coords[0], coords[3])

    if horizontal == 0:
        return 0.0
    return (vertical1 + vertical2) / (2.0 * horizontal)

def compute_mar(landmarks, img_w, img_h):
    def pt(idx):
        lm = landmarks[idx]
        return (lm.x * img_w, lm.y * img_h)

    v1 = euclidean_dist(pt(82), pt(87))   # Inner left
    v2 = euclidean_dist(pt(13), pt(14))   # Inner center
    v3 = euclidean_dist(pt(312), pt(317)) # Inner right
    h = euclidean_dist(pt(78), pt(308))   # Inner span

    if h == 0:
        return 0.0
    return (v1 + v2 + v3) / (2.0 * h)

def smooth_value(buffer, new_value):
    buffer.append(new_value)
    return float(np.median(list(buffer)))

def draw_landmark_path(frame, landmarks, indices, img_w, img_h, color):
    pts = []
    for idx in indices:
        lm = landmarks[idx]
        pts.append((int(lm.x * img_w), int(lm.y * img_h)))
    pts = np.array(pts, dtype=np.int32)
    cv2.polylines(frame, [pts], isClosed=True, color=color, thickness=2)

import base64

def process_image_data(image_data_uri):
    # Decode the base64 image
    try:
        format, imgstr = image_data_uri.split(';base64,')
        nparr = np.frombuffer(base64.b64decode(imgstr), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return frame
    except Exception as e:
        print(f"[Server] Error decoding image: {e}")
        return None

# ================= DETECTION LOOP =================

# ================= DETECTION LOGIC =================

@app.route('/process_frame', methods=['POST'])
def process_frame():
    global eye_counter, mouth_counter, alarm_on
    
    data = request.get_json()
    image_data = data.get('image')
    if not image_data:
        return jsonify({'status': 'error', 'message': 'No image data'})

    frame = process_image_data(image_data)
    if frame is None:
        return jsonify({'status': 'error', 'message': 'Could not decode image'})

    h, w = frame.shape[:2]
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

    detection_result = None
    if landmarker is not None:
        detection_result = landmarker.detect(mp_image)

    ear_value = 0.0
    mar_value = 0.0
    eye_status = "Unknown"
    mouth_status = "Unknown"
    status_list = []
    face_detected = False

    if detection_result and detection_result.face_landmarks:
        face_detected = True
        landmarks = detection_result.face_landmarks[0]

        # EAR
        left_ear = compute_ear(landmarks, LEFT_EYE, w, h)
        right_ear = compute_ear(landmarks, RIGHT_EYE, w, h)
        ear = smooth_value(ear_buffer, (left_ear + right_ear) / 2.0)
        ear_value = round(ear, 3)

        if ear >= EAR_THRESHOLD:
            eye_status = "Open"
            eye_counter = 0
        else:
            eye_status = "Closed"
            eye_counter += 1

        # MAR
        mar = smooth_value(mar_buffer, compute_mar(landmarks, w, h))
        mar_value = round(mar, 3)

        if mar > MAR_THRESHOLD:
            mouth_status = "Yawning"
            mouth_counter += 1
        else:
            mouth_status = "Normal"
            mouth_counter = 0

        # Alarm Logic
        if eye_counter > EYE_FRAMES:
            status_list.append("Eyes Closed")
        if mouth_counter > MOUTH_FRAMES:
            status_list.append("Yawning")

        if status_list:
            alarm_on = True
        else:
            alarm_on = False
            status_list = ["Driver Attentive"]
    else:
        eye_status = "No Face"
        mouth_status = "No Face"
        status_list = ["No Face Detected"]
        eye_counter = 0
        mouth_counter = 0
        alarm_on = False

    status_text = " | ".join(status_list)

    return jsonify({
        'ear': ear_value,
        'mar': mar_value,
        'eye_status': eye_status,
        'mouth_status': mouth_status,
        'status': status_text,
        'alarm_on': alarm_on,
        'face_detected': face_detected,
        'timestamp': datetime.now().isoformat()
    })

# ================= ROUTES =================

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/start_detection')
def start_detection():
    global eye_counter, mouth_counter, alarm_on
    eye_counter = 0
    mouth_counter = 0
    alarm_on = False
    return jsonify({'status': 'started', 'message': 'Detection service ready'})

@app.route('/stop_detection')
def stop_detection():
    global eye_counter, mouth_counter, alarm_on
    eye_counter = 0
    mouth_counter = 0
    alarm_on = False
    return jsonify({'status': 'stopped', 'message': 'Detection stopped'})

@app.route('/get_detection_data')
def get_detection_data():
    with lock:
        data = dict(latest_detection)
    return jsonify(data)

@app.route('/update_settings', methods=['POST'])
def update_settings():
    global EAR_THRESHOLD, MAR_THRESHOLD
    data = request.get_json()
    if 'ear_threshold' in data:
        EAR_THRESHOLD = float(data['ear_threshold'])
    if 'mar_threshold' in data:
        MAR_THRESHOLD = float(data['mar_threshold'])
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    print("=" * 50)
    print("  Driver Drowsiness Detection System")
    print("  Using MediaPipe Tasks API")
    print("  Open http://localhost:5000 in your browser")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)

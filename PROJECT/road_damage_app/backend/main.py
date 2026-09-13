import base64
import os

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from ultralytics import YOLO
from ultralytics.nn import tasks as tasks_module


# ============================================================
# 1. Mish - PHẢI khai báo trước khi load model
# ============================================================


class Mish(nn.Module):
    """
    Mish activation:
        f(x) = x * tanh(softplus(x))

    Đây chính là Mish được sử dụng trong notebook training.
    """

    def forward(self, x):
        return x * torch.tanh(F.softplus(x))


# Register Mish vào Ultralytics
tasks_module.Mish = Mish


# ============================================================
# 2. FastAPI
# ============================================================

app = FastAPI(title="Road Damage Detection API", version="1.0")


# ============================================================
# 3. CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# 4. Load model
#
#    Chỉ dùng duy nhất model base_best.pt.
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "best.pt")

# Notebook dùng cuda:0 khi có GPU, nếu không thì CPU.
DEVICE = 0 if torch.cuda.is_available() else "cpu"

IMGSZ = 640
CONF_THRES = 0.25

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(
        f"Không tìm thấy model: {MODEL_PATH}. "
        "Hãy đặt base_best.pt cùng thư mục với main.py."
    )

print(f"Loading model: {MODEL_PATH}")

model = YOLO(MODEL_PATH)

print("Model loaded successfully!")
print("Class names:", model.names)
print("Device:", "cuda:0" if DEVICE == 0 else "cpu")


# ============================================================
# 5. Home
# ============================================================


@app.get("/")
def home():
    return {
        "message": "Road Damage Detection API is running",
        "model": "base_best",
        "model_path": MODEL_PATH,
        "device": "cuda:0" if DEVICE == 0 else "cpu",
        "imgsz": IMGSZ,
        "conf": CONF_THRES,
        "classes": model.names,
    }


# ============================================================
# 6. Predict
# ============================================================


@app.post("/predict")
async def predict(file: UploadFile = File(...)):

    # --------------------------------------------------------
    # Kiểm tra file
    # --------------------------------------------------------

    if not file.content_type or not file.content_type.startswith("image/"):
        return JSONResponse(
            status_code=400, content={"error": "File upload phải là ảnh."}
        )

    # --------------------------------------------------------
    # Đọc ảnh
    # --------------------------------------------------------

    contents = await file.read()

    if not contents:
        return JSONResponse(status_code=400, content={"error": "File ảnh rỗng."})

    nparr = np.frombuffer(contents, np.uint8)

    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return JSONResponse(
            status_code=400, content={"error": "Không thể đọc file ảnh."}
        )

    # --------------------------------------------------------
    # YOLO inference
    #
    # Notebook sử dụng imgsz=640.
    # --------------------------------------------------------

    try:
        results = model.predict(
            source=img,
            imgsz=IMGSZ,
            conf=CONF_THRES,
            device=DEVICE,
            verbose=False,
        )

    except Exception as e:
        return JSONResponse(
            status_code=500, content={"error": f"Lỗi khi chạy model: {str(e)}"}
        )

    result = results[0]

    # --------------------------------------------------------
    # Lấy detections
    # --------------------------------------------------------

    detections = []

    if result.boxes is not None:
        for box in result.boxes:
            cls_id = int(box.cls[0].item())
            confidence = float(box.conf[0].item())

            # Lấy tên class từ model
            class_name = model.names[cls_id]

            # xyxy = x1, y1, x2, y2
            xyxy = box.xyxy[0].tolist()

            detections.append(
                {
                    "class_id": cls_id,
                    "class": class_name,
                    "confidence": round(confidence, 4),
                    "box": [round(float(coord), 2) for coord in xyxy],
                }
            )

    # --------------------------------------------------------
    # Vẽ bounding boxes
    # --------------------------------------------------------

    plotted_image = result.plot()

    # result.plot() trả về BGR numpy array
    success, encoded_image = cv2.imencode(
        ".jpg", plotted_image, [int(cv2.IMWRITE_JPEG_QUALITY), 90]
    )

    if not success:
        return JSONResponse(
            status_code=500, content={"error": "Không thể encode ảnh kết quả."}
        )

    # --------------------------------------------------------
    # Convert JPEG -> Base64
    # --------------------------------------------------------

    image_base64 = base64.b64encode(encoded_image.tobytes()).decode("utf-8")

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    class_counts = {}

    for detection in detections:
        class_name = detection["class"]

        if class_name not in class_counts:
            class_counts[class_name] = 0

        class_counts[class_name] += 1

    # --------------------------------------------------------
    # Response JSON
    # --------------------------------------------------------

    return {
        "success": True,
        "message": "Prediction completed successfully",
        "filename": file.filename,
        "model": "base_best",
        "model_path": MODEL_PATH,
        "image": {
            "format": "jpg",
            "base64": image_base64,
            "data_url": f"data:image/jpeg;base64,{image_base64}",
        },
        "detections": detections,
        "summary": {"total": len(detections), "class_counts": class_counts},
    }
"""License plate detection module using YOLO and PaddleOCR."""
import logging
import time
from typing import List, Tuple
import cv2
import numpy as np
from ultralytics import YOLO
from paddleocr import PaddleOCR

logger = logging.getLogger(__name__)


class LicencePlateDetection:
    """
    Detects and recognizes license plates using YOLO and PaddleOCR.
    
    This class handles both detection (finding plates in images) and
    recognition (reading text from detected plates).
    """
    
    def __init__(self, model_path: str):
        """
        Initialize detector with model.
        
        Args:
            model_path: Path to YOLO model file (.pt)
        """
        logger.info(f"Loading YOLO model from: {model_path}")
        self.model = YOLO(model_path)
        logger.info("Initializing PaddleOCR")
        self.ocr = PaddleOCR(use_angle_cls=True, lang='en')
        self.ocr = PaddleOCR(use_angle_cls=True, lang='en')
    def detect_frames(self, frames):
        licence_plate_detections = []
        licence_plate_texts = []
        for frame in frames:
            bbox_list, text_list = self.detect_frame(frame)
            licence_plate_detections.append(bbox_list)
            licence_plate_texts.append(text_list)
        return licence_plate_detections, licence_plate_texts

    def detect_frame(self, frame):
        results = self.model.predict(frame)[0]
        id_name_dict = results.names
        licence_plate_list = []
        licence_plate_texts = []
        for box in results.boxes:
            result = box.xyxy.tolist()[0]
            cls_id = int(box.cls.tolist()[0])
            cls_name = id_name_dict[cls_id]

            if cls_name == "License_Plate":
                licence_plate_list.append(result)
                # Crop the license plate region
                x1, y1, x2, y2 = map(int, result)
                cropped_plate = frame[y1:y2, x1:x2]

                # Always apply preprocessing
                gray = cv2.cvtColor(cropped_plate, cv2.COLOR_BGR2GRAY)
                resized = cv2.resize(gray, None, fx=2, fy=2)
                cropped_plate = cv2.cvtColor(resized, cv2.COLOR_GRAY2BGR)

                # Run OCR
                ocr_result = self.ocr.ocr(cropped_plate)
                
                # Extract all text lines (for multi-line plates like Vietnamese plates)
                text = "N/A"
                if ocr_result and ocr_result[0]:
                    result_data = ocr_result[0]
                    # PaddleOCR returns list of [[[bbox], (text, confidence)], ...]
                    if isinstance(result_data, list):
                        texts = []
                        for line in result_data:
                            if len(line) >= 2 and isinstance(line[1], tuple):
                                text_str, conf = line[1]
                                if text_str and conf > 0.5:
                                    texts.append(text_str)
                        if texts:
                            text = " ".join(texts)
                            logger.debug(f"OCR detected: {text} from {len(texts)} line(s)")
                        else:
                            logger.warning("OCR returned low-confidence results")
                    # Legacy format check
                    elif hasattr(result_data, '__getitem__') and "rec_texts" in result_data:
                        rec_texts = result_data["rec_texts"]
                        if rec_texts:
                            text = " ".join(rec_texts)
                            logger.debug(f"OCR detected: {text} (from {len(rec_texts)} line(s))")
                        else:
                            logger.warning("OCR returned empty rec_texts")
                    else:
                        logger.warning("Unexpected OCR result format")
                else:
                    logger.warning("OCR result is empty")
                licence_plate_texts.append(text)
        return licence_plate_list, licence_plate_texts

    def draw_bboxes(self, video_frames, licence_plate_detections, licence_plate_texts):
        output_video_frames = []
        for frame, plate_list, text_list in zip(video_frames, licence_plate_detections, licence_plate_texts):
            for bbox, text in zip(plate_list, text_list):
                x1, y1, x2, y2 = map(int, bbox)
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0,255,0), 2)
                cv2.putText(frame, f"{text}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9,
                            (255, 255,0), 2)
            output_video_frames.append(frame)
        return output_video_frames

    def detect_plate_from_frame(self, frame):
        """Detect a plate in a single frame and return text/confidence."""
        start = time.perf_counter()

        results = self.model.predict(frame)[0]
        id_name_dict = results.names

        best_candidate = None

        for box in results.boxes:
            cls_id = int(box.cls.tolist()[0])
            cls_name = id_name_dict[cls_id]

            if cls_name != "License_Plate":
                continue

            conf_list = box.conf.tolist() if hasattr(box, "conf") else []
            confidence = float(conf_list[0]) if conf_list else 0.0
            x1, y1, x2, y2 = map(int, box.xyxy.tolist()[0])

            cropped_plate = frame[y1:y2, x1:x2]
            if cropped_plate.size == 0:
                continue

            # Light preprocessing to help OCR
            gray = cv2.cvtColor(cropped_plate, cv2.COLOR_BGR2GRAY)
            resized = cv2.resize(gray, None, fx=2, fy=2)
            preprocessed = cv2.cvtColor(resized, cv2.COLOR_GRAY2BGR)

            ocr_result = self.ocr.ocr(preprocessed)
            plate_text = "N/A"
            if ocr_result and ocr_result[0]:
                result_data = ocr_result[0]
                # PaddleOCR returns list of [[[bbox], (text, confidence)], ...]
                if isinstance(result_data, list):
                    texts = []
                    for line in result_data:
                        if len(line) >= 2 and isinstance(line[1], tuple):
                            text, conf = line[1]
                            if text and conf > 0.5:  # Only include high-confidence text
                                texts.append(text)
                    if texts:
                        plate_text = " ".join(texts)
                        logger.debug(f"OCR detected: {plate_text} from {len(texts)} line(s)")
                # Legacy format check for backward compatibility
                elif hasattr(result_data, "__getitem__") and "rec_texts" in result_data:
                    rec_texts = result_data.get("rec_texts", [])
                    if rec_texts:
                        plate_text = " ".join(rec_texts)

            candidate = {
                "bbox": [x1, y1, x2, y2],
                "plate_text": plate_text,
                "confidence": confidence,
            }

            if best_candidate is None or confidence > best_candidate.get("confidence", 0):
                best_candidate = candidate

        if best_candidate is None:
            return {
                "success": False,
                "error": "No license plate detected",
            }

        if not best_candidate.get("plate_text") or best_candidate["plate_text"] == "N/A":
            return {
                "success": False,
                "error": "Failed to read plate text",
            }

        duration_ms = int((time.perf_counter() - start) * 1000)

        best_candidate.update(
            {
                "success": True,
                "detection_time_ms": duration_ms,
            }
        )

        return best_candidate


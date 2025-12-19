"""
Debug script to see full OCR output for Vietnamese license plates
"""

import cv2
from ultralytics import YOLO
from paddleocr import PaddleOCR
import json

def debug_plate_ocr(image_path):
    print(f"\n{'='*60}")
    print(f"Debugging OCR for: {image_path}")
    print(f"{'='*60}")
    
    # Load image
    frame = cv2.imread(image_path)
    if frame is None:
        print(f"[ERROR] Failed to read image: {image_path}")
        return
    
    # Initialize models
    print("[INFO] Loading models...")
    yolo_model = YOLO('models/best.pt')
    ocr = PaddleOCR(use_angle_cls=True, lang='en')
    
    # Detect license plate
    print("[INFO] Detecting license plate...")
    results = yolo_model.predict(frame)[0]
    
    for box in results.boxes:
        result = box.xyxy.tolist()[0]
        cls_id = int(box.cls.tolist()[0])
        cls_name = results.names[cls_id]
        
        if cls_name == "License_Plate":
            x1, y1, x2, y2 = map(int, result)
            print(f"\n[INFO] License plate detected at: ({x1}, {y1}) to ({x2}, {y2})")
            
            # Crop the license plate region
            cropped_plate = frame[y1:y2, x1:x2]
            
            # Save cropped plate for inspection
            cv2.imwrite(f"debug_cropped_{image_path}", cropped_plate)
            print(f"[INFO] Saved cropped plate to: debug_cropped_{image_path}")
            
            # Test 1: OCR on original crop
            print("\n--- Test 1: Original Crop ---")
            ocr_result = ocr.ocr(cropped_plate)
            print(f"OCR Result type: {type(ocr_result)}")
            print(f"OCR Result length: {len(ocr_result) if ocr_result else 0}")
            if ocr_result and ocr_result[0]:
                result_data = ocr_result[0]
                print(f"Result data type: {type(result_data)}")
                if isinstance(result_data, dict):
                    print(f"Keys available: {result_data.keys()}")
                    if "rec_texts" in result_data:
                        print(f"rec_texts: {result_data['rec_texts']}")
                    if "rec_scores" in result_data:
                        print(f"rec_scores: {result_data['rec_scores']}")
                elif isinstance(result_data, list):
                    print(f"Number of detected lines: {len(result_data)}")
                    for idx, line in enumerate(result_data):
                        print(f"  Line {idx}: {line}")
            
            # Test 2: OCR with preprocessing (gray + resize)
            print("\n--- Test 2: Preprocessed (Gray + 2x Resize) ---")
            gray = cv2.cvtColor(cropped_plate, cv2.COLOR_BGR2GRAY)
            resized = cv2.resize(gray, None, fx=2, fy=2)
            preprocessed = cv2.cvtColor(resized, cv2.COLOR_GRAY2BGR)
            cv2.imwrite(f"debug_preprocessed_{image_path}", preprocessed)
            
            ocr_result_preprocessed = ocr.ocr(preprocessed)
            print(f"OCR Result type: {type(ocr_result_preprocessed)}")
            print(f"OCR Result length: {len(ocr_result_preprocessed) if ocr_result_preprocessed else 0}")
            if ocr_result_preprocessed and ocr_result_preprocessed[0]:
                result_data = ocr_result_preprocessed[0]
                print(f"Result data type: {type(result_data)}")
                if isinstance(result_data, dict):
                    print(f"Keys available: {result_data.keys()}")
                    if "rec_texts" in result_data:
                        print(f"rec_texts: {result_data['rec_texts']}")
                    if "rec_scores" in result_data:
                        print(f"rec_scores: {result_data['rec_scores']}")
                elif isinstance(result_data, list):
                    print(f"Number of detected lines: {len(result_data)}")
                    for idx, line in enumerate(result_data):
                        print(f"  Line {idx}: {line}")
            
            # Extract all texts
            print("\n--- Extracting All Text Lines ---")
            if ocr_result_preprocessed and ocr_result_preprocessed[0]:
                result_data = ocr_result_preprocessed[0]
                all_texts = []
                
                if isinstance(result_data, dict) and "rec_texts" in result_data:
                    # New API format
                    rec_texts = result_data["rec_texts"]
                    rec_scores = result_data.get("rec_scores", [])
                    for idx, (text, score) in enumerate(zip(rec_texts, rec_scores) if rec_scores else [(t, 0) for t in rec_texts]):
                        all_texts.append(text)
                        print(f"  Text Line {idx+1}: '{text}' (confidence: {score})")
                elif isinstance(result_data, list):
                    # Old API format
                    for idx, line in enumerate(result_data):
                        if isinstance(line, list) and len(line) >= 2:
                            text = line[1][0] if isinstance(line[1], tuple) else line[1]
                            confidence = line[1][1] if isinstance(line[1], tuple) and len(line[1]) > 1 else 0
                            all_texts.append(text)
                            print(f"  Text Line {idx+1}: '{text}' (confidence: {confidence})")
                
                if all_texts:
                    print(f"\n=== COMBINATION OPTIONS ===")
                    print(f"All lines array: {all_texts}")
                    print(f"Joined with space: '{' '.join(all_texts)}'")
                    print(f"Joined with dash: '{'-'.join(all_texts)}'")
                    print(f"Joined with newline: '{chr(10).join(all_texts)}'")

def main():
    # Test both images
    for img in ["image.png", "test.png"]:
        debug_plate_ocr(img)

if __name__ == "__main__":
    main()

"""
Test script for license plate detection on static images.
Tests with test.png and image.png before integrating into plate_capture.py
"""

import cv2
import os
from detections import LicencePlateDetection

def test_image_detection(image_path, output_prefix="test"):
    """
    Test license plate detection on a single image
    
    Args:
        image_path: Path to the input image
        output_prefix: Prefix for output image filename
    """
    print(f"\n{'='*60}")
    print(f"Testing: {image_path}")
    print(f"{'='*60}")
    
    # Check if image exists
    if not os.path.exists(image_path):
        print(f"[ERROR] Image not found: {image_path}")
        return
    
    # Read the image
    frame = cv2.imread(image_path)
    if frame is None:
        print(f"[ERROR] Failed to read image: {image_path}")
        return
    
    print(f"[INFO] Image loaded successfully")
    print(f"[INFO] Image size: {frame.shape[1]}x{frame.shape[0]}")
    
    # Initialize license plate detector
    print("[INFO] Loading license plate detection model...")
    licence_plate_detector = LicencePlateDetection(model_path='models/best.pt')
    print("[INFO] Model loaded successfully")
    
    # Detect license plates
    print("[INFO] Detecting license plates...")
    bbox_list, text_list = licence_plate_detector.detect_frame(frame)
    
    # Display results
    print(f"\n[RESULTS]")
    print(f"Number of plates detected: {len(bbox_list)}")
    
    if len(bbox_list) > 0:
        for idx, (bbox, text) in enumerate(zip(bbox_list, text_list)):
            x1, y1, x2, y2 = map(int, bbox)
            print(f"\nPlate {idx+1}:")
            print(f"  - Bounding box: ({x1}, {y1}) to ({x2}, {y2})")
            print(f"  - Detected text: '{text}'")
            
            # Show alternative formats if multi-line
            if " " in text:
                parts = text.split(" ")
                print(f"  - Alternative formats:")
                print(f"    • No separator: '{''.join(parts)}'")
                print(f"    • Dash separator: '{'-'.join(parts)}'")
                print(f"    • Space (current): '{text}'")
            
            # Draw on frame
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(frame, text, (x1, y1 - 10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 0), 2)
    else:
        print("  No license plates detected!")
    
    # Save output image
    output_path = f"output_{output_prefix}.png"
    cv2.imwrite(output_path, frame)
    print(f"\n[INFO] Output saved to: {output_path}")
    
    return bbox_list, text_list


def main():
    """Main testing function"""
    print("="*60)
    print("License Plate Detection Test Script")
    print("="*60)
    
    # Test both images
    test_images = [
        ("test.png", "test"),
        ("image.png", "image")
    ]
    
    results = {}
    
    for img_path, prefix in test_images:
        if os.path.exists(img_path):
            bbox_list, text_list = test_image_detection(img_path, prefix)
            results[img_path] = {
                'bboxes': bbox_list,
                'texts': text_list
            }
        else:
            print(f"\n[WARN] Skipping {img_path} - file not found")
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    for img_path in results:
        num_plates = len(results[img_path]['bboxes'])
        texts = results[img_path]['texts']
        print(f"\n{img_path}:")
        print(f"  - Plates detected: {num_plates}")
        if num_plates > 0:
            print(f"  - Texts: {texts}")
    
    print("\n[INFO] Test complete! Check output_test.png and output_image.png")


if __name__ == "__main__":
    main()

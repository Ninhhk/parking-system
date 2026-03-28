# Báo cáo Hệ thống Nhận dạng Biển số xe (License Plate Detection - LPD)

## 1. Tổng quan hệ thống

### 1.1 Mô tả
Hệ thống **License Plate Detection (LPD)** là một module tích hợp trong ứng dụng quản lý bãi đỗ xe, cho phép tự động nhận dạng biển số xe từ hình ảnh camera. Hệ thống sử dụng công nghệ Deep Learning (YOLO) để phát hiện biển số và OCR (PaddleOCR) để đọc ký tự trên biển.

### 1.2 Kiến trúc tổng quan

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐
│   Frontend      │───▶│    Backend      │───▶│   Python LPD Service        │
│   (React/Next)  │    │   (Node.js)     │    │   (Flask + YOLO + OCR)      │
└─────────────────┘    └─────────────────┘    └─────────────────────────────┘
```

### 1.3 Công nghệ sử dụng

| Layer | Công nghệ |
|-------|-----------|
| Frontend | React, Next.js, WebRTC (getUserMedia) |
| Backend | Node.js, Express.js, Axios |
| LPD Service | Python, Flask, YOLO (Ultralytics), PaddleOCR |
| Model | YOLO-based custom trained model (best.pt) |

---

## 2. Use Case Diagram

```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle

actor "Employee (Nhân viên)" as Employee

rectangle "License Plate Detection System" {
    usecase "UC01: Quét biển số xe" as UC01
    usecase "UC02: Xác thực hình ảnh" as UC02
    usecase "UC03: Phát hiện biển số" as UC03
    usecase "UC04: Nhận dạng ký tự" as UC04
    usecase "UC05: Chuẩn hóa biển số" as UC05
    usecase "UC06: Hiển thị kết quả" as UC06
}

Employee --> UC01
UC01 ..> UC02 : <<include>>
UC02 ..> UC03 : <<include>>
UC03 ..> UC04 : <<include>>
UC04 ..> UC05 : <<include>>
UC01 ..> UC06 : <<include>>

@enduml
```

---

## 3. Đặc tả chi tiết Use Case

### UC01: Quét biển số xe (Scan License Plate)

| Thuộc tính | Mô tả |
|------------|-------|
| **Tên UC** | Quét biển số xe |
| **Actor** | Nhân viên (Employee) |
| **Mô tả** | Cho phép nhân viên sử dụng camera để chụp và nhận dạng tự động biển số xe |
| **Tiền điều kiện** | - Nhân viên đã đăng nhập vào hệ thống<br>- Camera được kết nối và hoạt động |
| **Hậu điều kiện** | - Biển số xe được nhận dạng và hiển thị trên form |

**Luồng chính (Main Flow):**

| Bước | Actor | Hệ thống |
|------|-------|----------|
| 1 | Nhấn nút "Scan" trên trang Check-in | |
| 2 | | Mở camera và hiển thị WebcamFeed |
| 3 | Đưa xe vào khung hình và nhấn "Capture" | |
| 4 | | Chụp ảnh từ camera, chuyển sang base64 |
| 5 | | Gửi ảnh đến Backend API |
| 6 | | Backend xác thực và chuyển tiếp đến Python LPD Service |
| 7 | | LPD Service phát hiện biển số bằng YOLO |
| 8 | | OCR đọc ký tự trên biển số |
| 9 | | Chuẩn hóa biển số (PlateNormalizer) |
| 10 | | Trả về kết quả cho Frontend |
| 11 | | Hiển thị biển số trên form, hiện thông báo thành công |

**Luồng thay thế (Alternative Flows):**

| Nhánh | Điều kiện | Xử lý |
|-------|-----------|-------|
| 3a | Camera không khả dụng | Hiển thị thông báo lỗi, cho phép nhập thủ công |
| 7a | Không phát hiện biển số trong ảnh | Trả về lỗi 422, hiển thị "No license plate detected" |
| 8a | OCR không đọc được ký tự | Trả về lỗi "Failed to read plate text" |
| 8b | Độ tin cậy OCR < 50% | Bỏ qua kết quả, thử lại hoặc báo lỗi |

---

### UC02: Xác thực hình ảnh (Validate Image)

| Thuộc tính | Mô tả |
|------------|-------|
| **Tên UC** | Xác thực hình ảnh |
| **Actor** | Hệ thống (System) |
| **Mô tả** | Kiểm tra tính hợp lệ của dữ liệu hình ảnh base64 |
| **Tiền điều kiện** | Nhận được request chứa dữ liệu image |

**Chi tiết xác thực:**

| Kiểm tra | Mô tả | HTTP Code nếu lỗi |
|----------|-------|-------------------|
| Null/Empty check | Image không được rỗng | 400 |
| Type check | Image phải là string | 400 |
| Base64 format | Kiểm tra định dạng base64 hợp lệ | 400 |
| Buffer decode | Có thể decode thành buffer | 400 |
| Image decode | OpenCV có thể decode thành ảnh | 400 |

---

### UC03: Phát hiện biển số (Detect Plate)

| Thuộc tính | Mô tả |
|------------|-------|
| **Tên UC** | Phát hiện biển số |
| **Actor** | LPD Service |
| **Mô tả** | Sử dụng YOLO model để phát hiện vị trí biển số trong ảnh |

**Chi tiết xử lý:**

```
1. Load ảnh vào memory (numpy array)
2. Chạy YOLO predict trên ảnh
3. Lọc các box có class = "License_Plate"
4. Chọn box có confidence cao nhất
5. Crop vùng biển số từ ảnh gốc
```

---

### UC04: Nhận dạng ký tự (OCR Recognition)

| Thuộc tính | Mô tả |
|------------|-------|
| **Tên UC** | Nhận dạng ký tự |
| **Actor** | PaddleOCR Engine |
| **Mô tả** | Đọc ký tự từ vùng biển số đã crop |

**Tiền xử lý ảnh:**

```
1. Chuyển sang grayscale (cv2.cvtColor)
2. Resize 2x để cải thiện OCR
3. Chuyển lại sang BGR cho PaddleOCR
```

**Cấu hình OCR:**

| Tham số | Giá trị |
|---------|---------|
| use_angle_cls | True |
| lang | 'en' |
| use_gpu | False |
| enable_mkldnn | True |
| cpu_threads | 2 |

---

### UC05: Chuẩn hóa biển số (Normalize Plate)

| Thuộc tính | Mô tả |
|------------|-------|
| **Tên UC** | Chuẩn hóa biển số |
| **Actor** | PlateNormalizer |
| **Mô tả** | Chuyển đổi raw text từ OCR thành định dạng biển số chuẩn |

**Quy tắc chuẩn hóa:**

| Bước | Xử lý | Ví dụ |
|------|-------|-------|
| 1 | Uppercase | "51g-39466" → "51G-39466" |
| 2 | OCR Corrections | O→0, I→1, Z→2, S→5, B→8 |
| 3 | Remove invalid chars | Chỉ giữ A-Z, 0-9, - |
| 4 | Collapse hyphens | "51G--39466" → "51G-39466" |
| 5 | Trim hyphens | "-51G-39466-" → "51G-39466" |

---

## 4. Sequence Diagram

### 4.1 Sequence Diagram - Luồng nhận dạng biển số

```plantuml
@startuml
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true

title Sequence Diagram - License Plate Detection Flow

actor "Employee" as User
participant "CheckInPage\n(React)" as UI
participant "WebcamFeed\n(Component)" as Webcam
participant "employee.lpd.client\n(API Client)" as LPDClient
participant "LPD Controller\n(Node.js)" as Controller
participant "LPD Service\n(Node.js)" as Service
participant "Flask API\n(Python)" as FlaskAPI
participant "LicencePlateDetection\n(Python)" as Detector
participant "YOLO Model" as YOLO
participant "PaddleOCR" as OCR
participant "PlateNormalizer\n(Python)" as Normalizer

== Khởi tạo Camera ==
User -> UI: Nhấn nút "Scan"
UI -> Webcam: Mở WebcamFeed component
Webcam -> Webcam: getUserMedia()\nKhởi tạo camera stream

== Chụp ảnh ==
User -> Webcam: Nhấn "Capture"
Webcam -> Webcam: canvas.toDataURL()\nChuyển frame sang base64
Webcam -> UI: onCapture(base64Image)
UI -> UI: setDetectingPlate(true)

== Gọi API ==
UI -> LPDClient: detectLicensePlate(base64Image)
LPDClient -> LPDClient: Strip data URL prefix\n(nếu có "data:image...")
LPDClient -> Controller: POST /api/employee/parking/lpd-detect\n{image: base64}

== Xác thực Backend ==
Controller -> Controller: Validate session (auth)
Controller -> Controller: Validate image input
Controller -> Service: detectPlateFromImage(base64Image)

== Gọi Python Service ==
Service -> Service: isValidBase64()\nValidate base64 format
Service -> FlaskAPI: POST http://lpd:5000/api/detect\n{image: base64}

== Xử lý Python ==
FlaskAPI -> FlaskAPI: base64.b64decode()\ncv2.imdecode()
FlaskAPI -> Detector: detect_plate_from_frame(image)

Detector -> YOLO: model.predict(frame)
YOLO --> Detector: boxes (License_Plate detections)

loop Mỗi detected box
    Detector -> Detector: Crop plate region
    Detector -> Detector: Preprocess (grayscale, resize 2x)
    Detector -> OCR: ocr(preprocessed_plate)
    OCR --> Detector: [[bbox, (text, confidence)], ...]
    Detector -> Detector: Lọc confidence > 0.5
    Detector -> Detector: Join multiple lines
end

Detector --> FlaskAPI: {success, plate_text, confidence, bbox}

FlaskAPI -> Normalizer: sanitize(raw_text)
Normalizer --> FlaskAPI: normalized_plate

FlaskAPI --> Service: {success, normalized_plate,\nraw_text, confidence}
Service --> Controller: Detection result
Controller --> LPDClient: {success, data: {...}}

== Hiển thị kết quả ==
LPDClient --> UI: {normalized_plate, confidence, ...}
UI -> UI: setForm({license_plate: result})
UI -> UI: setPlateDetected(true)
UI -> User: Toast "License plate detected: 51G-39466"

@enduml
```

### 4.2 Sequence Diagram - Xử lý lỗi

```plantuml
@startuml
title Sequence Diagram - Error Handling Flow

actor "Employee" as User
participant "CheckInPage" as UI
participant "LPD Client" as Client
participant "LPD Controller" as Controller
participant "LPD Service" as Service
participant "Flask API" as Flask

== Lỗi: Không có biển số trong ảnh ==
User -> UI: Capture image (no plate visible)
UI -> Client: detectLicensePlate(image)
Client -> Controller: POST /lpd-detect
Controller -> Service: detectPlateFromImage()
Service -> Flask: POST /api/detect
Flask -> Flask: YOLO detect → 0 plates found
Flask --> Service: {success: false, error: "No license plate detected"}
Service --> Controller: Error thrown
Controller --> Client: 422 {success: false, message: "..."}
Client --> UI: throw Error(message)
UI -> User: Toast error "No license plate detected"

== Lỗi: LPD Service không khả dụng ==
User -> UI: Capture image
UI -> Client: detectLicensePlate(image)
Client -> Controller: POST /lpd-detect
Controller -> Service: detectPlateFromImage()
Service -> Flask: POST /api/detect
Flask x--> Service: ECONNREFUSED
Service --> Controller: Error "LPD service unavailable"
Controller --> Client: 503 {success: false, message: "..."}
Client --> UI: throw Error(message)
UI -> User: Toast error "LPD service unavailable..."

@enduml
```

---

## 5. Activity Diagram

```plantuml
@startuml
title Activity Diagram - License Plate Detection Process

start

:Employee mở trang Check-in;
:Nhấn nút "Scan";

if (Camera khả dụng?) then (Có)
    :Hiển thị WebcamFeed;
    :Stream camera lên canvas;
    
    :Nhấn nút "Capture";
    :Chụp frame hiện tại;
    :Chuyển đổi sang Base64;
    
    :Gửi request đến Backend;
    
    if (Xác thực session?) then (Valid)
        if (Xác thực image format?) then (Valid)
            :Gửi đến Python LPD Service;
            
            :Decode Base64 → OpenCV Image;
            
            :YOLO Detection;
            
            if (Phát hiện biển số?) then (Có)
                :Crop vùng biển số;
                :Tiền xử lý (grayscale, resize);
                :PaddleOCR recognition;
                
                if (OCR confidence ≥ 50%?) then (Có)
                    :Lấy text từ OCR;
                    :Chuẩn hóa biển số;
                    :Trả về kết quả thành công;
                    
                    :Điền tự động vào form;
                    :Hiện thông báo thành công;
                    #palegreen:Hoàn thành;
                else (Không)
                    :Trả về lỗi "Failed to read";
                    :Hiện thông báo lỗi;
                    #salmon:Thất bại;
                endif
            else (Không)
                :Trả về lỗi 422;
                :Hiện thông báo lỗi;
                #salmon:Thất bại;
            endif
        else (Invalid)
            :Trả về lỗi 400;
            :Hiện thông báo lỗi;
            #salmon:Thất bại;
        endif
    else (Invalid)
        :Trả về lỗi 401;
        :Redirect đến login;
        #salmon:Thất bại;
    endif
else (Không)
    :Hiển thị lỗi camera;
    #salmon:Thất bại;
endif

stop

@enduml
```

---

## 6. Package Diagram

```plantuml
@startuml
skinparam packageStyle rectangle

title Package Diagram - LPD System Architecture

package "Frontend (Next.js)" <<Frame>> {
    package "app/employee/checkin" {
        [CheckInPage.jsx] as CheckInPage
    }
    
    package "app/components/common" {
        [WebcamFeed.jsx] as WebcamFeed
        [FormField.jsx] as FormField
    }
    
    package "app/api" {
        [employee.lpd.client.js] as LPDClient
        [client.config.js] as ClientConfig
    }
}

package "Backend (Node.js/Express)" <<Frame>> {
    package "controllers" {
        [employee.lpd.controller.js] as LPDController
    }
    
    package "services" {
        [employee.lpd.service.js] as LPDService
    }
    
    package "routes" {
        [employee.routes.js] as EmployeeRoutes
    }
    
    package "middlewares" {
        [auth.middleware.js] as AuthMiddleware
    }
    
    package "config" {
        [constants.js] as Constants
    }
    
    package "utils" {
        [licensePlate.js] as LicensePlateUtils
    }
}

package "Python LPD Service (Flask)" <<Frame>> {
    package "root" {
        [api_server.py] as APIServer
    }
    
    package "detections" {
        [licence_plate_detection.py] as Detection
    }
    
    package "services" {
        [plate_normalizer.py] as Normalizer
        [plate_capture_service.py] as CaptureService
    }
    
    package "config" {
        [settings.py] as Settings
    }
    
    package "models" {
        [best.pt] as YOLOModel
    }
}

package "External Libraries" <<Cloud>> {
    [YOLO (Ultralytics)] as YOLO
    [PaddleOCR] as PaddleOCR
    [OpenCV] as OpenCV
}

' Frontend dependencies
CheckInPage --> WebcamFeed : uses
CheckInPage --> LPDClient : import
LPDClient --> ClientConfig : import

' Backend dependencies
EmployeeRoutes --> LPDController : routes to
EmployeeRoutes --> AuthMiddleware : uses
LPDController --> LPDService : calls
LPDService --> Constants : config

' Python dependencies
APIServer --> Detection : import
APIServer --> Normalizer : import
APIServer --> Settings : config
Detection --> YOLOModel : loads
Detection --> YOLO : uses
Detection --> PaddleOCR : uses
Detection --> OpenCV : uses
Normalizer ..> LicensePlateUtils : sync rules

' Cross-layer communication
LPDClient ..> LPDController : HTTP POST
LPDService ..> APIServer : HTTP POST

@enduml
```

---

## 7. Component Diagram

```plantuml
@startuml
skinparam componentStyle uml2

title Component Diagram - LPD System

package "Presentation Layer" {
    component [CheckInPage] <<React Component>>
    component [WebcamFeed] <<React Component>>
    
    interface "onCapture()" as ICapture
    interface "onError()" as IError
    
    WebcamFeed -down- ICapture
    WebcamFeed -down- IError
    CheckInPage -up-> ICapture : subscribes
}

package "API Client Layer" {
    component [LPDClient] <<JavaScript Module>>
    
    interface "detectLicensePlate()" as IDetect
    LPDClient -down- IDetect
    CheckInPage -down-> IDetect : calls
}

package "Backend Controller Layer" {
    component [LPDController] <<Express Controller>>
    
    interface "POST /lpd-detect" as IRoute
    LPDController -down- IRoute
    LPDClient -down-> IRoute : HTTP
}

package "Backend Service Layer" {
    component [LPDService] <<Node.js Service>>
    
    interface "detectPlateFromImage()" as IService
    LPDService -down- IService
    LPDController -down-> IService : calls
}

package "Python LPD Layer" {
    component [FlaskAPI] <<Flask Application>>
    component [LicencePlateDetection] <<Python Class>>
    component [PlateNormalizer] <<Python Class>>
    
    interface "POST /api/detect" as IAPI
    FlaskAPI -down- IAPI
    LPDService -down-> IAPI : HTTP
    
    FlaskAPI -down-> LicencePlateDetection : uses
    FlaskAPI -down-> PlateNormalizer : uses
}

package "ML/AI Layer" {
    component [YOLOModel] <<Deep Learning>>
    component [PaddleOCR] <<OCR Engine>>
    
    LicencePlateDetection -down-> YOLOModel : detect
    LicencePlateDetection -down-> PaddleOCR : recognize
}

@enduml
```

---

## 8. Class Diagram

```plantuml
@startuml
skinparam classAttributeIconSize 0

title Class Diagram - LPD Service Components

package "Python LPD Service" {
    
    class LicencePlateDetection {
        - model: YOLO
        - ocr: PaddleOCR
        --
        + __init__(model_path: str)
        + detect_frames(frames: List) : Tuple
        + detect_frame(frame: ndarray) : Tuple
        + detect_plate_from_frame(frame: ndarray) : dict
        + draw_bboxes(frames, detections, texts) : List
    }
    
    class PlateNormalizer {
        {static} + ALLOWED_CHARS: Set[str]
        {static} + OCR_CORRECTIONS: dict
        --
        + __init__()
        {static} + sanitize(raw: str, apply_ocr: bool) : str
        {static} + is_valid(plate: str) : bool
        {static} + format_vietnamese_2line(line1, line2) : str
    }
    
    class FlaskAPI {
        - detector: LicencePlateDetection
        - normalizer: PlateNormalizer
        - config: AppConfig
        --
        + initialize_services()
        + health_check() : Response
        + detect_license_plate() : Response
        + detect_batch() : Response
        + get_metrics() : Response
    }
    
    FlaskAPI --> LicencePlateDetection : uses
    FlaskAPI --> PlateNormalizer : uses
    
}

package "Node.js Backend" {
    
    class LPDController <<Controller>> {
        --
        + detectLicensePlate(req, res) : Response
    }
    
    class LPDService <<Service>> {
        --
        + detectPlateFromImage(base64Image) : Promise<Object>
        - isValidBase64(str) : boolean
        + healthCheck() : Promise<boolean>
    }
    
    LPDController --> LPDService : uses
    
}

package "Frontend" {
    
    class LPDClient <<Module>> {
        --
        + detectLicensePlate(base64Image) : Promise<Object>
        + isLPDServiceAvailable() : Promise<boolean>
    }
    
    class WebcamFeed <<React Component>> {
        - videoRef: Ref
        - canvasRef: Ref
        - stream: MediaStream
        --
        + startCamera()
        + captureImage()
        + stopCamera()
    }
    
    LPDClient ..> LPDController : HTTP
    
}

@enduml
```

---

## 9. Data Flow

### 9.1 Request Flow

```
┌──────────────┐   Base64 Image   ┌───────────────┐   Base64 Image   ┌─────────────────┐
│   Frontend   │ ───────────────▶ │    Backend    │ ───────────────▶ │  Python Service │
│  (React)     │                  │  (Node.js)    │                  │    (Flask)      │
└──────────────┘                  └───────────────┘                  └─────────────────┘
                                                                              │
                                                                              ▼
                                                                     ┌─────────────────┐
                                                                     │  YOLO + OCR     │
                                                                     │  Processing     │
                                                                     └─────────────────┘
```

### 9.2 Response Data Structure

```json
{
    "success": true,
    "normalized_plate": "51G-39466",
    "raw_text": "51G-394.66",
    "confidence": 0.95,
    "detection_time_ms": 125
}
```

---

## 10. API Endpoints

### 10.1 Backend API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/employee/parking/lpd-detect` | Nhận dạng biển số từ ảnh base64 |

**Request Body:**
```json
{
    "image": "<base64_encoded_image>"
}
```

**Response (Success - 200):**
```json
{
    "success": true,
    "data": {
        "success": true,
        "normalized_plate": "51G-39466",
        "raw_text": "51G-394.66",
        "confidence": 0.95
    }
}
```

### 10.2 Python LPD API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/health` | Health check |
| POST | `/api/detect` | Phát hiện biển số đơn |
| POST | `/api/detect-batch` | Phát hiện biển số hàng loạt (max 10) |
| GET | `/api/metrics` | Thống kê service (memory, CPU) |
| GET | `/api/config` | Cấu hình service |

---

## 11. Error Codes

| HTTP Code | Lỗi | Mô tả |
|-----------|-----|-------|
| 400 | Bad Request | Image không hợp lệ, base64 sai định dạng |
| 401 | Unauthorized | Chưa đăng nhập |
| 422 | Unprocessable Entity | Không phát hiện biển số trong ảnh |
| 500 | Internal Server Error | Lỗi xử lý nội bộ |
| 503 | Service Unavailable | Python LPD service không khả dụng |
| 504 | Gateway Timeout | Request timeout |

---

## 12. Cấu hình hệ thống

### 12.1 Environment Variables

| Variable | Default | Mô tả |
|----------|---------|-------|
| LPD_SERVICE_URL | http://lpd:5000 | URL của Python LPD service |
| LPD_DETECT_ENDPOINT | /api/detect | Endpoint detection |
| LPD_TIMEOUT_MS | 30000 | Timeout cho request |
| LPD_API_PORT | 5000 | Port của Flask API |
| LPD_API_HOST | 0.0.0.0 | Host của Flask API |

### 12.2 Model Configuration

| Tham số | Giá trị |
|---------|---------|
| YOLO Model | best.pt (custom trained) |
| OCR Engine | PaddleOCR (lang='en') |
| OCR Confidence Threshold | 0.5 (50%) |

---

## 13. Deployment Architecture

```plantuml
@startuml
!define RECTANGLE class

node "Docker Network" {
    node "frontend" <<Container>> {
        component [Next.js App]
    }
    
    node "backend" <<Container>> {
        component [Node.js/Express]
    }
    
    node "lpd" <<Container>> {
        component [Flask + YOLO + OCR]
        artifact "best.pt" as model
    }
    
    database "PostgreSQL" as db
}

[Next.js App] --> [Node.js/Express] : HTTP :3001
[Node.js/Express] --> [Flask + YOLO + OCR] : HTTP :5000
[Node.js/Express] --> db : PostgreSQL

@enduml
```

---

## 14. Kết luận

Hệ thống License Plate Detection được thiết kế theo kiến trúc microservices với 3 layer chính:

1. **Frontend Layer**: React/Next.js với WebcamFeed component xử lý camera
2. **Backend Layer**: Node.js/Express đóng vai trò API Gateway và validation
3. **LPD Service Layer**: Python Flask với YOLO và PaddleOCR xử lý AI/ML

**Ưu điểm của thiết kế:**
- Tách biệt rõ ràng giữa các layer
- Dễ dàng scale từng component độc lập
- Hỗ trợ biển số Việt Nam (2 dòng)
- Có cơ chế OCR correction tự động
- Xử lý lỗi đầy đủ ở mọi layer

**Điểm cần cải thiện:**
- Thêm caching cho kết quả detection
- Hỗ trợ GPU để tăng tốc xử lý
- Queue system cho batch processing lớn

---

*Tài liệu được tạo tự động - Ngày: 2026-01-11*

# 🚀 Quick Start Guide

## Installation (5 minutes)

```powershell
# 1. Navigate to module directory
cd d:\Project 2_20242\Tun\parking-lot\Licence-Plate-Detection-Recognition-Recording

# 2. Create virtual environment
python -m venv venv

# 3. Activate virtual environment
.\venv\Scripts\Activate.ps1

# 4. Install dependencies
pip install -r requirements.txt

# 5. Copy environment template
Copy-Item .env.example .env

# 6. Edit .env with your settings (optional)
notepad .env
```

## Running Tests (2 minutes)

```powershell
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test category
pytest tests/unit/ -v
pytest tests/integration/ -v

# Run with coverage report
pytest --cov=. --cov-report=html
```

## Basic Usage (1 minute)

### Test with Sample Image (Dry Run)

```powershell
# Uses default settings from .env
python plate_capture.py
```

Expected output:
```
2025-12-05 10:30:00 - INFO - License Plate Capture & Check-in System
2025-12-05 10:30:01 - INFO - Mode: IMAGE
2025-12-05 10:30:02 - INFO - Loading YOLO model
2025-12-05 10:30:05 - INFO - Detected plate: 51G-39466
2025-12-05 10:30:05 - INFO - DRY RUN mode - skipping API check-in
2025-12-05 10:30:05 - INFO - Saved annotated frame: outputs/...
```

### Test with Camera

```powershell
$env:MODE = "camera"
python plate_capture.py
```

### Connect to Backend (Production)

```powershell
# Edit .env first:
# DRY_RUN=false
# EMPLOYEE_USER=your_username
# EMPLOYEE_PASS=your_password

python plate_capture.py
```

## Verification Checklist

- [ ] Tests pass: `pytest`
- [ ] Image mode works: `python plate_capture.py`
- [ ] Output saved in `outputs/` folder
- [ ] Logs show correct plate detection
- [ ] (Optional) Backend integration works with DRY_RUN=false

## Troubleshooting

### Issue: ModuleNotFoundError
```powershell
# Solution: Activate virtual environment
.\venv\Scripts\Activate.ps1
```

### Issue: Model file not found
```powershell
# Solution: Ensure models/best.pt exists
# Download or train YOLO model first
```

### Issue: PaddleOCR crashes
```
Solution: Install Visual C++ Redistributable
https://www.microsoft.com/en-us/download/details.aspx?id=48145
```

### Issue: Camera not opening
```powershell
# Solution: Check camera index
$env:CAM_INDEX = "0"  # or 1, 2, etc.
python plate_capture.py
```

## Next Steps

1. Review [README_REFACTORED.md](README_REFACTORED.md) for full documentation
2. Check [REFACTORING_COMPLETE.md](REFACTORING_COMPLETE.md) for architecture details
3. Start backend server and test integration
4. Train custom YOLO model if needed
5. Add more sample images for testing

## Need Help?

- Check logs in terminal output
- Review test failures: `pytest -v`
- Read documentation in `docs/` folder
- Verify `.env` configuration

---

**Ready to go!** 🎉

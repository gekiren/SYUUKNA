@echo off
echo Starting Routine Tracker...

:: Change to the application directory
cd /d "C:\Users\toshi\.gemini\antigravity\scratch\routine_tracker"

:: Open the browser after a short delay (to give the server time to start)
timeout /t 2 >nul
start http://127.0.0.1:8000

:: Start the FastAPI server
echo Server is running. Close this window to stop the app.
python -m uvicorn main:app --reload

pause

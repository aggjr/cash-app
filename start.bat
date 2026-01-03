@echo off
echo ========================================
echo CASH - Quick Start
echo ========================================
echo.
echo This script will help you start both servers
echo.

REM Check if backend is set up
if not exist backend\node_modules (
    echo ERROR: Backend not set up!
    echo Please run: database\setup-complete.bat first
    pause
    exit /b 1
)

REM Check if .env exists
if not exist backend\.env (
    echo ERROR: .env file not found!
    echo Please copy backend\.env.example to backend\.env
    echo and set your MySQL password
    pause
    exit /b 1
)

echo Starting servers...
echo.
echo Backend will run on: http://localhost:3001
echo Frontend will run on: http://localhost:5173
echo.
echo Press Ctrl+C in each window to stop the servers
echo.
pause

REM Start backend in new window
start "CASH Backend" cmd /k "cd backend && npm run dev"

REM Wait a bit for backend to start
timeout /t 3 /nobreak > nul

REM Start frontend in new window  
start "CASH Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo Servers started!
echo ========================================
echo Backend: http://localhost:3001/health
echo Frontend: http://localhost:5173
echo.

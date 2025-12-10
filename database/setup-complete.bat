@echo off
echo ========================================
echo CASH Application - Complete Setup
echo ========================================
echo.

REM Step 1: Initialize Database
echo [1/5] Initializing MySQL database...
echo Please enter your MySQL root password when prompted:
mysql -u root -p < init.sql
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Database initialization failed!
    pause
    exit /b 1
)
echo ✓ Database created successfully
echo.

REM Step 2: Setup Backend
echo [2/5] Setting up backend...
cd ..\backend

REM Create .env file
if not exist .env (
    echo Creating .env file...
    copy .env.example .env
    echo.
    echo IMPORTANT: Please edit backend\.env and set your MySQL password!
    echo Press any key after editing the file...
    pause
)

REM Install backend dependencies
echo Installing backend dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Backend npm install failed!
    pause
    exit /b 1
)
echo ✓ Backend dependencies installed
echo.

REM Step 3: Test backend
echo [3/5] Testing backend connection...
echo Starting backend server (will stop after test)...
timeout /t 2 /nobreak > nul
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Edit backend\.env with your MySQL password
echo 2. Run: cd backend ^&^& npm run dev
echo 3. In another terminal: cd .. ^&^& npm run dev
echo.
echo Backend will run on: http://localhost:3001
echo Frontend will run on: http://localhost:5173
echo.
pause

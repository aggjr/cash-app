@echo off
echo ========================================
echo CASH - Database Setup
echo ========================================
echo.

REM Common MySQL installation paths
set MYSQL_PATHS[0]="C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
set MYSQL_PATHS[1]="C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe"
set MYSQL_PATHS[2]="C:\xampp\mysql\bin\mysql.exe"
set MYSQL_PATHS[3]="mysql"

set MYSQL_CMD=

REM Try to find MySQL
for /L %%i in (0,1,3) do (
    if exist !MYSQL_PATHS[%%i]! (
        set MYSQL_CMD=!MYSQL_PATHS[%%i]!
        goto :found
    )
)

REM If not found in common paths, try PATH
where mysql >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set MYSQL_CMD=mysql
    goto :found
)

echo ERROR: MySQL not found!
echo.
echo Please install MySQL or add it to your PATH
echo Common locations:
echo - C:\Program Files\MySQL\MySQL Server 8.0\bin
echo - C:\xampp\mysql\bin
echo.
pause
exit /b 1

:found
echo Found MySQL: %MYSQL_CMD%
echo.
echo Please enter your MySQL root password when prompted
echo.

%MYSQL_CMD% -u root -p < init.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo ✓ Database created successfully!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo ✗ Database creation failed!
    echo ========================================
)

echo.
pause

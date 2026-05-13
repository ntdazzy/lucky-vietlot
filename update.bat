@echo off
chcp 65001 >nul
title Vietlott Auto-Update

echo =========================================
echo    VIETLOTT - CAP NHAT KET QUA
echo =========================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js. Hay cai dat tai https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Dang cai dat dependencies...
    call npm install
    echo.
)

echo [%date% %time%] Bat dau cap nhat ket qua...
echo.

node scripts/update-today.js

echo.
if %errorlevel% equ 0 (
    echo =========================================
    echo    HOAN TAT CAP NHAT!
    echo =========================================
) else (
    echo =========================================
    echo    CO LOI XAY RA. XEM LOG PHIA TREN.
    echo =========================================
)

echo.
pause

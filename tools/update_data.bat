@echo off
echo ===================================================
echo   Taisho Yoidore Quest II - Data Update
echo   STORES.xlsx -> js/data.js
echo ===================================================
echo.

python convert_xlsx_to_js.py

echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Store data has been updated successfully!
    echo Please open or refresh index.html in your browser.
) else (
    echo [ERROR] Failed to update data. Please check Python or STORES.xlsx.
)

echo.
pause

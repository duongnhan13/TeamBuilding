@echo off
chcp 65001 > nul
title Trò Chơi Team Building TCKT 2026
echo ======================================================================
echo    🎪 TRÒ CHƠI TEAM BUILDING PHÒNG KẾ TOÁN - BVĐK PHƯƠNG ĐÔNG
echo ======================================================================
echo.
echo Đang kiểm tra Node.js và khởi động máy chủ...
echo Cổng mặc định: 3999 (Tự động tránh các cổng đang bận)
echo.

node server.js 3999

pause

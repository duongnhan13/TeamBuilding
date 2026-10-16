@echo off
chcp 65001 > nul
title Trò Chơi Team Building TCKT 2026 - Cloudflare Tunnel
echo ======================================================================
echo    🎪 TRÒ CHƠI TEAM BUILDING PHÒNG KẾ TOÁN - BVĐK PHƯƠNG ĐÔNG
echo ======================================================================
echo.
echo [1] Đang khởi động máy chủ Node.js (Cổng 3999 - tự động đổi nếu bận)...
echo [2] Đang kết nối Cloudflare Tunnel để mọi người quét QR là vào được...
echo.
echo Khi màn hình hiện link: https://xxxx.trycloudflare.com
echo Mọi người chỉ cần dùng Camera điện thoại (4G / 5G / Wi-Fi) quét QR trên máy chiếu!
echo.
echo ----------------------------------------------------------------------

node server.js 3999

pause

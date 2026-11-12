@echo off
chcp 65001 >nul
cd /d %~dp0
start http://localhost:4300
node server.js
pause

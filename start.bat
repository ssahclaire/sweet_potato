@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" http://localhost:5500
node server.js

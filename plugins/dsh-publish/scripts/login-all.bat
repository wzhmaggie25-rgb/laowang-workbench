@echo off
chcp 65001 >nul
setlocal
rem 一键扫码登录：两个平台依次弹浏览器，各扫一次。
rem 用前先设两个环境变量（或在下面两行直接改成绝对路径）：
rem   PUBLISH_XHS_DIR   xiaohongshu-mcp 所在目录
rem   PUBLISH_SAU_CWD   social-auto-upload 仓库目录
if "%PUBLISH_XHS_DIR%"=="" set "PUBLISH_XHS_DIR="
if "%PUBLISH_SAU_CWD%"=="" set "PUBLISH_SAU_CWD="

if "%PUBLISH_XHS_DIR%"=="" (
  echo [缺少配置] 请先设置 PUBLISH_XHS_DIR 为 xiaohongshu-mcp 所在目录
  pause
  exit /b 1
)
if "%PUBLISH_SAU_CWD%"=="" (
  echo [缺少配置] 请先设置 PUBLISH_SAU_CWD 为 social-auto-upload 仓库目录
  pause
  exit /b 1
)

echo ==========================================
echo   发布端登录：两个平台依次扫码
echo ==========================================
echo.
echo [1/2] 小红书
echo       会弹出浏览器窗口，用小红书 App 扫码
echo.
"%PUBLISH_XHS_DIR%\xiaohongshu-login.exe"
echo.
echo [2/2] 抖音
echo       会弹出浏览器窗口，用抖音 App 扫码
echo.
"%PUBLISH_SAU_CWD%\.venv\Scripts\sau.exe" douyin login --account default
echo.
echo ==========================================
echo 两个都扫完后跑只读诊断确认状态（在 DSH 源码仓库根目录）：
echo   tsx "<本插件目录>\scripts\doctor.ts"
echo ==========================================
pause

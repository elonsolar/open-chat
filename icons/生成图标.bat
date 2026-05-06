@echo off
echo ========================================
echo   AI对话助手 - 图标生成器启动器
echo ========================================
echo.
echo 正在打开图标生成器...
echo.

REM 获取脚本所在目录
set "SCRIPT_DIR=%~dp0"

REM 打开generator.html文件
start "" "%SCRIPT_DIR%generator.html"

echo.
echo 图标生成器已在浏览器中打开。
echo.
echo 使用说明：
echo 1. 在浏览器中调整颜色和文字（可选）
echo 2. 点击"下载所有图标"按钮
echo 3. 将下载的文件移动到此目录
echo.
pause

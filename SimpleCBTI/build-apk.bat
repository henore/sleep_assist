@echo off
echo === SimpleCBTI Release APK Build ===

set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%
set GRADLE_OPTS=-Xmx4096m -XX:MaxMetaspaceSize=1024m

echo [1/4] Copying to C:\build\SimpleCBTI ...
xcopy "%~dp0" "C:\build\SimpleCBTI\" /E /I /Y /Q >nul
cd /d C:\build\SimpleCBTI

echo [2/4] npm install ...
call npm install --silent

echo [3/4] expo prebuild ...
call npx expo prebuild --platform android --clean

echo [4/4] Building release APK ...
cd android
call gradlew assembleRelease

if exist "app\build\outputs\apk\release\app-release.apk" (
    echo.
    echo === BUILD SUCCESS ===
    echo APK: C:\build\SimpleCBTI\android\app\build\outputs\apk\release\app-release.apk
) else (
    echo.
    echo === BUILD FAILED ===
)
pause

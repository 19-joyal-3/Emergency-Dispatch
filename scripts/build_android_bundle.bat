@echo off
echo ======================================================
echo    VANGUARD GEO - ANDROID RELEASE BUNDLE BUILDER
echo ======================================================

echo.
echo [1/3] Building Web Production Assets (Vite)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Web build failed!
    exit /b %errorlevel%
)

echo.
echo [2/3] Synchronizing Assets with Capacitor Android...
call npx cap sync android
if %errorlevel% neq 0 (
    echo [ERROR] Capacitor sync failed!
    exit /b %errorlevel%
)

echo.
echo [3/3] Compiling Android App Bundle (bundleRelease)...
cd android
call gradlew.bat bundleRelease
if %errorlevel% neq 0 (
    echo.
    echo [NOTE] If Gradle build failed due to missing Java/Android SDK in PATH:
    echo Please open the "android" folder in Android Studio and select:
    echo "Build -> Generate Signed Bundle / APK -> Android App Bundle".
    cd ..
    exit /b 1
)

cd ..
echo.
echo ======================================================
echo [SUCCESS] Release bundle generated successfully!
echo Location: android\app\build\outputs\bundle\release\app-release.aab
echo Ready for upload to Google Play Console.
echo ======================================================

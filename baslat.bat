@echo off
cd /d "%~dp0"
set "EXPO_TOKEN="
echo.
echo  ===== MotoRota baslatici =====
echo  1) Tarayicida su adresi acin: https://expo.dev/settings/access-tokens
echo  2) "Create token" ile yeni bir kod olusturun ve kopyalayin.
echo  3) Bu pencereye SAG TIK yaparak yapistirin ve Enter'a basin.
echo.
:ask
set "EXPO_TOKEN="
set /p "EXPO_TOKEN=Kodu yapistirin: "
if not defined EXPO_TOKEN goto ask
set EXPO_TOKEN=%EXPO_TOKEN:"=%
set "EXPO_TOKEN=%EXPO_TOKEN: =%"
echo.
echo Kod kontrol ediliyor...
call npx expo whoami
if errorlevel 1 (
  echo.
  echo  Kod gecersiz. Sitede YENI bir kod olusturup tekrar yapistirin.
  echo.
  goto ask
)
echo.
echo Giris basarili. Uygulama baslatiliyor...
if not exist node_modules call npm install
call npx expo start -c

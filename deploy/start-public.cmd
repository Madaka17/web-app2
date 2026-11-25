@echo off
REM Builds the site and serves it publicly through the Cloudflare tunnel "openplot".
REM Run from anywhere; it always works from the repo root.
cd /d "%~dp0.."

REM Build the production bundle first; stop if it fails.
call npm run build
if errorlevel 1 (
  echo Build failed. Not starting the public site.
  exit /b 1
)

REM Model API (127.0.0.1:3030). Takes about a minute to load the model.
start "openplot-api" cmd /k "cd /d ml && set PYTHONIOENCODING=utf-8 && .venv\Scripts\python.exe api.py"

REM Static preview server with /api proxied to the model API (127.0.0.1:4173).
start "openplot-web" cmd /k "npx vite preview"

REM Cloudflare tunnel that forwards the public hostname to the preview server.
start "openplot-tunnel" cmd /k ""C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --no-autoupdate --config "%~dp0cloudflare\config.yml" run openplot"

echo.
echo Public site: https://openplot.bkksmartstreet.com
echo Prices work about a minute after the openplot-api window shows the model loaded.

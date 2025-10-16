# PowerShell helper to run locally
$ErrorActionPreference = "Stop"

if (!(Test-Path .venv)) {
  Write-Host "Creating virtual environment (.venv)..." -ForegroundColor Cyan
  python -m venv .venv
}

& .\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt

Write-Host "Starting Streamlit..." -ForegroundColor Green
streamlit run app.py

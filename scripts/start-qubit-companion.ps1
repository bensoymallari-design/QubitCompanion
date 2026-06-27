$ErrorActionPreference = "Stop"

$AppDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $AppDir

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "Node.js and npm are required."
}

if (-not (Test-Path "node_modules")) {
  npm install
}

Start-Process "http://localhost:3000"
npm run start

@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\semver\bin\semver" %*
) ELSE (
  node  "%~dp0\..\semver\bin\semver" %*
)
@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\rimraf\bin.js" %*
) ELSE (
  node  "%~dp0\..\rimraf\bin.js" %*
)
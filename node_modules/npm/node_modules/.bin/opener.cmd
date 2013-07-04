@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\opener\opener.js" %*
) ELSE (
  node  "%~dp0\..\opener\opener.js" %*
)
@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\npm\bin\npm-cli.js" %*
) ELSE (
  node  "%~dp0\..\npm\bin\npm-cli.js" %*
)
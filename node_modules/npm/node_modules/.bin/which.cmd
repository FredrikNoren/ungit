@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\which\bin\which" %*
) ELSE (
  node  "%~dp0\..\which\bin\which" %*
)
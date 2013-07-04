@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\ansi\examples\beep\index.js" %*
) ELSE (
  node  "%~dp0\..\ansi\examples\beep\index.js" %*
)
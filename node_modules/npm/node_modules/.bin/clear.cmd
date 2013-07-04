@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\ansi\examples\clear\index.js" %*
) ELSE (
  node  "%~dp0\..\ansi\examples\clear\index.js" %*
)
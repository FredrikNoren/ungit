@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\ansi\examples\starwars.js" %*
) ELSE (
  node  "%~dp0\..\ansi\examples\starwars.js" %*
)
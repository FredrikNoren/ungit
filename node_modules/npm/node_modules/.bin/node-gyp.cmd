@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\node-gyp\bin\node-gyp.js" %*
) ELSE (
  node  "%~dp0\..\node-gyp\bin\node-gyp.js" %*
)
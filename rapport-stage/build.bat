@echo off
setlocal
cd /d "%~dp0"

set "MAIN=main.tex"

rem --- Verifie la presence de latexmk (MikTeX) ---
where latexmk >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] latexmk introuvable dans le PATH.
    echo Installez MiKTeX ou ajoutez son dossier bin au PATH.
    exit /b 1
)

rem --- Nettoyage optionnel ---
if /i "%~1"=="clean" (
    echo Nettoyage des fichiers auxiliaires...
    latexmk -c
    echo [OK] Fichiers auxiliaires supprimes ^(PDF conserve^).
    exit /b %errorlevel%
)
if /i "%~1"=="cleanall" (
    echo Nettoyage complet ^(PDF inclus^)...
    latexmk -C
    echo [OK] Nettoyage complet effectue.
    exit /b %errorlevel%
)

rem --- Compilation complete : pdflatex + bibtex + passes multiples ---
echo Compilation de %MAIN% ...
latexmk -pdf -interaction=nonstopmode -halt-on-error "%MAIN%"

if errorlevel 1 (
    echo.
    echo [ECHEC] La compilation a echoue. Voir main.log :
    echo   findstr /i "error" main.log
    exit /b 1
)

echo.
echo [OK] PDF genere : %~dp0main.pdf
exit /b 0

@echo off
REM Script para criar e visualizar o banco de dados CASH

echo ========================================
echo CASH Database Setup
echo ========================================
echo.

REM Ajuste o caminho do MySQL conforme sua instalação
set MYSQL_PATH="C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"

echo 1. Criando banco de dados...
%MYSQL_PATH% -u root -p -e "CREATE DATABASE IF NOT EXISTS cash_db;"

echo.
echo 2. Executando schema...
%MYSQL_PATH% -u root -p cash_db < schema.sql

echo.
echo 3. Visualizando dados...
%MYSQL_PATH% -u root -p cash_db -e "SELECT * FROM tipo_entrada;"

echo.
echo ========================================
echo Concluído!
echo ========================================
pause

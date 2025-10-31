@echo off
echo === AUTENTICANDO CON GOOGLE CLOUD ===
gcloud auth login

echo === ESTABLECIENDO PROYECTO ===
gcloud config set project aplicacion-mejora-taller

echo === CONFIGURANDO CORS PARA STORAGE ===
gsutil cors set cors.json gs://aplicacion-mejora-taller.appspot.com

echo.
echo === CORS CONFIGURADO CORRECTAMENTE ===
pause

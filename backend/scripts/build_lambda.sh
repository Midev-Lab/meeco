#!/usr/bin/env bash
# Builds build/meeco-api.zip for AWS Lambda (python3.12, x86_64) from any OS.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf build && mkdir -p build/pkg
python3 -m pip install -q -r requirements-lambda.txt --target build/pkg \
  --platform manylinux2014_x86_64 --implementation cp --python-version 3.12 --only-binary=:all: --upgrade
cp -r app lambda_handler.py build/pkg/
find build/pkg -name "__pycache__" -type d -prune -exec rm -rf {} +
find build/pkg -name "*.dist-info" -type d -prune -exec rm -rf {} +
(cd build/pkg && python3 -c "
import os, zipfile
z = zipfile.ZipFile('../meeco-api.zip', 'w', zipfile.ZIP_DEFLATED)
for r, _, fs in os.walk('.'):
    for f in fs:
        p = os.path.join(r, f); z.write(p, os.path.relpath(p, '.'))
")
du -h build/meeco-api.zip | cut -f1 | xargs echo "built build/meeco-api.zip"

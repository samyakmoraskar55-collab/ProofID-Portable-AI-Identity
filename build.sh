#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "==> Upgrading pip and installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Navigate to backend directory if currently in root
if [ -d "proofid_backend" ]; then
  cd proofid_backend
fi

echo "==> Collecting static assets..."
python manage.py collectstatic --no-input

echo "==> Running database migrations..."
python manage.py migrate

echo "==> Seeding rich demo data..."
python manage.py seed_demo_data

echo "==> Build completed successfully!"

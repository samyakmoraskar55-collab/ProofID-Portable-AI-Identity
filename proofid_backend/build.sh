#!/usr/bin/env bash
set -o errexit

echo "==> Upgrading pip and installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "==> Collecting static assets..."
python manage.py collectstatic --no-input

echo "==> Running database migrations..."
python manage.py migrate

echo "==> Seeding rich demo data..."
python manage.py seed_demo_data

echo "==> Build completed successfully!"

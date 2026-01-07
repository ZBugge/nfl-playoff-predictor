#!/bin/bash
set -ex

echo "========================================"
echo "Starting build process..."
echo "========================================"

echo "Current directory: $(pwd)"
echo "Contents: $(ls -la)"

echo ""
echo "========================================"
echo "Building client..."
echo "========================================"
cd client
echo "Client directory contents: $(ls -la)"
npm run build
echo "Client dist contents: $(ls -la dist/ || echo 'dist not found')"
cd ..

echo ""
echo "========================================"
echo "Building server..."
echo "========================================"
cd server
npm run build
echo "Server dist contents: $(ls -la dist/ || echo 'dist not found')"
cd ..

echo ""
echo "========================================"
echo "Build complete!"
echo "========================================"

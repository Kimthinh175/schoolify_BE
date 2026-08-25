#!/bin/bash

echo "🚀 Bắt đầu cài đặt môi trường Server cho Ubuntu 26.04..."

# 1. Cập nhật hệ thống và cài đặt PostgreSQL
echo "📦 Đang cài đặt PostgreSQL..."
apt-get update
apt-get install -y curl ca-certificates gnupg postgresql postgresql-contrib

# 2. Cài đặt Node.js (Bản 22.x LTS mới nhất)
echo "📦 Đang cài đặt Node.js..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# 3. Khởi tạo Database cho Schoolify
echo "🗄️ Đang thiết lập Database (schoolify_db)..."
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE schoolify_db;"

# 4. Cài đặt PM2 (Process Manager để giữ Server chạy 24/7)
echo "⚙️ Đang cài đặt PM2..."
npm install -g pm2

echo "✅ CÀI ĐẶT HOÀN TẤT!"

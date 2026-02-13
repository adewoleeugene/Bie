#!/bin/bash

# ChristBase Setup Script
# Run this after setting up your database and environment variables

echo "🚀 ChristBase Setup Script"
echo "=========================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "📝 Please copy .env.example to .env and fill in your values:"
    echo "   cp .env.example .env"
    echo ""
    exit 1
fi

echo "✅ .env file found"
echo ""

# Generate Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "❌ Failed to generate Prisma Client"
    exit 1
fi
echo "✅ Prisma Client generated"
echo ""

# Run migrations
echo "🗄️  Running database migrations..."
npx prisma migrate dev --name init
if [ $? -ne 0 ]; then
    echo "❌ Failed to run migrations"
    echo "💡 Make sure your DATABASE_URL in .env is correct and PostgreSQL is running"
    exit 1
fi
echo "✅ Migrations complete"
echo ""

# Seed database
echo "🌱 Seeding database..."
npx prisma db seed
if [ $? -ne 0 ]; then
    echo "❌ Failed to seed database"
    exit 1
fi
echo "✅ Database seeded"
echo ""

echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Make sure you've configured Google OAuth credentials in .env"
echo "2. Run: npm run dev"
echo "3. Open: http://localhost:3000"
echo "4. Sign in with Google"
echo ""
echo "Happy coding! 🚀"

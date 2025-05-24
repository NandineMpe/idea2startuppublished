# IdeaToStartup Dashboard

A comprehensive platform for entrepreneurs to analyze business ideas, generate pitch decks, and manage their startup journey.

## 🚀 Getting Started

This project uses **pnpm** as the package manager for better performance and disk efficiency.

### Prerequisites

- Node.js 18+ 
- pnpm 8+

### Installation

\`\`\`bash
# Install pnpm globally if you haven't already
npm install -g pnpm

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your actual values

# Run the development server
pnpm dev
\`\`\`

### Available Scripts

\`\`\`bash
# Development
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server

# Code Quality
pnpm lint         # Run ESLint
pnpm type-check   # Run TypeScript type checking

# Utilities
pnpm clean        # Clean build artifacts and node_modules
\`\`\`

### Package Management with pnpm

\`\`\`bash
# Add dependencies
pnpm add <package-name>
pnpm add -D <package-name>  # Dev dependencies

# Remove dependencies
pnpm remove <package-name>

# Update dependencies
pnpm update

# Install from lockfile
pnpm install --frozen-lockfile
\`\`\`

## 🗄️ Database Setup

This project uses Supabase for authentication and data storage.

1. Create a Supabase project
2. Run the SQL migrations in the `/sql` directory
3. Add your Supabase credentials to `.env.local`

## 🔐 Authentication

- Email/Password authentication
- Google OAuth integration
- Persistent sessions with Supabase
- Protected routes with middleware

## 🛠️ Tech Stack

- **Framework**: Next.js 14
- **Database**: Supabase (PostgreSQL)
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Package Manager**: pnpm
- **Language**: TypeScript

## 📁 Project Structure

\`\`\`
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   └── dashboard/         # Protected dashboard pages
├── components/            # Reusable components
│   ├── ui/               # Base UI components
│   └── dashboard/        # Dashboard-specific components
├── lib/                  # Utility functions and configurations
├── types/                # TypeScript type definitions
└── sql/                  # Database migrations
\`\`\`

## 🌟 Features

- **Business Idea Analysis**: AI-powered analysis of business concepts
- **Pitch Deck Generation**: Automated pitch deck creation
- **Market Insights**: Comprehensive market analysis
- **Competitor Analysis**: Detailed competitor research
- **User Dashboard**: Personalized startup journey tracking
- **Authentication**: Secure user management
- **Responsive Design**: Mobile-first approach

## 🚀 Deployment

This project is optimized for deployment on Vercel:

\`\`\`bash
# Deploy to Vercel
pnpm build
vercel --prod
\`\`\`

## 📝 Environment Variables

\`\`\`env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# AI Services
OPENAI_API_KEY=your-openai-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key
\`\`\`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.
\`\`\`

Create a .env.example file:

```plaintext file=".env.example"
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-key-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# AI Service APIs
OPENAI_API_KEY=your-openai-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key
GOOGLE_GEMINI_API_KEY=your-gemini-api-key
PERPLEXITY_API_KEY=your-perplexity-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Database (if using external PostgreSQL)
POSTGRES_URL=your-postgres-connection-string

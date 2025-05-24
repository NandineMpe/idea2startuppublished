# IdeaToStartup Dashboard

A comprehensive platform for entrepreneurs to analyze business ideas, generate pitch decks, and manage their startup journey.

## 🚀 Features

- **Business Idea Analysis** - AI-powered analysis of your business concepts
- **Pitch Deck Generation** - Create professional pitch decks automatically
- **Market Insights** - Comprehensive market research and competitor analysis
- **User Authentication** - Secure login with email/password and Google OAuth
- **Database Integration** - Persistent user data with Supabase

## 🛠️ Tech Stack

- **Framework**: Next.js 14 with App Router
- **Authentication**: NextAuth.js v4
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS + shadcn/ui
- **Package Manager**: pnpm
- **AI Integration**: OpenAI, Deepseek, Google Gemini
- **Deployment**: Vercel

## 📦 Installation

1. **Clone the repository**
   \`\`\`bash
   git clone <repository-url>
   cd ideatostartup_dashboard
   \`\`\`

2. **Install dependencies with pnpm**
   \`\`\`bash
   # Install pnpm globally if you haven't already
   npm install -g pnpm
   
   # Install project dependencies
   pnpm install
   \`\`\`

3. **Set up environment variables**
   \`\`\`bash
   # Generate NextAuth secret
   npx auth secret
   
   # This will automatically create/update your .env.local file with NEXTAUTH_SECRET
   \`\`\`

4. **Configure additional environment variables**
   
   Add these to your `.env.local` file:
   \`\`\`env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # Google OAuth
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   
   # AI APIs
   OPENAI_API_KEY=your_openai_api_key
   DEEPSEEK_API_KEY=your_deepseek_api_key
   GOOGLE_GEMINI_API_KEY=your_google_gemini_api_key
   \`\`\`

5. **Set up the database**
   
   The Supabase tables will be created automatically when you first run the application.

6. **Start the development server**
   \`\`\`bash
   pnpm dev
   \`\`\`

## 🔧 Development Commands

\`\`\`bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint

# Type checking
pnpm type-check

# Clean build artifacts
pnpm clean
\`\`\`

## 🔐 Authentication Setup

### NextAuth Secret Generation
\`\`\`bash
# Generate a secure random secret for NextAuth
npx auth secret
\`\`\`

This command will:
- Generate a cryptographically secure random string
- Automatically add it to your `.env.local` file as `NEXTAUTH_SECRET`
- Ensure your authentication is properly secured

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)

## 🗄️ Database Schema

The application uses Supabase with the following tables:

- **users** - User profiles and authentication data
- **user_sessions** - Session management
- **accounts** - OAuth provider account linking

## 🚀 Deployment

### Vercel Deployment
1. **Connect your repository to Vercel**
2. **Set environment variables in Vercel dashboard**
3. **Deploy**
   \`\`\`bash
   vercel deploy
   \`\`\`

### Environment Variables for Production
Make sure to set all environment variables in your Vercel project settings:
- `NEXTAUTH_SECRET` (generated with `npx auth secret`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- All AI API keys

## 📱 Usage

1. **Sign Up/Sign In** - Create an account or sign in with Google
2. **Analyze Ideas** - Use the business idea analyzer to evaluate concepts
3. **Generate Pitches** - Create professional pitch decks
4. **Explore Market** - Research market insights and competitors
5. **Track Progress** - Monitor your startup journey

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

If you encounter any issues:
1. Check the [documentation](./docs)
2. Search existing [issues](./issues)
3. Create a new issue with detailed information

---

Built with ❤️ for entrepreneurs and startup founders.
\`\`\`

Let's also create a simple setup script to help with the initial configuration:

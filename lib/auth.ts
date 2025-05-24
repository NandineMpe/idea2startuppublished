// This is a temporary stub file to maintain backward compatibility
// during the migration from NextAuth to Clerk

export const authOptions = {
  // Empty stub to satisfy imports
  providers: [],
  callbacks: {},
  pages: {
    signIn: "/auth/signin",
  },
}

// Add any other exports that might be referenced elsewhere
export const getServerSession = async () => {
  return null
}

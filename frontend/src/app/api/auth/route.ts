import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import axios from 'axios';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email:    { label: 'Email',      type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        try {
          const { data } = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
            { email: credentials?.email, password: credentials?.password },
          );
          if (data.access_token) {
            return {
              id:           String(data.usuario.id),
              name:         `${data.usuario.nombre} ${data.usuario.apellido}`,
              email:        data.usuario.email,
              role:         data.usuario.rol,
              access_token: data.access_token,
            };
          }
          return null;
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.access_token = (user as any).access_token;
        token.role         = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).access_token = token.access_token;
      (session.user as any).role    = token.role;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
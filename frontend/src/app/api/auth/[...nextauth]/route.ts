import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
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
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        try {
          const nombreCompleto = (profile as any)?.name || user.name || '';
          const [nombre, ...resto] = nombreCompleto.split(' ');
          const apellido = resto.join(' ') || '-';

          const { data } = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/google`,
            {
              email: user.email,
              nombre: nombre || 'Usuario',
              apellido,
              google_id: account.providerAccountId,
            },
          );

          // Guardamos el JWT propio y el rol dentro del objeto user,
          // para que el callback jwt() los tome igual que con Credentials.
          (user as any).access_token = data.access_token;
          (user as any).role         = data.usuario.rol;
          return true;
        } catch (err) {
          console.error('Error en login con Google:', err);
          return false;
        }
      }
      return true;
    },
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
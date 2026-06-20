import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "./db";
import User from "@/models/User";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        await connectToDatabase();

        const user = await User.findOne({ email: credentials.email.toLowerCase() });

        if (!user || !user.password) {
          throw new Error("No user found with this email");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          throw new Error("Invalid password");
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          flatId: user.flatId?.toString() || null,
          role: user.role,
          capabilities: user.capabilities,
          points: user.points,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.flatId = (user as any).flatId;
        token.role = (user as any).role;
        token.capabilities = (user as any).capabilities;
        token.points = (user as any).points;
      }
      
      // Allow updating session dynamically (e.g. after joining a flat or changing capabilities)
      if (trigger === "update" && session) {
        if (session.flatId !== undefined) token.flatId = session.flatId;
        if (session.role !== undefined) token.role = session.role;
        if (session.capabilities !== undefined) token.capabilities = session.capabilities;
        if (session.points !== undefined) token.points = session.points;
        if (session.name !== undefined) token.name = session.name;
      }

      // Periodically refresh points/flatId from database (only when a real user is signed in)
      if (token.id) {
        try {
          await connectToDatabase();
          const dbUser = await User.findById(token.id);
          if (dbUser) {
            token.flatId = dbUser.flatId?.toString() || null;
            token.role = dbUser.role;
            token.capabilities = dbUser.capabilities;
            token.points = dbUser.points;
            token.name = dbUser.name;
          }
        } catch (err) {
          console.error("JWT Session refresh error", err);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).flatId = token.flatId;
        (session.user as any).role = token.role;
        (session.user as any).capabilities = token.capabilities;
        (session.user as any).points = token.points;
        session.user.name = token.name;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

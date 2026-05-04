import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

// jose requires the secret to be encoded
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-hospital-key');

export const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string) => {
  return await bcrypt.compare(password, hash);
};

// Note: signToken is now an async function
export const signToken = async (payload: any) => {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
};

// Note: verifyToken is now an async function
export const verifyToken = async (token: string) => {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch (e) {
    return null;
  }
};
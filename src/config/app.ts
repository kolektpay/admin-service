import dotenv from 'dotenv';

dotenv.config();



export const config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    jwtSecret: process.env.JWT_SECRET || 'yoursecretkeyhere',
    jwtExpiresIn: "7d",
    supportEmail: process.env.SUPPORT_EMAIL || 'kolektpay@gmail.com'
};

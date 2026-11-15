import dotenv from 'dotenv';

dotenv.config();

function parseTrustProxy(value: string | undefined): number {
    if (value === undefined || value.trim() === '') return 1;
    const hops = Number(value);
    if (!Number.isInteger(hops) || hops < 0) {
        throw new Error(`TRUST_PROXY must be a whole number of proxy hops, got "${value}"`);
    }
    return hops;
}



export const config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    jwtSecret: process.env.JWT_SECRET || 'yoursecretkeyhere',
    jwtExpiresIn: "7d",
    supportEmail: process.env.SUPPORT_EMAIL || 'kolektpay@gmail.com',
    // How many reverse proxies (load balancer, ingress, ...) sit in front of
    // the app. Express only believes X-Forwarded-For for that many hops, so
    // clients cannot fake their IP in audit logs. 0 when the app is reached
    // directly. Defaults to 1, the usual single load balancer.
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
};

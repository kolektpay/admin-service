import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    // Correlation id: reuse the caller's x-request-id or generate one
    const incomingId = req.headers['x-request-id'];
    req.requestId = typeof incomingId === 'string' && incomingId.length <= 100 ? incomingId : randomUUID();
    res.setHeader('x-request-id', req.requestId);

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(
            `[${new Date().toISOString()}] [${req.requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`
        );
    });

    next();
};

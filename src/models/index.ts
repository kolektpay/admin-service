// This folder is for additional model utilities
// Prisma handles the main model definitions in prisma/schema.prisma

/**
 * Example: Model transformation utilities
 * You can add functions here to transform Prisma models
 * or add additional model-related logic
 */

export const excludeFields = <T, K extends keyof T>(
    model: T,
    keys: K[]
): Omit<T, K> => {
    const result = { ...model };
    for (const key of keys) {
        delete result[key];
    }
    return result;
};

/**
 * In-memory stand-in for the Prisma client. Interactive transactions run
 * the callback against the same mock, so `tx.*` and `prisma.*` share spies.
 */
export const createPrismaMock = () => {
  const mock = {
    students: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      createManyAndReturn: jest.fn(),
    },
    subclasses: { findMany: jest.fn() },
    guardians: { findMany: jest.fn() },
    guardianHasStudents: { createMany: jest.fn() },
    passwordHistory: { createMany: jest.fn() },
    notifications: { create: jest.fn(), createMany: jest.fn() },
    roleHasPermission: { findFirst: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
    role: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    permissions: { findMany: jest.fn(), count: jest.fn() },
    users: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    userHasRole: { updateMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    userTokens: { updateMany: jest.fn() },
    auditLogs: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  const runTransaction = (arg: unknown) =>
    typeof arg === "function" ? arg(mock) : Promise.all(arg as Promise<unknown>[]);
  mock.$transaction.mockImplementation(runTransaction);

  return mock;
};

export type PrismaMock = ReturnType<typeof createPrismaMock>;

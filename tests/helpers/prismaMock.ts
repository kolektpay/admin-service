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
    notifications: { createMany: jest.fn() },
    roleHasPermission: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };

  const runTransaction = (arg: unknown) =>
    typeof arg === "function" ? arg(mock) : Promise.all(arg as Promise<unknown>[]);
  mock.$transaction.mockImplementation(runTransaction);

  return mock;
};

export type PrismaMock = ReturnType<typeof createPrismaMock>;

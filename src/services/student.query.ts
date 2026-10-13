import { Prisma } from "@prisma/client";

/**
 * Student fields that are safe to return to staff. Passwords, login
 * counters, block reasons and wallet flags are deliberately excluded.
 */
export const studentPublicSelect = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  registrationNumber: true,
  email: true,
  phoneNumber: true,
  gender: true,
  age: true,
  dateOfBirth: true,
  address: true,
  avatar: true,
  status: true,
  subclassId: true,
  subclass: {
    select: {
      id: true,
      name: true,
      class: { select: { id: true, name: true } },
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StudentsSelect;

export type StudentPublicRecord = Prisma.StudentsGetPayload<{
  select: typeof studentPublicSelect;
}>;

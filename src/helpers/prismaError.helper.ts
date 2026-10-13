import { Prisma } from "@prisma/client";

export const isPrismaErrorCode = (
  error: unknown,
  code: "P2002" | "P2003" | "P2025",
): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

/**
 * Returns which field a unique-constraint (P2002) error refers to.
 * `fieldAliases` maps each field to the names it may appear under
 * (column or model field name); list the most specific fields first.
 * The metadata shape differs between the native engine (meta.target)
 * and driver adapters (meta.driverAdapterError), so it is searched as text.
 */
export const getUniqueViolationField = (
  error: Prisma.PrismaClientKnownRequestError,
  fieldAliases: Record<string, string[]>,
): string | undefined => {
  const metadata = JSON.stringify(error.meta ?? {}) + error.message;
  return Object.keys(fieldAliases).find((field) =>
    fieldAliases[field].some((alias) => metadata.includes(alias)),
  );
};

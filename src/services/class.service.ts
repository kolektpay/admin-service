import { Prisma } from "@prisma/client";

import prisma from "../config/database";
import { isPrismaErrorCode } from "../helpers/prismaError.helper";
import { AdminActor } from "../interfaces/admin.interfaces";
import { AppError } from "../middleware/error.middleware";
import { AuditModel } from "../models/audit.model";
import {
  CreateSubclassInput,
  ListClassesQuery,
  ListSubclassesQuery,
  UpdateSubclassInput,
} from "../validations/classManagement.schema";

// ==========================================
// Shared helpers
// ==========================================

const activeStudentWhere = { deletedAt: null } satisfies Prisma.StudentsWhereInput;

const studentsCountSelect = {
  _count: { select: { students: { where: activeStudentWhere } } },
} satisfies Prisma.SubclassesSelect;

const nestedSubclassSelect = {
  id: true,
  name: true,
  ...studentsCountSelect,
} satisfies Prisma.SubclassesSelect;

// Classes are global; only the business's own subclasses are nested under them
const classSelect = (businessId: bigint) =>
  ({
    id: true,
    name: true,
    category: true,
    description: true,
    createdAt: true,
    updatedAt: true,
    subclasses: {
      where: { businessId },
      select: nestedSubclassSelect,
      orderBy: [{ name: "asc" }, { id: "asc" }],
    },
  }) satisfies Prisma.ClassesSelect;

const subclassSelect = {
  id: true,
  name: true,
  classId: true,
  class: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
  ...studentsCountSelect,
} satisfies Prisma.SubclassesSelect;

type NestedSubclassRow = Prisma.SubclassesGetPayload<{ select: typeof nestedSubclassSelect }>;
type ClassRow = Prisma.ClassesGetPayload<{ select: ReturnType<typeof classSelect> }>;
type SubclassRow = Prisma.SubclassesGetPayload<{ select: typeof subclassSelect }>;

const withStudentsCount = <T extends NestedSubclassRow | SubclassRow>({
  _count,
  ...subclass
}: T) => ({
  ...(subclass as Omit<T, "_count">),
  studentsCount: _count.students,
});

const toClassRecord = ({ subclasses, ...rest }: ClassRow) => {
  const records = subclasses.map(withStudentsCount);
  return {
    ...rest,
    studentsCount: records.reduce((total, s) => total + s.studentsCount, 0),
    subclasses: records,
  };
};

const toSubclassRecord = (row: SubclassRow) => withStudentsCount(row);

export type ClassRecord = ReturnType<typeof toClassRecord>;
export type SubclassRecord = ReturnType<typeof toSubclassRecord>;

export const paginate = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

const classNotFoundError = (field?: string) =>
  new AppError(
    "Class not found",
    404,
    "CLASS_NOT_FOUND",
    field ? [{ field, message: "Class does not exist" }] : undefined,
  );

export const subclassNotFoundError = (field?: string) =>
  new AppError(
    "Subclass not found",
    404,
    "SUBCLASS_NOT_FOUND",
    field ? [{ field, message: "Subclass does not exist" }] : undefined,
  );

const subclassNameTakenError = () =>
  new AppError(
    "This class already has a subclass with this name",
    409,
    "SUBCLASS_NAME_TAKEN",
    [{ field: "name", message: "This class already has a subclass with this name" }],
  );

// Soft-deleted students still hold their subclass, so they count as usage
const subclassInUseError = (students = 0, paymentItems = 0) => {
  const uses = [
    ...(students ? [`${students} student record(s)`] : []),
    ...(paymentItems ? [`${paymentItems} payment item(s)`] : []),
  ];
  return new AppError(
    uses.length
      ? `This subclass is used by ${uses.join(" and ")}. Move or remove them before deleting it.`
      : "This subclass is in use. Move or remove its students and payment items before deleting it.",
    409,
    "SUBCLASS_IN_USE",
  );
};

// Names only clash with the business's own subclasses of the class
const findSubclassNameConflict = (
  classId: bigint,
  businessId: bigint,
  name: string,
  excludeSubclassId?: bigint,
) =>
  prisma.subclasses.findFirst({
    where: {
      classId,
      businessId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeSubclassId !== undefined && { id: { not: excludeSubclassId } }),
    },
    select: { id: true },
  });

const findClass = (classId: bigint) =>
  prisma.classes.findUnique({
    where: { id: classId },
    select: { id: true, name: true },
  });

/** Subclasses belong to the business that created them. */
export const ownSubclassWhere = (
  subclassId: bigint,
  businessId: bigint,
): Prisma.SubclassesWhereInput => ({ id: subclassId, businessId });

/** Whether the class exists. Classes are global, so every business can use any of them. */
export const classExists = async (classId: bigint): Promise<boolean> =>
  (await findClass(classId)) !== null;

// ==========================================
// Classes
// ==========================================

/**
 * List the global classes, each with the business's own subclasses and
 * student counts.
 */
export const listClasses = async (businessId: bigint, query: ListClassesQuery) => {
  const { page, limit, search, category, hasSubclasses } = query;

  const where: Prisma.ClassesWhereInput = {
    ...(category && { category }),
    // The business's subclass names match too, so "1A" finds JSS 1 in the classes table
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        {
          subclasses: {
            some: { businessId, name: { contains: search, mode: "insensitive" } },
          },
        },
      ],
    }),
    ...(hasSubclasses !== undefined && {
      subclasses: hasSubclasses ? { some: { businessId } } : { none: { businessId } },
    }),
  };

  const [classes, total] = await Promise.all([
    prisma.classes.findMany({
      where,
      select: classSelect(businessId),
      // Insertion order keeps classes in the order they were seeded (JSS 1 → SS 3)
      orderBy: { id: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.classes.count({ where }),
  ]);

  return { classes: classes.map(toClassRecord), pagination: paginate(page, limit, total) };
};

export const getClass = async (classId: bigint, businessId: bigint): Promise<ClassRecord> => {
  const found = await prisma.classes.findUnique({
    where: { id: classId },
    select: classSelect(businessId),
  });
  if (!found) throw classNotFoundError();
  return toClassRecord(found);
};

// ==========================================
// Subclasses
// ==========================================

/** List the business's subclasses, optionally within one class. */
export const listSubclasses = async (businessId: bigint, query: ListSubclassesQuery) => {
  const { page, limit, classId, search } = query;

  const where: Prisma.SubclassesWhereInput = {
    businessId,
    ...(classId !== undefined && { classId }),
    ...(search && { name: { contains: search, mode: "insensitive" } }),
  };

  const [subclasses, total] = await Promise.all([
    prisma.subclasses.findMany({
      where,
      select: subclassSelect,
      orderBy: [{ classId: "asc" }, { name: "asc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.subclasses.count({ where }),
  ]);

  return {
    subclasses: subclasses.map(toSubclassRecord),
    pagination: paginate(page, limit, total),
  };
};

export const getSubclass = async (
  subclassId: bigint,
  businessId: bigint,
): Promise<SubclassRecord> => {
  const found = await prisma.subclasses.findFirst({
    where: ownSubclassWhere(subclassId, businessId),
    select: subclassSelect,
  });
  if (!found) throw subclassNotFoundError();
  return toSubclassRecord(found);
};

export const createSubclass = async (
  input: CreateSubclassInput,
  actor: AdminActor,
): Promise<SubclassRecord> => {
  const parent = await findClass(input.classId);
  if (!parent) throw classNotFoundError("classId");

  if (await findSubclassNameConflict(input.classId, actor.businessId, input.name)) {
    throw subclassNameTakenError();
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.subclasses.create({
        data: { classId: input.classId, businessId: actor.businessId, name: input.name },
        select: subclassSelect,
      });
      await AuditModel.logClassChange(
        actor,
        `subclass_created: ${created.id} (${created.name}) in class ${parent.id} (${parent.name})`,
        tx,
      );
      return toSubclassRecord(created);
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) throw subclassNameTakenError();
    throw error;
  }
};

/**
 * Rename a subclass and/or move it under another class.
 * Its students move with it. A subclass that payment items are targeted at
 * cannot change class, since those items belong to the current class.
 */
export const updateSubclass = async (
  subclassId: bigint,
  input: UpdateSubclassInput,
  actor: AdminActor,
): Promise<SubclassRecord> => {
  const existing = await prisma.subclasses.findFirst({
    where: ownSubclassWhere(subclassId, actor.businessId),
    select: {
      id: true,
      name: true,
      classId: true,
      _count: { select: { paymentItems: true } },
    },
  });
  if (!existing) throw subclassNotFoundError();

  const targetClassId = input.classId ?? existing.classId;
  const changingClass = targetClassId !== existing.classId;

  if (changingClass) {
    if (!(await classExists(targetClassId))) {
      throw classNotFoundError("classId");
    }
    if (existing._count.paymentItems > 0) {
      throw new AppError(
        `This subclass is targeted by ${existing._count.paymentItems} payment item(s) of its current class, so it cannot be moved to another class.`,
        409,
        "SUBCLASS_HAS_PAYMENT_ITEMS",
        [{ field: "classId", message: "Subclass is targeted by payment items" }],
      );
    }
  }

  const targetName = input.name ?? existing.name;
  if (
    (changingClass || input.name !== undefined) &&
    (await findSubclassNameConflict(targetClassId, actor.businessId, targetName, subclassId))
  ) {
    throw subclassNameTakenError();
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // A move is re-checked in the write so a payment item linked after the
      // check above blocks it instead of ending up pointing at another class
      const { count } = await tx.subclasses.updateMany({
        where: { id: subclassId, ...(changingClass && { paymentItems: { none: {} } }) },
        data: { name: input.name, classId: input.classId },
      });
      if (count === 0) {
        throw new AppError(
          "This subclass is targeted by payment items of its current class, so it cannot be moved to another class.",
          409,
          "SUBCLASS_HAS_PAYMENT_ITEMS",
        );
      }
      const updated = await tx.subclasses.findUniqueOrThrow({
        where: { id: subclassId },
        select: subclassSelect,
      });
      const changes = [
        ...(updated.name !== existing.name ? [`renamed from ${existing.name}`] : []),
        ...(changingClass ? [`moved from class ${existing.classId} to ${targetClassId}`] : []),
      ];
      await AuditModel.logClassChange(
        actor,
        `subclass_updated: ${subclassId} (${updated.name})${changes.length ? `, ${changes.join(", ")}` : ""}`,
        tx,
      );
      return toSubclassRecord(updated);
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) throw subclassNameTakenError();
    // The target class was deleted between the check and the write
    if (isPrismaErrorCode(error, "P2003")) throw classNotFoundError("classId");
    throw error;
  }
};

/**
 * Delete a subclass. Refused while any student (including a soft-deleted one)
 * is in it or any payment item is targeted at it.
 */
export const deleteSubclass = async (subclassId: bigint, actor: AdminActor): Promise<void> => {
  const existing = await prisma.subclasses.findFirst({
    where: ownSubclassWhere(subclassId, actor.businessId),
    select: {
      id: true,
      name: true,
      classId: true,
      _count: { select: { students: true, paymentItems: true } },
    },
  });
  if (!existing) throw subclassNotFoundError();

  const { students, paymentItems } = existing._count;
  if (students > 0 || paymentItems > 0) throw subclassInUseError(students, paymentItems);

  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.subclasses.deleteMany({
        where: {
          id: subclassId,
          students: { none: {} },
          paymentItems: { none: {} },
        },
      });
      if (count === 0) throw subclassInUseError();

      await AuditModel.logClassChange(
        actor,
        `subclass_deleted: ${subclassId} (${existing.name}) from class ${existing.classId}`,
        tx,
      );
    });
  } catch (error) {
    // A student added after the checks above is protected by the foreign key
    if (isPrismaErrorCode(error, "P2003")) throw subclassInUseError();
    throw error;
  }
};

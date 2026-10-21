import { Prisma } from "@prisma/client";

import prisma from "../config/database";
import { isPrismaErrorCode } from "../helpers/prismaError.helper";
import { AdminActor } from "../interfaces/admin.interfaces";
import { AppError } from "../middleware/error.middleware";
import { AuditModel } from "../models/audit.model";
import {
  CreateClassInput,
  CreateSubclassInput,
  ListClassesQuery,
  ListSubclassesQuery,
  UpdateClassInput,
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

const classSelect = {
  id: true,
  name: true,
  category: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  subclasses: { select: nestedSubclassSelect, orderBy: [{ name: "asc" }, { id: "asc" }] },
} satisfies Prisma.ClassesSelect;

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
type ClassRow = Prisma.ClassesGetPayload<{ select: typeof classSelect }>;
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

const classNameTakenError = () =>
  new AppError("A class with this name already exists", 409, "CLASS_NAME_TAKEN", [
    { field: "name", message: "A class with this name already exists" },
  ]);

const subclassNameTakenError = () =>
  new AppError(
    "This class already has a subclass with this name",
    409,
    "SUBCLASS_NAME_TAKEN",
    [{ field: "name", message: "This class already has a subclass with this name" }],
  );

// Soft-deleted students still hold their subclass, so they count as usage
const inUseMessage = (what: string, students: number, paymentItems: number) => {
  const uses = [
    ...(students ? [`${students} student record(s)`] : []),
    ...(paymentItems ? [`${paymentItems} payment item(s)`] : []),
  ];
  return uses.length
    ? `This ${what} is used by ${uses.join(" and ")}. Move or remove them before deleting it.`
    : `This ${what} is in use. Move or remove its students and payment items before deleting it.`;
};

const classInUseError = (students = 0, paymentItems = 0) =>
  new AppError(inUseMessage("class", students, paymentItems), 409, "CLASS_IN_USE");

const subclassInUseError = (students = 0, paymentItems = 0) =>
  new AppError(inUseMessage("subclass", students, paymentItems), 409, "SUBCLASS_IN_USE");

const findClassNameConflict = (businessId: bigint, name: string, excludeClassId?: bigint) =>
  prisma.classes.findFirst({
    where: {
      businessId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeClassId !== undefined && { id: { not: excludeClassId } }),
    },
    select: { id: true },
  });

const findSubclassNameConflict = (classId: bigint, name: string, excludeSubclassId?: bigint) =>
  prisma.subclasses.findFirst({
    where: {
      classId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeSubclassId !== undefined && { id: { not: excludeSubclassId } }),
    },
    select: { id: true },
  });

const findOwnClass = (classId: bigint, businessId: bigint) =>
  prisma.classes.findFirst({
    where: { id: classId, businessId },
    select: { id: true, name: true },
  });

/** Subclasses are owned through their class's business. */
export const ownSubclassWhere = (
  subclassId: bigint,
  businessId: bigint,
): Prisma.SubclassesWhereInput => ({ id: subclassId, class: { businessId } });

/** Whether the class exists and belongs to the business. */
export const classBelongsToBusiness = async (
  classId: bigint,
  businessId: bigint,
): Promise<boolean> => (await findOwnClass(classId, businessId)) !== null;

// ==========================================
// Classes
// ==========================================

/** List the business's classes, each with its subclasses and student counts. */
export const listClasses = async (businessId: bigint, query: ListClassesQuery) => {
  const { page, limit, search, category, hasSubclasses } = query;

  const where: Prisma.ClassesWhereInput = {
    businessId,
    ...(category && { category }),
    ...(search && { name: { contains: search, mode: "insensitive" } }),
    ...(hasSubclasses !== undefined && {
      subclasses: hasSubclasses ? { some: {} } : { none: {} },
    }),
  };

  const [classes, total] = await Promise.all([
    prisma.classes.findMany({
      where,
      select: classSelect,
      // Insertion order keeps classes in the order schools set them up (JSS 1 → SS 3)
      orderBy: { id: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.classes.count({ where }),
  ]);

  return { classes: classes.map(toClassRecord), pagination: paginate(page, limit, total) };
};

export const getClass = async (classId: bigint, businessId: bigint): Promise<ClassRecord> => {
  const found = await prisma.classes.findFirst({
    where: { id: classId, businessId },
    select: classSelect,
  });
  if (!found) throw classNotFoundError();
  return toClassRecord(found);
};

/**
 * Create a class for the actor's business. Subclasses are created only when
 * listed. Names must be unique (case-insensitively) within the business.
 */
export const createClass = async (
  input: CreateClassInput,
  actor: AdminActor,
): Promise<ClassRecord> => {
  if (await findClassNameConflict(actor.businessId, input.name)) throw classNameTakenError();

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.classes.create({
        data: {
          businessId: actor.businessId,
          name: input.name,
          category: input.category,
          description: input.description || null,
          ...(input.subclasses.length && {
            subclasses: {
              createMany: { data: input.subclasses.map((name) => ({ name })) },
            },
          }),
        },
        select: classSelect,
      });
      await AuditModel.logClassChange(
        actor,
        `class_created: ${created.id} (${created.name})`,
        tx,
      );
      return toClassRecord(created);
    });
  } catch (error) {
    // Lost a race with a concurrent request creating the same name
    if (isPrismaErrorCode(error, "P2002")) throw classNameTakenError();
    throw error;
  }
};

export const updateClass = async (
  classId: bigint,
  input: UpdateClassInput,
  actor: AdminActor,
): Promise<ClassRecord> => {
  const existing = await findOwnClass(classId, actor.businessId);
  if (!existing) throw classNotFoundError();

  if (input.name && (await findClassNameConflict(actor.businessId, input.name, classId))) {
    throw classNameTakenError();
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.classes.update({
        where: { id: classId },
        data: {
          name: input.name,
          category: input.category,
          description: input.description === "" ? null : input.description,
        },
        select: classSelect,
      });
      const renamed = updated.name !== existing.name ? `, renamed from ${existing.name}` : "";
      await AuditModel.logClassChange(
        actor,
        `class_updated: ${classId} (${updated.name})${renamed}`,
        tx,
      );
      return toClassRecord(updated);
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) throw classNameTakenError();
    throw error;
  }
};

/**
 * Delete a class and its subclasses. Refused while any student (including a
 * soft-deleted one) is in one of its subclasses or any payment item uses it.
 */
export const deleteClass = async (classId: bigint, actor: AdminActor): Promise<void> => {
  const existing = await prisma.classes.findFirst({
    where: { id: classId, businessId: actor.businessId },
    select: {
      id: true,
      name: true,
      _count: { select: { paymentItems: true } },
    },
  });
  if (!existing) throw classNotFoundError();

  const students = await prisma.students.count({ where: { subclass: { classId } } });
  if (students > 0 || existing._count.paymentItems > 0) {
    throw classInUseError(students, existing._count.paymentItems);
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Re-checked in the delete itself so a student or payment item added
      // after the check above blocks the delete instead of racing it
      const { count } = await tx.classes.deleteMany({
        where: {
          id: classId,
          businessId: actor.businessId,
          paymentItems: { none: {} },
          subclasses: { none: { students: { some: {} } } },
        },
      });
      if (count === 0) throw classInUseError();

      await AuditModel.logClassChange(
        actor,
        `class_deleted: ${classId} (${existing.name})`,
        tx,
      );
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2003")) throw classInUseError();
    throw error;
  }
};

// ==========================================
// Subclasses
// ==========================================

/** List the business's subclasses, optionally within one class. */
export const listSubclasses = async (businessId: bigint, query: ListSubclassesQuery) => {
  const { page, limit, classId, search } = query;

  const where: Prisma.SubclassesWhereInput = {
    class: { businessId },
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
  const parent = await findOwnClass(input.classId, actor.businessId);
  if (!parent) throw classNotFoundError("classId");

  if (await findSubclassNameConflict(input.classId, input.name)) throw subclassNameTakenError();

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.subclasses.create({
        data: { classId: input.classId, name: input.name },
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
 * Rename a subclass and/or move it under another of the business's classes.
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
    if (!(await classBelongsToBusiness(targetClassId, actor.businessId))) {
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
    (await findSubclassNameConflict(targetClassId, targetName, subclassId))
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

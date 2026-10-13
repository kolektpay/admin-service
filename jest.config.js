/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
  clearMocks: true,
  collectCoverageFrom: [
    "src/validations/studentManagement.schema.ts",
    "src/services/admin.student.service.ts",
    "src/services/admin.student.bulk.service.ts",
    "src/controllers/admin/admin.student.controller.ts",
    "src/helpers/prismaError.helper.ts",
    "src/utils/asyncHandler.ts",
    "src/middleware/validation.middleware.ts",
  ],
};

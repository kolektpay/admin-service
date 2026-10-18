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
    "src/services/studentservice.service.ts",
    "src/controllers/student/student.controller.ts",
    "src/helpers/prismaError.helper.ts",
    "src/utils/asyncHandler.ts",
    "src/middleware/validation.middleware.ts",
    "src/validations/adminManagement.schema.ts",
    "src/validations/roleManagement.schema.ts",
    "src/services/admin.service.ts",
    "src/services/role.service.ts",
    "src/controllers/admin/*.ts",
  ],
};

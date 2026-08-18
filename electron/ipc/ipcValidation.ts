import { z } from "zod";
import type {
  HireCandidateParams,
  HrCreateParams,
  HrDeleteParams,
  HrEmploymentChangeParams,
  HrGetByIdParams,
  HrHireDateCorrectionParams,
  HrListParams,
  HrTerminationParams,
  HrUpdateParams,
  RecruitmentListParams,
  SaveCandidateParams,
  SaveVacancyParams,
} from "../../src/shared/types/hr";
import type {
  ChangeOwnPasswordParams,
  LoginParams,
  ResetAccessPasswordParams,
  SaveAccessRoleParams,
  SaveAccessUserParams,
} from "../../src/shared/types/access";

const scalarSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.undefined(),
]);
const recordSchema = z.record(z.string(), scalarSchema);
const positiveId = z.number().int().positive();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const entitySchema = z.enum([
  "enterprises",
  "departments",
  "positions",
  "employees",
  "employee_education",
  "employee_experience",
  "employment_history",
  "vacation_types",
  "vacations",
]);

const listSchema = z.object({
  entity: entitySchema,
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  search: z.string().max(500).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  orderBy: z.string().max(100).optional(),
  orderDirection: z.enum(["asc", "desc"]).optional(),
});

const vacancySkillSchema = z.object({
  id: positiveId.optional(),
  type: z.enum(["hard", "soft"]),
  name: z.string().max(200),
  requiredLevel: z.number().int(),
});

const candidateScoreSchema = z.object({
  vacancySkillId: positiveId,
  score: z.number().int(),
});

export const ipcValidation = {
  login(value: unknown): LoginParams {
    return z
      .object({ username: z.string().max(64), password: z.string().max(1000) })
      .parse(value);
  },
  changePassword(value: unknown): ChangeOwnPasswordParams {
    return z
      .object({
        currentPassword: z.string().max(1000),
        newPassword: z.string().max(1000),
      })
      .parse(value);
  },
  list(value: unknown): HrListParams {
    return listSchema.parse(value) as HrListParams;
  },
  getById(value: unknown): HrGetByIdParams {
    return z.object({ entity: entitySchema, id: positiveId }).parse(value);
  },
  create(value: unknown): HrCreateParams {
    return z.object({ entity: entitySchema, data: recordSchema }).parse(value);
  },
  update(value: unknown): HrUpdateParams {
    return z
      .object({ entity: entitySchema, id: positiveId, data: recordSchema })
      .parse(value);
  },
  remove(value: unknown): HrDeleteParams {
    return z.object({ entity: entitySchema, id: positiveId }).parse(value);
  },
  employmentChange(value: unknown): HrEmploymentChangeParams {
    return z
      .object({
        employeeId: positiveId,
        departmentId: positiveId,
        positionId: positiveId,
        salaryMode: z.enum(["keep", "custom"]),
        salary: z.number().nonnegative().optional(),
        effectiveAt: dateSchema,
        reason: z.string().min(1).max(2000),
      })
      .parse(value);
  },
  termination(value: unknown): HrTerminationParams {
    return z
      .object({
        employeeId: positiveId,
        effectiveAt: dateSchema,
        reason: z.string().min(1).max(2000),
      })
      .parse(value);
  },
  hireDateCorrection(value: unknown): HrHireDateCorrectionParams {
    return z
      .object({
        employeeId: positiveId,
        hireDate: dateSchema,
        reason: z.string().min(1).max(2000),
      })
      .parse(value);
  },
  recruitmentList(value: unknown): RecruitmentListParams {
    return z.object({ search: z.string().max(500).optional() }).parse(value ?? {});
  },
  saveVacancy(value: unknown): SaveVacancyParams {
    return z
      .object({
        id: positiveId.optional(),
        positionId: positiveId,
        status: z.enum(["draft", "open", "paused", "closed"]),
        employmentType: z.enum([
          "full_time",
          "part_time",
          "temporary",
          "internship",
        ]),
        openingsCount: z.number().int().positive(),
        skills: z.array(vacancySkillSchema).max(200),
      })
      .parse(value);
  },
  saveCandidate(value: unknown): SaveCandidateParams {
    return z
      .object({
        id: positiveId.optional(),
        vacancyId: positiveId,
        lastName: z.string().max(200),
        firstName: z.string().max(200),
        middleName: z.string().max(200).optional(),
        phone: z.string().max(100).optional(),
        email: z.string().max(320).optional(),
        status: z.enum([
          "new",
          "screening",
          "interview",
          "offer",
          "hired",
          "rejected",
        ]),
        source: z.string().max(500).optional(),
        skillScores: z.array(candidateScoreSchema).max(200),
      })
      .parse(value);
  },
  hireCandidate(value: unknown): HireCandidateParams {
    return z
      .object({
        candidateId: positiveId,
        hireDate: dateSchema,
        salary: z.number().nonnegative(),
        employeeNumber: z.string().max(100).optional(),
        contractNumber: z.string().max(200).optional(),
        contractDate: dateSchema.optional().or(z.literal("")),
        contractEndDate: dateSchema.optional().or(z.literal("")),
        probationEndDate: dateSchema.optional().or(z.literal("")),
        workplace: z.string().max(500).optional(),
      })
      .parse(value);
  },
  saveRole(value: unknown): SaveAccessRoleParams {
    return z
      .object({
        id: positiveId.optional(),
        name: z.string().max(100),
        description: z.string().max(1000).optional(),
        scopeType: z.enum(["global", "enterprise", "department", "self"]),
        permissionCodes: z.array(z.string().max(100)).max(200),
      })
      .parse(value);
  },
  saveUser(value: unknown): SaveAccessUserParams {
    return z
      .object({
        id: positiveId.optional(),
        employeeId: positiveId,
        username: z.string().max(64),
        status: z.enum(["active", "blocked"]),
        roleIds: z.array(positiveId).max(100),
        password: z.string().max(1000).optional(),
        mustChangePassword: z.boolean().optional(),
      })
      .parse(value);
  },
  resetPassword(value: unknown): ResetAccessPasswordParams {
    return z
      .object({
        userId: positiveId,
        password: z.string().max(1000),
        mustChangePassword: z.boolean().optional(),
      })
      .parse(value);
  },
  id(value: unknown): number {
    return positiveId.parse(value);
  },
  backupName(value: unknown): string {
    return z.string().min(1).max(300).parse(value);
  },
};

import { SetMetadata } from '@nestjs/common';
import { SystemRole, SchoolRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (SystemRole | SchoolRole | string)[]) =>
  SetMetadata(ROLES_KEY, roles);

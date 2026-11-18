import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { SystemRole } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<(string | SystemRole)[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('Bạn không có quyền truy cập tài nguyên này');
    }

    // Kiểm tra SystemRole
    if (user.role === SystemRole.SUPER_ADMIN) {
      return true; // Super Admin có toàn quyền
    }

    const hasSystemRole = requiredRoles.includes(user.role);
    if (hasSystemRole) {
      return true;
    }

    // Kiểm tra SchoolRole nếu có school context
    const req = context.switchToHttp().getRequest();
    const currentSchoolId = req.headers['x-school-id'] || req.params?.schoolId;
    if (currentSchoolId && user.school_memberships) {
      const membership = user.school_memberships.find(
        (m: any) => m.school_id === currentSchoolId,
      );
      if (membership && requiredRoles.includes(membership.role)) {
        return true;
      }
    }

    throw new ForbiddenException('Bạn không có quyền hạn cần thiết để thực hiện thao tác này');
  }
}

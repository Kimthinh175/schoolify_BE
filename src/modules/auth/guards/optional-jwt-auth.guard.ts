import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard xác thực JWT tùy chọn (Optional JWT):
 * - Nếu request có Cookie `access_token` hoặc Header `Authorization: Bearer <token>` hợp lệ -> gắn `req.user` đã xác thực.
 * - Nếu không có token hoặc token hết hạn/không hợp lệ -> trả về `null` (coi là Khách / Guest), không ném lỗi 401.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(_err: any, user: any): TUser {
    return (user || null) as TUser;
  }
}

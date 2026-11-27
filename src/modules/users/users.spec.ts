import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    studentProfile: {
      update: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      studentProfile: {
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    service = new UsersService(prisma as any);
  });

  it('should map student_profile fields to root object in formatUserItem', () => {
    const formatted = service.formatUserItem({
      id: 'u1',
      fullname: 'Nguyễn Văn A',
      email: 'a@schoolify.edu.vn',
      role: 'USER',
      avatar_url: 'https://img/a.png',
      student_profile: {
        grade_level: 'Lớp 12',
        school_name: 'THPT Chu Văn An',
        province: 'Hà Nội',
        bio: 'Mục tiêu 27 điểm',
        equipped_frame: 'GOLD',
        points: 50,
        exam_points: 9,
        active_package: 'FREE',
      },
    });

    expect(formatted.appRole).toBe('STUDENT');
    expect(formatted.school_name).toBe('THPT Chu Văn An');
    expect(formatted.schoolName).toBe('THPT Chu Văn An');
    expect(formatted.province).toBe('Hà Nội');
    expect(formatted.equipped_frame).toBe('GOLD');
    expect(formatted.exam_points).toBe(9);
    expect(formatted.points).toBe(50);
  });

  it('should filter users by status in findAll', async () => {
    prisma.user.findMany.mockResolvedValueOnce([]);
    prisma.user.count.mockResolvedValueOnce(0);

    await service.findAll({ status: 'false', limit: 20 });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: false }),
      }),
    );
  });

  it('should normalize numeric grade_level when updating user profile', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      role: 'USER',
      student_profile: { id: 'sp1' },
      teacher_profile: null,
    });
    prisma.studentProfile.update.mockResolvedValueOnce({ id: 'sp1' });
    prisma.user.update.mockResolvedValueOnce({
      id: 'u1',
      fullname: 'Học sinh A',
      role: 'USER',
      password_hash: 'secret',
      student_profile: {
        id: 'sp1',
        grade_level: 'Lớp 11',
        school_name: 'THPT A',
      },
    });

    const updated = await service.updateUser('u1', {
      grade_level: 11,
      school_name: 'THPT A',
    });

    expect(prisma.studentProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          grade_level: 'Lớp 11',
          school_name: 'THPT A',
        }),
      }),
    );
    expect(updated.grade_level).toBe('Lớp 11');
  });
});

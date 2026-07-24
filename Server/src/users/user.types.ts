import type { Patient } from '../../generated/prisma/client.ts';

export const userInclude = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  displayName: true,
  avatar: true,
  logo: true,
  altLogo: true,
  jobTitle: true,
  role: true,
  status: true,
  timezone: true,
  lastLoginAt: true,
  reminderActive: true,
  reminderChannel: true,
  phoneNumber: true,
  whatsappNumber: true,
  createdAt: true,
  updatedAt: true,
  bankName: true,
  accountNumber: true,
  nationalId: true,
  bankingKey: true,
  consentDocument: {
    select: {
      id: true,
      name: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

export interface PaginatedPatients {
  data: Patient[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

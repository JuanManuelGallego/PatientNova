import { Channel } from "./Reminder";

export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName: string
    avatar: string
    logo: string
    altLogo: string
    jobTitle: string
    role: AdminRole
    status: AdminStatus
    timezone: string
    lastPasswordChange?: string | null
    phoneNumber?: string | null
    whatsappNumber?: string | null
    reminderActive: boolean
    reminderChannel: Channel
    bankName?: string | null
    accountNumber?: string | null
    nationalId?: string | null
    bankingKey?: string | null
    consentDocument?: Document | null
    selfServeEnabled?: boolean
}

export type ManagedUser = Omit<User, "avatar" | "logo" | "altLogo" | "consentDocument" | "bankName" | "accountNumber" | "nationalId" | "bankingKey" | "selfServeEnabled"> & {
    isDeleted: boolean
    lastLoginAt: string | null
    createdAt: string
}

export interface Document {
    id: string
    name: string
    mimeType: string
    sizeBytes: string,
}

export enum AdminRole {
    VIEWER = 'VIEWER',
    ADMIN = 'ADMIN',
    SUPER_ADMIN = 'SUPER_ADMIN'
}

export const isSuperAdmin = (role?: AdminRole | null): boolean => role === AdminRole.SUPER_ADMIN;

/** ADMIN and SUPER_ADMIN: the roles that may write and see admin pages. */
export const isAdminRole = (role?: AdminRole | null): boolean =>
    role === AdminRole.ADMIN || role === AdminRole.SUPER_ADMIN;

export enum AdminStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    PENDING = 'PENDING'
}

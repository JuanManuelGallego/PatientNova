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
    phoneNumber?: string | null
    whatsappNumber?: string | null
    reminderActive: boolean
    reminderChannel: Channel
    bankName?: string | null
    accountNumber?: string | null
    nationalId?: string | null
    bankingKey?: string | null
    consentDocument?: Document | null
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

export enum AdminStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    SUSPENDED = 'SUSPENDED',
    PENDING = 'PENDING'
}

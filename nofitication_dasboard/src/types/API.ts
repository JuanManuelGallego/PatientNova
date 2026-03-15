import { Patient } from "./Patient";

export interface ApiResponse {
    success: boolean;
    data: {
        data: Patient[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
    timestamp: string;
}

export const API_BASE = "http://localhost:3001";

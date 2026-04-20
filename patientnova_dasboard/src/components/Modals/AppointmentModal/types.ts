import { AppointmentForm } from "@/src/types/Appointment";
import React from "react";

/** Handler factory type shared by LocationAndTimeStep and PaymentAndStatusStep. */
export type SetField = (field: keyof AppointmentForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;

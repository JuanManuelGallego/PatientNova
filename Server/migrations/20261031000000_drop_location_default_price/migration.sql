-- AppointmentLocation.defaultPrice was never used: an appointment's price comes from its type.
ALTER TABLE "appointment_locations" DROP COLUMN "defaultPrice";

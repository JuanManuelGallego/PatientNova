-- The booking form no longer asks for an optional phone: a request keeps only the contact that confirms the link
-- (email or verifiedPhone). The dropped column held encrypted, never-verified numbers.
ALTER TABLE "booking_requests" DROP COLUMN "phone";

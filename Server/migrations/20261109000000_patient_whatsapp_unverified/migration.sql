-- A number typed in the booking form is not an identity until the provider endorses it.
ALTER TABLE "patients" ADD COLUMN "whatsappUnverified" BOOLEAN NOT NULL DEFAULT false;

-- Reads only the hash column, never ciphertext. A provider who already chose WhatsApp for the patient endorsed the number.
UPDATE "patients"
SET "whatsappUnverified" = true
WHERE "source" = 'PORTAL'
  AND "whatsappHash" IS NOT NULL
  AND "reminderChannel" <> 'WHATSAPP';

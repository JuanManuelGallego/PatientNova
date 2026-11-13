ALTER TABLE "booking_requests" DROP CONSTRAINT booking_requests_no_hold_overlap;

ALTER TABLE "booking_requests"
  ADD CONSTRAINT booking_requests_no_hold_overlap
  EXCLUDE USING gist (
    "userId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE (status IN ('PENDING', 'UNCONFIRMED'));

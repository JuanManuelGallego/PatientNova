// WhatsApp Content Template SIDs (approved in Twilio/Meta). They are not secrets and are the same in
// every environment, so they live here rather than in env vars. Bulk-sendable templates are in
// bulk-template-config.ts.
export const WHATSAPP_TEMPLATES = {
  // Provider templates
  tomorrowAppointmentsReminderSid: 'HX29e5329d91b9450df77de4abd484c5eb',
  tomorrowAppointmentsReminder2Sid: 'HX01abebd06861cc3205c1b8f29f75b26f',
  tomorrowAppointmentsReminder3Sid: 'HXc2393a08cb77f7e3e03289d9ce9d256c',
  tomorrowAppointmentsReminder4Sid: 'HX9fd718251c9114776192e3f82f6cf365',
  tomorrowAppointmentsReminder5Sid: 'HXc5dbaa16dbf6e15fa4dd9ce44658b483',
  tomorrowAppointmentsReminder6Sid: 'HX211fa8ab08de917b43ca3198f9130d3c',
  reminderFailedSid: 'HX4400ab81d1ab58625eedb7169734d721',
  appointmentStatusUpdateSid: 'HX3c8c70461db0d65c58bdba1802ef245f',
  portalBookingSid: 'HXc6dda0f9838f913f70025eb95d414f76',
  portalCancelSid: 'HX63ea27cc465e256446fb92a03858560a',
  portalRescheduleSid: 'HXee0cd9ac5f092fb186d6cef6f963bf34',
  portalRequestSid: 'HX211ab1a165cc9ef0701c73b8ec485e1b',
  portalRequestNudgeSid: 'HX53d59803ad047e33db7d0627b3be9c60',

  // Patient templates
  appointmentMeetingLinkSid: 'HX1320fb500fa5374b2fca01ac25c0b616',
  patientPortal: {
    confirmationSid: 'HXd6d6860c676d13275fe60f1f41a21715',
    cancelSid: 'HX3b33a0d9e3b33971bcf6f6b9204a1b3d',
    rescheduleSid: 'HX91da4836b7d6c64c51ca7254e81d9896',
    requestRejectedSid: 'HXb11cebece834846054c6183becb57543',
    requestExpiredSid: 'HXe009bcf96719dec6121b761ae3637e15',
    confirmLinkSid: 'HX5d7ad875d894142f136f1f1d0d08b516',
    unconfirmedExpiredSid: 'HXb0388ee5183bd16a9d6deefb52c7b85b',
  },
} as const;

// Daily provider reminder by number of appointments tomorrow; other counts use the generic template.
export const APPT_SID_MAP: Record<number, string> = {
  2: WHATSAPP_TEMPLATES.tomorrowAppointmentsReminder2Sid,
  3: WHATSAPP_TEMPLATES.tomorrowAppointmentsReminder3Sid,
  4: WHATSAPP_TEMPLATES.tomorrowAppointmentsReminder4Sid,
  5: WHATSAPP_TEMPLATES.tomorrowAppointmentsReminder5Sid,
  6: WHATSAPP_TEMPLATES.tomorrowAppointmentsReminder6Sid,
};

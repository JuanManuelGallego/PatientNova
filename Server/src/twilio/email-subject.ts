const SUBJECT_PREFIX = 'Asunto:';

/**
 * Message templates start with an "Asunto: ..." header line. For email that
 * line becomes the subject and is stripped from the body; text without the
 * header is returned unchanged with a null subject.
 */
export function splitSubjectLine(text: string): { subject: string | null; body: string } {
  const [ first = '', ...rest ] = text.split('\n');
  if (!first.trimStart().startsWith(SUBJECT_PREFIX)) return { subject: null, body: text };
  const subject = first.trimStart().slice(SUBJECT_PREFIX.length).trim();
  return { subject: subject || null, body: rest.join('\n').trimStart() };
}

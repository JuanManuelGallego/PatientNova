# Archived legal text

One folder per `PRIVACY_POLICY_VERSION`. A consent row stores only the version, so this archive is what proves which text a patient accepted. Never edit a published folder: a change to the policy, the notice or the checkbox is a new version, with a new folder and a new constant.

## Versions

- `2026-11-06-r2`: first archived package.
- `2026-11-09`: access by confirmation link instead of login code and session. **Everything below is pending counsel review.** Only these passages differ from `2026-11-06-r2`; every other sentence is verbatim.
  - `autorizacion-portal.md`: "Antes de pedir el código ... verificar tu acceso" -> "Al reservar ... enviarte el enlace de confirmación de tu cita".
  - `politica-privacidad.md` s.2: "códigos temporales, la sesión" -> "los enlaces de confirmación".
  - `politica-privacidad.md` s.3: "gestionar la sesión y las autorizaciones" -> "comprobar el contacto ... mediante el enlace de confirmación, gestionar las autorizaciones".
  - `politica-privacidad.md` s.5: "Un código verifica el acceso ... puede iniciar sesión y ver las citas" -> single-use confirmation link proves access to the email or number (not identity or representation); whoever has the contact can open the link and confirm.
  - `politica-privacidad.md` s.9: patient session cookie (two hours) -> "no establece ninguna cookie de sesión".
  - `politica-privacidad.md` s.10: "Los códigos temporales y las sesiones expiran" -> links expire after 15 minutes, unconfirmed bookings are deleted after 48 hours (resolved requests still after 90 days).
  - `condiciones-portal.md`: "No compartas códigos o enlaces de acceso" -> "No compartas los enlaces de confirmación".
- `2026-11-14`: shorter authorization text with the same scope, shown in layers so the booking form reads as a form. **Pending counsel review**, like `2026-11-09`, including whether the collapsed layer is acceptable. Only `autorizacion-portal.md` changed; the policy and both conditions are verbatim.
  - Layers: the contact help, the checkbox and the sensitive-data line are always visible; the voluntary notice and the controller line sit behind "Ver detalles" on the same page, and stay in the checkbox's accessible description.
  - Datos sensibles (new, visible): "Los datos de salud son datos sensibles: no estás obligado a autorizar su tratamiento." It carries the statutory statement that was in the Aviso.
  - Aviso (collapsed): the remaining statements of voluntariness become one sentence with the direct contact; "No escribas aquí diagnósticos..." is gone (the form has no free-text field).
  - Casilla: "recoger y utilizar" -> "tratar"; "mediante Patient Nova como su encargado" and "Conozco mis derechos y el procedimiento de revocación" move to the controller line; ends "según la Política de privacidad".
  - Línea del responsable (collapsed): "opera este portal por su cuenta" -> "como su encargado", plus the rights to know, update and rectify and to revoke at any time.
  - Ayuda del campo de contacto (was "Al reservar"): same request in fewer words, under the contact field; "No incluyas datos de salud en este paso" is gone.

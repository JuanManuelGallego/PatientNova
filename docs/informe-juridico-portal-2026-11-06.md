# PatientNova: informe de revisión del portal de pacientes

**Fecha de referencia:** 6 de noviembre de 2026.  
**Destinatario:** Juan Manuel Gallego, operador de Patient Nova.  
**Resultado:** mantener apagado el portal hasta cerrar las condiciones de lanzamiento de este informe.  
**Naturaleza:** análisis informativo y propuestas de redacción; no constituye un dictamen firmado por abogado habilitado ni crea relación abogado-cliente o privilegio profesional.

## 1. Decisión recomendada y alcance

**El reparto clínica responsable / PatientNova encargado es defendible para la gestión de pacientes, pero no explica todos los tratamientos de PatientNova ni los de sus proveedores. La casilla actual debe cambiar. También hay problemas de identidad, revocación y conservación que no se arreglan publicando una política más extensa.**

La alternativa de menor alcance para abrir es un portal para adultos que actúan por sí mismos, con contactos individuales previamente comprobados por la clínica, canales de comunicación autorizados y un procedimiento manual probado para ejercer derechos. No hace falta construir ahora un sistema de representación familiar. Sí hace falta impedir que la versión inicial lo simule mediante un correo compartido.

Este informe responde al brief pegado en la conversación, titulado «Brief para abogado: portal de pacientes PatientNova», y contrasta sus hechos con los borradores de política y términos de 6 de noviembre y con código del repositorio, base `cf90a366`. La afirmación de que el portal está apagado procede del brief: **no se inspeccionó producción**.

Las fuentes jurídicas se consultaron en sitios oficiales colombianos, de Québec y Canadá, y en documentos oficiales de proveedores. Cuando una conclusión depende de contratos, ubicaciones o hechos no comprobados, se identifica. No se revisaron cuentas privadas de proveedores, registros fiscales, contratos efectivamente aceptados ni expedientes de pacientes.

En las tablas, **bloqueo** significa que recomiendo no activar la función hasta resolverlo; no implica que una autoridad haya ordenado suspenderla. **Condicional** significa que depende del alcance que finalmente se habilite. Los plazos operativos y controles propuestos se distinguen de los exigidos por norma.

### Condiciones para autorizar el lanzamiento

| Condición | Evidencia concreta para cerrarla | Quién la cierra |
|---|---|---|
| Identificar a la clínica responsable y limitar el uso a personas autorizadas | Identidad y contacto de cada clínica visibles antes de recoger datos; flujo que impida reservas para terceros y acceso por contactos compartidos conocidos | Operador y clínica |
| Obtener autorización explícita y conservar su alcance | Textos del anexo C, alternativa de contacto real, versión archivada de cada texto y prueba vinculada al acto y a la clínica | Operador y clínica |
| Acreditar la cadena contractual e internacional | Acuerdo clínica–PatientNova y expediente de cada proveedor activo, incluidas finalidades propias y países | Operador, con revisión jurídica |
| Hacer efectiva la revocación | Ejercicio de prueba que bloquee el acceso solicitado, suprima avisos no autorizados y evite reactivar consentimientos desde solicitudes anteriores | Operador y clínica |
| Poder atender consultas, reclamos y supresión | Buzones comprobados, responsables nombrados, calendario de plazos y procedimiento ejecutable, también sobre auditoría y copias | Operador |
| Aprobar conservación y salida del servicio | Tabla por categoría, fundamento de cada conservación, exportación utilizable y mecanismo seguro de eliminación cuando corresponda | Clínica y operador |
| Resolver el encuadre en Québec/Canadá | Determinación documentada de aplicabilidad, evaluación de privacidad y de comunicaciones fuera de Québec cuando corresponda | Operador y asesor local |
| Preparar incidentes | Responsable, contactos y canales de reporte, simulacro y respuesta posible ante exposición de claves | Operador |

**No se exige una interfaz nueva para cada trámite.** Se admite gestión manual si es segura, verificable y cabe en los plazos. Una instrucción interna sin medios para ejecutarla no cierra un bloqueo.

## 2. Marco y reparto de responsabilidades

La Ley 1581 distingue por quién decide el tratamiento y por cuenta de quién se realiza; los nombres contractuales no sustituyen los hechos. Su régimen incluye autorización, protección reforzada de datos sensibles, calidad, acceso restringido y seguridad. Para PatientNova, una cita con un profesional de salud puede revelar información sensible aunque no contenga un diagnóstico. Esta última es una evaluación de riesgo del contexto, no una clasificación automática de cualquier dato de agenda. [Ley 1581, arts. 3–6](https://apps.procuraduria.gov.co/normograma/compilacion/docs/ley_1581_2012.htm).

| Actividad | Reparto recomendado | Consecuencia para los documentos |
|---|---|---|
| Historia clínica, agenda, elección de pacientes y avisos clínicos | Clínica o profesional como responsable; PatientNova como encargado, según instrucciones | Acuerdo de tratamiento, finalidades de la clínica y límites de acceso |
| OTP, sesión y constancia de autorización utilizados exclusivamente para el portal de una clínica | Pueden seguir dentro del encargo; operarlos no convierte por sí solo a PatientNova en responsable | Describirlos expresamente en las instrucciones y el acuerdo |
| Cuenta del profesional, contratación y gestión propia de clientes de PatientNova | PatientNova como responsable para esas finalidades | Aviso y autorización propios cuando sean necesarios |
| Seguridad transversal, defensa jurídica y registros que PatientNova decide conservar para fines propios | Posible responsabilidad propia, delimitada por operación | Justificar necesidad, fundamento, destinatarios y plazo; evitar una categoría ilimitada de «seguridad» |
| Usos propios de proveedores | Analizar por finalidad y entidad jurídica | No llamar «subencargado» a todo receptor ni trasladarle toda la responsabilidad |

La tabla es una aplicación provisional al funcionamiento descrito. Si PatientNova reutiliza datos de pacientes para perfiles, publicidad o desarrollos propios, hay que rehacer el análisis antes de hacerlo. **El contrato con la clínica no sustituye la autorización del paciente cuando esta sea exigible.** Tampoco una aceptación de términos equivale sin más a autorización para datos de salud.

La política debe distinguir la identidad del operador de la identidad del responsable de los datos clínicos. El cierre actual «Responsable: Juan Manuel Gallego» resulta ambiguo si se lee como referido a todos los pacientes.

## 3. Respuestas a las cinco preguntas de política

### P1. Meta: rol, contrato y tratamiento internacional

**Cambiar. No hay base para atribuir a todo Meta un único rol.** Debe identificarse la entidad y el producto contratados, quién es titular de la cuenta de WhatsApp Business y qué términos vinculan a PatientNova y a la clínica.

Los términos públicos de tratamiento de WhatsApp prevén el papel de encargado en el alcance que remiten sus condiciones comerciales. Eso no demuestra que todos los datos y finalidades estén cubiertos ni que esa versión sea la aplicable a esta cuenta. [WhatsApp Business Data Processing Terms](https://www.whatsapp.com/legal/business-data-processing-terms).

Hay una advertencia especialmente relevante: las condiciones de Twilio tratan WhatsApp Business Platform como servicio de tercero y remiten a términos diferentes según el cliente sea o no un proveedor independiente de software. Su DPA distingue además tratamientos de Twilio como encargado y como responsable propio. **Aceptar solo el DPA de Twilio no permite dar por cerrada toda la ruta WhatsApp.** [Condiciones específicas de Twilio](https://www.twilio.com/en-us/legal/service-country-specific-terms), [DPA de Twilio](https://www.twilio.com/en-us/legal/data-protection-addendum).

La página pública de WhatsApp Platform indica condiciones efectivas desde el 23 de septiembre de 2026. Las remisiones de Twilio a ciertos términos de Meta exigieron inicio de sesión y no fue posible revisar su contenido completo. Por ello, la clasificación final de Meta queda pendiente de los documentos de la cuenta, sin presumir que el DPA público de 2025 lo resuelva. [WhatsApp Platform](https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-Platform).

**Decisión de lanzamiento:** cerrar ese expediente antes de habilitar WhatsApp. Alternativa: abrir con correo únicamente, pero eso exige impedir WhatsApp en el servidor y en las rutas de avisos, no solo esconder un botón. `portalLoginChannels()` ofrece hoy EMAIL y WHATSAPP.

### P2. Revocación y supresión en la sección 10

**Cambiar.** No obligar al titular a probar primero una infracción ni a obtener una decisión de la SIC para presentar su solicitud. El Decreto 1074 permite pedir revocación o supresión en todo momento y contempla el deber legal o contractual de permanencia como límite. Ese límite exige explicar qué información y finalidad subsisten; no autoriza a continuar todos los usos. [Decreto 1074, art. 2.2.2.25.2.6](https://cancilleria.gov.co/normograma/compilacion/docs/decreto_1074_2015.htm).

La redacción sustitutiva figura en el anexo A. Distingue el derecho a solicitar, los efectos hacia el futuro y las conservaciones justificadas. Una obligación clínica de custodia puede impedir destruir la historia; no justifica por sí sola conservar el acceso al portal o mandar recordatorios rechazados.

### P3. Nombre e instrucciones en recordatorios de WhatsApp

**Cambiar el diseño recomendado; informar también.** No he identificado una regla general que prohíba todo saludo por nombre en cualquier recordatorio autorizado. Sin embargo, la aprobación de la plantilla por Meta no certifica su legalidad y el aviso de privacidad no vuelve necesario todo su contenido.

Para el lanzamiento recomiendo quitar nombre, tipo de atención e instrucciones libres que puedan revelar información clínica. Mantener solo lo necesario para reconocer y gestionar la cita, valorando también si el nombre o especialidad del profesional revela atención sensible. Ofrecer un canal alternativo y comprobar la autorización del destinatario. Es una medida de minimización y confidencialidad, no una afirmación de prohibición literal del nombre.

**Si no está aprobada la plantilla reducida, no activar esa plantilla en el piloto.** No trasladar contenido clínico al correo como solución automática. La selección de canal y el contenido mínimo deben revisarse juntos. No prometer que cualquier mensaje de WhatsApp Business es invisible para todos sus intermediarios.

### P4. Menores y contacto compartido

**No es suficiente delegarlo en una frase de la política.** Atribuir una cita del hijo al expediente del padre afecta la calidad de los datos y puede exponer o alterar información de otra persona. Una segunda casilla no acredita representación.

La SIC exige para menores respeto de su interés superior y derechos, autorización del representante y consideración de su opinión conforme a madurez y autonomía. No basta afirmar que siempre decide quien recibe el código. [Criterio de la SIC sobre menores](https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/concepto/tratamiento-excepcional-y-autorizacion-del-representante-legal-con-interes-superior).

**Versión inicial recomendada:** solo adultos que actúan por sí mismos. Informarlo antes de solicitar el código; para menores, familiares y representantes, ofrecer contacto directo sin recoger datos clínicos en ese desvío. La clínica debe excluir del acceso automático los contactos compartidos conocidos. El rechazo o la revisión deben ser neutrales, sin mostrar una lista de familiares.

Este alcance requiere control funcional. No queda implantado por insertar el texto. Una declaración «la cita es para mí» reduce errores, pero no elimina un contacto compartido conocido ni acredita por sí sola una identidad discutida. Si no puede garantizarse la separación, mantener ese acceso deshabilitado y atenderlo manualmente.

**Matiz del brief:** el código no manda a revisión todo número compartido; permite una coincidencia confiable única y no cuenta igual los números digitados sin verificar. La política no debe prometer una revisión que el sistema no hace. Véase `classifyPhoneMatch` en el anexo E.

### P5. Rol de PatientNova en acceso y consentimiento

**Cambiar parcialmente.** Mantener el encargo para autenticación y prueba recogidas por instrucción de la clínica, y reconocer las finalidades propias delimitadas de PatientNova de la sección 2. Operar técnicamente el formulario o elegir medidas de seguridad no determina por sí solo el rol.

El acuerdo debe autorizar expresamente la recogida de la autorización en nombre de la clínica y permitirle consultar y obtener la prueba. Si PatientNova decide usos adicionales de esos datos, debe analizarlos como tales, no esconderlos dentro del encargo clínico.

## 4. Respuestas a las seis preguntas de consentimiento y términos

### C1. Datos de salud y número de casillas

**Cambiar la casilla.** Nombrar expresamente los datos de salud, explicar las finalidades concretas y quién recibe la autorización. Una referencia genérica a «mis datos personales» es insuficiente como diseño para este contexto.

La normativa exige informar la naturaleza sensible y obtener consentimiento expreso; no establece una regla universal de «exactamente dos casillas». [Regulación de autorización de datos sensibles](https://cancilleria.gov.co/sites/default/files/Normograma/docs/decreto_1377_2013.htm).

Recomiendo una autorización clínica específica, separada de términos contractuales y de cualquier publicidad. Una preferencia opcional de canal o contenido necesita una prueba separable si se ofrece. No añadir una segunda casilla indistinguible de la primera solo para aparentar cumplimiento.

**Implicación técnica:** el modelo actual tiene un único `ConsentKind.DATA_PROCESSING` y el servicio lo fija expresamente. Una segunda finalidad independiente requiere cambios de esquema, API, interfaz y prueba; no es únicamente añadir HTML. Puede mantenerse una autorización clínica acotada para la primera versión.

### C2. Carácter facultativo

**Añadirlo junto al acto de autorización.** La información esencial debe verse antes de marcar la casilla. El aviso propuesto en el anexo C indica que los datos sensibles no tienen que autorizarse, que el portal es voluntario y cómo contactar a la clínica sin aceptar ese uso digital.

### C3. Autorización como condición para reservar

**No considerar que un enlace a la clínica resuelve automáticamente la cuestión.** La prohibición reglamentaria de condicionar actividades al suministro de datos sensibles requiere tomar en serio la libertad de elección. No hay una excepción general para cualquier portal médico. La negativa tampoco habilita a procesar datos sin fundamento.

La solución operativa que recomiendo es limitar la autorización al tratamiento necesario para ese portal, ofrecer una vía real para obtener y gestionar la cita fuera de él, sin penalización por rechazar ese tratamiento, y eliminar finalidades opcionales del requisito de acceso. La vía alternativa debe tener contacto, horario y capacidad de respuesta; un número abandonado no es alternativa.

**Pendiente de confirmación jurídica local antes de abrir:** si el concreto flujo y esa alternativa satisfacen la regla en la clínica y servicio de que se trate. No doy por resuelta esa interpretación mediante una casilla mejor escrita. La autorización del portal tampoco debe presentarse como autorización integral para toda la historia clínica ni como consentimiento para una intervención médica.

### C4. Autorización a favor de la clínica y prueba electrónica

**Sí puede servir como prueba recogida por el encargado, con mejoras.** El formato electrónico no requiere por sí mismo una firma digital certificada; su fuerza depende de accesibilidad, integridad y atribución. Un OTP acredita control del contacto, no automáticamente identidad civil ni representación. [Ley 527, arts. 6–12](https://www.and.gov.co/sites/default/files/2022-05/Ley_527_de_1999.pdf).

Mostrar el nombre legal del responsable y un contacto, además del nombre comercial del profesional. Si este trabaja para una entidad que decide el tratamiento, no basta su nombre personal.

Conservar, como expediente mínimo recomendado: identificador de clínica y paciente o solicitud; finalidad y alcance; versión exacta de política, aviso y casilla; momento; contacto verificado y evento de aceptación; evidencia de representación cuando proceda; revocaciones y cambios. IP y navegador son datos auxiliares, no una garantía suficiente ni sustituto del texto aceptado. No hace falta guardar una captura distinta por clic: se puede archivar cada versión del paquete documental y vincularla a la constancia.

En aprobación, hay autorización desde la solicitud, antes de que exista una ficha de paciente. La clínica debe poder recuperar esa prueba. Justificar qué evidencia mínima queda si la solicitud se rechaza o expira y se elimina a los 90 días, sin conservar por ello todo el formulario indefinidamente.

### C5. Procedimiento manual, citas, mensajes y nueva aceptación

**El canal manual por correo puede ser válido; el procedimiento actual necesita cambios.** Debe ser gratuito, accesible y efectivo. Se describe el reemplazo en la sección 6.

No cancelar automáticamente todas las citas por revocar la autorización del portal. Primero aclarar si la persona quiere abandonar el portal, un canal de avisos, todos los tratamientos voluntarios o también cancelar la atención. Mantener la continuidad asistencial con la clínica y los tratamientos amparados por otro fundamento válido, explicándolo al titular.

Detener recordatorios y avisos comprendidos en la revocación cuando su fundamento sea la autorización retirada. Una autorización clínica independiente y vigente podría permitir otros avisos, pero hay que acreditarla, no presumirla porque los envíe la clínica. No cambiar de canal para eludir la oposición.

**No permitir que la aprobación de una solicitud anterior reponga por sí sola una autorización revocada después.** Tampoco admitir una nueva aceptación desde un contacto compartido cuando la identidad o representación esté cuestionada. En esos casos, bloquear el acceso afectado y tramitar una nueva autorización comprobada. Si la persona quiere volver y no existe disputa de identidad, puede dar una nueva autorización libre, sin borrar la revocación anterior.

### C6. Términos aplicables al paciente

**Cambiar el alcance de los términos actuales.** Un enlace en el pie ofrece una prueba débil de incorporación, especialmente para limitaciones de responsabilidad o indemnizaciones. Recomiendo dejar los términos comerciales para profesionales y entidades, y ofrecer al paciente condiciones breves de uso del portal, separadas de la autorización de datos.

Para la primera versión, las condiciones del paciente pueden limitarse a reglas informativas, sin indemnización ni renuncia de derechos. Si se pretende exigir obligaciones contractuales adicionales, presentar y registrar su aceptación de manera diferenciada. Un solo botón puede instrumentar actos distintos únicamente si su alcance está claro y se prueba cada uno; no llamarlo consentimiento global.

Además, retirar el límite de responsabilidad equivalente a lo pagado en doce meses de esta versión gratuita: puede producir un límite de cero. No asegurar su validez con una frase genérica «en la medida permitida». Las cláusulas abusivas y la transferencia al usuario de responsabilidades legales propias pueden ser ineficaces cuando corresponda el régimen de consumo. [Ley 1480, arts. 42–43](https://normograma.dian.gov.co/dian/compilacion/docs/ley_1480_2011.htm).

## 5. Lista de cumplimiento: respuesta a cada tema

### L1. Persona natural, NIT, sociedad y representante

**No se desprende de la Ley 1581 una obligación general de constituir una sociedad colombiana o nombrar un representante local solo por operar este portal.** Sí deben poder identificarse y contactarse los responsables y el encargado. Publicar la identidad del operador extranjero y la de cada clínica; confirmar domicilio y medios de atención reales.

La obligación de NIT, RUT, impuestos, establecimiento y representación exige examinar la actividad, presencia y contratación. No se verificó ese expediente y no debe declararse una exención fiscal. Si aplica el régimen colombiano de comercio electrónico, hay deberes específicos de identificación; el artículo 50 contempla a proveedores ubicados en territorio nacional, por lo que no debe aplicarse mecánicamente a toda persona extranjera ni descartarse el resto del régimen. [Ley 1480, art. 50](https://normativa.colpensiones.gov.co/colpensiones/docs/ley_1480_2011_pr001.htm).

**Dato adicional del domicilio:** Québec exige a una persona que explota una empresa individual bajo un nombre que no incluye su nombre y apellido inscribirse, por regla general, dentro de los 60 días siguientes al inicio. Confirmar si Patient Nova ya tiene la inscripción y NEQ correspondientes. Esto no exige incorporarse como sociedad. [Registraire des entreprises](https://www.quebec.ca/entreprises-et-travailleurs-autonomes/demarrer-entreprise/immatriculer-constituer-entreprise/immatriculer-constituer-entreprise-formes-juridiques/personne-physique-entreprise-individuelle).

### L2. RNBD

**En los hechos declarados, PatientNova como persona natural no está en las categorías obligadas a registrar bases.** Cada clínica debe evaluarse por separado. La SIC identifica sociedades y entidades sin ánimo de lucro con activos superiores a 100.000 UVT, y personas jurídicas públicas. Ser encargado no hace que PatientNova inscriba a su nombre las bases de todas las clínicas. Cambiar la estructura jurídica puede cambiar el resultado. [Criterio oficial de sujetos obligados al RNBD](https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/concepto/cuales-personas-estan-obligadas-realizar-el-registro-de-bases-de-datos-personales-en-el-rnbd).

La conclusión de no registro debe documentarse. **No registro no significa no cumplir protección de datos ni no reportar incidentes.** No hace falta convertir una inscripción no aplicable en trámite previo artificial.

### L3. DPA estándar con proveedores

**Pueden servir, pero hay que revisar su contenido y aplicación, no solo su título o firma.** Un DPA puede estar incorporado electrónicamente en un acuerdo ya aceptado: «no encontramos contrato firmado» no demuestra que no exista. Archivar entidad contratante, producto, versión, fecha y mecanismo de aceptación, categorías de datos, fines, países, subcontratación, seguridad, incidentes, ejercicio de derechos y devolución/eliminación.

Contrastar el alcance con las instrucciones de la clínica y con la regulación colombiana del contrato de transmisión. Complementar lo que falte y revisar las exclusiones por usos propios. Las cláusulas europeas no sustituyen automáticamente el análisis colombiano.

Sentry permanece sin recibir datos hasta acreditar las condiciones aplicables y el DPA. La misma regla se aplica a cualquier función opcional no evaluada. Aceptar condiciones es un acto del titular de la cuenta; este informe no las acepta.

### L4. Base internacional y mapa por proveedor

La distinción decisiva es entre **transmisión** por cuenta del responsable y **transferencia** a otro responsable. El Decreto 1074 contempla un contrato de transmisión con alcance, actividades, obligaciones, seguridad y confidencialidad; la transferencia se analiza bajo el artículo 26 de la Ley 1581. La SIC reiteró esa distinción en su concepto publicado en febrero de 2026. [Decreto 1074, arts. 2.2.2.25.5.1–5.2](https://www.cancilleria.gov.co/sites/default/files/Normograma/docs/decreto_1074_2015_pr026.htm), [concepto SIC de 2026](https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/concepto/alcance-de-la-circular-002-de-2025-sobre-transferencias-internacionales-de-datos).

| Receptor / función | Calificación de partida, pendiente del contrato | Qué acreditar antes de usarlo |
|---|---|---|
| Juan Manuel Gallego en Canadá | Encargado para los pacientes; responsable para finalidades propias delimitadas | Acuerdo de transmisión con cada clínica; alcance territorial y obligaciones canadienses |
| Railway: aplicación y base de datos | Subencargo para alojamiento | Entidad, región efectiva, soporte y accesos, DPA, subencargados, salida y copias |
| Vercel: portal y registros de infraestructura | Subencargo en los datos alojados; revisar usos propios de cuenta y telemetría | Qué datos pasan por su infraestructura, países, logs y plazo real |
| Cloudflare R2: respaldo | Subencargo para almacenamiento cifrado | Región/jurisdicción y accesos, contrato, ciclo de vida; claves fuera del respaldo |
| Cloudflare Turnstile | Evaluación propia para señales del navegador; no inferir el rol del contrato de R2 | Condiciones del producto, señales, finalidades, aviso previo y comunicaciones internacionales |
| Brevo: códigos y correo | Subencargo para envío; revisar tratamientos propios | Destino, contenido, eventos de entrega, conservación y DPA |
| Twilio: SMS y WhatsApp | Papel mixto según dato y finalidad | Separar contenido por encargo de cuenta, uso y fines propios; términos del canal |
| WhatsApp/Meta | No resuelto para la cuenta concreta | Entidad, ruta de contratación, términos Business Platform/Technology Provider, finalidades y países |
| Google Meet | No asumir que los términos Workspace cubren la API concreta | Producto usado, quién organiza la reunión, metadatos transmitidos, accesos y condiciones |
| Sentry, si se activa | Subencargo para diagnóstico acotado; revisar condiciones propias | DPA, región, retención y comprobación de que la configuración limita datos |

**Ningún país ni rol queda certificado por esta tabla.** No se comprobaron las regiones de las cuentas. El acceso remoto desde Canadá también cuenta para el análisis aunque la base esté en otro país.

Para transferencias, documentar país y destinatario, nivel adecuado bajo los criterios vigentes de la SIC o excepción aplicable; cuando corresponda, declaración de conformidad. Un contrato genérico no es por sí solo una excepción universal. La lista oficial consultada incluye EE. UU. y remite también a países reconocidos por la Comisión Europea; no equivale a «todo proveedor de EE. UU. o Canadá está aprobado». El documento accesible es una versión de 2022, por lo que la comprobación final de lista y alcance queda como tarea previa contractual. [Circular Única, título V, cap. III](https://sedeelectronica.sic.gov.co/sites/default/files/normativa/T%C3%ADtulo%20V%20Versi%C3%B3n%2029-09-2022.pdf).

### L5. Contrato con cada clínica

**Los términos pueden incorporar el acuerdo; no hace falta necesariamente un PDF con otro nombre.** Pero el contenido actual que remite a futuros acuerdos no acredita el contrato de transmisión completo. Formalizar un anexo aceptado por la persona autorizada de cada clínica antes de cargar datos bajo ese encargo.

El anexo debe cubrir: partes y roles; instrucciones y finalidades; categorías de titulares y datos; operaciones; personal y accesos; confidencialidad y seguridad; proveedores y países autorizados; ayuda con derechos; comunicación de incidentes; conservación y salida; devolución/eliminación; prueba de cumplimiento y cambios. Incluir expresamente OTP, consentimiento, solicitudes de cita, mensajería y copias. No confundirlo con la autorización del paciente.

### L6. Atención de solicitudes

**Aprobar e implantar el procedimiento de la sección 6.** La clínica decide sobre el expediente clínico; PatientNova debe atender sus deberes como encargado, trasladar lo que proceda y responder sobre sus tratamientos propios. El silencio de la clínica no habilita a archivar ni a inventar una respuesta sobre sus decisiones clínicas.

### L7. Incidentes

**Aprobar y ensayar la sección 7.** Hay obligación de reporte también para encargados y responsables no inscritos en RNBD. No asumir una única notificación de la clínica que libere automáticamente a PatientNova.

### L8. Historia clínica: norma y plazo

**Se aplican conjuntamente la Resolución 1995 de 1999 y sus modificaciones, incluida la Resolución 839 de 2017.** No elegir una y descartar la otra. La 839 fija mínimo de 15 años desde la última atención, cinco en archivo de gestión y diez en central; duplica el término en ciertos expedientes de víctimas de violaciones de derechos humanos o infracciones graves al DIH y contempla conservación permanente para determinados casos de lesa humanidad. La eliminación exige procedimiento, no un borrado automático al cumplir años. [Resolución 839, arts. 3–5](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-839-de-2017.pdf).

No extender ese plazo a toda OTP, solicitud rechazada o registro de infraestructura. La clínica debe clasificar qué integra su expediente clínico y qué no. Contratar alojamiento tampoco convierte a PatientNova en prestador de atención ni descarga al custodio de sus deberes.

### L9. Supresión, borrado lógico y auditoría

**Cambiar el criterio «indefinido porque no hay purge».** El cifrado protege confidencialidad; no elimina el carácter personal del dato mientras pueda recuperarse. La inmutabilidad del sistema tampoco crea un deber legal de conservar nombres para siempre. La temporalidad exige ligar conservación y finalidad. [Jurisprudencia constitucional sobre necesidad y temporalidad](https://www.corteconstitucional.gov.co/relatoria/boletines/Boletin/Bolet%C3%ADn-tem%C3%A1tico-de-jurisprudencia-5-Derechos-en-el-escenario-digital-y-de-las-TIC.pdf).

Reducir desde ahora los nuevos registros de auditoría a identificadores y hechos necesarios. Para los existentes, separar evidencia con deber de conservación de duplicados innecesarios, restringir acceso y fijar vencimiento. Una referencia seudonimizada sigue siendo personal si puede vincularse de nuevo; no llamarla anónima.

Cuando proceda supresión, usar un procedimiento autorizado que alcance tablas relacionadas, textos/diffs de auditoría y proveedores. Preservar una constancia mínima de la operación sin copiar el dato suprimido. No modificar pruebas sujetas a litigio o custodia clínica sin análisis específico. No destruir una clave compartida con todos los pacientes para borrar a uno.

Puede hacerse manualmente al comienzo, pero hay que probar que funciona con las restricciones de integridad y el registro inmutable. Si no existe mecanismo seguro para un caso procedente, eso impide cumplir; la política no puede eximirlo diciendo que no hay plazo técnico.

## 6. Procedimiento de derechos y revocación propuesto

### Plazos y responsables

La Ley 1581 establece consultas de diez días hábiles, prorrogables cinco; reclamos de quince, prorrogables ocho con explicación previa. Para reclamos incluye requerimiento de subsanación dentro de cinco días, desistimiento tras dos meses sin subsanar, traslado por falta de competencia en dos días hábiles y anotación de «reclamo en trámite» en dos días hábiles desde el reclamo completo. Conservar los puntos de inicio legales; un traslado interno no debe usarse para reiniciar artificialmente el cómputo. [Ley 1581, arts. 14–16](https://relatoria.colombiacompra.gov.co/normativa/ley-1581-de-2012/).

| Paso | Actuación operativa |
|---|---|
| Recepción | Radicar en `privacidad@patientnova.net`; registrar fecha, alcance, clínica, responsable y vencimiento. Aceptar otros canales accesibles de la clínica. Acusar recibo como objetivo interno en un día hábil. |
| Identidad | Verificación proporcional al riesgo. Una respuesta del mismo correo no basta si se discute su titularidad o es compartido. No solicitar copias de identificación completas por defecto. Verificar representación cuando corresponda. |
| Clasificación | Distinguir consulta, corrección, supresión, revocación y oposición a mensajes. Pedir aclaración del alcance sin convertirla en obstáculo. |
| Traslado | Enviar a la clínica lo que le corresponda, avisar al titular y conservar seguimiento. PatientNova responde por sus propios tratamientos y acciones. |
| Reclamo | Aplicar subsanación, traslado y marca de trámite cuando correspondan. La marca debe asociarse al registro afectado, no quedar solo en un buzón aislado. |
| Decisión | Identificar dato, finalidad, acción y fundamento de cualquier conservación. Si la clínica no responde, escalar a su contacto autorizado y contestar lo que compete a PatientNova; no ocultar la demora ni exceder plazos sin tratamiento legal. |
| Ejecución | Aplicar y comprobar restricciones, correcciones o eliminación en sistemas y proveedores. No dar por ejecutada una baja solo por enviar la orden. |
| Cierre | Respuesta comprensible, evidencia mínima y acceso restringido al expediente. Informar la posibilidad de acudir a la SIC tras agotar el trámite correspondiente. |

### Revocación: reemplazo del procedimiento actual

1. Identificar si se retira el portal, un canal concreto, todos los avisos voluntarios u otras finalidades. **No vincular necesariamente revocación con cancelación de citas.**
2. Mientras se aclara una disputa de identidad, suspender la exposición del expediente y comunicaciones al contacto discutido; verificar por un medio independiente.
3. Registrar la revocación y bloquear el portal cuando sea su alcance, utilizando la opción disponible `--block-portal`. Guardar la decisión y su prueba en el expediente de derechos.
4. Detener recordatorios y trabajos pendientes incluidos en la retirada. Resolver también solicitudes de reserva anteriores: que no restablezcan el consentimiento ni generen mensajes rechazados al aprobarlas. No usar la simple eliminación de la ficha como cancelación de trabajos.
5. Acordar con la clínica continuidad de atención y canal permitido. Mantener la historia que deba conservarse, con finalidad y accesos limitados.
6. Para volver al portal, comprobar identidad/representación si hay disputa y recoger una nueva autorización. La reapertura debe quedar auditada; no usar cambios directos sin trazabilidad.

**Limitaciones constatadas:** el comando actual revoca constancias y opcionalmente bloquea el portal; no detiene avisos, no cancela trabajos y no invalida por sí solo una solicitud anterior. Tampoco se acreditó una operación auditada de reapertura. La gestión manual puede cubrir estos puntos solo si se documentan y prueban todos los pasos.

## 7. Incidentes: procedimiento y avisos

Designar a Juan Manuel Gallego como responsable operativo y un suplente accesible. Documentar contacto de seguridad de cada clínica. Contener el incidente, preservar evidencia, medir alcance, recuperar de forma segura y corregir la causa.

| Destinatario | Regla / propuesta aplicable |
|---|---|
| Clínica | Aviso inicial sin demora injustificada; recomiendo pactar máximo de 24 horas desde conocimiento, aunque falte completar la investigación. Es un plazo contractual propuesto, no el plazo general de la SIC. |
| SIC | Conforme al criterio oficial consultado, reporte dentro de quince días hábiles desde detección y conocimiento del área encargada. Responsables inscritos usan RNBD; responsables no obligados y encargados usan el módulo/canales de incidentes. Verificar acceso al canal antes de necesitarlo. [SIC: reporte de incidentes](https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/concepto/cumplimiento-de-la-obligacion-del-reporte-de-incidentes-de-seguridad). |
| Titulares en Colombia | Evaluar de inmediato daño, sensibilidad y medidas de protección; notificar oportunamente cuando corresponda para permitir protección, por obligación específica u orden. No atribuir a Ley 1581 una regla general de 72 horas ni un plazo universal de quince días para titulares. |
| Québec, si aplica | Si existe riesgo de perjuicio serio, avisar con diligencia a la CAI y a las personas afectadas; llevar registro de incidentes. [CAI: incidentes y seguridad](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees/incidents-confidentialite-mesures-securite-entreprises). |
| Canadá federal, si aplica | Evaluar reporte y aviso por riesgo real de perjuicio significativo y hacerlo tan pronto como sea factible; conservar registro de brechas durante al menos 24 meses. [Reglamento federal y explicación oficial](https://gazette.gc.ca/rp-pr/p2/2018/2018-04-18/html/sor-dors64-eng.html). |

Coordinar avisos entre clínica y PatientNova sin asumir que el contrato elimina deberes propios. Usar una relación única del incidente, versiones y responsables de cada envío. Si la autoridad pide información adicional, aportarla por canal seguro; no publicar datos de afectados ni incluirlos en tickets abiertos.

**Clave de cifrado:** el documento interno dice que no existe aún rotación de `ENCRYPTION_KEY`. Antes de abrir, comprobar un procedimiento de recuperación y recifrado seguro o implantarlo. No borrar o cambiar esa clave sin migrar los datos. Es una condición técnica que recomiendo por el impacto de una exposición, no una orden legal de usar un algoritmo concreto.

## 8. Conservación y eliminación: decisiones necesarias

Los plazos técnicos actuales son hechos del documento interno, no plazos legales certificados ni una comprobación de que los trabajos estén ejecutándose en producción.

| Categoría | Decisión recomendada |
|---|---|
| Historia clínica y componentes que la integren | Aplicar el régimen sanitario con la clínica como custodio; distinguir conservación legal, acceso operativo y disposición final. |
| Ficha administrativa y citas | Definir qué integra el expediente, qué prueba obligaciones pendientes y qué puede eliminarse al terminar la finalidad. Sin un plazo universal inventado. |
| Solicitudes resueltas | Mantener 90 días como propuesta operativa si se justifica; precisar el hito de inicio y la ejecución periódica. Separar evidencia mínima necesaria antes de eliminar el contenido. |
| OTP | Mantener únicamente hashes y metadatos necesarios; comprobar la purga documentada de 24 horas desde el último envío. Eliminar el código/hash no equivale a eliminar copias en el proveedor. |
| Sesiones | Dos horas es duración de acceso, no plazo de conservación de todos los logs. |
| Autorizaciones y revocaciones | Conservar prueba mínima durante la necesidad de demostrar el tratamiento y atender responsabilidades; fijar plazo motivado y revisión, no «para siempre». |
| Auditoría | Categorizar hechos y contenido, reducir datos identificativos, definir acceso, plazo y tratamiento de supresiones. Inmutabilidad no implica perpetuidad. |
| Respaldos | Comprobar ciclo de 30 días y que no queden copias fuera del ciclo. Limitar uso a recuperación, y reaplicar supresiones/restricciones antes de volver a servir datos restaurados. |
| Proveedores | Anotar plazos efectivos de mensajes, logs y copias; activar opciones de reducción/eliminación disponibles y confirmar lo que no controla PatientNova. |
| Cierre de la clínica | Exportar y comprobar legibilidad e integridad; acordar custodia posterior y eliminación del alojamiento. No destruir el único expediente ni retenerlo indefinidamente por defecto. |

**Antes de abrir:** aprobar la tabla con fundamentos, responsables e hitos y probar al menos una exportación, una supresión procedente y una restauración que respete restricciones. Se puede automatizar después; no se puede posponer el derecho.

## 9. Québec y Canadá: omisión material del brief

El domicilio declarado en Sherbrooke es una conexión relevante. Si el operador explota desde allí la empresa y recoge, conserva o utiliza datos en su actividad, debe examinarse la ley de protección de datos del sector privado de Québec. Elegir Colombia en los términos no desplaza normas imperativas aplicables. Esta es una inferencia sobre los hechos declarados, pendiente de confirmar cómo se opera realmente. [CAI: ámbito de la ley](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees/champ-application-loi_entreprises).

No basta el vocabulario colombiano de responsable/encargado para resolver ese régimen. Antes de abrir, determinar si corresponde designar y publicar el responsable de privacidad, aprobar gobernanza, realizar evaluación de factores relativos a la vida privada del portal y documentar comunicaciones o encargos fuera de Québec. La CAI explica la evaluación del proyecto y la necesidad de evaluación y acuerdo escrito para operaciones fuera de Québec. [CAI: responsabilidad y evaluación del proyecto](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees/responsable-protection-renseignements-personnels-entreprise), [CAI: comunicaciones fuera de Québec](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees/utilisation-communication-renseignements-personnels).

Además, la autoridad federal explica que PIPEDA cubre flujos de datos entre provincias o países realizados en actividades comerciales, también desde provincias con legislación sustancialmente similar. Revisar si la actividad gratuita actual forma parte de una actividad comercial y qué operaciones quedan cubiertas. No declarar PIPEDA inaplicable únicamente porque la cuenta no se cobra todavía. [OPC: aplicación de PIPEDA](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda_brief/).

**Cierre requerido:** conclusión local sobre aplicabilidad y documentos correspondientes. Este informe no certifica cumplimiento integral canadiense, tributario, sanitario ni lingüístico.

## 10. Orden de ejecución

| Orden | Trabajo | Puede esperar |
|---|---|---|
| 1 | Confirmar alcance inicial, identidad de operador y clínicas, elegibilidad de contactos y jurisdicciones | La constitución de una sociedad, si no resulta exigible por otro motivo |
| 2 | Formalizar acuerdo con clínicas y evaluar cada proveedor/canal activo | Un proveedor opcional que permanezca sin recibir datos |
| 3 | Aprobar y adaptar los textos de anexos; resolver el punto de no condicionamiento y alternativa real | Una cuenta familiar o sistema de representación, si no se admite ese uso |
| 4 | Ajustar identidad, evidencia de consentimiento y revocación efectiva; limitar mensajes | El autoservicio de revocación, si existe trámite manual efectivo |
| 5 | Aprobar conservación, supresión, salida e incidentes; probar su ejecución | Automatizaciones que mejoren un procedimiento manual ya probado |
| 6 | Archivar versiones, comprobar configuración desplegada y autorizar por escrito el piloto por clínica | Extender el alcance a otros países, menores o nuevos canales |

No se recomienda activar todo y corregir textos después. El estado apagado permite una sola revisión coherente del paquete documental. Un cambio de finalidades exige especial cuidado; no todo cambio ortográfico de política tiene por ley que recabar otra autorización, aunque hoy el producto lo haga por versión. No usar esa mecánica para volver a autorizar por defecto una finalidad revocada.

Al implementar, asignar una versión nueva e inequívoca al paquete aprobado, aunque se publique el mismo día que el borrador: por ejemplo, `2026-11-06-r2`, si sigue siendo esa la fecha efectiva y el identificador está libre. Actualizar de forma coherente la fecha visible, `Server/src/portal/privacy-policy.ts`, las casillas y avisos, y el registro documental interno. Conservar los textos anteriores relacionados con cualquier prueba existente. Los textos que prometen un control nuevo solo entran en vigor cuando ese control funciona.

---

## Anexo A. Política completa propuesta

**Instrucciones internas de publicación — no forman parte de la política:** el texto siguiente es una propuesta para el alcance inicial de adultos que actúan por sí mismos. Solo publicar después de que coincida con el funcionamiento real, se cierren los bloqueos y se apruebe el expediente internacional. Completar una fecha efectiva nueva e identificadores registrales que resulten exigibles; confirmar domicilio y contactos. La ficha de cada clínica debe mostrar identidad legal y contacto. Publicar o enlazar el directorio de proveedores con entidades, funciones, países y condiciones realmente verificadas. No afirmar contrataciones o funciones aún inexistentes.

### Política de tratamiento de datos personales de Patient Nova

**Vigencia: fecha efectiva de publicación indicada en esta página.**

**1. Identidad y responsabilidades.** Patient Nova es el servicio operado por Juan Manuel Gallego, persona natural, con domicilio en 402-1595 rue Lalemant, Sherbrooke, Québec, Canadá; teléfono +57 304 487 3415; privacidad@patientnova.net. La clínica o profesional identificado en su página de reserva decide el tratamiento de los datos de sus pacientes y actúa como responsable. Patient Nova los trata por cuenta de esa clínica para prestar el servicio contratado. Patient Nova decide el tratamiento de las cuentas de sus clientes y las finalidades propias de gestión del servicio, seguridad y cumplimiento que se describen aquí. Puedes solicitar aclaración de quién interviene en cada operación.

**2. Información tratada.** Según la función utilizada, tratamos identificación y contacto, datos de citas y solicitudes, preferencias de comunicación, documentos y contenido clínico que la clínica incorpora, y datos de cuentas profesionales. Para acceso y seguridad se utilizan contacto de acceso, códigos temporales, sesión y datos técnicos, incluidos IP y navegador cuando se recogen para la operación o su constancia. La información clínica y ciertos datos de citas pueden revelar datos de salud y requieren especial protección. El portal no permite al paciente consultar su historia clínica completa; las solicitudes de acceso a ella se atienden con la clínica.

**3. Finalidades.** La clínica utiliza la plataforma para administrar pacientes, agenda, documentos e historia clínica, y para gestionar comunicaciones relacionadas con su atención. Cuando habilita el portal, se utiliza para comprobar el contacto elegido, gestionar la sesión y las autorizaciones, mostrar y gestionar citas y solicitudes y enviar los avisos autorizados. Patient Nova utiliza los datos necesarios de sus clientes para administrar cuentas, prestar soporte y cumplir la relación de servicio. Se conservan registros limitados para prevenir abuso, proteger el sistema, atender derechos y cumplir obligaciones aplicables. No utilizamos los datos clínicos para publicidad conductual ni los vendemos.

**4. Autorización y uso voluntario.** Solicitamos autorización cuando es exigible y explicamos quién la recibe y para qué. Los datos de salud son sensibles y no estás obligado a autorizar su tratamiento. El portal es voluntario: si no autorizas ese tratamiento digital, puedes contactar directamente a la clínica por los medios publicados para gestionar tu cita y atención. La negativa al portal no debe penalizarte ni impedirte solicitar atención por esa vía. La autorización del portal no es un consentimiento para intervenciones médicas ni autoriza cualquier utilización de tu historia clínica. Los tratamientos exigidos o permitidos sin autorización por una norma se limitan a su fundamento y finalidad.

**5. Identidad, menores y representantes.** En esta versión el portal está destinado a adultos que actúan por sí mismos. Si gestionas una cita de un menor, de un familiar o en representación de otra persona, contacta directamente a la clínica. No introduzcas datos de otra persona como si fueran tuyos. Un código verifica acceso a un correo o número; no acredita por sí solo representación. Comunica a la clínica si el contacto está compartido, ha cambiado de titular o puede ser utilizado por alguien más. La clínica deberá comprobar los permisos que correspondan antes de facilitar información. La atención de menores fuera del portal se sujeta a las garantías y autorizaciones que resulten aplicables.

**6. Comunicaciones y proveedores.** Para operar el servicio utilizamos, según las funciones habilitadas: Railway y Vercel para alojamiento e infraestructura; Cloudflare para protección de formularios y respaldo cifrado; Brevo para correo; Twilio para comunicaciones telefónicas y WhatsApp; WhatsApp y las entidades de Meta que correspondan para ese canal; Google para funciones de reuniones; y Sentry, si se habilita, para diagnóstico técnico limitado. El directorio de proveedores enlazado desde esta política identifica sus entidades, funciones, países y condiciones aplicables. No todas sus operaciones tienen el mismo rol: los tratamientos por nuestra cuenta se delimitan contractualmente y los proveedores pueden realizar tratamientos propios bajo sus condiciones y las leyes aplicables. Esas condiciones no sustituyen nuestros deberes ni los de la clínica.

Los mensajes necesitan utilizar el contacto y contenido necesario para su entrega. El canal de acceso se elige entre los ofrecidos; los avisos de citas siguen la ruta autorizada de la clínica y pueden utilizar correo, WhatsApp o SMS. No se utiliza un número simplemente digitado como prueba de identidad. Un mensaje, su remitente o su vista previa pueden revelar que te relacionas con una clínica; evita contactos compartidos y solicita otro canal si lo necesitas. Puedes pedir que cesen comunicaciones comprendidas en una autorización retirada. No uses estos canales para emergencias.

**7. Operaciones internacionales.** Patient Nova opera desde Canadá y sus proveedores pueden tratar información en otros países. Para cada operación se determina quién recibe los datos, con qué finalidad y bajo qué condiciones. Los tratamientos por cuenta de la clínica se sujetan al acuerdo de transmisión correspondiente; los tratamientos de otro responsable se sujetan a las reglas aplicables a esa comunicación o transferencia. La ubicación internacional no elimina la confidencialidad ni los derechos del titular. Puedes solicitar información sobre los destinatarios y las garantías aplicables a tus datos. La prestación se sujeta a la legislación colombiana de protección de datos y a las normas imperativas de otras jurisdicciones que resulten aplicables.

**8. Seguridad y documentos.** Aplicamos medidas de acceso, autenticación, validación, registro y protección de la información proporcionales a las operaciones. Algunos campos personales y clínicos se cifran en la aplicación; esto no significa que todos los componentes y proveedores utilicen la misma protección ni garantiza ausencia de incidentes. Algunos documentos informativos de la clínica pueden distribuirse mediante un enlace de acceso público: no deben contener información de pacientes. Si detectas un documento personal accesible o un acceso sospechoso, avisa a privacidad@patientnova.net. La clínica no debe cargar documentación clínica individual en una función diseñada para publicar documentos informativos.

**9. Conservación y cierre.** La clínica define la custodia y conservación de la historia clínica conforme a la normativa sanitaria, incluidas la Resolución 1995 de 1999 y sus modificaciones. Los datos administrativos y registros se conservan durante la finalidad justificada y los deberes aplicables, con accesos limitados cuando dejan de utilizarse operativamente. Las solicitudes de cita resueltas se eliminan de la base operativa después del periodo de 90 días previsto para su seguimiento, mediante el proceso periódico correspondiente; la evidencia mínima que deba conservarse tiene un tratamiento separado. Los códigos temporales y las sesiones expiran; su expiración no elimina automáticamente todos los registros técnicos.

El borrado lógico oculta ciertos registros, pero no equivale a su eliminación definitiva. Una solicitud de supresión se evalúa sobre los datos y finalidades concretos. Cuando procede, se ejecuta la eliminación o anonimización efectiva y se gestiona su alcance en proveedores y copias; no se conserva información sin fundamento solo por estar en auditoría. Los respaldos tienen un ciclo limitado de conservación y uso restringido para recuperación. Las restricciones y supresiones deben respetarse al restaurarlos. El cierre de una cuenta se coordina con la clínica para preservar la información que legalmente deba custodiar y evitar la pérdida del único expediente.

**10. Derechos y solicitudes.** Puedes conocer, consultar, actualizar y rectificar tus datos; pedir prueba de autorización e información sobre su uso; solicitar revocación total o parcial y supresión; y presentar quejas ante la autoridad competente. Puedes solicitar revocación o supresión en cualquier momento, sin demostrar primero una infracción. Si un deber legal o contractual válido impide atender una parte, te explicaremos los datos, finalidad y fundamento de la conservación. La revocación produce efectos sobre los tratamientos comprendidos hacia el futuro y no elimina automáticamente la historia clínica ni cancela la atención.

Escribe a privacidad@patientnova.net o a la clínica identificada en tu portal. La clínica decide sobre el tratamiento clínico y Patient Nova atiende lo que le corresponde, ayuda con la ejecución y traslada las solicitudes pertinentes. Podemos pedir comprobaciones proporcionales de identidad y representación. No necesitas mantener activa una cuenta para ejercer estos derechos. Las consultas y reclamos siguen los plazos y reglas de los artículos 14 y 15 de la Ley 1581; las extensiones se comunicarán con sus motivos. Antes de acudir a la SIC debe agotarse la consulta o reclamo cuando así lo exige la ley.

El portal no tiene un botón de revocación: la atendemos por estos contactos. Retirar el portal o un canal no significa necesariamente cancelar tus citas; aclara el alcance que deseas y coordinaremos su efecto con la clínica. No reactivaremos una autorización retirada mediante una solicitud anterior; el regreso al portal requiere una nueva autorización válida y las comprobaciones necesarias.

**11. Incidentes y cambios.** Si ocurre un incidente, adoptaremos medidas de respuesta y realizaremos los avisos que correspondan a la clínica, autoridades y personas afectadas conforme a los regímenes aplicables. Puedes avisarnos de un riesgo sin enviar historias clínicas completas por correo. Publicaremos las modificaciones de esta política con su fecha; informaremos los cambios sustanciales y recabaremos nuevas autorizaciones cuando corresponda. La plataforma puede solicitar una nueva confirmación al cambiar de versión.

**12. Contacto.** Juan Manuel Gallego atiende la función de privacidad del operador en privacidad@patientnova.net y en el domicilio y teléfono de la sección 1. Para asuntos de cuenta y cierre: legal@patientnova.net. Para atención sanitaria y decisiones sobre tu historia, utiliza también el contacto de tu clínica publicado en su portal. Esta política permanece disponible mientras continúen los tratamientos que describe; puedes pedir las versiones relacionadas con tu autorización.

---

## Anexo B. Términos completos propuestos para profesionales y entidades

**Instrucciones internas:** texto sustitutivo para la versión actual, sin suscripciones ni pagos de cuenta dentro de la aplicación. Incorporar el acuerdo de tratamiento antes de cargar datos y registrar aceptación por la persona con facultades. No publicar una referencia a un acuerdo inexistente como si ya estuviera formalizado. Una futura limitación negociada de responsabilidad o un plan comercial debe revisarse por separado.

### Términos de servicio de Patient Nova para profesionales y entidades

**Vigencia: fecha efectiva de publicación indicada en esta página.**

**1. Partes y aceptación.** Patient Nova es operado por Juan Manuel Gallego, persona natural, con domicilio en 402-1595 rue Lalemant, Sherbrooke, Québec, Canadá. Estos términos regulan la relación del operador con el profesional o entidad que contrata el servicio. Quien acepta por una clínica declara tener facultades para hacerlo. La aceptación se registra al contratar o activar la cuenta. El paciente utiliza el portal bajo sus condiciones específicas; no asume por ello las obligaciones comerciales de la clínica.

**2. Servicio.** Ofrecemos herramientas para gestión de pacientes, citas, agenda, documentos, historia clínica y comunicaciones, y un portal de pacientes cuando la clínica lo habilita. Las funciones dependen del alcance contratado y de su configuración. Patient Nova no presta atención médica, no sustituye el criterio profesional y no sirve para emergencias. Una solicitud pendiente de aprobación no es una cita confirmada; la clínica debe informar sus reglas de atención y cambios.

**3. Cuentas y acceso.** Proporciona información exacta, protege las credenciales y concede únicamente accesos autorizados. Informa de accesos sospechosos y retira permisos cuando dejen de ser necesarios. La existencia de una cuenta no certifica identidad, licencia o habilitación profesional. La clínica es responsable de sus habilitaciones y de la exactitud de su perfil público. El operador conserva sus propias obligaciones de seguridad y control del servicio.

**4. Datos y acuerdo de tratamiento.** La clínica mantiene los derechos y responsabilidades que le corresponden sobre su información y la de sus pacientes. Instruye a Patient Nova para tratarla exclusivamente dentro del servicio y del acuerdo de tratamiento aplicable. Antes de cargar datos personales debe formalizarse ese acuerdo, con instrucciones, confidencialidad, seguridad, proveedores, países, derechos, conservación, incidentes y salida. Estos términos no sustituyen las autorizaciones de los titulares. Patient Nova no adquiere permiso para reutilizar datos clínicos en publicidad u otras finalidades propias no acordadas y legalmente sustentadas.

**5. Obligaciones sobre pacientes.** La clínica identifica al responsable del tratamiento, informa a los pacientes y obtiene y conserva las autorizaciones que sean exigibles, incluidas las garantías reforzadas para datos sensibles y menores. Debe comprobar a quién corresponde cada expediente y quién puede acceder. No autorices el acceso automático de un contacto compartido como si identificara inequívocamente a una sola persona. En la versión inicial, el portal se utiliza para adultos que actúan por sí mismos; la representación se tramita directamente con la clínica hasta disponer de un flujo adecuado. La autorización del portal no sustituye el consentimiento para actos médicos.

**6. Comunicaciones y terceros.** La clínica debe utilizar contactos correctos, canales autorizados y contenido necesario. Debe tramitar solicitudes de cese y evitar que nuevas reservas o cambios reactiven mensajes rechazados. El servicio puede integrar los proveedores indicados en la política y directorio aplicable. La entrega y disponibilidad de comunicaciones y reuniones dependen de terceros y no se garantizan en un momento determinado. Esta dependencia no exime al operador de sus obligaciones legales o contractuales propias ni permite compartir datos fuera del alcance autorizado.

**7. Documentos y usos prohibidos.** No utilices el servicio para acceso ajeno, suplantación, spam, fraude, malware, explotación no autorizada o divulgación indebida de información. No introduzcas datos sin fundamento válido ni documentos de pacientes en funciones de publicación de información general. Si detectas una exposición o fallo, comunícalo de forma privada y sin distribuir datos personales innecesarios. Las actuaciones de seguridad autorizadas deben respetar su alcance acordado.

**8. Propiedad intelectual.** El software, marca y materiales del servicio pertenecen al operador o sus licenciantes, con las excepciones legales y licencias aplicables. Se concede un derecho de uso durante la vigencia del acceso. Esta licencia no transfiere al operador la titularidad de los datos de la clínica o del paciente ni limita sus derechos legales de acceso y portabilidad cuando correspondan.

**9. Precios.** La versión descrita no aplica suscripciones ni cobros de la cuenta dentro de la plataforma. Los precios y estados de pago de las citas son información de la clínica; no constituyen un cobro de Patient Nova. Cualquier futuro plan comercial deberá comunicarse y aceptarse con sus condiciones antes de aplicarse.

**10. Disponibilidad y responsabilidad.** Las funcionalidades pueden requerir mantenimiento y depender de infraestructura externa. El operador informará las limitaciones conocidas relevantes y actuará sobre fallos bajo su control conforme a sus obligaciones. No garantiza disponibilidad continua ni entrega instantánea de mensajes. Cada parte responde por los incumplimientos y daños que legalmente le sean imputables. Estos términos no excluyen deberes de privacidad, seguridad, custodia pactada ni derechos inderogables. No establecen un límite de responsabilidad de cero por el carácter gratuito del servicio.

**11. Reclamaciones.** Cada parte informará de reclamaciones relacionadas con el servicio y colaborará de forma razonable en su gestión. La clínica responde por la legalidad de sus decisiones clínicas y la información que incorpora en el alcance que le corresponde; el operador responde por sus actuaciones. No se impone al paciente ni a la clínica una indemnización automática por conductas imputables al operador.

**12. Suspensión, cierre y datos.** Puede restringirse el acceso en forma proporcionada cuando sea necesario para contener abuso, un riesgo de seguridad o un incumplimiento material. Se notificará cuando sea posible y no comprometa la contención o una obligación legal. La suspensión no debe utilizarse para impedir derechos sobre datos o destruir el único expediente clínico. Para cerrar una cuenta escribe a legal@patientnova.net. Las partes coordinarán exportación utilizable, custodia que corresponda, devolución y eliminación según el acuerdo y la ley. El cierre no produce por sí solo borrado completo ni autoriza conservación indefinida.

**13. Cambios, ley y controversias.** Los cambios materiales se comunicarán antes de su aplicación y requerirán la aceptación o autorización que corresponda. Publicar una versión nueva no legitima un tratamiento incompatible. La relación se somete a la ley colombiana elegida por las partes, sin excluir normas imperativas de otras jurisdicciones aplicables. Las controversias se tramitan ante las autoridades y jueces competentes según las reglas aplicables; no se limitan competencias de protección de datos o consumo. La invalidez de una cláusula no elimina las restantes cuando puedan subsistir.

**14. Contacto.** Juan Manuel Gallego, en el domicilio indicado en la sección 1; teléfono +57 304 487 3415. Asuntos del servicio y cierre: legal@patientnova.net. Privacidad y derechos: privacidad@patientnova.net. El acuerdo de tratamiento identifica además el contacto de cada clínica para instrucciones, incidentes y solicitudes.

---

## Anexo C. Textos de interfaz y autorización

Los campos entre corchetes son información de la clínica que **debe existir y mostrarse** antes de publicar; no deben aparecer literalmente al paciente. La fecha/versión forma parte del paquete documental archivado. Ninguna casilla aparece marcada por defecto.

### Antes de pedir el código

> Este portal es para personas mayores de edad que gestionan sus propias citas. Si la cita es para un menor, un familiar u otra persona, o compartes este correo o número, contacta directamente a [clínica / profesional] en [contacto]. No introduzcas datos de otra persona.

> Al pedir el código solicitas a [responsable legal] que utilice este contacto para verificar tu acceso a su portal mediante Patient Nova. El envío se realiza por el canal que elijas, a través de los proveedores descritos en la Política de privacidad. No incluyas datos de salud en este paso. Puedes gestionar tu cita directamente en [contacto alternativo].

**Botón:** «Solicitar código». Vincular el acto a una versión de este aviso. El aviso no suple una revisión de los datos técnicos tratados antes del clic, incluido Turnstile. No consultar ni mostrar información de pacientes en la solicitud del código.

### Antes de mostrar citas o enviar la reserva

**Identificación visible:** «Responsable del tratamiento: [nombre legal de la clínica o profesional], [contacto de privacidad]. Patient Nova opera este portal por su cuenta».

**Aviso visible:**

> Tus citas pueden revelar información sobre tu salud. No estás obligado a autorizar el tratamiento de datos sensibles. Este portal es voluntario. Si prefieres no usarlo, puedes solicitar y gestionar tu cita directamente con [clínica] en [contacto y horario], sin penalización por rechazar este tratamiento digital. No escribas aquí diagnósticos ni información clínica adicional.

**Casilla clínica propuesta:**

> Autorizo expresamente a [responsable legal], mediante Patient Nova como su encargado, a recoger y utilizar mis datos de identificación y contacto y los datos de salud que revele la gestión de mis citas, para mostrarme y gestionar mis citas y solicitudes en este portal y enviar los avisos de su gestión por los canales que tenga autorizados. Conozco mis derechos y el procedimiento de revocación descritos en la Política de privacidad.

**Confirmación de alcance, separada de la autorización:** «Gestiono mis propias citas y el contacto de acceso es de uso personal». Es un control de producto recomendado, no prueba concluyente de identidad. Si no puede confirmarlo, dirigir al contacto alternativo antes de mostrar expedientes o crear la reserva.

No incorporar publicidad, usos propios indeterminados o aceptación de una intervención médica. Para pedir solo una baja de avisos o ejercer derechos no exigir esta nueva autorización. Antes de imponerla como requisito del portal, cerrar la interpretación indicada en C3.

### Condiciones breves del portal para pacientes

> Patient Nova proporciona este portal a [clínica / profesional] para gestionar citas. No presta atención médica ni atiende urgencias. Utiliza únicamente tus propios datos y no compartas códigos o enlaces de acceso. Si necesitas actuar por otra persona, contacta a la clínica. Una solicitud sujeta a revisión no está confirmada hasta que la clínica la apruebe. Las reglas de atención, cancelación y reprogramación de la clínica se muestran antes de la reserva. Comunica errores o problemas de acceso a [contacto]. Puedes ejercer tus derechos sobre datos sin utilizar el portal. Estas condiciones no contienen renuncias a tus derechos, indemnizaciones a favor del operador ni límites a responsabilidades legales.

Estas condiciones se muestran junto a la información de uso, separadas de la autorización. Si se amplían a obligaciones contractuales sustanciales, revisar y registrar su aceptación específica.

---

## Anexo D. Matriz de cierre: qué impide abrir y qué puede esperar

| Punto del brief | Decisión | Clasificación |
|---|---|---|
| P1 Meta | Clasificación contractual pendiente; cerrar o excluir WhatsApp con control real | Bloqueo del canal |
| P2 Revocación | Sustituir sección y ejecutar retirada por finalidad | Bloqueo |
| P3 Plantilla WhatsApp | Reducir contenido o mantener esa plantilla fuera del piloto | Bloqueo de esa mensajería, por recomendación de riesgo |
| P4 Menores/contactos | No activar acceso o atribución automáticos inseguros; limitar alcance inicial | Bloqueo |
| P5 Roles | Separar encargo clínico y fines propios | Bloqueo documental/contractual |
| C1/C2 Casilla | Explicitar salud, finalidad, responsable y facultatividad | Bloqueo |
| C3 Condición | Alternativa efectiva y confirmación jurídica del flujo | Bloqueo |
| C4 Prueba | Archivo del texto y atribución recuperable por clínica | Bloqueo; automatización avanzada puede esperar |
| C5 Manual/reingreso | Trámite probado y sin reactivación por solicitudes anteriores | Bloqueo; botón de autoservicio puede esperar |
| C6 Términos | Separar profesionales y pacientes, retirar exclusiones problemáticas | Bloqueo documental |
| L1 Identidad | Identificación real y encuadre registral/fiscal comprobado | Condicional; no exigir sociedad por defecto |
| L2 RNBD | Documentar no obligación del operador actual y revisar cada clínica | No hay trámite universal previo |
| L3/L4 Proveedores | Contratos y base internacional acreditados por cada función activa | Bloqueo de cada ruta no cubierta |
| L5 Clínica | Acuerdo de transmisión con contenido suficiente | Bloqueo |
| L6 Solicitudes | Buzón, responsables, plazos, marca y ejecución | Bloqueo |
| L7 Incidentes | Procedimiento y canales operativos | Bloqueo recomendado |
| L8/L9 Conservación | Tabla motivada, exportación y supresión realizables | Bloqueo; purgas generales automáticas pueden esperar |
| Québec/Canadá | Aplicabilidad y evaluación correspondientes | Bloqueo de revisión jurídica, no afirmación de prohibición ya resuelta |

## Anexo E. Evidencia técnica y límites de verificación

Referencias relativas al repositorio; permiten revisar el hecho descrito sin afirmar que esté desplegado.

| Evidencia | Archivo |
|---|---|
| Borradores completos de 6 de noviembre | [Política](../Portal/src/app/privacy-policy/page.tsx), [términos](../Portal/src/app/terms-of-service/page.tsx) |
| Registro actual de decisiones, revocación y conservación | [Documento interno](compliance-patient-data.md) |
| Casilla en reserva y acceso a citas | [PatientSteps](../Portal/src/components/PublicBooking/PatientSteps.tsx), [PortalConsent](../Portal/src/components/PublicBooking/PortalConsent.tsx) |
| Canal ofrecido y contacto acreditado | [portal-contact](../Server/src/portal/portal-contact.ts) |
| Clasificación email y números confiables | [patient-resolution](../Server/src/portal/patient-resolution.ts), [repositorio de pacientes](../Server/src/patients/patient.repository.ts) |
| Tipo único de consentimiento y restricciones de eliminación | [Esquema, ConsentKind y PatientConsent](../Server/schema.prisma) |
| Escritura, revocación y bloqueo opcional | [Servicio de consentimiento](../Server/src/patient-consents/patient-consent.service.ts) |
| Autorización conservada en solicitud y copiada al aprobar | [portal-request](../Server/src/portal/portal-request.service.ts), [revisión de solicitudes](../Server/src/booking-requests/booking-request-review.service.ts) |
| Reingreso y consentimiento del contacto resuelto | [portal-session.service](../Server/src/portal/portal-session.service.ts) |
| Auditoría de eliminación con nombre | [patient.service](../Server/src/patients/patient.service.ts) |
| Documento de clínica con descarga pública por identificador | [consent-document.routes](../Server/src/consent-documents/consent-document.routes.ts) |

La descarga pública observada corresponde al documento de la clínica; **no se constató que contenga datos de pacientes**. Antes de abrir, comprobar que se usa solo para material informativo o protegerlo si admite documentos personales. La política no puede convertir en válido un acceso no autorizado mediante una advertencia.

No se modificó código, política publicada ni configuración; no se enviaron mensajes ni se aceptaron contratos. No se ejecutaron tests, no se accedió a bases de datos ni se hicieron pruebas sobre servicios vivos. Los anexos son propuestas completas de redacción sujetas a las condiciones identificadas; no son una certificación de que los controles que describen ya estén implantados.

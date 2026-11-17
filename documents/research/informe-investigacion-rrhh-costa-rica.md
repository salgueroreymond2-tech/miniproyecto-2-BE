# Informe de investigación documental: Recursos Humanos y RAG

**Empresa ficticia:** NexoTico Servicios Tecnológicos, S.R.L.  
**Versión:** 1.0  
**Fecha de vigencia:** 17 de noviembre de 2026  
**Responsable:** Gerencia de Personas y Cultura / Comité de Gobierno de Información  
**Extensión prevista de distribución:** 8 páginas

## 1. Propósito, método y límites de uso

Este informe documenta la base de conocimiento para una empresa ficticia costarricense de servicios tecnológicos con cincuenta colaboradores. Su fin es apoyar políticas internas, consultas de Recursos Humanos y recuperación de contexto para un sistema RAG. No es un criterio jurídico, una liquidación, una certificación médica ni una decisión disciplinaria.

La investigación se realizó el 17 de noviembre de 2026 mediante fuentes institucionales: Ministerio de Trabajo y Seguridad Social (MTSS), Código de Trabajo y normas disponibles en el Sistema Costarricense de Información Jurídica de la Procuraduría General de la República (SCIJ/PGR), Caja Costarricense de Seguro Social (CCSS) y la referencia normativa de la Agencia de Protección de Datos de los Habitantes (PRODHAB). Se usaron fuentes primarias u oficiales para respaldar afirmaciones legales. Cuando una fuente fue inaccesible desde el entorno, se dejó constancia de ello en vez de completar el vacío con una suposición.

El material distingue dos capas. La primera es **obligación legal verificada**: una síntesis trazable de la fuente que debe consultarse de nuevo si el caso individual depende de una versión vigente, una fecha, un cálculo o un hecho controvertido. La segunda es **política interna ficticia**: reglas de operación de NexoTico que no se presentan como ley y que pueden modificarse por control de versiones. Esta separación es indispensable para un RAG: una respuesta debe identificar qué capa está usando y no elevar un beneficio interno a derecho legal ni rebajar un derecho legal por una regla interna.

La base no contiene datos reales de personas. Los colaboradores, canales, beneficios, calendarios y responsables son constructos ficticios para el proyecto académico. La fuente de verdad textual son los archivos Markdown; los DOCX y PDF son copias de distribución, y la matriz XLSX facilita importación estructurada a Google Sheets.

<!-- PAGE BREAK -->

## 2. Identidad corporativa y perímetro documental

La entidad definida es **NexoTico Servicios Tecnológicos, S.R.L.**, también llamada **NexoTico**. Es una empresa B2B ficticia con sede de referencia en San José, Costa Rica, dedicada al desarrollo de software, integración de sistemas, analítica de datos y soporte tecnológico. El modelo operativo es híbrido y la dotación de referencia es de cincuenta personas colaboradoras ficticias.

La identidad única evita respuestas contradictorias. Todas las políticas usan versión 1.0, vigencia de 17 de noviembre de 2026 y responsables identificables. La Gerencia de Personas y Cultura custodia contenidos laborales; Finanzas participa donde hay nómina; Seguridad de la Información participa en accesos y activos; el Comité de Gobierno de Información custodia datos personales. Esta distribución no crea cargos reales: establece responsables internos para que el corpus RAG pueda derivar la consulta al equipo correcto.

Las diez políticas cubren vacaciones y feriados; permisos y licencias; incapacidades; jornada y teletrabajo; remuneración; beneficios; onboarding y salida; desempeño; conducta y denuncias; y protección de datos. Para cada una se incluyeron objetivo, alcance, obligaciones legales verificadas, reglas internas, procedimiento, excepciones, preguntas RAG y fuentes. El patrón disminuye la ambigüedad de recuperación: una pregunta por “pago durante incapacidad” puede recuperar la política de incapacidades, pero debe derivar el cálculo a Nómina; una pregunta por “horario remoto” recupera la política de jornada, sin confundirla con un beneficio de vacaciones.

No se encontró en el repositorio un enunciado académico adicional ni un banco de preguntas específico. Por esa razón no se inventaron preguntas de evaluación. En su lugar, cada política contiene preguntas de recuperación representativas del tema y este informe deja como pendiente comparar el corpus con el enunciado cuando sea entregado. La cobertura se limita a los diez documentos solicitados y no declara completitud frente a requisitos no recibidos.

<!-- PAGE BREAK -->

## 3. Marco laboral: Código de Trabajo y MTSS

El Código de Trabajo, Ley N.° 2, es la fuente estructural para derechos y obligaciones nacidos de la relación de trabajo. La consulta se realizó en SCIJ/PGR y se complementó con la publicación del Código disponible en el MTSS. Para decisiones concretas se debe abrir la versión vigente de la norma, comprobar reformas, identificar el artículo aplicable y pedir criterio profesional cuando existan hechos en disputa. La política no debe citar artículos, porcentajes o plazos si no se verificaron para el caso y la fecha correspondientes.

El portal de Asuntos Laborales del MTSS fue particularmente útil para información explicativa sobre vacaciones, feriados, aguinaldo, constancias de finalización y efectos de determinadas ausencias. De esta fuente se incorporaron, de forma explícita, el mínimo de dos semanas de vacaciones por cada cincuenta semanas de trabajo continuo, la necesidad de constancia del otorgamiento, la lista de feriados de pago obligatorio y no obligatorio, y la regla general de disfrute del feriado. Las políticas no transforman esos hechos en cálculos individualizados: un algoritmo no debe decidir pago doble, acumulación o saldo final solo a partir de una pregunta genérica.

También se documentó que el MTSS publica y actualiza información sobre salario mínimo y aguinaldo. NexoTico no fija valores de salario mínimo en el corpus porque cambian y porque la clasificación del puesto debe revisarse contra el instrumento vigente. En remuneración se establece un calendario interno quincenal, pero se marca de forma expresa que ese calendario no desplaza el salario aplicable, las deducciones permitidas ni el pago legal de aguinaldo.

La regla de diseño que se deriva de la investigación es conservadora: si una respuesta cambia dinero, continuidad laboral, descanso, seguridad social o una medida disciplinaria, el RAG debe mostrar la política interna pertinente, citar su versión y dirigir la situación a Personas y Cultura. No debe producir asesoría legal individual ni fabricar un resultado de nómina.

<!-- PAGE BREAK -->

## 4. Descanso, jornada y teletrabajo

La política de vacaciones y feriados mantiene separado el marco legal de las reglas de solicitud. La ley establece un piso de descanso y los feriados oficiales; NexoTico define el uso del Portal Personas, la coordinación de cobertura y la anticipación operativa. Esta diferencia permite contestar “¿cómo solicito mis vacaciones?” con el procedimiento interno y “¿qué feriados se reconocen?” con la fuente del MTSS, sin afirmar que una jefatura pueda suprimir el derecho por carga de trabajo.

El teletrabajo se investigó a partir de la Ley N.° 9738 y la guía básica del MTSS. Ambas fuentes orientan a tratar el teletrabajo como una modalidad que usa tecnologías de información y que debe documentarse por escrito, sin reducir derechos laborales. La política interna establece una jornada de referencia de lunes a viernes de 08:00 a 17:00, una pausa de alimentación y hasta tres días remotos para puestos elegibles. Estas cifras son decisiones ficticias de NexoTico, no límites legales ni derecho automático de toda persona.

La política prohíbe asumir que conectarse desde casa equivale a disponibilidad permanente. Incluye una regla interna de desconexión fuera de la jornada, guardias solo pactadas y autorización previa para horas adicionales. También impide el teletrabajo desde otro país sin una revisión escrita legal, fiscal, migratoria, de seguros y de datos. Esta precaución no afirma que el teletrabajo internacional sea ilegal; reconoce que el marco consultado no permite inferir una solución uniforme para cada caso.

Para RAG, las etiquetas recomendadas son: `vacaciones`, `feriados`, `descanso`, `horario`, `teletrabajo`, `horas-adicionales`, `desconexion` y `cobertura`. Las respuestas que involucren fechas de feriados deben advertir que se verificará el calendario oficial del año consultado.

<!-- PAGE BREAK -->

## 5. Incapacidades, permisos, nómina y CCSS

La CCSS fue consultada mediante documentos institucionales sobre incapacidades, su registro y el Reglamento del Seguro de Salud. La fuente distingue incapacidad como período de reposo y subsidio como prestación sujeta a condiciones del aseguramiento. Por esa razón el corpus no fija porcentajes, montos, cantidades de cuotas ni fechas de pago de subsidio. Tales datos pueden variar por regla vigente o situación concreta y no deben ser inventados por un asistente.

NexoTico adopta medidas internas protectoras: notificación sin diagnóstico, ausencia de exigencia de trabajo durante la incapacidad, acceso restringido a la constancia y comunicación a la jefatura solo de las fechas necesarias para cobertura. El documento separa el registro de la ausencia de la decisión médica y de la determinación de subsidio. Si hay accidente de trabajo, incapacidad prolongada, documento atípico o discusión de pago, el flujo exige escalamiento humano.

En permisos y licencias se evita declarar que todos los supuestos tienen la misma protección. Las licencias legales se resuelven con norma específica y documentación correspondiente; los permisos por diligencia, duelo o formación descritos en la política son beneficios internos ficticios. De este modo, un permiso interno no se confunde con maternidad, adopción, cuido, una orden judicial u otra situación legalmente protegida. La ausencia de un número en el documento legal no autoriza a descontar un derecho.

Para remuneración, la política interna define pago el día 15 y el último día hábil. El MTSS confirma la relevancia del salario mínimo vigente y del aguinaldo en el sector privado, incluido el límite de pago del aguinaldo. La matriz RAG debe excluir cálculos personalizados y dirigir preguntas de neto, embargos, incapacidad, liquidación o ajuste retroactivo a Nómina. Etiquetas sugeridas: `incapacidad`, `CCSS`, `permiso`, `licencia`, `pago`, `aguinaldo`, `comprobante` y `salario-minimo`.

<!-- PAGE BREAK -->

## 6. Conducta, denuncias, desempeño y salida

La Ley N.° 7476 y el protocolo de recepción de denuncias del MTSS fueron usados como base para separar principios legales de diseño interno. El material del MTSS trata el hostigamiento o acoso sexual como conducta indeseada con efectos perjudiciales y resalta la confidencialidad del trámite. NexoTico no replica el procedimiento administrativo de una institución pública. En cambio, implementa un canal interno ficticio, confirmación de recepción, evaluación de conflicto de interés, medidas de protección, investigación imparcial y seguimiento de represalias.

La confidencialidad no es una promesa de secreto absoluto. La política explica que puede haber deberes de debido proceso, preservación de evidencia o requerimientos de autoridad. Tampoco convierte una denuncia en prueba concluyente ni permite que una jefatura investigue unilateralmente. Casos de riesgo, violencia, posible delito, hostigamiento sexual o alta gerencia se escalan a las instancias humanas y externas que correspondan. El sistema RAG debe evitar dar instrucciones de confrontación o prometer un resultado disciplinario.

La evaluación del desempeño es exclusivamente una política interna. Sus ciclos, criterios, escala descriptiva, posibilidad de observación y planes de desarrollo no sustituyen procedimientos legales. El documento prohíbe rankings forzados y el uso de métricas aisladas como única base de decisión. También contempla ajustes en casos de ausencia protegida, conflictos o alegaciones de discriminación.

Onboarding y salida integran contrato, accesos, activos, formación e información de negocio. La fuente MTSS consultada reconoce el derecho a solicitar una constancia de conclusión de contrato; el resto de pagos y documentación se somete a revisión del caso. Las etiquetas recomendadas son: `denuncia`, `represalia`, `hostigamiento`, `conducta`, `desempeno`, `onboarding`, `salida`, `accesos` y `constancia`.

<!-- PAGE BREAK -->

## 7. Protección de datos y controles para RAG

La Ley N.° 8968 consultada en SCIJ/PGR establece como objetivo la protección de la autodeterminación informativa frente al tratamiento automatizado o manual de datos personales. Por esta razón, la política de NexoTico no trata los datos de Recursos Humanos como material libre para entrenamiento, prueba o recuperación semántica. La finalidad, minimización, acceso por rol, conservación y eliminación son controles previos a cualquier incorporación de información en un sistema.

El sitio oficial de PRODHAB fue consultado directamente, pero devolvió un error 403 desde el entorno de investigación. Esta limitación se documentó en vez de presentar el contenido del sitio como verificado. La referencia a la Ley N.° 8968 se contrastó en SCIJ/PGR y la política ordena verificar la fuente vigente de PRODHAB para obligaciones de inscripción, transferencias, reclamos o notificaciones antes de actuar.

La decisión de arquitectura documental es especialmente importante: el RAG se alimentará inicialmente de políticas aprobadas, procedimientos y contenido sintético o anonimizado. Se prohíbe incorporar diagnósticos, incapacidades, denuncias, identificaciones, cuentas bancarias, evaluaciones individuales o expedientes personales sin aprobación escrita del Comité de Gobierno de Información y revisión legal específica. Esta es una barrera interna de seguridad, no una afirmación de que toda incorporación de un dato sea jurídicamente imposible.

Las respuestas RAG deben mostrar versión, documento y sección. Si la consulta contiene datos sensibles o solicita una decisión personalizada —por ejemplo, “¿puedo ver la denuncia de mi compañero?”— el sistema debe responder con el límite de acceso y ofrecer derivación al canal de privacidad, no recuperar documentos privados. Etiquetas sugeridas: `datos-personales`, `datos-sensibles`, `privacidad`, `RAG`, `acceso`, `rectificacion`, `retencion` e `incidente`.

<!-- PAGE BREAK -->

## 8. Matriz de fuentes, consistencia y pendientes

| Fuente oficial consultada | Uso documental | Estado de verificación |
| --- | --- | --- |
| MTSS, Asuntos Laborales | vacaciones, feriados, aguinaldo, constancias | verificada el 17/11/2026 |
| MTSS, guía de teletrabajo | adenda, derechos y horario en teletrabajo | verificada el 17/11/2026 |
| MTSS, protocolo de denuncias | confidencialidad y recepción de denuncias | verificada el 17/11/2026 |
| SCIJ/PGR, Código de Trabajo Ley N.° 2 | marco general laboral | fuente oficial; confirmar versión vigente por caso |
| SCIJ/PGR, Ley N.° 9738 | marco de teletrabajo | verificada el 17/11/2026 |
| CCSS, reglamento y guías de incapacidad | reposo, constancia y proceso institucional | verificada el 17/11/2026 |
| SCIJ/PGR, Ley N.° 8968 | propósito de protección de datos | verificada el 17/11/2026 |
| PRODHAB | autoridad y actualización sectorial | consultada; acceso 403 desde el entorno |

La revisión de coherencia confirma que los diez documentos usan la misma entidad, vigencia, versión y responsables, y que ninguno otorga datos de personas reales. Beneficios, horario, permisos, calendario y canal interno son señalados como reglas ficticias de NexoTico. Los documentos legales no asignan valores de salarios, porcentajes de subsidio, cálculos de liquidación, plazos de sanción ni diagnósticos médicos sin verificación individual.

Pendientes antes de una puesta en producción: validar la versión vigente de cada norma al momento de publicar; obtener acceso navegable a la guía y trámites de PRODHAB; revisar con asesoría legal los anexos de teletrabajo, la clasificación de beneficios y la retención documental; y contrastar el corpus contra el enunciado académico cuando sea suministrado. La matriz XLSX y los archivos de distribución deben pasar la misma revisión de control de versiones que los Markdown antes de cargarse a un repositorio RAG.

## Fuentes completas

1. MTSS, Asuntos laborales: https://www.mtss.go.cr/temas-laborales/
2. MTSS, Código de Trabajo: https://www.mtss.go.cr/elministerio/marco-legal/documentos/codigo_trabajo_cr.pdf
3. SCIJ/PGR, Código de Trabajo, Ley N.° 2: https://pgrweb.go.cr/scij/Busqueda/Normativa/Normas/nrm_texto_completo.aspx?nValor1=1&nValor2=8045&nValor3=129508&param1=NRTC&strTipM=TC
4. CCSS, Reglamento para el Otorgamiento de Incapacidades: https://aissfa.ccss.sa.cr/arc/publicaciones/21/a9c01.pdf
5. CCSS, guía de constancia de incapacidad o licencia: https://aissfa.ccss.sa.cr/arc/medicina/33/24b15.pdf
6. SCIJ/PGR, Ley N.° 9738: https://www.pgrweb.go.cr/DOCS/NORMAS/1/VIGENTE/L/2010-2019/2015-2019/2019/15E99/1308C9.HTML
7. MTSS, guía básica de teletrabajo: https://www.mtss.go.cr/perfiles/lineamientos_circulares_directrices_politicas_internas/lineamientos-circulares-directrices-politicas%20internas/Guia_basica_Teletrabajo.pdf
8. SCIJ/PGR, Ley N.° 8968: https://www.pgrweb.go.cr/DOCS/NORMAS/1/VIGENTE/L/2010-2019/2010-2014/2011/1153F/DCEF7.HTML
9. PRODHAB: https://www.prodhab.go.cr/
10. MTSS, protocolo de denuncia de hostigamiento sexual: https://www.mtss.go.cr/perfiles/lineamientos_circulares_directrices_politicas_internas/lineamientos-circulares-directrices-politicas%20internas/protocolo_denuncia_acoso_sexual.pdf


/**
 * Texto íntegro de la Política de Privacidad y Tratamiento de Datos Personales
 * (borrador v1.0 del Dr. Breinner Prieto, docs/legal/politica-datos-borrador-breinner-v1.txt).
 * Los espacios en blanco del borrador ya están llenos con los datos de la cooperativa.
 * «[[PD]]» marca un dato aún «Por definir» (la página lo muestra discreto).
 * Se quitaron las referencias pegadas «(Sede Electrónica)» y «(Función Pública)».
 */
export type BloquePolitica = { p: string } | { items: string[] };
export type SubseccionPolitica = { num: string; titulo: string; bloques: BloquePolitica[] };
export type SeccionPolitica = SubseccionPolitica & { subs: SubseccionPolitica[] };

export const SECCIONES_POLITICA: SeccionPolitica[] = [
 {
  "num": "1",
  "titulo": "Objeto",
  "bloques": [
   {
    "p": "COOPERATIVA GREEN ALLIANCE (sigla COOP GREEN), en adelante “LA COOPERATIVA”, adopta la presente Política de Privacidad y Tratamiento de Datos Personales, con el propósito de establecer los lineamientos, principios, procedimientos y condiciones bajo los cuales se realizará la recolección, almacenamiento, uso, circulación, actualización, transmisión, transferencia y supresión de datos personales de sus asociados, clientes, usuarios, trabajadores, contratistas, proveedores, beneficiarios, codeudores, deudores, potenciales clientes y demás personas naturales cuyos datos sean objeto de tratamiento por parte de LA COOPERATIVA."
   },
   {
    "p": "La presente política tiene como finalidad garantizar el derecho fundamental al hábeas data, la intimidad, el buen nombre y la autodeterminación informativa, de conformidad con el artículo 15 de la Constitución Política y las disposiciones contenidas, principalmente, en la Ley Estatutaria 1581 de 2012, el Decreto 1377 de 2013, incorporado al Decreto 1074 de 2015, y demás normas que las modifiquen, adicionen o reglamenten."
   },
   {
    "p": "Cuando LA COOPERATIVA realice tratamiento de información financiera, crediticia, comercial o de servicios en calidad de fuente, usuario u operador, se observarán adicionalmente las disposiciones especiales contenidas en la Ley 1266 de 2008, sus modificaciones y demás normas aplicables al hábeas data financiero. La Ley 1266 regula específicamente la información financiera, crediticia, comercial y de servicios."
   }
  ],
  "subs": []
 },
 {
  "num": "2",
  "titulo": "Alcance",
  "bloques": [
   {
    "p": "La presente política aplica a todas las bases de datos, archivos físicos, digitales, electrónicos, audiovisuales, sistemas de información y demás medios en los cuales LA COOPERATIVA almacene o trate datos personales."
   },
   {
    "p": "Su aplicación comprende, entre otros, a:"
   },
   {
    "items": [
     "Asociados.",
     "Clientes y usuarios.",
     "Solicitantes de productos o servicios.",
     "Deudores y obligados.",
     "Codeudores, fiadores y garantes.",
     "Beneficiarios.",
     "Referencias personales y comerciales suministradas legítimamente.",
     "Trabajadores y candidatos a procesos de selección.",
     "Contratistas y proveedores.",
     "Representantes legales y personas de contacto de terceros.",
     "Visitantes.",
     "Aliados comerciales.",
     "Personas que se comuniquen con LA COOPERATIVA a través de canales físicos o digitales.",
     "Cualquier otra persona natural cuyos datos personales sean objeto de tratamiento por LA COOPERATIVA."
    ]
   }
  ],
  "subs": []
 },
 {
  "num": "3",
  "titulo": "Marco normativo",
  "bloques": [
   {
    "p": "La presente política se fundamenta, entre otras, en las siguientes disposiciones:"
   },
   {
    "items": [
     "Constitución Política de Colombia, especialmente artículo 15.",
     "Ley 1581 de 2012 – Régimen General de Protección de Datos Personales.",
     "Decreto 1377 de 2013.",
     "Decreto 1074 de 2015, en lo relacionado con protección de datos personales.",
     "Ley 1266 de 2008 – Régimen especial de hábeas data financiero, crediticio, comercial y de servicios."
    ]
   },
   {
    "p": "Ley 2157 de 2021 y demás disposiciones que modifiquen o adicionen el régimen de hábeas data financiero."
   },
   {
    "p": "Ley 2300 de 2023, cuando resulte aplicable a las comunicaciones comerciales y de cobranza."
   },
   {
    "p": "Demás normas, decretos, circulares, instrucciones y decisiones de las autoridades competentes que regulen la protección y tratamiento de datos personales."
   },
   {
    "p": "La Ley 1581 establece como principios, entre otros, la legalidad, finalidad, libertad, veracidad o calidad, transparencia, acceso y circulación restringida, seguridad y confidencialidad."
   }
  ],
  "subs": []
 },
 {
  "num": "4",
  "titulo": "Definiciones",
  "bloques": [
   {
    "p": "Para efectos de esta política se tendrán en cuenta las siguientes definiciones:"
   }
  ],
  "subs": [
   {
    "num": "4.1",
    "titulo": "Autorización",
    "bloques": [
     {
      "p": "Consentimiento previo, expreso e informado otorgado por el Titular para llevar a cabo el tratamiento de sus datos personales, salvo las excepciones establecidas legalmente."
     }
    ]
   },
   {
    "num": "4.2",
    "titulo": "Base de datos",
    "bloques": [
     {
      "p": "Conjunto organizado de datos personales objeto de tratamiento."
     }
    ]
   },
   {
    "num": "4.3",
    "titulo": "Dato personal",
    "bloques": [
     {
      "p": "Cualquier información vinculada o que pueda asociarse a una persona natural determinada o determinable."
     }
    ]
   },
   {
    "num": "4.4",
    "titulo": "Dato público",
    "bloques": [
     {
      "p": "Dato que por su naturaleza puede estar contenido en registros, documentos públicos o ser de conocimiento general, de conformidad con la legislación aplicable."
     }
    ]
   },
   {
    "num": "4.5",
    "titulo": "Dato privado",
    "bloques": [
     {
      "p": "Información que, por su naturaleza, tiene carácter reservado y cuyo conocimiento está limitado al Titular."
     }
    ]
   },
   {
    "num": "4.6",
    "titulo": "Dato semiprivado",
    "bloques": [
     {
      "p": "Información que no tiene naturaleza íntima, reservada ni pública y cuyo conocimiento puede interesar al Titular y a determinado sector o grupo de personas."
     }
    ]
   },
   {
    "num": "4.7",
    "titulo": "Dato sensible",
    "bloques": [
     {
      "p": "Información cuyo tratamiento indebido puede afectar la intimidad del Titular o generar discriminación, incluyendo datos relativos a salud, biométricos, orientación política, convicciones religiosas o filosóficas, pertenencia sindical, origen racial o étnico, vida sexual, entre otros establecidos por la ley."
     }
    ]
   },
   {
    "num": "4.8",
    "titulo": "Encargado del tratamiento",
    "bloques": [
     {
      "p": "Persona natural o jurídica, pública o privada, que realiza tratamiento de datos personales por cuenta de LA COOPERATIVA."
     }
    ]
   },
   {
    "num": "4.9",
    "titulo": "Responsable del tratamiento",
    "bloques": [
     {
      "p": "LA COOPERATIVA, en cuanto determina las finalidades y medios del tratamiento de los datos personales."
     }
    ]
   },
   {
    "num": "4.10",
    "titulo": "Titular",
    "bloques": [
     {
      "p": "Persona natural cuyos datos personales son objeto de tratamiento."
     }
    ]
   },
   {
    "num": "4.11",
    "titulo": "Tratamiento",
    "bloques": [
     {
      "p": "Cualquier operación realizada sobre datos personales, incluyendo recolección, almacenamiento, uso, circulación, consulta, actualización, transmisión, transferencia y supresión."
     }
    ]
   }
  ]
 },
 {
  "num": "5",
  "titulo": "Principios para el tratamiento de datos personales",
  "bloques": [
   {
    "p": "LA COOPERATIVA aplicará los siguientes principios:"
   }
  ],
  "subs": [
   {
    "num": "5.1",
    "titulo": "Legalidad",
    "bloques": [
     {
      "p": "El tratamiento de datos personales se realizará conforme a la Constitución, la ley y demás disposiciones aplicables."
     }
    ]
   },
   {
    "num": "5.2",
    "titulo": "Finalidad",
    "bloques": [
     {
      "p": "Los datos serán tratados para finalidades legítimas, determinadas, explícitas e informadas al Titular."
     }
    ]
   },
   {
    "num": "5.3",
    "titulo": "Libertad",
    "bloques": [
     {
      "p": "El tratamiento se realizará con autorización previa, expresa e informada del Titular, salvo los casos exceptuados por la ley."
     }
    ]
   },
   {
    "num": "5.4",
    "titulo": "Veracidad o calidad",
    "bloques": [
     {
      "p": "LA COOPERATIVA procurará que la información sea veraz, completa, exacta, actualizada, comprobable y comprensible."
     }
    ]
   },
   {
    "num": "5.5",
    "titulo": "Transparencia",
    "bloques": [
     {
      "p": "El Titular podrá conocer, en cualquier momento y conforme a la ley, la existencia de información personal que le concierna y el tratamiento que se realiza sobre ella."
     }
    ]
   },
   {
    "num": "5.6",
    "titulo": "Acceso y circulación restringida",
    "bloques": [
     {
      "p": "Los datos personales serán tratados exclusivamente por las personas autorizadas y dentro de los límites establecidos por la Constitución, la ley y esta política."
     }
    ]
   },
   {
    "num": "5.7",
    "titulo": "Seguridad",
    "bloques": [
     {
      "p": "LA COOPERATIVA implementará medidas técnicas, humanas, administrativas y organizacionales razonables para evitar pérdida, adulteración, consulta, utilización o acceso no autorizado o fraudulento."
     }
    ]
   },
   {
    "num": "5.8",
    "titulo": "Confidencialidad",
    "bloques": [
     {
      "p": "Las personas que intervengan en el tratamiento de datos personales deberán mantener la reserva de la información, incluso después de terminada su relación laboral, contractual o comercial con LA COOPERATIVA."
     }
    ]
   }
  ]
 },
 {
  "num": "6",
  "titulo": "Datos personales que podrá tratar la cooperativa",
  "bloques": [
   {
    "p": "Dependiendo de la relación existente con el Titular y de las finalidades correspondientes, LA COOPERATIVA podrá tratar información como:"
   },
   {
    "items": [
     "Nombre y apellidos.",
     "Documento de identidad.",
     "Fecha y lugar de nacimiento.",
     "Nacionalidad.",
     "Dirección de residencia.",
     "Teléfono.",
     "Correo electrónico.",
     "Información laboral.",
     "Información profesional.",
     "Información económica y patrimonial.",
     "Información financiera.",
     "Información relacionada con obligaciones crediticias.",
     "Información comercial.",
     "Información relacionada con referencias.",
     "Información contractual.",
     "Información relacionada con productos y servicios adquiridos.",
     "Información necesaria para procesos de conocimiento del cliente o asociado.",
     "Información relacionada con garantías, obligaciones, codeudores y beneficiarios.",
     "Información necesaria para procesos de cobranza.",
     "Información contenida en documentos aportados por el Titular.",
     "Datos derivados de comunicaciones con LA COOPERATIVA.",
     "Registros de atención al cliente.",
     "Registros audiovisuales o de seguridad, cuando existan."
    ]
   },
   {
    "p": "Datos biométricos, únicamente cuando exista una finalidad legítima y se cumplan los requisitos legales aplicables."
   },
   {
    "p": "LA COOPERATIVA recolectará únicamente la información que resulte pertinente, necesaria y proporcional para cumplir las finalidades informadas."
   }
  ],
  "subs": []
 },
 {
  "num": "7",
  "titulo": "Finalidades del tratamiento",
  "bloques": [
   {
    "p": "LA COOPERATIVA podrá tratar los datos personales para las siguientes finalidades:"
   }
  ],
  "subs": [
   {
    "num": "7.1",
    "titulo": "Gestión de asociados y clientes",
    "bloques": [
     {
      "items": [
       "Gestionar solicitudes de vinculación.",
       "Verificar y actualizar información.",
       "Administrar la relación contractual o asociativa.",
       "Gestionar productos y servicios.",
       "Atender solicitudes, peticiones, quejas y reclamos.",
       "Mantener actualizados los registros de asociados y clientes."
      ]
     }
    ]
   },
   {
    "num": "7.2",
    "titulo": "Gestión de productos financieros, crediticios o comerciales",
    "bloques": [
     {
      "p": "Cuando corresponda a las actividades autorizadas de LA COOPERATIVA:"
     },
     {
      "items": [
       "Analizar solicitudes de crédito.",
       "Realizar estudios de capacidad de pago.",
       "Analizar riesgos.",
       "Verificar información suministrada.",
       "Gestionar obligaciones.",
       "Administrar garantías.",
       "Realizar seguimiento a obligaciones.",
       "Gestionar pagos y recaudos.",
       "Realizar procesos de cobranza.",
       "Gestionar acuerdos de pago.",
       "Administrar información relacionada con deudores, codeudores, fiadores y garantes."
      ]
     }
    ]
   },
   {
    "num": "7.3",
    "titulo": "Información financiera y crediticia",
    "bloques": [
     {
      "p": "Cuando legalmente corresponda, LA COOPERATIVA podrá consultar, reportar, almacenar, actualizar y utilizar información financiera, crediticia, comercial y de servicios conforme al régimen especial aplicable."
     },
     {
      "p": "Cuando actúe como fuente de información ante operadores legalmente autorizados, el tratamiento se realizará de acuerdo con la autorización otorgada por el Titular y con las obligaciones establecidas en la Ley 1266 de 2008 y sus modificaciones."
     },
     {
      "p": "La información financiera y crediticia estará sujeta a los principios de veracidad, integridad, actualización, circulación restringida, seguridad y confidencialidad."
     }
    ]
   },
   {
    "num": "7.4",
    "titulo": "Cumplimiento de obligaciones legales",
    "bloques": [
     {
      "p": "Los datos podrán ser tratados para:"
     },
     {
      "items": [
       "Cumplir obligaciones legales.",
       "Atender requerimientos de autoridades administrativas o judiciales.",
       "Atender requerimientos de organismos de vigilancia y control.",
       "Cumplir obligaciones tributarias.",
       "Cumplir obligaciones contables."
      ]
     },
     {
      "p": "Cumplir obligaciones relacionadas con prevención del lavado de activos y financiación del terrorismo, cuando resulten aplicables."
     },
     {
      "p": "Cumplir disposiciones relacionadas con protección al consumidor y protección de datos personales."
     }
    ]
   },
   {
    "num": "7.5",
    "titulo": "Gestión comercial",
    "bloques": [
     {
      "p": "Con autorización cuando sea requerida:"
     },
     {
      "items": [
       "Informar sobre productos y servicios.",
       "Enviar información comercial.",
       "Realizar campañas de mercadeo.",
       "Realizar encuestas de satisfacción.",
       "Comunicar promociones, beneficios y novedades.",
       "Gestionar programas de fidelización."
      ]
     },
     {
      "p": "El Titular podrá solicitar en cualquier momento el cese del uso de sus datos para finalidades de mercadeo directo, sin perjuicio de los tratamientos que sean necesarios para cumplir obligaciones legales o contractuales."
     }
    ]
   },
   {
    "num": "7.6",
    "titulo": "Gestión administrativa",
    "bloques": [
     {
      "p": "Los datos podrán ser utilizados para:"
     },
     {
      "items": [
       "Facturación.",
       "Contabilidad.",
       "Gestión de cartera.",
       "Gestión documental.",
       "Auditoría.",
       "Control interno.",
       "Gestión de proveedores.",
       "Gestión de contratistas.",
       "Seguridad física y lógica.",
       "Administración de sistemas de información."
      ]
     }
    ]
   }
  ]
 },
 {
  "num": "8",
  "titulo": "Tratamiento de datos sensibles",
  "bloques": [
   {
    "p": "LA COOPERATIVA evitará recolectar datos sensibles cuando estos no sean necesarios para una finalidad legítima."
   },
   {
    "p": "Cuando excepcionalmente sea necesario tratar datos sensibles, se informará al Titular de manera previa sobre:"
   },
   {
    "items": [
     "El carácter sensible del dato.",
     "La finalidad específica del tratamiento.",
     "El carácter facultativo de otorgar la autorización.",
     "Los derechos que le asisten."
    ]
   },
   {
    "p": "El tratamiento de datos sensibles se realizará únicamente cuando exista fundamento legal para ello y bajo medidas reforzadas de seguridad y confidencialidad."
   }
  ],
  "subs": []
 },
 {
  "num": "9",
  "titulo": "Datos de niños, niñas y adolescentes",
  "bloques": [
   {
    "p": "LA COOPERATIVA no realizará tratamiento de datos personales de niños, niñas y adolescentes salvo cuando dicho tratamiento sea legalmente procedente, respete sus derechos fundamentales y atienda a su interés superior."
   },
   {
    "p": "Cuando sea necesario, se solicitará la autorización del representante legal y se aplicarán las condiciones especiales establecidas por la legislación colombiana."
   }
  ],
  "subs": []
 },
 {
  "num": "10",
  "titulo": "Autorización del titular",
  "bloques": [
   {
    "p": "LA COOPERATIVA solicitará autorización para el tratamiento de datos personales mediante mecanismos físicos, electrónicos, telefónicos, digitales, formularios, contratos, aplicaciones, páginas web u otros medios que permitan acreditar posteriormente la autorización."
   },
   {
    "p": "La autorización deberá permitir demostrar:"
   },
   {
    "items": [
     "Identificación del Titular.",
     "Fecha de autorización.",
     "Medio utilizado.",
     "Finalidades informadas.",
     "Datos objeto de tratamiento.",
     "Aceptación del Titular, cuando corresponda."
    ]
   },
   {
    "p": "LA COOPERATIVA conservará la prueba de las autorizaciones obtenidas durante el tiempo legalmente necesario."
   }
  ],
  "subs": []
 },
 {
  "num": "11",
  "titulo": "Derechos de los titulares",
  "bloques": [
   {
    "p": "De conformidad con la Ley 1581 de 2012, los Titulares tendrán, entre otros, los siguientes derechos:"
   },
   {
    "items": [
     "Conocer los datos personales que reposen en las bases de datos de LA COOPERATIVA.",
     "Solicitar la actualización de sus datos.",
     "Solicitar la rectificación de información incorrecta, incompleta o inexacta.",
     "Solicitar prueba de la autorización otorgada.",
     "Conocer el uso dado a sus datos personales.",
     "Presentar consultas y reclamos.",
     "Solicitar, cuando legalmente proceda, la supresión de sus datos.",
     "Revocar la autorización cuando resulte jurídicamente procedente.",
     "Acceder gratuitamente a sus datos personales."
    ]
   },
   {
    "p": "Presentar quejas ante la Superintendencia de Industria y Comercio, una vez agotados los mecanismos internos correspondientes, cuando ello sea exigible."
   },
   {
    "p": "Estos derechos se encuentran expresamente reconocidos por el artículo 8 de la Ley 1581 de 2012."
   }
  ],
  "subs": []
 },
 {
  "num": "12",
  "titulo": "Procedimiento para consultas",
  "bloques": [
   {
    "p": "El Titular, sus causahabientes o representantes legalmente acreditados podrán presentar consultas para conocer la información personal que repose en las bases de datos de LA COOPERATIVA."
   },
   {
    "p": "La solicitud deberá contener, como mínimo:"
   },
   {
    "items": [
     "Nombre completo del Titular.",
     "Número de identificación.",
     "Descripción de la solicitud.",
     "Dirección física o electrónica para recibir respuesta.",
     "Documentos que acrediten la representación, cuando corresponda."
    ]
   },
   {
    "p": "Las consultas serán atendidas dentro de los términos establecidos por la legislación vigente."
   },
   {
    "p": "Actualmente, el artículo 14 de la Ley 1581 contempla un término máximo de diez (10) días hábiles para responder las consultas, con posibilidad de una extensión en los términos establecidos por la propia norma."
   }
  ],
  "subs": []
 },
 {
  "num": "13",
  "titulo": "Procedimiento para reclamos",
  "bloques": [
   {
    "p": "El Titular podrá presentar reclamos cuando considere que la información:"
   },
   {
    "items": [
     "Es incorrecta.",
     "Está incompleta.",
     "Debe ser actualizada.",
     "Debe ser rectificada.",
     "Está siendo tratada indebidamente.",
     "Está siendo utilizada para una finalidad diferente a la autorizada.",
     "Está siendo tratada en contravención de la legislación vigente.",
     "El reclamo deberá contener:",
     "Identificación del Titular.",
     "Descripción de los hechos.",
     "Petición concreta.",
     "Dirección o correo electrónico para recibir respuesta.",
     "Documentos y pruebas que considere pertinentes."
    ]
   },
   {
    "p": "Cuando el reclamo esté completo, LA COOPERATIVA lo tramitará dentro de los términos establecidos legalmente."
   },
   {
    "p": "La Ley 1581 establece actualmente un término de quince (15) días hábiles para resolver los reclamos, con la posibilidad de una ampliación en las condiciones previstas por la ley."
   }
  ],
  "subs": []
 },
 {
  "num": "14",
  "titulo": "Canales para el ejercicio de los derechos",
  "bloques": [
   {
    "p": "Los Titulares podrán ejercer sus derechos a través de:"
   },
   {
    "items": [
     "Correo electrónico: greenalliancecooperativa@gmail.com",
     "Dirección física: Cr 78 No. 16 D 71, Bogotá D.C.",
     "Teléfono: 318 389 4034",
     "Página web: www.greenallianceco.com",
     "Horario de atención: [[PD]]"
    ]
   },
   {
    "p": "LA COOPERATIVA podrá establecer canales adicionales para facilitar el ejercicio de los derechos de los Titulares."
   }
  ],
  "subs": []
 },
 {
  "num": "15",
  "titulo": "Seguridad de la información",
  "bloques": [
   {
    "p": "LA COOPERATIVA implementará medidas técnicas, humanas, administrativas y organizacionales razonables destinadas a proteger los datos personales contra:"
   },
   {
    "items": [
     "Acceso no autorizado.",
     "Uso indebido.",
     "Alteración.",
     "Pérdida.",
     "Destrucción.",
     "Divulgación no autorizada.",
     "Fraude.",
     "Tratamientos no autorizados."
    ]
   },
   {
    "p": "El acceso a información personal estará limitado a las personas que, por sus funciones, necesiten conocerla."
   },
   {
    "p": "Los trabajadores, contratistas, proveedores y terceros autorizados que tengan acceso a información personal deberán observar las obligaciones de confidencialidad correspondientes."
   }
  ],
  "subs": []
 },
 {
  "num": "16",
  "titulo": "Transmisión y transferencia de datos",
  "bloques": [
   {
    "p": "LA COOPERATIVA podrá transmitir o transferir datos personales a terceros cuando ello sea necesario para la prestación de servicios, ejecución contractual, cumplimiento de obligaciones legales, gestión administrativa, tecnológica, contable, jurídica, financiera o de seguridad."
   },
   {
    "p": "Cuando corresponda, LA COOPERATIVA exigirá a dichos terceros el cumplimiento de las obligaciones legales de protección, seguridad y confidencialidad de la información."
   },
   {
    "p": "Las transferencias internacionales de datos se realizarán únicamente en los casos y bajo las condiciones permitidas por la legislación colombiana."
   }
  ],
  "subs": []
 },
 {
  "num": "17",
  "titulo": "Encargados del tratamiento",
  "bloques": [
   {
    "p": "LA COOPERATIVA podrá contratar terceros que actúen como Encargados del Tratamiento."
   },
   {
    "p": "Estos terceros podrán prestar servicios relacionados con:"
   },
   {
    "items": [
     "Tecnología.",
     "Almacenamiento de información.",
     "Gestión documental.",
     "Contabilidad.",
     "Auditoría.",
     "Cobranza.",
     "Mensajería.",
     "Comunicaciones.",
     "Servicios jurídicos.",
     "Seguridad.",
     "Administración de plataformas.",
     "Servicios de apoyo administrativo."
    ]
   },
   {
    "p": "Los Encargados deberán tratar los datos exclusivamente para las finalidades autorizadas y cumplir las obligaciones de seguridad y confidencialidad establecidas por LA COOPERATIVA y la legislación vigente."
   }
  ],
  "subs": []
 },
 {
  "num": "18",
  "titulo": "Información financiera, crediticia y comercial",
  "bloques": [
   {
    "p": "Cuando LA COOPERATIVA trate información financiera, crediticia, comercial o de servicios, deberá observar las disposiciones especiales del régimen de hábeas data financiero."
   },
   {
    "p": "En particular, LA COOPERATIVA procurará que la información reportada sea:"
   },
   {
    "items": [
     "Veraz.",
     "Completa.",
     "Exacta.",
     "Actualizada.",
     "Comprobable.",
     "Comprensible."
    ]
   },
   {
    "p": "Cuando corresponda efectuar reportes a operadores de información, LA COOPERATIVA observará las reglas aplicables respecto de autorización, comunicación, actualización, rectificación, permanencia y retiro de la información."
   },
   {
    "p": "Los Titulares podrán ejercer sus derechos de actualización, rectificación y demás derechos previstos en la legislación aplicable."
   },
   {
    "p": "La Ley 1266 de 2008 constituye el régimen especial colombiano para la información financiera, crediticia, comercial y de servicios."
   }
  ],
  "subs": []
 },
 {
  "num": "19",
  "titulo": "Datos utilizados para cobranza",
  "bloques": [
   {
    "p": "Cuando LA COOPERATIVA realice actividades de gestión de cartera y cobranza, utilizará los datos de contacto necesarios para ejercer legítimamente dicha actividad."
   },
   {
    "p": "Las comunicaciones de cobranza se realizarán respetando las disposiciones legales aplicables, incluyendo las normas relativas a horarios, canales, frecuencia de contacto, protección de datos personales y demás garantías reconocidas al consumidor o deudor."
   }
  ],
  "subs": []
 },
 {
  "num": "20",
  "titulo": "Videovigilancia",
  "bloques": [
   {
    "p": "Cuando LA COOPERATIVA utilice sistemas de videovigilancia, las imágenes serán tratadas para finalidades relacionadas con:"
   },
   {
    "items": [
     "Seguridad de personas.",
     "Protección de bienes.",
     "Prevención de incidentes.",
     "Control de acceso.",
     "Investigación de eventos de seguridad.",
     "Cumplimiento de obligaciones legales."
    ]
   },
   {
    "p": "La utilización de sistemas de videovigilancia estará sujeta a medidas de seguridad y acceso restringido."
   }
  ],
  "subs": []
 },
 {
  "num": "21",
  "titulo": "Conservación de la información",
  "bloques": [
   {
    "p": "Los datos personales serán conservados durante el tiempo que resulte necesario para cumplir las finalidades para las cuales fueron recolectados, mientras subsista una relación contractual, comercial, asociativa o legal, o durante el término requerido para cumplir obligaciones legales, contables, fiscales, judiciales, administrativas o regulatorias."
   },
   {
    "p": "Una vez cumplida la finalidad y vencidos los términos de conservación aplicables, LA COOPERATIVA procederá a eliminar, anonimizar, archivar o conservar la información conforme a las obligaciones legales correspondientes."
   }
  ],
  "subs": []
 },
 {
  "num": "22",
  "titulo": "Confidencialidad",
  "bloques": [
   {
    "p": "Toda persona que tenga acceso a información personal administrada por LA COOPERATIVA deberá mantener estricta reserva sobre la misma."
   },
   {
    "p": "Esta obligación continuará incluso después de terminada la relación laboral, contractual, comercial o institucional."
   },
   {
    "p": "La información únicamente podrá ser revelada cuando:"
   },
   {
    "items": [
     "El Titular lo autorice.",
     "Exista autorización legal.",
     "Una autoridad competente lo requiera.",
     "Exista orden judicial.",
     "Sea necesario para ejecutar una obligación contractual o legal.",
     "Se encuentre dentro de las excepciones previstas por la legislación."
    ]
   }
  ],
  "subs": []
 },
 {
  "num": "23",
  "titulo": "Incidentes de seguridad",
  "bloques": [
   {
    "p": "LA COOPERATIVA establecerá procedimientos internos para identificar, gestionar, documentar y atender incidentes que puedan comprometer la seguridad de los datos personales."
   },
   {
    "p": "Cuando se presente una vulneración de seguridad que genere riesgos para los Titulares, LA COOPERATIVA adoptará las medidas correctivas correspondientes y realizará las comunicaciones o reportes a las autoridades competentes cuando exista obligación legal de hacerlo."
   }
  ],
  "subs": []
 },
 {
  "num": "24",
  "titulo": "Responsabilidad de los trabajadores y contratistas",
  "bloques": [
   {
    "p": "Los trabajadores, funcionarios, contratistas y demás personas autorizadas para acceder a información personal deberán:"
   },
   {
    "items": [
     "Utilizar la información únicamente para el cumplimiento de sus funciones.",
     "Mantener la confidencialidad.",
     "Evitar compartir credenciales.",
     "Proteger documentos físicos y digitales.",
     "Reportar incidentes de seguridad.",
     "Abstenerse de copiar o divulgar información sin autorización.",
     "Cumplir las políticas internas de seguridad de la información."
    ]
   },
   {
    "p": "El incumplimiento podrá generar las consecuencias laborales, contractuales, civiles o legales correspondientes."
   }
  ],
  "subs": []
 },
 {
  "num": "25",
  "titulo": "Modificaciones a la política",
  "bloques": [
   {
    "p": "LA COOPERATIVA podrá modificar esta política cuando sea necesario por cambios legislativos, regulatorios, tecnológicos, operativos o administrativos."
   },
   {
    "p": "Cuando las modificaciones afecten sustancialmente los derechos o finalidades informadas a los Titulares, LA COOPERATIVA comunicará los cambios mediante los mecanismos legalmente aplicables."
   },
   {
    "p": "La versión vigente permanecerá disponible para consulta de los Titulares."
   }
  ],
  "subs": []
 },
 {
  "num": "26",
  "titulo": "Vigencia",
  "bloques": [
   {
    "p": "La presente Política de Privacidad y Tratamiento de Datos Personales entra en vigencia a partir del 1 de octubre de 2026 y permanecerá vigente mientras LA COOPERATIVA realice actividades de tratamiento de datos personales."
   }
  ],
  "subs": []
 },
 {
  "num": "27",
  "titulo": "Responsable de la política",
  "bloques": [
   {
    "p": "La administración, implementación, seguimiento y actualización de la presente política estará a cargo de:"
   },
   {
    "items": [
     "COOPERATIVA GREEN ALLIANCE",
     "Responsable: [[PD]]",
     "Cargo: [[PD]]",
     "Correo electrónico: greenalliancecooperativa@gmail.com",
     "Teléfono: 318 389 4034",
     "Dirección: Cr 78 No. 16 D 71, Bogotá D.C."
    ]
   }
  ],
  "subs": []
 },
 {
  "num": "28",
  "titulo": "Declaración institucional",
  "bloques": [
   {
    "p": "COOPERATIVA GREEN ALLIANCE reconoce que la protección de los datos personales constituye una obligación legal y un compromiso institucional con sus asociados, clientes, trabajadores, proveedores, contratistas y demás Titulares."
   },
   {
    "p": "En consecuencia, LA COOPERATIVA se compromete a tratar la información personal de manera lícita, segura, transparente y responsable, respetando los derechos constitucionales y legales de los Titulares y adoptando las medidas necesarias para prevenir el acceso, uso, divulgación, modificación, pérdida o tratamiento no autorizado de la información."
   },
   {
    "p": "La presente política deberá ser conocida y aplicada por todas las personas que, en razón de sus funciones o relación con LA COOPERATIVA, tengan acceso a datos personales."
   }
  ],
  "subs": []
 }
];

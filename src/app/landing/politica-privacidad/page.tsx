import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/site-contact';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Política de Privacidad',
  description:
    'Política de Privacidad de LegalMev: extensión, cuenta y herramientas con IA. Encargo de tratamiento por cuenta del abogado (Ley 25.326).',
  path: '/landing/politica-privacidad',
});

export default function PoliticaPrivacidadPage() {
  return (
    <article className="container px-5 sm:px-6 lg:px-10 xl:px-12 max-w-3xl py-16 md:py-24">
      <div className="mb-8">
        <Button variant="ghost" asChild>
          <Link href="/landing" className="text-muted-foreground hover:text-foreground">
            ← Volver al inicio
          </Link>
        </Button>
      </div>

      <header className="mb-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          Política de Privacidad – LegalMev
        </h1>
        <p className="mt-2 text-muted-foreground">
          <strong>Última actualización:</strong> 30 de julio de 2026
        </p>
      </header>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-foreground">
        <p className="text-muted-foreground leading-relaxed">
          La presente Política de Privacidad describe cómo{' '}
          <strong>NOTIFICAS SRL</strong> (“LegalMev”, “nosotros”) trata datos personales en
          el marco de la extensión para navegador, el sitio web, la cuenta de usuario y las
          herramientas asistidas por inteligencia artificial (en particular,{' '}
          <strong>Copiloto de Audiencias</strong> y <strong>Control de Pruebas</strong>). El
          tratamiento se rige por la Ley argentina N.º 25.326 y normas complementarias.
        </p>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">1. Identificación</h2>
          <address className="not-italic mt-4 p-4 rounded-lg bg-muted/50 border border-border">
            <strong>NOTIFICAS SRL</strong>
            <br />
            Colón 12, Primer Piso
            <br />
            San Nicolás de los Arroyos, Provincia de Buenos Aires, Argentina
            <br />
            Correo electrónico de contacto:{' '}
            <a
              href={CONTACT_MAILTO}
              className="text-primary hover:text-primary/80 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </address>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">
            2. Roles: usuario profesional, LegalMev y subprestadores
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Respecto de los <strong>datos de la cuenta</strong> (registro, facturación,
            autenticación), NOTIFICAS SRL actúa como responsable del tratamiento necesario
            para prestar el servicio contratado.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Respecto del <strong>contenido de expedientes y documentación judicial</strong>{' '}
            que el usuario carga en herramientas de plataforma (texto, análisis, datos de
            partes, testigos u otros intervinientes), el modelo es el siguiente:
          </p>
          <ul className="list-disc pl-6 mt-4 space-y-2 text-muted-foreground">
            <li>
              <strong>Usuario profesional (abogado, parte o persona autorizada)</strong> =
              responsable del expediente y del tratamiento profesional de esos datos, en el
              marco de la representación o defensa encomendada y del secreto profesional.
            </li>
            <li>
              <strong>LegalMev (NOTIFICAS SRL)</strong> = prestador que trata esos datos{' '}
              <strong>por cuenta del usuario</strong>, conforme al artículo 25 de la Ley
              25.326 (servicios informatizados de tratamiento de datos personales por cuenta
              de terceros), con instrucciones del usuario, confidencialidad y medidas de
              seguridad. LegalMev <strong>no</strong> utiliza el contenido de expedientes
              para fines propios ajenos al servicio (por ejemplo, perfiles comerciales o
              venta de información).
            </li>
            <li>
              <strong>Google (Gemini / infraestructura asociada)</strong> = subprestador
              tecnológico de LegalMev para el procesamiento de IA necesario a la prestación.
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            LegalMev no es un organismo judicial ni una base de antecedentes penales o
            judiciales destinada a informar sobre personas. Es infraestructura tecnológica
            confidencial para que el profesional autorizado organice y analice la
            documentación de su propio asunto.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">3. Alcance</h2>
          <ul className="list-disc pl-6 mt-2 space-y-2 text-muted-foreground">
            <li>la extensión LegalMev para navegador (exportación de expedientes a PDF/ZIP);</li>
            <li>el registro y la gestión de la cuenta en legalmev.com.ar;</li>
            <li>
              las funciones de plataforma con IA: Copiloto de Audiencias y Control de
              Pruebas, cuando el usuario las utiliza.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">4. Datos del usuario de la cuenta</h2>
          <p className="text-muted-foreground leading-relaxed">
            Tratamos datos necesarios para prestar el servicio: identificación y contacto
            (por ejemplo nombre y correo electrónico), credenciales de autenticación, datos
            de facturación cuando corresponda, preferencias de uso y registros técnicos de
            sesión o dispositivo vinculados a la cuenta.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Finalidad: crear y administrar la cuenta, autenticar el acceso, facturar,
            brindar soporte y mejorar la seguridad del servicio.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">5. Extensión: datos del expediente</h2>
          <p className="text-muted-foreground leading-relaxed">
            Cuando el usuario solicita una exportación, la extensión lee la información del
            expediente que <strong>ya está visible o accesible en la pestaña abierta</strong>{' '}
            y genera el archivo en el propio navegador. En el flujo vigente de exportación, el
            PDF/ZIP se arma de manera local y se descarga con las funciones del navegador;
            NOTIFICAS SRL no recibe ni almacena esos archivos a través de ese flujo.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Si el usuario guarda credenciales de un portal judicial en la extensión, esas
            claves se almacenan únicamente de forma local en el navegador y no se envían a
            los servidores de LegalMev.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Portales compatibles (según la versión vigente de la extensión): MEV SCBA, PJN,
            Mesa Virtual MPBA, Poder Judicial de Salta, Mesa Virtual de Entre Ríos y Portal
            SAE de Tucumán.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">
            6. Datos de terceros contenidos en expedientes
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            El contenido que el usuario aporta a Copiloto de Audiencias o Control de Pruebas
            puede incluir datos personales de <strong>terceros del proceso</strong>: nombres
            de partes (actor, demandado, imputado u otros), carátula, testigos, peritos,
            destinatarios de oficios o cédulas, y —en Copiloto— preguntas y respuestas
            registradas en audiencia, análisis y alegatos derivados.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Esos datos no llegan a LegalMev por una recolección indiscriminada: los aporta el
            usuario que declara estar autorizado a acceder y tratar la documentación (por
            ejemplo, letrado habilitado en el portal judicial correspondiente). El tratamiento
            se realiza para una <strong>finalidad profesional o judicial concreta</strong>{' '}
            (organización de la prueba, preparación de audiencia, defensa o representación),
            no para crear perfiles comerciales.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Bajo este modelo de encargo, <strong>no se exige</strong> que LegalMev ni el
            usuario obtengan el consentimiento individual de cada demandado, testigo, perito
            o interviniente nombrado en el expediente antes de usar la herramienta. La
            legitimación se apoya en la relación profesional, la necesidad y proporcionalidad
            vinculadas al proceso, y las instrucciones del usuario responsable.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Antes de almacenar o enviar texto a la IA, el sistema procura eliminar{' '}
            <strong>identificadores sensibles</strong> (DNI, CUIT/CUIL, domicilios,
            matrículas profesionales, teléfonos y correos), conservando nombres necesarios
            para la asistencia. En Control de Pruebas no se solicitan ni guardan domicilios
            de testigos: solo el nombre.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Causas de <strong>familia, niñez, salud o materia penal</strong> pueden contener
            información especialmente reservada. El usuario debe extremar el cuidado del
            secreto profesional; LegalMev aísla los datos por cuenta autenticada (sin
            compartir expedientes entre usuarios distintos) y no ofrece enlaces públicos a
            ese contenido.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">
            7. Finalidad de las herramientas con IA
          </h2>
          <ul className="list-disc pl-6 mt-2 space-y-2 text-muted-foreground">
            <li>
              <strong>Copiloto de Audiencias:</strong> analizar el expediente, asistir en la
              preparación y desarrollo de audiencias y guardar la sesión de trabajo del
              usuario.
            </li>
            <li>
              <strong>Control de Pruebas:</strong> identificar y organizar la prueba
              ofrecida/producida y facilitar el seguimiento profesional de la causa.
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            <strong>Prohibición de entrenamiento:</strong> LegalMev no utiliza el contenido
            de expedientes para entrenar, afinar o mejorar modelos de inteligencia artificial
            propios ni autoriza voluntariamente ese uso a subprestadores más allá de lo
            estrictamente necesario para prestar el servicio solicitado por el usuario.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">8. Almacenamiento y conservación</h2>
          <p className="text-muted-foreground leading-relaxed">
            El PDF binario no se archiva como archivo permanente. Sí pueden persistirse, en
            bases asociadas a la cuenta del usuario:
          </p>
          <ul className="list-disc pl-6 mt-4 space-y-2 text-muted-foreground">
            <li>
              en Copiloto: texto extraído (con redacción de identificadores), análisis,
              declarantes, intercambios, documentos adicionales en texto y alegatos;
            </li>
            <li>
              en Control de Pruebas: datos estructurados del expediente e ítems de prueba,
              sin conservar de forma habitual el texto completo del PDF tras el import.
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            La conservación se limita a lo necesario para prestar el servicio: mientras el
            usuario mantenga la sesión o el expediente activo, o hasta que solicite su
            eliminación o la baja de la cuenta, salvo obligaciones legales de retención.
            LegalMev no conserva el contenido de expedientes más allá de esa finalidad de
            encargo.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">
            9. Inteligencia artificial y transferencias
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Para generar análisis y asistencia, fragmentos o el texto pertinente del
            expediente se envían al subprestador <strong>Google (Gemini)</strong>. Eso puede
            implicar transferencia internacional hacia infraestructuras del proveedor fuera
            de la República Argentina. LegalMev procura encuadrar esa relación mediante
            condiciones contractuales de tratamiento, seguridad y confidencialidad
            aplicables al servicio contratado, y no vende ni alquila el contenido de
            expedientes.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Pueden registrarse métricas de uso del modelo (tokens, modelo, función) con fines
            operativos y de control de costos; esas métricas no incluyen el texto completo
            del expediente.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">10. Declaración del usuario</h2>
          <p className="text-muted-foreground leading-relaxed">
            Al usar las herramientas con IA, el usuario declara —en los términos aceptados en
            la plataforma— que:
          </p>
          <ul className="list-disc pl-6 mt-4 space-y-2 text-muted-foreground">
            <li>
              es abogado, parte o persona debidamente autorizada para acceder y tratar la
              documentación que carga;
            </li>
            <li>
              utiliza la herramienta exclusivamente para una finalidad profesional o judicial
              legítima;
            </li>
            <li>
              no cargará expedientes ni documentación obtenidos sin autorización;
            </li>
            <li>
              cumplirá el secreto profesional y las normas deontológicas aplicables.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">11. Derechos de los titulares</h2>
          <p className="text-muted-foreground leading-relaxed">
            Los titulares pueden ejercer los derechos de acceso, rectificación, actualización
            y supresión previstos en la Ley 25.326, contactando a {CONTACT_EMAIL}. Si la
            solicitud se refiere a datos cargados por un usuario profesional en el marco de
            una causa, podremos requerir la colaboración de ese usuario o canalizar el pedido
            conforme al vínculo de encargo con él, sin comprometer indebidamente el secreto
            profesional.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">12. Seguridad</h2>
          <p className="text-muted-foreground leading-relaxed">
            Aplicamos medidas técnicas y organizativas razonables: autenticación de cuenta,
            aislamiento de datos entre usuarios, comunicaciones cifradas en tránsito hacia
            nuestros servicios y controles de acceso. El usuario es responsable de resguardar
            sus credenciales y el dispositivo desde el cual accede. Se recomienda no compartir
            la sesión ni publicar enlaces a contenido de expedientes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">13. Cambios</h2>
          <p className="text-muted-foreground leading-relaxed">
            Podremos actualizar esta Política cuando cambien el servicio o exigencias
            normativas. Las actualizaciones se publicarán en esta página con la fecha de
            última modificación. Cambios relevantes en el tratamiento de expedientes pueden
            requerir una nueva aceptación en la plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">14. Contacto</h2>
          <p className="text-muted-foreground leading-relaxed">
            Consultas sobre esta Política de Privacidad:
          </p>
          <address className="not-italic mt-4 p-4 rounded-lg bg-muted/50 border border-border">
            <strong>NOTIFICAS SRL</strong>
            <br />
            Colón 12, Primer Piso
            <br />
            San Nicolás de los Arroyos, Provincia de Buenos Aires, Argentina
            <br />
            Correo electrónico:{' '}
            <a
              href={CONTACT_MAILTO}
              className="text-primary hover:text-primary/80 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </address>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Ver también las{' '}
            <Link href="/landing/bases-y-condiciones" className="text-primary hover:underline">
              Bases y Condiciones
            </Link>
            , que incluyen las instrucciones de encargo de tratamiento aplicables a
            expedientes.
          </p>
        </section>
      </div>

      <div className="mt-12 pt-8 border-t">
        <Button variant="outline" asChild>
          <Link href="/landing">Volver al inicio</Link>
        </Button>
      </div>
    </article>
  );
}

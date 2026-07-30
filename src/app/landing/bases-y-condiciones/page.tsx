import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/site-contact';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Bases y Condiciones',
  description:
    'Bases y Condiciones de LegalMev: extensión, cuenta, herramientas con IA y encargo de tratamiento de expedientes (art. 25 Ley 25.326).',
  path: '/landing/bases-y-condiciones',
});

function LegalContactAddress({
  label = 'Correo electrónico de contacto',
}: {
  label?: string;
}) {
  return (
    <address className="not-italic mt-4 p-4 rounded-lg bg-muted/50 border border-border">
      <strong>NOTIFICAS SRL</strong>
      <br />
      Colón 12, Primer Piso
      <br />
      San Nicolás de los Arroyos, Provincia de Buenos Aires, Argentina
      <br />
      {label}:{' '}
      <a href={CONTACT_MAILTO} className="text-primary hover:text-primary/80 hover:underline">
        {CONTACT_EMAIL}
      </a>
    </address>
  );
}

export default function BasesYCondicionesPage() {
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
          Bases y Condiciones – LegalMEV
        </h1>
        <p className="mt-2 text-muted-foreground">
          <strong>Última actualización:</strong> 30 de julio de 2026
        </p>
      </header>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-foreground">
        <p className="text-muted-foreground leading-relaxed">
          Las presentes Bases y Condiciones regulan el acceso y uso del servicio{' '}
          <strong>LegalMEV</strong>, compuesto por el sitio web, la extensión para navegador
          Chrome, los servicios asociados de registro, gestión de cuenta y facturación, y las
          herramientas de plataforma asistidas por inteligencia artificial (incluidos{' '}
          <strong>Copiloto de Audiencias</strong> y <strong>Control de Pruebas</strong>). Al
          registrarse, acceder o utilizar LegalMEV, el usuario acepta íntegramente estos
          términos.
        </p>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">1. Prestador del servicio</h2>
          <p className="text-muted-foreground leading-relaxed">
            El servicio LegalMEV es ofrecido por:
          </p>
          <LegalContactAddress />
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">2. Descripción del servicio</h2>
          <p className="text-muted-foreground leading-relaxed">
            LegalMEV es un software como servicio (SaaS) para profesionales del derecho. Incluye,
            entre otras funciones: (a) la exportación de actuaciones de expedientes judiciales
            a archivo PDF/ZIP desde portales oficiales compatibles mediante la extensión; y
            (b) herramientas de plataforma con IA, como Copiloto de Audiencias y Control de
            Pruebas, cuando estén habilitadas para la cuenta.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            En el flujo de exportación de la extensión, el procesamiento del PDF/ZIP se
            realiza en el dispositivo del usuario y LegalMEV no almacena ese archivo con fines
            de archivo. En cambio, cuando el usuario utiliza Copiloto de Audiencias o Control
            de Pruebas, el contenido que carga puede almacenarse en servidores de LegalMev y
            enviarse a subprestadores de IA según se describe en la Política de Privacidad y
            en la cláusula de encargo de tratamiento de estas bases.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            LegalMEV no es un organismo judicial ni sustituye los portales oficiales. No
            garantiza la disponibilidad, estructura ni continuidad de los sitios de terceros
            ni la exactitud del contenido obtenido desde ellos, ni sustituye el criterio
            profesional del usuario respecto de análisis o sugerencias generadas por IA.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">3. Registro y cuenta</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para utilizar el servicio es necesario crear una cuenta con datos veraces. El
            usuario es responsable de mantener la confidencialidad de sus credenciales y de
            toda actividad realizada desde su cuenta. Puede requerirse la verificación del
            correo electrónico para el uso pleno del servicio. El acceso a herramientas con
            IA requiere cuenta autenticada; el contenido de expedientes de un usuario no se
            comparte con otras cuentas.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">4. Planes, precios y facturación</h2>
          <p className="text-muted-foreground leading-relaxed">
            LegalMEV ofrece la exportación de expedientes a PDF de forma gratuita e ilimitada
            para todos los usuarios registrados (Premium de por vida). Otras funcionalidades
            adicionales del servicio pueden tener condiciones comerciales distintas, las cuales
            se informan en el sitio al momento de su contratación. Los convenios con colegios
            de abogados pueden contemplar condiciones particulares acordadas por escrito con
            cada entidad.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Salvo disposición legal en contrario o acuerdo expreso, los importes abonados por
            períodos ya iniciados no son reembolsables.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">5. Uso aceptable</h2>
          <p className="text-muted-foreground leading-relaxed">
            El usuario se compromete a utilizar LegalMEV de conformidad con la ley, la ética
            profesional y estas bases. Queda prohibido, entre otros: usar el servicio con
            fines ilícitos; cargar documentación obtenida sin autorización; publicar o
            compartir enlaces públicos al contenido de expedientes; intentar eludir límites
            técnicos o de cuota; revender o sublicenciar el acceso; compartir credenciales con
            terceros no autorizados; o realizar ingeniería inversa o interferir con el
            funcionamiento del software.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">
            6. Declaración de autorización del usuario
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Al utilizar Copiloto de Audiencias, Control de Pruebas u otras funciones que
            impliquen cargar o analizar documentación de una causa, el usuario{' '}
            <strong>declara y garantiza</strong> que:
          </p>
          <ul className="list-disc pl-6 mt-4 space-y-2 text-muted-foreground">
            <li>
              es abogado, parte o persona debidamente autorizada para acceder y tratar la
              documentación que carga (incluida la habilitada en portales judiciales como la
              MEV u otros sistemas oficiales);
            </li>
            <li>
              utiliza la herramienta exclusivamente para una finalidad profesional o judicial
              legítima (defensa, representación u organización del propio asunto);
            </li>
            <li>
              no cargará expedientes ni documentación obtenidos sin autorización;
            </li>
            <li>
              cumplirá el secreto profesional y las normas deontológicas aplicables,
              especialmente en causas de familia, niñez, salud o materia penal.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">
            7. Encargo de tratamiento (art. 25, Ley 25.326)
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Respecto del contenido de expedientes y demás documentación judicial cargada por
            el usuario en las herramientas de plataforma, el usuario actúa como{' '}
            <strong>responsable</strong> del tratamiento profesional de esos datos, y
            NOTIFICAS SRL (LegalMEV) actúa como <strong>prestador que trata los datos por
            cuenta del usuario</strong>, en los términos del artículo 25 de la Ley 25.326.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Instrucciones del usuario a LegalMEV:
          </p>
          <ul className="list-disc pl-6 mt-4 space-y-2 text-muted-foreground">
            <li>
              tratar el contenido únicamente para prestar las funciones contratadas
              (análisis, organización, asistencia en audiencia o prueba, almacenamiento de la
              sesión de trabajo);
            </li>
            <li>
              no utilizar el contenido para fines propios ajenos al servicio (incluida la
              creación de perfiles comerciales o la venta de información);
            </li>
            <li>
              <strong>no utilizar el contenido de expedientes para entrenar, afinar o
              mejorar modelos de inteligencia artificial</strong> propios, ni autorizar
              voluntariamente ese uso a subprestadores más allá de lo necesario para ejecutar
              la solicitud del usuario;
            </li>
            <li>
              mantener confidencialidad y medidas de seguridad razonables;
            </li>
            <li>
              permitir al usuario eliminar sesiones o expedientes de trabajo y, en su caso,
              solicitar la baja de la cuenta;
            </li>
            <li>
              recurrir a subprestadores tecnológicos estrictamente necesarios (en particular,
              Google Gemini / infraestructura asociada como subencargado de procesamiento de
              IA), bajo condiciones de seguridad y confidencialidad aplicables al servicio.
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Esta cláusula, junto con la Política de Privacidad y el aviso de aceptación en la
            plataforma, constituye el marco contractual de encargo de tratamiento entre el
            usuario y LegalMEV respecto de esos datos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">
            8. Herramientas con IA y resultados
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Los resultados de la IA son asistencia orientativa y no sustituyen el juicio
            profesional del usuario. El usuario es el único responsable de las decisiones
            jurídicas o procesales que adopte.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">
            9. Dispositivo y restricciones técnicas
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Por razones de seguridad y control de uso, la vinculación de la extensión puede
            limitarse a un dispositivo por cuenta, revocando sesiones previas al vincular un
            nuevo equipo. El usuario debe contar con un navegador compatible y mantener
            actualizada la extensión cuando se indique.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">10. Propiedad intelectual</h2>
          <p className="text-muted-foreground leading-relaxed">
            La marca LegalMEV, el software, el diseño del sitio y los materiales asociados
            son propiedad de NOTIFICAS SRL o de sus licenciantes. No se concede ningún
            derecho sobre ellos más allá del uso permitido por estas bases. El contenido de
            los expedientes sigue siendo del usuario o de quien corresponda según la
            normativa aplicable; LegalMEV no adquiere derechos de explotación sobre ese
            contenido.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">11. Limitación de responsabilidad</h2>
          <p className="text-muted-foreground leading-relaxed">
            En la máxima medida permitida por la ley aplicable, NOTIFICAS SRL no será
            responsable por daños indirectos, lucro cesante o pérdida de datos derivados del
            uso o imposibilidad de uso del servicio, de fallas en portales de terceros, de
            decisiones profesionales del usuario basadas en material exportado o en
            sugerencias, análisis o textos generados por inteligencia artificial, ni por el
            incumplimiento del usuario de sus deberes de autorización, secreto profesional o
            deontología.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">12. Suspensión y terminación</h2>
          <p className="text-muted-foreground leading-relaxed">
            NOTIFICAS SRL podrá suspender o dar de baja cuentas que incumplan estas bases, la
            ley o que representen un riesgo para el servicio o para terceros, con o sin
            preaviso según la gravedad del caso. El usuario puede solicitar la baja de su
            cuenta contactando al correo indicado al final de este documento.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">13. Modificaciones</h2>
          <p className="text-muted-foreground leading-relaxed">
            NOTIFICAS SRL podrá modificar estas Bases y Condiciones. Las versiones
            actualizadas se publicarán en esta página y entrarán en vigencia desde su
            publicación. El uso continuado del servicio tras los cambios implica aceptación de
            las nuevas condiciones. Cambios relevantes en el encargo de tratamiento de
            expedientes pueden requerir una nueva aceptación en la plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">14. Privacidad</h2>
          <p className="text-muted-foreground leading-relaxed">
            El tratamiento de datos personales se rige por la{' '}
            <Link href="/landing/politica-privacidad" className="text-primary hover:underline">
              Política de Privacidad
            </Link>
            , que forma parte integrante de la relación con el usuario.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">15. Ley aplicable y jurisdicción</h2>
          <p className="text-muted-foreground leading-relaxed">
            Estas bases se rigen por las leyes de la República Argentina. Para cualquier
            controversia, las partes se someten a los tribunales ordinarios de la Provincia
            de Buenos Aires, con renuncia a cualquier otro fuero que pudiera corresponderles.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">16. Contacto</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para consultas sobre estas Bases y Condiciones, el servicio o su cuenta:
          </p>
          <LegalContactAddress label="Correo electrónico" />
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

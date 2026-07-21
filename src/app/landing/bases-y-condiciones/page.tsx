import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/site-contact';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Bases y Condiciones',
  description:
    'Bases y Condiciones de uso de LegalMev: sitio web, extensión Chrome para exportar expedientes a PDF y servicios con IA.',
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
          <strong>Última actualización:</strong> junio de 2026
        </p>
      </header>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-foreground">
        <p className="text-muted-foreground leading-relaxed">
          Las presentes Bases y Condiciones regulan el acceso y uso del servicio{' '}
          <strong>LegalMEV</strong>, compuesto por el sitio web, la extensión para navegador
          Chrome y los servicios asociados de registro, gestión de cuenta y facturación. Al
          registrarse, acceder o utilizar LegalMEV, el usuario acepta íntegramente estos
          términos.
        </p>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">1. Responsable del servicio</h2>
          <p className="text-muted-foreground leading-relaxed">
            El servicio LegalMEV es ofrecido por:
          </p>
          <LegalContactAddress />
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">2. Descripción del servicio</h2>
          <p className="text-muted-foreground leading-relaxed">
            LegalMEV es un software como servicio (SaaS) que permite a profesionales del
            derecho exportar actuaciones de expedientes judiciales a archivo PDF desde
            portales oficiales compatibles: MEV SCBA, PJN, MPBA y Salta (según lo indique la extensión y el sitio al momento del uso). El
            procesamiento de los documentos se realiza en el dispositivo del usuario; LegalMEV no
            almacena el contenido de los expedientes exportados en sus servidores con fines de
            archivo.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            LegalMEV no es un organismo judicial ni sustituye los portales oficiales. No
            garantiza la disponibilidad, estructura ni continuidad de los sitios de terceros
            ni la exactitud del contenido obtenido desde ellos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">3. Registro y cuenta</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para utilizar el servicio es necesario crear una cuenta con datos veraces. El
            usuario es responsable de mantener la confidencialidad de sus credenciales y de
            toda actividad realizada desde su cuenta. Puede requerirse la verificación del
            correo electrónico para el uso pleno del servicio.
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
            fines ilícitos; intentar eludir límites técnicos o de cuota; revender o
            sublicenciar el acceso; compartir credenciales con terceros no autorizados; o
            realizar ingeniería inversa o interferir con el funcionamiento del software.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">
            6. Dispositivo y restricciones técnicas
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Por razones de seguridad y control de uso, la vinculación de la extensión puede
            limitarse a un dispositivo por cuenta, revocando sesiones previas al vincular un
            nuevo equipo. El usuario debe contar con un navegador compatible y mantener
            actualizada la extensión cuando se indique.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">7. Propiedad intelectual</h2>
          <p className="text-muted-foreground leading-relaxed">
            La marca LegalMEV, el software, el diseño del sitio y los materiales asociados
            son propiedad de NOTIFICAS SRL o de sus licenciantes. No se concede ningún
            derecho sobre ellos más allá del uso permitido por estas bases.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">8. Limitación de responsabilidad</h2>
          <p className="text-muted-foreground leading-relaxed">
            En la máxima medida permitida por la ley aplicable, NOTIFICAS SRL no será
            responsable por daños indirectos, lucro cesante o pérdida de datos derivados del
            uso o imposibilidad de uso del servicio, de fallas en portales de terceros o de
            decisiones profesionales del usuario basadas en material exportado.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">9. Suspensión y terminación</h2>
          <p className="text-muted-foreground leading-relaxed">
            NOTIFICAS SRL podrá suspender o dar de baja cuentas que incumplan estas bases, la
            ley o que representen un riesgo para el servicio o para terceros, con o sin
            preaviso según la gravedad del caso. El usuario puede solicitar la baja de su
            cuenta contactando al correo indicado al final de este documento.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">10. Modificaciones</h2>
          <p className="text-muted-foreground leading-relaxed">
            NOTIFICAS SRL podrá modificar estas Bases y Condiciones. Las versiones
            actualizadas se publicarán en esta página y entrarán en vigencia desde su
            publicación. El uso continuado del servicio tras los cambios implica aceptación de
            las nuevas condiciones.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">11. Privacidad</h2>
          <p className="text-muted-foreground leading-relaxed">
            El tratamiento de datos personales se rige por la{' '}
            <Link href="/landing/politica-privacidad" className="text-primary hover:underline">
              Política de Privacidad
            </Link>
            , que forma parte integrante de la relación con el usuario.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">12. Ley aplicable y jurisdicción</h2>
          <p className="text-muted-foreground leading-relaxed">
            Estas bases se rigen por las leyes de la República Argentina. Para cualquier
            controversia, las partes se someten a los tribunales ordinarios de la Provincia
            de Buenos Aires, con renuncia a cualquier otro fuero que pudiera corresponderles.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">13. Contacto</h2>
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

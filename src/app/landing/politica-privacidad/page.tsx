import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/site-contact';

export const metadata = {
  title: 'Política de Privacidad – LegalMev',
  description:
    'Política de Privacidad de la extensión LegalMev. Cómo tratamos la información cuando utilizás esta herramienta.',
};

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
          <strong>Última actualización:</strong> 15 de julio de 2026
        </p>
      </header>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-foreground">
        <p className="text-muted-foreground leading-relaxed">
          La presente Política de Privacidad describe cómo funciona la extensión{' '}
          <strong>LegalMev</strong> para navegador y el tratamiento de la información cuando
          los usuarios la utilizan. Se refiere únicamente a la extensión (no al sitio web ni a
          otros productos de LegalMev, salvo la conexión de cuenta necesaria para usar la
          extensión).
        </p>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">1. Responsable</h2>
          <p className="text-muted-foreground leading-relaxed">
            La extensión LegalMev es desarrollada y mantenida por:
          </p>
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
          <h2 className="text-xl font-semibold mt-10 mb-4">2. Finalidad de la extensión</h2>
          <p className="text-muted-foreground leading-relaxed">
            LegalMev es una herramienta de asistencia para profesionales del derecho que
            facilita la <strong>exportación de actuaciones de un expediente judicial a un
            archivo PDF (o ZIP, según el caso)</strong> desde portales judiciales oficiales
            abiertos en el navegador.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            La extensión interactúa únicamente con los portales judiciales compatibles y con
            el dominio de LegalMev necesario para la cuenta del usuario. Los portales
            compatibles son:
          </p>
          <ul className="list-disc pl-6 mt-4 space-y-2 text-muted-foreground">
            <li>MEV SCBA (Provincia de Buenos Aires)</li>
            <li>PJN – Poder Judicial de la Nación</li>
            <li>Mesa Virtual MPBA</li>
            <li>Poder Judicial de Salta</li>
            <li>Mesa Virtual de Entre Ríos</li>
            <li>Portal SAE de Tucumán</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            En la mayoría de esos portales, la exportación requiere que el usuario ya tenga
            sesión iniciada en el portal correspondiente. En Salta, la consulta pública puede
            no requerir login judicial. LegalMev no modifica el funcionamiento de los sistemas
            judiciales ni evita sus mecanismos de autenticación.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">3. Cuenta LegalMev</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para usar la extensión es necesario vincular una cuenta de LegalMev. Al conectar la
            cuenta, la extensión almacena de forma local en el navegador un{' '}
            <strong>token de sesión</strong> y, en su caso, un identificador de dispositivo, el
            nombre para mostrar y la URL base del servicio.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Con esos datos, la extensión se comunica con los servidores de LegalMev
            (legalmev.com.ar) para validar la sesión y el estado del servicio. Eso no incluye
            el envío del contenido del expediente al servidor en el flujo habitual de
            exportación descrito más abajo.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">4. Datos del expediente</h2>
          <p className="text-muted-foreground leading-relaxed">
            Cuando el usuario solicita una exportación, la extensión lee la información del
            expediente que <strong>ya está visible o accesible en la pestaña abierta</strong>{' '}
            (actuaciones, documentos vinculados, metadatos como carátula o número) y genera el
            archivo en el propio navegador del usuario.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            En el flujo vigente de exportación, el PDF/ZIP se arma{' '}
            <strong>de manera local en el dispositivo</strong> y se descarga con las funciones
            del navegador. NOTIFICAS SRL no recibe ni almacena esos archivos a través de ese
            flujo.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            La extensión no está pensada para recopilar datos de navegación ajenos a esa
            función ni para acceder a sitios distintos de los portales listados y de LegalMev.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">
            5. Credenciales de portales judiciales
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Si el usuario decide guardar credenciales de acceso a un portal judicial en la
            extensión, esas claves se almacenan{' '}
            <strong>únicamente de forma local en el navegador</strong> (almacenamiento de la
            extensión) y se usan solo para asistir el inicio de sesión en ese portal, cuando
            esa función está disponible.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            LegalMev <strong>no envía</strong> esas credenciales judiciales a los servidores
            de LegalMev ni a terceros. El guardado es opcional y bajo control del usuario.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">6. Uso de permisos del navegador</h2>
          <p className="text-muted-foreground leading-relaxed">
            La extensión solicita permisos del navegador únicamente en la medida necesaria
            para:
          </p>
          <ul className="list-disc pl-6 mt-4 space-y-2 text-muted-foreground">
            <li>actuar en las páginas de los portales judiciales compatibles;</li>
            <li>leer la información del expediente abierto por el usuario;</li>
            <li>generar y descargar el PDF/ZIP solicitado;</li>
            <li>guardar de forma local preferencias, token de cuenta LegalMev y, si aplica, credenciales de portal;</li>
            <li>comunicarse con pestañas del navegador relacionadas con esa funcionalidad;</li>
            <li>mostrar avisos del navegador vinculados al resultado de operaciones de la extensión.</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Estos permisos no se utilizan para seguimiento publicitario ni para analítica de
            terceros.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">7. Transferencia y terceros</h2>
          <p className="text-muted-foreground leading-relaxed font-medium">
            LegalMev no vende ni alquila datos de usuarios a terceros.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            La comunicación con servidores se limita a LegalMev (cuenta / sesión / estado del
            servicio), según se describe en esta política. No utilizamos herramientas de
            analítica de terceros dentro de la extensión.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">8. Seguridad</h2>
          <p className="text-muted-foreground leading-relaxed">
            El procesamiento del expediente en el flujo de exportación vigente ocurre en el
            navegador del usuario. El token de cuenta LegalMev y eventuales credenciales de
            portal quedan sujetos a las protecciones del almacenamiento de extensiones del
            navegador y al control físico del dispositivo. Recomendamos no compartir el equipo
            ni la sesión del navegador con terceros no autorizados.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">
            9. Cambios en la política de privacidad
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            NOTIFICAS SRL podrá actualizar esta Política de Privacidad cuando resulte
            necesario para reflejar cambios reales en la extensión o exigencias normativas.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Las actualizaciones se publicarán en esta página e indicarán la fecha de última
            modificación.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">10. Contacto</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para cualquier consulta relacionada con esta Política de Privacidad o con el
            funcionamiento de la extensión, los usuarios pueden comunicarse con:
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

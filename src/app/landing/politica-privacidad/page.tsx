import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Política de Privacidad – LegalMEV',
  description:
    'Política de Privacidad de la extensión LegalMEV. Cómo tratamos la información cuando utilizás esta herramienta.',
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
          Política de Privacidad – LegalMEV
        </h1>
        <p className="mt-2 text-muted-foreground">
          <strong>Última actualización:</strong> 2026
        </p>
      </header>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-foreground">
        <p className="text-muted-foreground leading-relaxed">
          La presente Política de Privacidad describe cómo funciona la extensión{' '}
          <strong>LegalMEV</strong> y el tratamiento de la información cuando los usuarios
          utilizan esta herramienta.
        </p>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">1. Responsable</h2>
          <p className="text-muted-foreground leading-relaxed">
            La extensión LegalMEV es desarrollada y mantenida por:
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
              href="mailto:contacto@notificas.com"
              className="text-emerald-600 hover:text-emerald-500 hover:underline"
            >
              contacto@notificas.com
            </a>
          </address>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">2. Finalidad de la extensión</h2>
          <p className="text-muted-foreground leading-relaxed">
            LegalMEV es una herramienta destinada a facilitar a los profesionales del derecho la{' '}
            <strong>exportación de actuaciones de expedientes judiciales a archivos PDF</strong>{' '}
            desde portales judiciales oficiales.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            La extensión funciona únicamente cuando el usuario se encuentra{' '}
            <strong>previamente autenticado en los portales judiciales compatibles</strong>,
            tales como:
          </p>
          <ul className="list-disc pl-6 mt-4 space-y-2 text-muted-foreground">
            <li>MEV SCBA (Provincia de Buenos Aires)</li>
            <li>Portal del Poder Judicial de la Nación</li>
            <li>
              Portal del Ministerio Público de la Provincia de Buenos Aires (MPBA)
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            La extensión actúa exclusivamente como una herramienta de asistencia para el usuario
            dentro de su sesión activa en dichos portales.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">3. Datos que recopila la extensión</h2>
          <p className="text-muted-foreground leading-relaxed font-medium">
            LegalMEV no recopila, almacena ni transmite datos personales de los usuarios.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            La extensión:
          </p>
          <ul className="list-disc pl-6 mt-4 space-y-2 text-muted-foreground">
            <li>no solicita información personal</li>
            <li>no recopila credenciales</li>
            <li>no registra actividad del usuario</li>
            <li>no transmite información a servidores externos</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Toda la información procesada corresponde únicamente al{' '}
            <strong>contenido visible en la página web que el usuario está consultando</strong>,
            y se utiliza exclusivamente para generar el archivo PDF solicitado por el propio
            usuario.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">
            4. Procesamiento local de la información
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            El procesamiento de la información se realiza{' '}
            <strong>exclusivamente de manera local en el navegador del usuario</strong>.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Esto significa que:
          </p>
          <ul className="list-disc pl-6 mt-4 space-y-2 text-muted-foreground">
            <li>los datos del expediente permanecen en el dispositivo del usuario</li>
            <li>la extensión no envía información a servidores externos</li>
            <li>
              la generación del archivo PDF ocurre únicamente dentro del navegador
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">5. Descarga de archivos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Cuando el usuario solicita exportar un expediente, la extensión genera un archivo
            PDF que es descargado directamente en el dispositivo del usuario mediante las
            funciones de descarga del navegador.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            La empresa desarrolladora no tiene acceso a dichos archivos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">6. Uso de permisos del navegador</h2>
          <p className="text-muted-foreground leading-relaxed">
            La extensión utiliza determinados permisos del navegador únicamente para:
          </p>
          <ul className="list-disc pl-6 mt-4 space-y-2 text-muted-foreground">
            <li>acceder a las páginas de los portales judiciales compatibles</li>
            <li>leer la información visible del expediente que el usuario está consultando</li>
            <li>generar el archivo PDF solicitado</li>
            <li>descargar el archivo en el dispositivo del usuario</li>
            <li>almacenar configuraciones locales de la extensión</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Estos permisos se utilizan exclusivamente para el funcionamiento de la herramienta
            y no para recopilar información de los usuarios.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">7. Transferencia de datos</h2>
          <p className="text-muted-foreground leading-relaxed font-medium">
            LegalMEV no vende, alquila ni transfiere datos de usuarios a terceros.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Dado que la extensión no recopila datos personales ni envía información a
            servidores externos, no existe transferencia de datos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">8. Seguridad</h2>
          <p className="text-muted-foreground leading-relaxed">
            LegalMEV está diseñada para funcionar dentro del entorno seguro del navegador del
            usuario. Todo el procesamiento de la información se realiza localmente, lo que
            reduce riesgos asociados a la transmisión de datos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-10 mb-4">
            9. Cambios en la política de privacidad
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            NOTIFICAS SRL podrá actualizar esta Política de Privacidad cuando resulte
            necesario para reflejar mejoras de la extensión o cambios normativos.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Las actualizaciones se publicarán junto con la extensión y entrarán en vigencia
            desde su publicación.
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
              href="mailto:contacto@notificas.com"
              className="text-emerald-600 hover:text-emerald-500 hover:underline"
            >
              contacto@notificas.com
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

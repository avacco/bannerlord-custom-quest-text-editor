# Forja de diálogos

Editor visual de conversaciones para mods de **Mount & Blade II: Bannerlord**. Permite crear y recorrer ramas, importar diálogos de C# y editar textos traducidos en catálogos XML.

## Empezar

1. Descomprime la carpeta y abre `index.html` en una versión reciente de Chrome, Edge o Firefox. El editor funciona sin conexión y sin instalar dependencias.
2. Selecciona **Cargar ejemplo** para abrir *El mirador del valle*, una conversación ficticia creada para la herramienta.
3. Selecciona el saludo y pulsa **Probar diálogo**. Preguntar por el camino vuelve al menú de respuestas. Las otras opciones llevan al cierre.
4. Usa **Nuevo** para crear tu propio proyecto. Añade estados y líneas, y elige su siguiente estado en **Destino** o con los conectores del grafo.

**Probar diálogo** parte del estado seleccionado. La vista previa permite activar condiciones manualmente y muestra como marcadores los valores que se resuelven durante la partida.

## Trabajar con archivos de un mod

| Archivo | Cómo se usa |
| --- | --- |
| **C#** | Selecciona uno o varios archivos con **Abrir archivo**. El importador reconoce registros como `AddPlayerLine`, `AddDialogLine` y construcciones de `DialogFlow`. Usa **Archivo activo** para cambiar de fuente. |
| **XML** | Abre los catálogos de idioma que contienen las claves. Si las líneas apuntan a una clase auxiliar de textos, abre también su archivo C#. Elige **Idioma de los textos** y edita **Texto XML** en el inspector. Las líneas que comparten esa clave muestran el mismo cambio. |
| **JSON** | **Guardar JSON** crea un proyecto que puedes volver a abrir. Si importaste fuentes, el JSON incluye el C# y los catálogos XML junto con las ediciones. Revisa su contenido antes de compartirlo. |

## Exportar

- **Exportar C#** descarga una copia del archivo activo. En un proyecto creado desde cero, genera un método `AddDialogs` para integrar en un mod de Bannerlord. Configura los tokens de entrada y salida según la conversación a la que quieras conectarlo.
- **Exportar XML** descarga una copia del catálogo elegido. Conserva las claves y la estructura del archivo, y aplica los cambios en sus atributos de texto.

La importación de C# es estática. Los diálogos que dependan de cálculos en tiempo de ejecución pueden aparecer como plantillas, referencias o avisos. Revisa la exportación en el proyecto del mod antes de compilarlo.

## Un par de palabras humanas

Esta herramienta fue pensada para hacer más fácil mi tarea de visualizar los diálogos y traducirlos ya que es un incordio tener que andar ubicando los strings, viendo donde encajan, bajo qué contexto, qué viene antes y qué viene después. Pero cada quien hace sus mods a su pinta y esta herramienta probablemente no sea util para otro caso que no sea el mío. Ya lo probé descompilando un par de mods y pasando sus archivos por la herramienta y los resultados fueron... *regulares*.

Props pa' tí si te sirve.

## Licencia

El código de la herramienta y su ejemplo se distribuyen bajo la [licencia MIT](LICENSE). Los archivos que abras en el editor conservan sus propias licencias.

En corto y en cristiano, haz lo que te dé la gana con él. No voy a fingir autoría sobre código que no escribo.
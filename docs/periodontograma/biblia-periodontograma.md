# Periodontograma · Documento base

Todo lo que hay que saber del periodontograma de Invoke IA, de lo clínico a lo técnico, en un solo lugar.

**Cómo leerlo.** La parte 1 explica qué es un periodontograma y qué mide, sin dar nada por sabido. La parte 2 cuenta cómo lo usan los doctores para ver si el paciente mejora o empeora. La parte 3 explica los diagnósticos. La parte 4 recorre la pantalla, función por función. La parte 5 es técnica: base de datos, n8n, configuración y cómo crear la regla del recordatorio. Al final hay un glosario.

Documentos relacionados:

- [Comandos de voz](comandos-de-voz.md): la lista completa de lo que se puede dictar.
- [Diseño técnico](diseno-odontograma-y-periodontograma.md): el plan por fases y las decisiones.

---

## Índice

1. [Entender el periodontograma](#1-entender-el-periodontograma)
2. [Comparar exámenes y leer la evolución](#2-comparar-exámenes-y-leer-la-evolución)
3. [Los diagnósticos](#3-los-diagnósticos)
4. [Recorrido por la funcionalidad](#4-recorrido-por-la-funcionalidad)
5. [Parte técnica](#5-parte-técnica)
6. [Glosario](#6-glosario)

---

## 1. Entender el periodontograma

### 1.1 Para qué sirve

Los dientes no están "clavados" en la boca: están sostenidos por la **encía** y por el **hueso**, como un poste sostenido por la tierra que lo rodea. A esa base que los sostiene se le llama **periodonto**.

Cuando entre el diente y la encía se acumula suciedad con bacterias (la **placa**), la encía se inflama: se pone roja y sangra. Si eso sigue meses o años, la inflamación empieza a "comerse" la base: la encía se despega del diente y el hueso baja. Esa enfermedad se llama **periodontitis**. No duele al principio, por eso hay que medirla. Si no se trata, los dientes se aflojan y se pierden.

El **periodontograma** es el mapa de esa base. Es una ficha con todos los dientes donde el profesional anota, con una regla muy fina, cuánto se despegó la encía en cada punto de cada diente. Sirve para tres cosas:

1. **Saber si hay enfermedad y qué tan grave es** (el diagnóstico).
2. **Decidir el tratamiento** (el plan).
3. **Ver si el tratamiento funciona**, comparando el mapa de hoy con los anteriores (la evolución).

### 1.2 Las partes del diente que importan

Imaginá un diente como un árbol: la parte que se ve es la copa y la raíz está enterrada.

| Parte | Qué es | Comparación |
| --- | --- | --- |
| **Corona** | La parte blanca que se ve, cubierta de esmalte | La copa del árbol |
| **Raíz** | La parte enterrada en el hueso | Las raíces del árbol |
| **LAC** (línea amelocementaria) | La línea donde termina el esmalte y empieza la raíz. Es el "cuello" del diente y **es el punto fijo desde donde se mide todo** | La marca en el tronco donde empieza la tierra |
| **Encía** | El tejido rosado que abraza el cuello del diente | El pasto alrededor del tronco |
| **Margen gingival** | El borde de la encía, la línea donde la encía toca el diente | El borde del pasto |
| **Surco o bolsa** | El espacio entre la encía y el diente. Sano, es una ranura de 1 a 3 mm. Cuando la encía se despega, se hace más hondo y se llama **bolsa** | Un bolsillo: mientras más hondo, más suciedad junta y peor se limpia |
| **Hueso** | Lo que sostiene la raíz | La tierra |
| **Furca** | En los dientes de atrás con dos o tres raíces, el punto donde las raíces se separan | El lugar donde un tronco se divide en dos |

Además de los dientes propios:

- **Implante**: un "tornillo" de titanio que reemplaza una raíz, con una corona encima. **Se mide igual** que un diente, porque también puede enfermarse (se llama periimplantitis).
- **Póntico**: el diente "falso" del medio de un puente; está pegado a sus vecinos y no tiene raíz. **No se mide**.
- **Pieza ausente**: un diente que falta. **No se mide**.

### 1.3 Cómo se nombran los dientes y los lugares que se miden

**Numeración FDI.** Cada diente tiene un número de dos dígitos. El primero dice el **cuadrante** (la boca se divide en cuatro partes) y el segundo la **posición**, contando desde el medio hacia atrás.

- Cuadrante **1**: arriba a la derecha del paciente. **2**: arriba a la izquierda. **3**: abajo a la izquierda. **4**: abajo a la derecha.
- Posición **1** y **2**: incisivos (los de adelante, para cortar). **3**: canino (el colmillo). **4** y **5**: premolares. **6**, **7** y **8**: molares (el 8 es la muela de juicio).
- Ejemplos: **11** es el incisivo central de arriba a la derecha; **36** es la primera muela de abajo a la izquierda; **48** es la muela de juicio de abajo a la derecha.

Un adulto tiene 32 dientes: del 11 al 18, del 21 al 28, del 31 al 38 y del 41 al 48.

**Arcadas.** La **arcada superior** son los dientes de arriba (cuadrantes 1 y 2) y la **inferior**, los de abajo (3 y 4).

**Caras.** Cada diente tiene dos caras que se miden:

- **Vestibular**: la que mira hacia afuera, hacia los labios y las mejillas.
- **Palatina** (arriba) o **lingual** (abajo): la que mira hacia adentro, hacia el paladar o la lengua. En la app se agrupan como "cara interna" y se muestran con la palabra que corresponde a cada arcada.

**Sitios.** En cada cara se mide en tres puntos, así que **cada diente tiene 6 sitios**:

- **Distal**: el costado que mira hacia el fondo de la boca.
- **Centro**: el medio de la cara.
- **Mesial**: el costado que mira hacia el medio de la boca (hacia los dientes de adelante).

Los sitios distal y mesial se llaman **interproximales** (están entre diente y diente). Importan especialmente porque ahí es donde la enfermedad suele avanzar primero.

**Sextantes.** Para el cribado rápido (ver 1.6), la boca se divide en seis partes:

| Sextante | Dientes |
| --- | --- |
| 1 | 18 a 14 (arriba, atrás a la derecha) |
| 2 | 13 a 23 (arriba, adelante) |
| 3 | 24 a 28 (arriba, atrás a la izquierda) |
| 4 | 34 a 38 (abajo, atrás a la izquierda) |
| 5 | 33 a 43 (abajo, adelante) |
| 6 | 44 a 48 (abajo, atrás a la derecha) |

### 1.4 Qué se mide y qué significa cada cosa

El profesional usa una **sonda periodontal**: una varilla muy fina con marcas cada milímetro, como una regla en miniatura. La mete con suavidad entre la encía y el diente hasta que toca fondo y lee cuántos milímetros entró.

#### Profundidad de sondaje (PS)

**Qué es:** cuántos milímetros entra la sonda desde el borde de la encía hasta el fondo de la bolsa. Se anota en cada uno de los 6 sitios de cada diente.

**Cómo leerla:**

| PS | Qué significa | Color en la pantalla |
| --- | --- | --- |
| 1 a 3 mm | Normal: es el surco sano | Sin color |
| 4 mm | Atención: la encía empieza a despegarse | Ámbar |
| 5 mm | Bolsa: ya hay enfermedad | Naranja |
| 6 mm o más | Bolsa profunda: la enfermedad está avanzada en ese punto | Rojo |

Una bolsa es mala porque es un escondite: el cepillo no llega al fondo y las bacterias siguen trabajando.

#### Sangrado al sondaje (SS)

**Qué es:** si el sitio sangra después de pasar la sonda. Se anota sí o no en cada sitio.

**Qué significa:** que **la encía está inflamada ahora**, es decir, que la enfermedad está activa en ese punto. Una encía sana no sangra al tocarla con suavidad. Es como una herida que todavía no cicatrizó.

Con todos los sitios se calcula el **porcentaje de sangrado**: qué parte de los sitios medidos sangró. Por debajo de 10 % se considera bajo.

#### Supuración

**Qué es:** si sale pus del sitio. Es menos frecuente que el sangrado.

**Qué significa:** infección. Es una señal más seria que el sangrado solo.

#### Placa

**Qué es:** si hay placa bacteriana (esa capa blanda y blanquecina de suciedad) en el sitio.

**Qué significa:** cómo se está limpiando el paciente. Con todos los sitios se calcula el **porcentaje de placa**. Por encima de 20 % se considera que la higiene no alcanza.

#### Margen gingival (MG)

**Qué es:** dónde está el borde de la encía con respecto al cuello del diente (la LAC).

- **Positivo (recesión):** la encía **bajó** y deja ver parte de la raíz. Un MG de 2 significa que el borde de la encía está 2 mm por debajo del cuello del diente. Se ve como un diente "más largo".
- **Cero:** el borde de la encía está justo en el cuello.
- **Negativo (agrandamiento):** la encía está **hinchada o crecida** y tapa parte de la corona. Un MG de −2 significa que el borde está 2 mm por encima del cuello.

Algunas clínicas anotan la recesión con signo negativo en lugar de positivo. La app permite elegir la convención (ver 4.11); en la base siempre se guarda igual.

#### Nivel de inserción clínica (NIC)

**Qué es:** cuántos milímetros de sostén se perdieron, medidos desde el punto fijo (el cuello del diente). **No se mide**: la app lo calcula sola.

**Fórmula:** **NIC = PS + MG**.

**Por qué es la medida más importante.** La profundidad de la bolsa sola puede engañar, porque el borde de la encía se mueve. Un ejemplo:

- En enero, un sitio tiene una bolsa de 6 mm y la encía está en su lugar (MG 0). NIC = 6 + 0 = **6 mm** de sostén perdido.
- En julio, la bolsa mide 3 mm. Parece que mejoró mucho. Pero la encía bajó 3 mm (MG 3). NIC = 3 + 3 = **6 mm**.

La bolsa "se achicó" solo porque la encía se retiró. El sostén perdido es el mismo: **no se ganó nada**. Por eso, para saber si el paciente realmente ganó o perdió soporte, los doctores miran el NIC.

Mientras falte el margen de un sitio, ese sitio no tiene NIC.

#### Movilidad

**Qué es:** cuánto se mueve el diente al empujarlo. Se anota una vez por diente, en grados del 0 al III (escala de Miller).

| Grado | Qué significa |
| --- | --- |
| 0 | No se mueve más de lo normal |
| I | Se mueve un poco, menos de 1 mm hacia los costados |
| II | Se mueve más de 1 mm hacia los costados |
| III | Se mueve mucho, también hacia arriba y abajo |

Un diente que se mueve perdió mucho hueso alrededor.

#### Furcas

**Qué es:** en las muelas con varias raíces, si el hueso entre las raíces se perdió. La sonda entra en el espacio donde las raíces se separan.

**Dónde se mide:** en los primeros y segundos molares (no en las muelas de juicio).

- Molares de arriba: tres entradas: **vestibular**, **mesiopalatina** y **distopalatina**.
- Molares de abajo: dos entradas: **vestibular** y **lingual**.

**Grados (escala de Hamp):**

| Grado | Qué significa |
| --- | --- |
| 0 | Sin lesión |
| I | La sonda entra menos de 3 mm entre las raíces |
| II | Entra más de 3 mm, pero no atraviesa |
| III | Atraviesa de lado a lado |

Una furca afectada es difícil de limpiar y de tratar, y complica el pronóstico.

### 1.5 Los índices: los números del examen completo

Con todos los sitios, la app calcula unos números de resumen. **Se calculan solo con los dientes propios**: los implantes tienen sus propios criterios.

| Índice | Qué cuenta | Para qué sirve |
| --- | --- | --- |
| Sitios sondados | Cuántos sitios tienen profundidad | Saber cuánto se midió |
| % sangrado | Sitios que sangran sobre los medidos | Cuánta inflamación activa hay |
| % placa | Sitios con placa sobre los medidos | Cómo se limpia el paciente |
| PS media | Promedio de las profundidades | Tendencia general |
| NIC medio | Promedio del sostén perdido | Tendencia general del daño |
| Sitios ≥ 4 / ≥ 5 / ≥ 6 mm | Cuántos sitios tienen bolsas de cada tamaño | Cuánta enfermedad hay y qué tan profunda |
| 4 mm con sangrado | Sitios de 4 mm que además sangran | Bolsas chicas pero activas |
| 5 mm o más con sangrado | Bolsas que sangran | Lo que más preocupa |
| Piezas con ≥ 5 mm | En cuántos dientes hay bolsas | Si la enfermedad está repartida o concentrada |
| NIC interproximal máximo | El mayor sostén perdido entre diente y diente | Define el estadio (ver 3.3) |

### 1.6 Los tipos de examen

| Tipo | Cuándo se hace | Qué se mide |
| --- | --- | --- |
| **Diagnóstico inicial** | La primera vez, para saber cómo está el paciente | Todo: 6 sitios por diente, margen, furcas, movilidad |
| **Reevaluación** | Unas semanas después del tratamiento, para ver si funcionó | Todo |
| **Mantenimiento** | En los controles periódicos de un paciente ya tratado (cada 3 a 6 meses) | Todo |
| **Cribado PSR/BPE** | Una revisión rápida para decidir si hace falta el examen completo | Solo un código por sextante (ver abajo) |
| **Solo implantes** | Control de los implantes de un paciente | Solo los implantes, 6 sitios cada uno |

**El cribado PSR/BPE** es una revisión rápida. En lugar de anotar 6 números por diente, se recorre cada sextante y se anota **un solo código: el del peor sitio**.

| Código | Qué encontró | Qué hace falta |
| --- | --- | --- |
| 0 | Encía sana: no sangra, sin sarro, bolsa normal | Nada, solo seguir limpiándose bien |
| 1 | Sangra al sondar, sin sarro | Enseñar higiene |
| 2 | Hay sarro (placa endurecida) o restauraciones mal ajustadas | Higiene y limpieza profesional |
| 3 | Bolsa de 3,5 a 5,5 mm | Limpieza y examen completo de ese sextante |
| 4 | Bolsa de más de 5,5 mm | Examen completo de toda la boca y tratamiento |
| X | El sextante tiene menos de dos dientes | Se excluye |
| \* (asterisco) | Además: furca, movilidad, problema de encía o recesión de 3,5 mm o más | Examen completo del sextante |

---

## 2. Comparar exámenes y leer la evolución

### 2.1 Qué buscan los doctores al comparar

Un periodontograma solo es una foto. Lo que realmente le sirve al doctor es **compararlo con los anteriores** para responder: ¿el tratamiento funciona? ¿la enfermedad avanza? ¿hay que hacer algo distinto?

Lo que miran:

1. **El sostén (NIC).** Si bajó, se **ganó inserción**: la encía volvió a pegarse. Si subió, se **perdió inserción**: la enfermedad avanzó. Es lo más importante.
2. **Las bolsas (PS).** Si se achicaron, la limpieza de la bolsa funcionó. Si crecieron, la enfermedad avanza. Pero hay que confirmarlo con el NIC (ver el ejemplo de 1.4).
3. **El sangrado.** Si bajó, la inflamación está bajo control. Es lo primero que mejora después de un tratamiento.
4. **La placa.** Si el paciente se limpia mejor o peor que antes.
5. **Los sitios puntuales que cambiaron.** Un promedio puede esconder un sitio que empeoró mucho.

### 2.2 La regla de los 2 milímetros

Medir con una sonda manual no es exacto: dos mediciones del mismo sitio pueden diferir en 1 mm sin que nada haya cambiado (por la fuerza, el ángulo, la inflamación). Por eso **un cambio de 1 mm se considera "ruido"** y no se interpreta. Recién un cambio de **2 mm o más** es un cambio real.

La app sigue esa regla: en las listas de "empeoraron" y "mejoraron" solo aparecen los sitios que cambiaron 2 mm o más, en profundidad o en inserción.

### 2.3 Cómo se lee la evolución

| Situación | Qué se ve | Qué significa |
| --- | --- | --- |
| **Evolución positiva** | El sangrado baja, las bolsas se achican y el NIC baja o se mantiene | El tratamiento funciona. El paciente va hacia la estabilidad |
| **Mejora aparente** | Las bolsas se achican, pero el NIC queda igual porque la encía bajó (recesión) | La inflamación bajó, pero no se recuperó sostén. Es un resultado aceptable, no una curación |
| **Estable** | Cambios de 1 mm o menos, sangrado bajo | La enfermedad está controlada. Se sigue con mantenimiento |
| **Poca evolución** | El sangrado baja un poco pero las bolsas profundas siguen igual | El tratamiento no alcanzó en esos sitios. Puede hacer falta repetir la limpieza profunda o evaluar cirugía |
| **Evolución negativa** | Aparecen sitios que perdieron 2 mm o más de inserción, nuevas bolsas, más sangrado | La enfermedad avanza. Hay que buscar la causa (higiene, tabaco, diabetes) y reforzar el tratamiento |
| **Mixta** | Unas zonas mejoran y otras empeoran | Hay sitios puntuales que necesitan atención especial |

Para el paciente, la evolución es la mejor motivación: ver su boca "antes y después" le muestra que el esfuerzo sirve.

### 2.4 Las herramientas de comparación de la app

El paso **Evolución** (ver 4.7) ofrece varias formas de ver lo mismo:

- **Deslizador:** el periodontograma de antes a la izquierda y el de hoy a la derecha, con una manija para mover el corte. Es la forma más clara de mostrarle el cambio al paciente.
- **Superponer:** las curvas de hoy y, punteadas, las de antes. Además, en cada sitio, una barra **verde** si se ganó inserción o **roja** si se perdió (más intensa si el cambio es de 2 mm o más).
- **Cambios:** los números de hoy coloreados según cuánto cambió la profundidad: verde fuerte (mejoró 2 mm o más), verde claro (mejoró 1), rojo claro (empeoró 1), rojo fuerte (empeoró 2 o más).
- **Mapa:** una vista de arriba de las arcadas, cada diente como un anillo de 6 porciones coloreadas por el cambio de inserción.
- **Animación:** pasa de un examen al siguiente, sesión por sesión, para contar la historia del tratamiento.
- **Tendencias:** cada índice (sangrado, placa, bolsas, promedios) con una línea de todas las sesiones y la diferencia contra el examen comparado.
- **Empeoraron / Mejoraron:** los sitios que cambiaron 2 mm o más, del mayor cambio al menor.

---

## 3. Los diagnósticos

Con el sondaje completo, la app **sugiere** un diagnóstico. Son sugerencias: el profesional las revisa, cambia lo que haga falta y **confirma**. En la historia clínica queda lo que el profesional confirmó.

### 3.1 Cómo está hoy: la estabilidad

Responde a la pregunta "¿la enfermedad está activa ahora?". Se calcula con los dientes propios de hoy.

| Estado | Regla | En palabras simples |
| --- | --- | --- |
| **Estable** | Sangrado menor a 10 %, ninguna bolsa de 5 mm o más y ningún sitio de 4 mm que sangre | La encía está sana, aunque tenga daño de antes ("periodonto reducido": menos sostén, pero sin enfermedad activa) |
| **Estable con inflamación gingival** | Igual que estable, pero el sangrado es de 10 % o más | No hay bolsas activas, pero la encía está irritada. Falta higiene |
| **Inestable** | Alguna bolsa de 5 mm o más, o algún sitio de 4 mm que sangra | La enfermedad está activa. Hay que tratar |

Aparte se indica si se cumplen los **objetivos de la terapia**: que no quede ninguna bolsa de más de 4 mm que sangre, ni ninguna de 6 mm o más. Es la meta del tratamiento.

### 3.2 ¿Hay periodontitis? El caso

Se considera que el paciente **tiene periodontitis** si:

- tiene pérdida de sostén entre dientes (NIC interproximal) en **dos o más dientes que no están uno al lado del otro**, o
- tiene pérdida de 3 mm o más en las caras de afuera o de adentro, con bolsas de más de 3 mm, en dos o más dientes.

Si no es un caso de periodontitis, el resto de la clasificación (estadio, extensión, grado) no corresponde.

### 3.3 El estadio: qué tan grave es

El estadio dice **cuánto daño hizo la enfermedad**, del I (leve) al IV (muy avanzado). Sigue la clasificación internacional de 2017 de las sociedades de periodoncia de Estados Unidos y Europa (AAP/EFP).

| Estadio | Cuándo |
| --- | --- |
| **I** | El mayor sostén perdido entre dientes es de 1 a 2 mm |
| **II** | Es de 3 a 4 mm |
| **III** | Es de 5 mm o más; o es estadio II pero hay bolsas de 6 mm o más o furcas de grado II o III (eso lo hace más complejo) |
| **IV** | Además, se perdieron 5 dientes o más por la periodontitis |

Dos reglas importantes:

- El estadio se lee en el **examen inicial**, antes del tratamiento. Si el paciente no tiene uno marcado como inicial, se usa el más antiguo.
- **El estadio nunca baja.** Aunque el paciente mejore con el tratamiento, el daño que hubo queda. Si un diagnóstico confirmado antes tenía un estadio más alto, se mantiene.

El dato de **dientes perdidos por periodontitis** no sale del sondaje: lo carga el profesional.

### 3.4 La extensión: dónde está

- **Localizada:** afecta a menos del 30 % de los dientes.
- **Generalizada:** afecta al 30 % o más.
- **Patrón molar-incisivo:** solo en las muelas y los dientes de adelante (típico de pacientes jóvenes). Lo elige el profesional.

La app cuenta como afectados los dientes con 3 mm o más de sostén perdido entre dientes.

### 3.5 El grado: qué tan rápido avanza

El grado dice **a qué velocidad avanza la enfermedad** y qué tan probable es que siga avanzando: A (lento), B (moderado), C (rápido).

**Cómo se calcula:** se divide el porcentaje de hueso perdido (lo mide el profesional en una radiografía, en el diente más afectado) por la edad del paciente.

- Menos de 0,25: **grado A**.
- De 0,25 a 1: **grado B**.
- Más de 1: **grado C**.

Ejemplo: un paciente de 47 años con 35 % de hueso perdido: 35 ÷ 47 = 0,74 → grado B.

**Modificadores** (pueden subir el grado):

- Fuma menos de 10 cigarrillos por día: al menos B. Fuma 10 o más: C.
- Tiene diabetes con buen control (HbA1c menor a 7 %): al menos B. Con mal control (7 % o más): C.

Si falta el dato de la radiografía, la guía indica asumir **grado B**.

La edad sale de la fecha de nacimiento del paciente. El hueso perdido, los cigarrillos y la diabetes los carga el profesional, y pasan al próximo periodontograma.

### 3.6 El riesgo: qué tan probable es que vuelva

El riesgo (método de Lang y Tonetti) estima **qué tan probable es que la enfermedad vuelva o avance**, y con eso **cada cuánto tiene que volver el paciente a control**. Mira seis cosas, cada una en una zona baja, moderada o alta:

| Parámetro | Bajo | Moderado | Alto |
| --- | --- | --- | --- |
| Sangrado | Menos de 10 % | 10 a 25 % | Más de 25 % |
| Sitios de 5 mm o más | Hasta 4 | 5 a 8 | Más de 8 |
| Dientes perdidos (de 28, sin muelas de juicio) | Hasta 4 | 5 a 8 | Más de 8 |
| Hueso perdido ÷ edad | Hasta 0,5 | Hasta 1 | Más de 1 |
| Diabetes | No | — | Sí |
| Tabaco | No fuma | Menos de 20 por día | 20 o más |

- **Riesgo bajo:** a lo sumo un parámetro moderado.
- **Riesgo moderado:** dos o más moderados, o uno alto.
- **Riesgo alto:** dos o más altos.

El riesgo sugiere el **intervalo de mantenimiento**: alto, cada 3 meses; moderado, cada 4; bajo, cada 6. La clínica puede cambiar esos meses (ver 4.11).

En pantalla se dibuja como un **hexágono**: mientras más grande la forma, más riesgo.

### 3.7 El plan de tratamiento

La guía europea (EFP) ordena el tratamiento en pasos. La app arma el plan solo, con el sondaje de hoy:

| Paso | Qué es | Cuándo aparece |
| --- | --- | --- |
| 1 · Higiene | Enseñarle al paciente a limpiarse y controlar la placa | Si la placa supera el 20 % |
| 2 · Reinstrumentación | Limpieza profunda debajo de la encía, diente por diente, con el detalle de los sitios | Sitios de 6 mm o más, o de 4 a 5 mm que sangran |
| 3 · Reevaluar y evaluar cirugía | Volver a medir cuando cicatrice; si la bolsa sigue de 6 mm o más, considerar cirugía | Dientes con algún sitio de 6 mm o más |
| Implante · Rx | Radiografía para medir el hueso del implante | Implantes que sangran o supuran |
| Implante · Desbridamiento | Limpieza del implante | Implantes que sangran o supuran |
| 4 · Mantenimiento | Controles periódicos | Siempre |

Cada ítem se puede incluir o no, y marcar como **Hoy** (se hace en esta sesión) o **Más adelante**.

### 3.8 Los diagnósticos de los exámenes especiales

**Cribado PSR/BPE.** No se clasifica la periodontitis. Se toma el código más alto y se interpreta (ver la tabla de 1.6). El plan sugiere higiene (código 1 o más), limpieza profesional (2 o más) y examen completo de los sextantes con código 3, 4 o asterisco. El riesgo sale del código: 4 es alto; 3 o asterisco, moderado; el resto, bajo.

**Solo implantes.** Cada implante recibe un estado:

| Estado | Regla | Qué significa |
| --- | --- | --- |
| **Sano** | No sangra ni supura | Está bien |
| **Mucositis** | Sangra o supura, sin bolsa de 6 mm ni aumento | La encía alrededor del implante está inflamada, pero el hueso no se perdió. Es reversible |
| **Periimplantitis** | Sangra o supura, con bolsa de 6 mm o más, o 2 mm más profunda que en el examen anterior | Se está perdiendo hueso alrededor del implante. Se confirma con una radiografía |

### 3.9 Cómo queda escrito

Al final, la app arma una frase que resume todo. Ejemplos:

- "Periodontitis generalizada · estadio III · grado B · inestable"
- "Sin periodontitis · estable"
- "PSR/BPE: código máximo 3"
- "36 sano · 46 mucositis"

---

## 4. Recorrido por la funcionalidad

### 4.1 Dónde se encuentra y quién lo puede usar

**Permisos:**

| Permiso | Qué permite |
| --- | --- |
| `PERIO_RECORD_VIEW` (Ver periodontograma) | Ver los periodontogramas en la historia clínica |
| `PERIO_RECORD_REGISTER_SESSION` (Registrar periodontograma) | Crear, editar, firmar, cerrar, eliminar (si no está cerrado) y enmendar |

Al instalar la funcionalidad, cada permiso se le dio a los roles que ya tenían su equivalente del odontograma. Sin el permiso de registrar, todo se ve en solo lectura.

Otras acciones usan permisos que ya existían: cobrar (permisos de Ventas), reservar la cita (crear citas) y cambiar la configuración (editar la configuración del sistema).

**Dónde se crea un periodontograma nuevo:**

1. **Pacientes → elegir un paciente → Crear → Periodontograma.** Abre la historia clínica con un periodontograma nuevo.
2. **Vista rápida del paciente** (el panel que se abre desde la agenda): **Crear → Periodontograma**.
3. **Historia clínica → Agregar sesión → Periodontograma.**
4. **Mi Consultorio**, con una cita abierta: botón **Periodontograma**. Queda vinculado a esa cita y a ese profesional.

**Dónde se ven los que ya existen:** en la línea de tiempo de la historia clínica (ver 4.10).

### 4.2 La hoja del periodontograma

El periodontograma se abre en una hoja lateral grande (se puede agrandar o achicar arrastrando el borde; recuerda el ancho). Tiene tres zonas fijas:

**El encabezado:**

- Las iniciales y el nombre del paciente, el número de periodontograma, la fecha y el profesional.
- Los **cuatro pasos**: Sondaje, Evolución, Diagnóstico y Cierre. Se puede saltar de uno a otro en cualquier momento; el paso terminado lleva una tilde.
- Un **anillo de avance** con el porcentaje completo. El sondaje vale el 90 % (profundidad y margen, mitad cada uno) y el diagnóstico confirmado, el 10 % restante.
- El **estado**: Sondaje en curso, Sondada, Con diagnóstico o Cerrada.
- **Qué falta**: por ejemplo "Faltan 23 sitios por sondar". **Se puede tocar**: lleva al sondaje y resalta en ámbar los sitios que faltan; si ya está todo sondado, lleva al paso que sigue.
- El **indicador de guardado**: "Guardando…", "Guardado hace 5 s" o el error con un botón para reintentar.

**El contenido del paso**, con su propio scroll.

**El pie**, fijo abajo: la navegación de cada paso (volver y seguir) y lo que el paso tenga para decir. Siempre está en el mismo lugar.

**Guardado automático.** Cada cambio se guarda solo, a los 0,8 segundos de dejar de escribir. Si se cierra la hoja con algo sin guardar, primero termina de guardar; si falla, pregunta antes de salir. Si el periodontograma fue cerrado o eliminado desde otro lugar mientras estaba abierto, avisa y pasa a solo lectura.

**Estados del periodontograma** (los calcula la base, nadie los elige):

| Estado | Cuándo |
| --- | --- |
| Sondaje en curso | Falta profundidad o margen en algún sitio (en el cribado: falta algún sextante) |
| Sondada | Profundidad y margen completos |
| Con diagnóstico | Además, el diagnóstico está confirmado |
| Cerrada | Firmado y cerrado. Solo lectura |

### 4.3 Al abrir un periodontograma nuevo

La app prepara el examen para no empezar de cero:

- **Tipo de examen:** "Mantenimiento" si el paciente ya tiene periodontogramas; "Diagnóstico inicial" si es el primero. Se cambia en la barra de arriba.
- **Examen guía:** el último periodontograma cerrado del paciente que tenga sondaje (o el último con sondaje, si ninguno está cerrado). Un cribado PSR/BPE o un examen que quedó vacío nunca son guía: no tienen valores que mostrar. En un examen completo, uno de solo implantes es guía sólo si no hay otro. Sus valores se ven en gris como referencia.
- **Estado de cada diente desde el odontograma:** toma el último odontograma del paciente.
  - Ausente o edéntulo → **ausente** (no se mide).
  - Implante → **implante** (se mide).
  - Dientes del medio de un puente → **póntico** (no se mide). Los de las puntas del puente son pilares y se miden.
  - Con extracción indicada → sigue **presente**, porque todavía está en la boca.
  - La barra de arriba dice qué se trajo, por ejemplo "del odontograma: 18, 28 ausentes · 36 implante".
  - Si no hay odontograma, se usa el examen guía; si tampoco hay, todos presentes.

El estado de cada diente se puede corregir en el inspector (ver 4.4).

### 4.4 Paso 1 · Sondaje

Es donde se cargan las mediciones.

#### La barra del examen

Una sola fila con:

- **Examen de:** el tipo de examen (inicial, reevaluación, mantenimiento, cribado o solo implantes).
- El examen que se usa como **guía** y lo que se trajo del odontograma.
- En "solo implantes", una etiqueta que lo recuerda.
- El **engranaje** de la configuración de la clínica (ver 4.11).
- A la derecha, la **barra de dictado** (ver 4.5).

#### Las tres pasadas

El sondaje se hace en tres vueltas, una para cada cosa:

1. **Profundidad y sangrado:** la profundidad de cada sitio y, si corresponde, sangrado, supuración y placa.
2. **Margen gingival:** el margen de cada sitio.
3. **Furcas y movilidad:** por diente.

Cada pasada muestra cuánto lleva (por ejemplo, 120/168) y una tilde verde al terminar.

**Iniciar con el examen anterior.** Debajo de cada pasada aparece este enlace cuando hay un examen guía y queda algo vacío. Llena lo vacío con los valores del examen anterior:

- En profundidad: copia la profundidad, el sangrado, la supuración y la placa.
- En margen: copia el margen.
- En furcas y movilidad: copia la movilidad y las furcas.

Debajo de "Mostrar el examen anterior como guía" está **Copiar todo del examen anterior**, que hace las tres de una vez.

Reglas de la copia:

- **Nunca pisa lo que ya se midió hoy.**
- Lo copiado queda **subrayado en violeta, pendiente de confirmar**, igual que lo dictado. Se revisa, se corrige lo que cambió y se confirma.
- No se puede firmar con valores copiados sin confirmar.
- Se puede deshacer.

Sirve para los mantenimientos de pacientes estables, donde la mayoría de los valores se repiten y solo hay que retocar algunos.

#### Qué arcada se ve

Un selector con cuatro opciones:

- **Sigue a la sonda** (la opción por defecto): muestra la arcada donde se está midiendo. Dentro del botón se ve hacia cuál apunta (↑ Superior o ↓ Inferior).
- **Superior**, **Inferior**: una sola arcada.
- **Ambas**: las dos. La arcada donde está la sonda se ve resaltada ("la sonda está acá") y la otra, más tenue.

Cuando la sonda **cambia de arcada**, aparece un aviso grande ("Ahora en Arcada inferior · 48 vestibular") y la vista se mueve sola para mostrar dónde se está midiendo, aunque se haya elegido una arcada a mano. Si hay varias arcadas en pantalla, el gráfico se desplaza hasta el sitio activo.

#### Mostrar el examen anterior como guía

Con este interruptor encendido, los valores del examen guía se ven **en gris y en cursiva** en las celdas vacías, y su curva se dibuja **punteada** donde hoy no hay datos. Sirven de referencia; no son datos de hoy.

#### Deshacer y rehacer

Botones en la barra (y Ctrl+Z / Ctrl+Y). Guardan los últimos 60 cambios.

#### La barra guía

Arriba del gráfico, una línea dice **qué toca cargar ahora**: la pieza activa, el sitio y el tipo de dato ("16 V · distal · profundidad de sondaje"). Muestra el avance de la pasada y los atajos de teclado. Si se pidió ver qué falta, debajo aparece una franja ámbar con la cantidad de sitios resaltados y un botón para quitar el resaltado.

#### El gráfico

Cada arcada se dibuja con la cara de afuera arriba, los números de los dientes en el medio y la cara de adentro abajo. Las coronas se miran entre sí y las raíces apuntan hacia afuera.

- **Siluetas de los dientes**, las mismas del odontograma. Los ausentes, punteados; los pónticos, más claros; los implantes, con el tornillo.
- **Líneas de un milímetro** (3, 6 y 9 mm) de fondo, como en un papel milimetrado.
- **Línea punteada del cuello del diente** (LAC).
- **Curva azul:** el margen de la encía. **Curva roja:** el fondo de la bolsa. Entre las dos, una zona rosada: la bolsa.
- **Puntos de color en el fondo de la bolsa:** ámbar a 4 mm, naranja a 5, rojo a 6 o más.
- **Filas de números** de cada cara: SS (sangrado), MG (margen) y PS (profundidad). Las celdas de 4 mm se pintan ámbar y las de 5 o más, rojas.
- **Fila SS:** un punto por sitio. Relleno rojo si sangra; borde naranja grueso si supura; una rayita celeste abajo si tiene placa.
- **Furcas:** triángulos en los molares. Vacío: grado I; rayado: II; lleno: III.
- **Movilidad:** un número romano junto al número del diente. "IMP" en los implantes.
- **Cursor:** la celda donde va el próximo valor, con borde violeta, y una línea punteada que baja hasta el diente.
- **Anillo punteado:** el sitio al que van las marcas (sangrado, supuración, placa).
- **Subrayado violeta:** valores dictados o copiados, sin confirmar.
- **Ámbar punteado:** sitios que faltan, cuando se pidió verlos.
- **Pulso violeta:** lo que un comando de voz acaba de cargar.

**Qué hace cada clic:**

| Dónde | Qué hace |
| --- | --- |
| Celda de PS o MG | Lleva la sonda ahí y cambia a esa pasada |
| Punto de SS | Cicla: sin sangrado → sangra → sangra y supura → limpio |
| Triángulo de furca | Cicla el grado: 0 → I → II → III |
| Número del diente | En furcas y movilidad, elige el diente; en las otras pasadas, cicla la movilidad |
| Columna del diente | Lleva la sonda al primer sitio de ese diente. Si es ausente o póntico, avisa que no se mide |

Abajo hay una **leyenda** con el significado de cada color y símbolo.

#### Cómo avanza la sonda

**Orden de sondaje** (configurable, ver 4.11):

- **Por arcada** (por defecto): superior vestibular de 18 a 28, superior palatina de 28 a 18, inferior vestibular de 48 a 38, inferior lingual de 38 a 48.
- **Vestibulares primero:** superior vestibular de 18 a 28, inferior vestibular de 38 a 48, inferior lingual de 48 a 38, superior palatina de 28 a 18.

En los dos casos se saltean los ausentes y los pónticos; los implantes se miden. En "solo implantes" se recorren solo los implantes.

**Al cargar un valor**, la sonda va al **próximo sitio vacío**. Si no queda ninguno, avisa que la pasada terminó y ofrece pasar a la siguiente.

**Alerta de salto.** Si una profundidad difiere 3 mm o más de la del examen guía ("Ojo: 46 V · distal pasó de 3 a 6 mm"), aparece un aviso con un botón **Corregir** que vuelve a ese sitio. No bloquea: puede ser un cambio real.

#### Las marcas: sangrado, supuración y placa

Las marcas van al **último sitio medido** (porque el sangrado aparece después de sondar) o al **sitio que se eligió** tocándolo. Ese sitio se ve con un **anillo punteado** en el gráfico y el inspector lo dice ("Las marcas van a: 16 vestibular · distal").

Formas de marcar:

- Teclas **B** (sangra), **S** (supura) y **P** (placa).
- Los botones del inspector.
- Tocar el punto en la fila SS.
- Los botones por sitio en la tabla del inspector.
- La voz: "sangra", "sangra distal", "sangra 16 mesial".

#### El inspector

El panel de la derecha (en pantallas angostas, debajo del gráfico) tiene:

- **Indicadores:** sitios sondados, % de sangrado, % de placa y bolsas de 5 mm o más, con colores según lo bueno o malo del valor.
- **La pieza activa:** número, nombre del diente ("Primer molar") y cuadrante, con flechas para ir al sitio anterior o al siguiente.
- **Estado de la pieza:** presente, ausente, póntico o implante. Se corrige acá si el odontograma no coincide con la boca. Pasar a ausente o póntico borra sus mediciones.
- **La tabla de la pieza**, por cara: PS, MG y NIC (calculado) en los tres sitios, con el valor del examen guía en chiquito; y una fila con los botones de sangrado, supuración y placa de cada sitio. Tocar una celda lleva la sonda ahí.
- **Consejo para implantes**: con sangrado o supuración y más profundidad que antes, pedir una radiografía.
- **Teclado numérico** (en las pasadas de profundidad y margen):
  - Dígitos del 0 al 9 y borrar.
  - **+1**, para valores de 10 mm o más (suma 1 al último valor).
  - **Igual que antes · N**: carga el valor del examen guía como medido hoy. En margen, sin valor anterior, carga 0 ("Sin recesión").
  - En margen, **− Agrandamiento** (o **− Recesión**, según la convención de la clínica) para el próximo valor negativo.
  - En profundidad, los botones de **Sangra**, **Supura** y **Placa**, con el sitio al que van.
- **En furcas y movilidad:** los grados de movilidad (0 a III) y de cada entrada de furca, y **Siguiente pieza**.
- **Historia de la pieza:** la profundidad máxima de ese diente en cada examen anterior.
- **Nota de la pieza:** texto libre (por ejemplo, "control radiográfico").

**En tablet** (pantallas de menos de 1000 px de ancho), el teclado queda **fijo abajo** con botones grandes, para que el gráfico use toda la pantalla.

#### Atajos de teclado

| Tecla | Qué hace |
| --- | --- |
| 0 a 9 | Carga el valor (en furcas y movilidad, 0 a 3 es la movilidad) |
| Enter | Igual que antes (el valor del examen guía) |
| ⌫ | Borra el valor y vuelve |
| ← → | Mueve el sitio en la cara (en furcas y movilidad, cambia de pieza) |
| ↑ ↓ | Cambia de cara |
| B / S / P | Sangra / supura / placa en el sitio de las marcas |
| − | En margen: el próximo valor es negativo |
| + | Suma 1 al último valor |
| Ctrl+Z / Ctrl+Y | Deshacer / rehacer |
| / | Va a la barra de dictado para escribir un comando |
| Esc | Sale de una línea de marcas del dictado |

### 4.5 Dictado por voz

La barra de dictado está en la barra del examen. Permite cargar el sondaje **hablando**, en español o en inglés, mientras el profesional sondea con las dos manos.

**Cómo se usa:**

1. Tocar **Dictar** (necesita Chrome o Edge y permiso del micrófono). El micrófono queda encendido hasta tocar **Detener** o decir "parar dictado".
2. Hablar: cada frase se aplica apenas se termina de decir.
3. La barra muestra lo que se está escuchando, lo que entendió ("23 P · PS 3 2 3") y lo que no entendió.
4. También se puede **escribir** el comando en la misma barra y apretar Enter (sirve en cualquier navegador).
5. El botón **?** abre la lista de comandos.

**Ejemplos:**

- "3 2 4": tres sitios seguidos en la línea actual.
- "38 lingual 3 2 4 sangra distal": pieza, cara, valores y una marca.
- "SS 23": va a la línea de sangrado del 23 (por defecto, la cara de adentro). Después se dice "sí" o "no" por sitio.
- "margen gingival", "furcas y movilidad", "arcada inferior", "ver ambas", "anterior", "siguiente".
- "46 movilidad 1", "furca vestibular 2".
- "deshacer", "confirmar", "descartar", "parar dictado".

La lista completa está en [comandos-de-voz.md](comandos-de-voz.md).

**Lo dictado queda pendiente.** Los valores dictados quedan **subrayados en violeta** y la barra muestra "N sitios dictados o copiados sin confirmar", con **Confirmar** y **Descartar** (que devuelve cada sitio a como estaba). No se puede firmar con dictado pendiente.

**Lo que se ve al dictar:**

- Si un comando escribe en un diente o una arcada que no se está viendo, la vista cambia sola para mostrarlo (o muestra las dos arcadas) y **lo cargado parpadea** unos segundos.
- Si la sonda pasa a la otra arcada, aparece el aviso de cambio de arcada.
- Cada frase es un paso de deshacer.

**Respaldo con IA.** Si una frase no se entiende, se manda a un servicio de IA que la reescribe en el lenguaje de comandos (por ejemplo, "en el treinta y ocho por lingual tengo tres, dos y cuatro" → "38 lingual 3 2 4"). La barra muestra "IA" junto a lo que entendió. La IA solo reformula: no inventa valores y lo dictado sigue pendiente de confirmar.

### 4.6 El cribado PSR/BPE

Con el tipo de examen **Cribado PSR/BPE**, el paso 1 cambia: en lugar del gráfico aparecen **seis tarjetas**, una por sextante, ordenadas como en la boca (1, 2, 3 arriba; 6, 5, 4 abajo).

- Cada tarjeta tiene los botones **0, 1, 2, 3, 4 y X** (excluido) y la casilla del **asterisco**.
- La tarjeta activa tiene borde violeta. Con el teclado: 0 a 4 o X codifican la tarjeta activa y pasan a la siguiente; el asterisco (`*`) la marca; ← → mueven.
- Abajo, una leyenda con el significado de cada código.
- El pie muestra cuántos sextantes van ("4 de 6 sextantes").

### 4.7 Paso 2 · Evolución

Compara el periodontograma de hoy con uno anterior (ver 2.4).

- **Con qué se compara:** por defecto, con el examen inicial (lo que más motiva al paciente). Abajo hay una **línea de tiempo** con los exámenes anteriores que tienen sondaje ("Comparar hoy con…"), con la fecha y el sangrado de cada uno; tocar uno lo elige. Los cribados y los exámenes que quedaron vacíos no aparecen ni cuentan en las tendencias: su 0 % de sangrado se leería como una mejora.
- **Modo:** Deslizador, Superponer o Cambios.
- **Arcada:** Superior, Inferior o Ambas.
- **Vista:** Curvas (el gráfico de siempre) o Mapa (vista de arriba).
- **Ver la evolución animada** / **Pausar**.
- **Panel derecho:** tendencias de sangrado, placa, sitios de 5 mm o más, PS media y NIC medio, cada una con su línea; las listas **Empeoraron** y **Mejoraron** (tocar un sitio selecciona su diente y su arcada); y la nota sobre la regla de los 2 mm.
- **El deslizador** se arrastra con el mouse, el dedo o las flechas del teclado. Arriba muestra las etiquetas de los dos exámenes.
- **Primer periodontograma:** si no hay con qué comparar, el paso lo dice y ofrece seguir.
- **Cribado:** como no tiene curvas, se muestra una tabla con los códigos de cada sextante, sesión por sesión.

### 4.8 Paso 3 · Diagnóstico y plan

Muestra lo explicado en la parte 3, en cuatro tarjetas:

1. **Cómo está hoy:** la estabilidad grande y en color, la lista que la justifica (sangrado, bolsas de 5 mm, sitios de 4 mm con sangrado), si se cumplen los objetivos de la terapia y cuatro indicadores.
2. **Clasificación AAP/EFP 2017:**
   - Los datos que carga el profesional: dientes perdidos por periodontitis, hueso perdido en la radiografía (%), edad, cigarrillos por día y diabetes (no, HbA1c menor a 7 %, HbA1c de 7 % o más).
   - Las sugerencias, cada una con su porqué: caso de periodontitis, estadio, extensión y grado.
   - La frase final.
3. **Riesgo de progresión:** el hexágono, los seis parámetros con su zona, el riesgo y "Mantenimiento cada N meses".
4. **Plan por pasos:** los ítems con su casilla y Hoy / Más adelante.

**Cambiar una sugerencia.** Todo se puede cambiar con su selector. Lo cambiado a mano queda marcado con un lápiz ("cambiado") y deja de seguir a la sugerencia.

**Confirmar.** En el pie, **Confirmar diagnóstico** (se habilita con el sondaje completo). Recién ahí queda en la historia clínica y el estado pasa a "Con diagnóstico". **Si después se cambia algo, la confirmación se pierde** y hay que volver a confirmar: lo que queda guardado es siempre lo confirmado.

**En "solo implantes"** no hay clasificación ni hexágono: hay una tarjeta **Implantes** con el estado sugerido de cada implante (sano, mucositis, periimplantitis), su porqué, un selector para cambiarlo y el intervalo de mantenimiento.

**En el cribado** hay una tarjeta **Resultado del cribado** con el código más alto, qué significa, qué hacer y en qué sextantes hace falta el examen completo; el plan; y el intervalo de mantenimiento.

### 4.9 Paso 4 · Cierre

Arriba, el diagnóstico confirmado en una línea. Debajo, tres columnas:

**Reporte para el paciente:**

- Un texto en palabras simples, como la salida de un asistente de chat:
  - El saludo.
  - Cómo están sus encías ("Hoy tus encías están estables", "…inflamadas, pero sin bolsas que tratar" o "Hoy hay zonas de tus encías que necesitan tratamiento").
  - El porcentaje de puntos que sangran y las zonas con bolsas de 5 mm o más, comparados con el primer control.
  - Una indicación concreta ("Hay que repasar la zona de 46, 47. Usá cepillo interdental todas las noches").
  - En el cribado: el código y qué significa.
- **Copiar**: un ícono en la esquina del texto.
- **WhatsApp:** abre el mensaje armado para enviarlo por WhatsApp (necesita el teléfono del paciente).
- **Imprimir:** abre el reporte con las dos arcadas, en colores claros y hoja apaisada, listo para imprimir.
- **Enviar** (email): abre el compositor de email con el reporte. Si la clínica crea una plantilla de email con el código `PERIO_REPORT_EMAIL`, se usa esa (necesita el email del paciente).
- Enviar por WhatsApp o por email deja registrado que el reporte se envió.

**Cobro de hoy:**

- Muestra lo marcado **Hoy** en el plan, como recordatorio.
- **Cobrar** abre el asistente de cobro (el mismo de toda la app), donde se eligen los servicios del catálogo con sus precios.
- Al crear la factura, queda **vinculada al periodontograma** y la tarjeta la muestra ahí mismo: número, estado (pagada, parcial, impaga), total, pagado, saldo y cada pago con su recibo para imprimir. Si queda saldo, **Cobrar saldo**.
- Se puede cobrar aunque el periodontograma ya esté cerrado: cerrar traba la historia clínica, no el dinero.
- **Sin cobro hoy:** para cerrar sin facturar.

**Próxima cita:**

- Sugiere el tipo de cita que pide el plan, con la fecha:
  - **Reinstrumentación** de los dientes del plan, en 1 a 2 semanas, si el plan la tiene para más adelante.
  - **Mantenimiento**, en el intervalo que dio el riesgo.
- **Reservar:** abre el formulario de citas con el paciente, la fecha y el motivo ya cargados. Al guardar, la tarjeta muestra "Cita reservada para el 12/11/2026 a las 10:30".
- **Agendar después:** deja anotada la fecha sugerida (y la usa el recordatorio, ver 4.12).
- **Cambiar:** vuelve a elegir.

**Notas de la sesión:** debajo de la próxima cita, texto libre.

**Índices de hoy:** los diez indicadores del examen (no aparecen en el cribado).

**El pie del cierre:** la lista de lo que hace falta para firmar, cada ítem con tilde verde o aviso ámbar:

- Profundidades completas y margen completo (en el cribado: sextantes codificados). Se pueden tocar para ver qué falta.
- Diagnóstico confirmado (se puede tocar para ir al paso 3).
- Cobro resuelto (factura o "sin cobro hoy").
- Próxima cita (reservada o "agendar después").
- Valores dictados o copiados confirmados (con un botón para confirmar).

**Firmar y cerrar** se habilita con todo resuelto. Pide confirmación. Cerrado:

- Queda en solo lectura, con una franja verde que dice cuándo y quién lo cerró.
- **Enmiendas:** el periodontograma cerrado no se modifica. Con **Enmendar** se agrega un texto (qué se corrige y por qué) que queda junto al examen, con autor y fecha.

### 4.10 En la historia clínica

Cada periodontograma aparece en la **línea de tiempo** de la historia clínica, junto a las otras sesiones:

- **Filtro** "Periodontograma" para ver solo esos.
- **Resumen** en la fila cerrada: tipo de examen, estadio, sangrado y bolsas de 5 mm o más. Chip de estado con el porcentaje si está abierto.
- **Al expandirlo:** a la izquierda, una vista previa chica de las dos arcadas (tocarla lo abre); a la derecha, el título, el tipo, el profesional, el diagnóstico confirmado, los índices o los códigos del cribado, y las notas.
- **Botones:**
  - **Continuar** (si está abierto) o **Ver periodontograma**.
  - **Eliminar**: solo si no está cerrado, con confirmación. Un periodontograma cerrado es parte de la historia clínica y no se borra.
  - **Comparar con hoy**: en un periodontograma que no es el último, abre el más reciente en el paso Evolución, comparado con ese.

### 4.11 Configuración de la clínica

El **engranaje** de la barra del examen abre la configuración del periodontograma. Vale para toda la clínica. Todos la pueden ver; solo la cambia quien puede editar la configuración del sistema.

| Opción | Valores | Qué cambia |
| --- | --- | --- |
| Orden de sondaje | Por arcada (por defecto) · Vestibulares primero | El recorrido de la sonda (ver 4.4) |
| Signo del margen gingival | Recesión positiva (por defecto) · Recesión negativa | Con qué signo se escribe y se muestra el margen. Se guarda igual en los dos casos |
| Mantenimiento sugerido | Meses para riesgo alto (3), moderado (4) y bajo (6) | El intervalo que sugieren el diagnóstico y la próxima cita |

### 4.12 Recordatorio de mantenimiento

El sistema puede avisar cuándo le toca el mantenimiento a cada paciente y mandarle un mensaje.

**De dónde sale la fecha:** del **último periodontograma cerrado** de cada paciente. Es la fecha del examen más los meses de mantenimiento del diagnóstico confirmado (6 si no hay). Si en el cierre quedó "Agendar después" con una fecha, se usa esa. Cuando el paciente cierra un periodontograma nuevo, la fecha se recalcula sola.

**Qué pasa cuando llega la fecha:** el motor de alertas de la app (el mismo de los recordatorios de citas y facturas) crea una **alerta** en el Centro de Alertas unos días antes y, si se configuró, le manda al paciente un **WhatsApp o un email**.

**Lo que hay que hacer una vez:** crear la regla de alerta. Los pasos están en la parte técnica, sección 5.6.

---

## 5. Parte técnica

### 5.1 Mapa de archivos

**Front (Next.js):**

| Archivo | Qué hace |
| --- | --- |
| `src/components/users/perio-record/perio-session-sheet.tsx` | La hoja: carga, borrador, guardado automático, deshacer, estados, encabezado, pasos, pie fijo, lo pendiente de confirmar |
| `perio-probe-step.tsx` | Paso 1: pasadas, avance, teclado, inspector, copiar del anterior, cambio de arcada, dictado |
| `perio-arch.tsx` | El gráfico de una arcada (SVG) y la vista previa de la historia clínica |
| `perio-voice-bar.tsx` | La barra de dictado y su respaldo con IA |
| `perio-screening-step.tsx` | El cribado por sextantes |
| `perio-evolution-step.tsx` | Paso 2: deslizador, superponer, cambios, animación, tendencias, listas |
| `perio-map.tsx` | La vista de mapa (anillos de 6 sitios) |
| `perio-diagnosis-step.tsx` | Paso 3, también para implantes y cribado; la frase del diagnóstico |
| `perio-close-step.tsx` | Paso 4: reporte, cobro, próxima cita, firma, enmiendas, impresión |
| `perio-settings-dialog.tsx` | La configuración de la clínica |
| `perio-step-footer.tsx` | El pie fijo (los pasos lo llenan con un portal) |
| `perio-timeline.tsx` | La tarjeta de la historia clínica |
| `perio-errors.ts` | Traducción de los códigos de error |
| `src/lib/perio/teeth.ts` | Dientes, sitios, secuencia de sondaje y modos |
| `src/lib/perio/probe.ts` | Moverse por la secuencia, copiar y modificar sitios |
| `src/lib/perio/stats.ts` | Índices, avance, estado y completitud (las mismas reglas que la base) |
| `src/lib/perio/compare.ts` | Cambios entre exámenes, interpolación para la animación |
| `src/lib/perio/assess.ts` | Estabilidad, caso, estadio, extensión, grado, riesgo, plan, cribado e implantes |
| `src/lib/perio/voice.ts` · `voice-engine.ts` | El lenguaje de comandos de voz y su aplicación |
| `src/lib/perio/settings.ts` | La configuración de la clínica |
| `src/lib/perio/from-odontogram.ts` | El estado de cada diente desde el odontograma |
| `src/hooks/use-live-dictation.ts` | Reconocimiento de voz continuo del navegador |
| `src/services/perio-record.ts` | Llamadas a n8n y normalización |
| `src/ai/flows/perio-dictation.ts` · `src/app/api/ai/perio-dictation/route.ts` | El respaldo con IA del dictado (Genkit) |

Textos: `PerioRecord` en `src/messages/{es,es-ES,en}.json`. Colores: variables `--perio-*` en `src/app/globals.css`.

**Puntos de entrada tocados:** `clinic-history-viewer.tsx` (línea de tiempo, filtro, hoja), `patients/page.tsx`, `PatientDetailSheet.tsx`, `patient-actions-menu.tsx`, `patient-quick-actions.tsx` y `doctor-workspace.tsx`. Además, se reusaron `WhatsAppComposerDialog` (nuevas props `initialMessage` y `onSent`), `EmailComposerDialog`, `AppointmentFormDialog`, el asistente de cobro e `InvoiceDetails` de la ficha estética.

### 5.2 Base de datos

**Migraciones** (en orden; todas idempotentes):

| Script | Qué agrega |
| --- | --- |
| `163_20261105_perio-record.sql` | Tablas, funciones básicas y permisos |
| `163_20261105_perio-record_down.sql` | Vuelta atrás de la 163, **comentada entera** para que nadie la corra por error; sólo a mano, y se niega a correr si hay periodontogramas cargados |
| `164_20261105_perio-diagnosis.sql` | Diagnóstico, estado `diagnosed`, cierre con diagnóstico |
| `165_20261105_perio-closing.sql` | Factura, datos del cierre, enmiendas, cierre con cobro y cita |
| `166_20261105_perio-screening-implants.sql` | Cribado, solo implantes, vista del recordatorio |
| `167_20261105_perio-report-email.sql` | Email del paciente; la vista del recordatorio pasa a apuntar a `users` |

**Tablas:**

| Tabla | Qué guarda |
| --- | --- |
| `perio_exams` | Un periodontograma: paciente, profesional, cita, fecha, tipo (`initial`, `reevaluation`, `maintenance`, `screening`, `implants`), examen guía, título, notas, estado (`probing`, `probed`, `diagnosed`, `closed`, `void`), completitud, índices (`stats`), `diagnosis`, `closing`, `screening`, `invoice_id`, datos de cierre y anulación, auditoría y borrado lógico (`deleted_at`) |
| `perio_teeth` | Una fila por diente y examen: estado (`present`, `missing`, `pontic`, `implant`), movilidad (0–3), furcas (`{"v":2,"mp":0,…}`), nota |
| `perio_sites` | Una fila por sitio: cara (`v`, `i`), sitio (`D`, `C`, `M`), `pd_mm` (0–15), `gm_mm` (−10 a 15), `cal_mm` **calculado por la base** (= pd + gm), sangrado, supuración, placa y origen del valor (`manual`, `same`, `dictation`) |
| `perio_exam_events` | Registro: `created`, `closed`, `deleted`, `invoice_linked`, `amended` |
| `perio_exam_amendments` | Enmiendas de exámenes cerrados: texto, autor, fecha |

**Contenido de los JSON de `perio_exams`:**

- `diagnosis`: datos cargados (dientes perdidos, hueso perdido, edad, cigarrillos, diabetes), clasificación (caso, estabilidad, estadio, extensión, grado), riesgo, meses de mantenimiento, plan (`kind`, `tooth`, `detail`, `include`, `today`), `psrMax` (cribado), `implants` (estado por implante), `manual` (qué se cambió a mano) y `confirmedAt`.
- `closing`: `noCharge`, `nextVisit` (`mode`: `booked` o `later`, `date`, `time`, `kind`, `appointmentId`) y `reportSentAt`.
- `screening`: `codes` (`{"1":"3",…}`) y `star` (sextantes con asterisco).

**Funciones:**

| Función | Qué hace |
| --- | --- |
| `perio_exam_json(id)` | El examen completo en camelCase, con piezas, sitios (orden D, C, M), diagnóstico, cierre, cribado, factura (con sus servicios), enmiendas, y fecha de nacimiento, teléfono y email del paciente |
| `perio_exams_list(patient_id)` | Los exámenes del paciente, del más viejo al más nuevo, sin los eliminados |
| `perio_exam_recompute(id)` | Recalcula estado, completitud e índices. No toca exámenes cerrados ni anulados. Cuenta según el tipo: presentes e implantes; solo implantes; o los seis sextantes del cribado |
| `perio_exam_save(payload, user)` | Crea o actualiza el examen entero (piezas y sitios se reemplazan), valida y recalcula |
| `perio_exam_close(id, user)` | Firma y cierra. Exige estado `diagnosed`, cobro resuelto y próxima cita |
| `perio_exam_delete(id, user)` | Borrado lógico; solo exámenes no cerrados |
| `perio_exam_link_invoice(id, invoice_id, user)` | Vincula la factura (debe ser de venta y del mismo paciente; una por examen). Funciona con el examen cerrado |
| `perio_exam_amend(id, body, user)` | Agrega una enmienda a un examen cerrado |

**Reglas que calcula la base** (el front usa las mismas para mostrar al instante):

- **Estado:** `probing` mientras falte profundidad o margen en algún sitio sondeable (en el cribado, algún sextante). `probed` con todo completo. `diagnosed` si además hay `diagnosis.confirmedAt`.
- **Completitud:** 90 × (profundidades + márgenes) ÷ (2 × sitios), más 10 si está diagnosticado. Cerrado: 100.
- **Índices:** solo dientes presentes; `maxInterproximalCal` con los sitios distales y mesiales.

**Códigos de error.** Las funciones lanzan `PERIO:<CÓDIGO>|<detalle>` y el flujo responde 400 `{ success: false, code, detail }`.

| Código | Cuándo |
| --- | --- |
| `PATIENT_REQUIRED`, `DATE_REQUIRED` | Falta el paciente o la fecha |
| `EXAM_NOT_FOUND` | No existe o fue eliminado |
| `EXAM_CLOSED` | Se intentó modificar un examen cerrado o anulado |
| `INVALID_TOOTH`, `INVALID_TOOTH_STATUS`, `INVALID_VALUE` | Pieza, estado o valor fuera de rango (también códigos del cribado o próxima cita inválidos) |
| `INVALID_DIAGNOSIS` | Estadio, grado, riesgo o estabilidad inválidos |
| `NOT_READY_TO_CLOSE` | Falta sondaje o diagnóstico |
| `BILLING_PENDING`, `NEXT_VISIT_PENDING` | Falta resolver el cobro o la próxima cita |
| `INVOICE_NOT_FOUND`, `INVOICE_ALREADY_LINKED` | Factura inexistente, de otro paciente o examen ya facturado |
| `NOT_CLOSED`, `AMENDMENT_REQUIRED` | Enmienda de un examen abierto, o sin texto |

**Permisos:** `PERIO_RECORD_VIEW` y `PERIO_RECORD_REGISTER_SESSION`, creados en la 163 y asignados a los roles que tenían `ODONTOGRAM_VIEW` y `ODONTOGRAM_REGISTER_SESSION`.

### 5.3 n8n

Flujo **Perio Record**: `docs/n8n-flows/flow-perio-record.json`. **No se edita a mano**: se genera con `node scripts/n8n/generate-perio-record-workflow.mjs`.

| Endpoint | Función |
| --- | --- |
| `GET perio/exams?patient_id=` | `perio_exams_list` |
| `POST perio/exams/save` `{ exam }` | `perio_exam_save` |
| `POST perio/exams/close` `{ id }` | `perio_exam_close` |
| `POST perio/exams/delete` `{ id }` | `perio_exam_delete` |
| `POST perio/exams/link-invoice` `{ id, invoice_id }` | `perio_exam_link_invoice` |
| `POST perio/exams/amend` `{ id, body }` | `perio_exam_amend` |

Cada endpoint: webhook con JWT → una consulta a Postgres → respuesta. El usuario sale del JWT (`jwtPayload.userId`). Los errores van a un nodo `Map error` que arma la respuesta 400.

### 5.4 Configuración de la clínica

En `system_configurations`, clave **`perio_settings`** (tipo `json`):

```json
{
  "order": "arch",
  "marginSign": "recessionPositive",
  "intervals": { "high": 3, "moderate": 4, "low": 6 }
}
```

`order`: `arch` o `buccalFirst`. `marginSign`: `recessionPositive` o `recessionNegative`. Sin la clave (o si el usuario no puede leer la configuración), se usan esos valores por defecto. Se edita desde el engranaje del periodontograma.

### 5.5 IA del dictado

`src/ai/flows/perio-dictation.ts` usa Genkit con Gemini (`googleai/gemini-2.5-flash`, configurado en `src/ai/genkit.ts`). La ruta `POST /api/ai/perio-dictation` es de Next.js, no de n8n. El navegador la llama solo cuando el intérprete local no entendió nada, con un tiempo máximo de 8 segundos.

Necesita la variable **`GOOGLE_GENAI_API_KEY`** en el servidor de Next. Sin ella, la frase queda como "No entendí" y todo lo demás funciona igual.

### 5.6 Cómo crear la regla del recordatorio de mantenimiento

**Cómo funciona el motor de alertas** (ya existía):

1. El flujo **Alert Instances** se ejecuta **cada 5 minutos** y llama a **Alert Scheduler**.
2. Alert Scheduler toma las reglas activas que tienen que correr ese día (según su recurrencia y su próxima ejecución).
3. Para cada regla, consulta su tabla o vista de origen con las condiciones de la regla. Las variables de fecha (`{{TODAY}}`) se corren según "Días antes del evento" y "Días después del evento".
4. Por cada fila que cumple, crea una **alerta** (`alert_instances`) que se ve en el **Centro de Alertas**. No duplica la misma ocurrencia.
5. Si la regla tiene envío automático, manda el **WhatsApp** o el **email** al paciente.

**La fuente de datos del periodontograma** es la vista `v_alert_perio_maintenance` (scripts 166 y 167): una fila por paciente con su último periodontograma cerrado.

| Columna | Qué es |
| --- | --- |
| `id` | El id del paciente (la vista apunta a `users`, así el envío automático sabe a quién mandarle) |
| `patient_id` | El mismo id del paciente |
| `exam_id`, `exam_date`, `exam_type` | El periodontograma del que sale la fecha |
| `maintenance_months` | Los meses del diagnóstico (6 si no hay) |
| **`due_date`** | **Cuándo le toca el mantenimiento** |
| `risk`, `next_visit_mode` | Riesgo y cómo se cerró la próxima cita |

**Crear la regla** en **Menú → Sistema → Reglas de Alertas → Crear** (se abre el diálogo «Crear Regla de Alerta»):

| Campo | Valor |
| --- | --- |
| Categoría | La que use la clínica para recordatorios a pacientes |
| Código | `PERIO_MAINTENANCE_DUE` |
| Nombre | Mantenimiento periodontal |
| Prioridad | Media |
| Tabla de Origen | `v_alert_perio_maintenance` (grupo «Vistas») |
| Campo de ID de tabla | `id` |
| Campo de ID de usuario | `patient_id` |
| Fecha del evento | `due_date` |
| **Condición** | Columna `due_date`, operador `=`, valor `{{TODAY}}` |
| Días Antes del Evento | Con cuánta anticipación avisar. Por ejemplo, **14**: la alerta se crea 14 días antes del `due_date` |
| Días Después del Evento | 0 |
| Tipo de Recurrencia | Diaria |

Con esa configuración, cada día el motor busca los pacientes cuyo mantenimiento vence dentro de 14 días y crea una alerta para cada uno.

**Para que le llegue el mensaje al paciente** (opcional):

- **WhatsApp:**
  - Elegir una **Plantilla de WhatsApp** aprobada en el proveedor (YCloud), con tipo de entidad `patient`.
  - Activar **"Enviar SMS Automáticamente"**: en este sistema, ese interruptor es el que dispara el envío por WhatsApp.
- **Email:**
  - Elegir una **Plantilla de Correo** y activar **Enviar Correo Automáticamente**.
  - El interruptor general `alert_email_auto_send_enabled` tiene que estar en `true`.
  - Mientras se prueba, conviene usar el modo prueba (`alert_email_test_mode_enabled` y `alert_email_test_whitelist`).
  - Detalle en [docs/alert-email-auto-send.md](../alert-email-auto-send.md).
- **Las plantillas solo pueden usar variables del paciente y de la clínica** (nombre, teléfono y dirección de la clínica, etc.). La fecha del mantenimiento no se pasa como variable, así que el texto tiene que ser general, por ejemplo: "Hola {{patient_name}}, ya te toca tu control periodontal. Escribinos para reservar."

**Limitaciones:**

- El recordatorio no sabe si el paciente ya reservó la cita, salvo que haya cerrado un periodontograma nuevo. Si se agenda desde el cierre con "Reservar", conviene que la cita ya traiga su propio recordatorio.
- Hasta que se crea la regla, la vista existe pero no genera avisos.

### 5.7 Puesta en marcha (checklist)

1. Correr las migraciones **162 a 166**, en orden.
2. Importar en n8n **`docs/n8n-flows/flow-perio-record.json`** (reemplaza la versión anterior si existía).
3. Confirmar que los roles que tienen que usarlo tengan `PERIO_RECORD_VIEW` y `PERIO_RECORD_REGISTER_SESSION`.
4. (Opcional) Configurar `GOOGLE_GENAI_API_KEY` en el servidor de Next para el respaldo con IA del dictado.
5. (Opcional) Crear la plantilla de email `PERIO_REPORT_EMAIL` para el reporte.
6. (Opcional) Crear la regla del recordatorio (5.6).
7. (Opcional) Revisar la configuración de la clínica desde el engranaje.

### 5.8 Pendientes conocidos

- **Plan sin precios:** el plan no está vinculado a servicios del catálogo. El cobro se arma eligiendo los servicios en el asistente de cobro.
- **Tabaco y diabetes:** se cargan en el diagnóstico (la anamnesis no tiene esos campos) y pasan al siguiente periodontograma.
- **Anulación:** el estado `void` existe en el modelo, pero la pantalla todavía no tiene la acción de anular.
- **Furcas y movilidad copiadas:** el deshacer las revierte; Descartar no, porque trabaja por sitio.
- **Puntaje del reporte:** se quitó el puntaje de 0 a 100 del prototipo porque no tenía una base clínica validada.

---

## 6. Glosario

| Término | En palabras simples |
| --- | --- |
| **Periodonto** | Lo que sostiene a los dientes: encía y hueso |
| **Periodontitis** | Enfermedad que destruye ese sostén por las bacterias de la placa |
| **Periodontograma** | El mapa de las mediciones de la encía en todos los dientes |
| **Sonda periodontal** | Una regla muy fina con marcas cada milímetro |
| **PS · profundidad de sondaje** | Cuánto entra la sonda en la bolsa |
| **Bolsa** | El espacio entre la encía y el diente cuando se hizo más hondo de lo normal |
| **SS · sangrado al sondaje** | Si sangra al pasar la sonda: inflamación activa |
| **Supuración** | Si sale pus: infección |
| **Placa** | La capa de bacterias que se pega a los dientes |
| **Sarro** | Placa endurecida |
| **LAC · línea amelocementaria** | El cuello del diente; el punto fijo desde donde se mide |
| **MG · margen gingival** | Dónde está el borde de la encía respecto al cuello |
| **Recesión** | La encía bajó y deja ver la raíz |
| **Agrandamiento** | La encía está crecida y tapa parte del diente |
| **NIC · nivel de inserción clínica** | Cuánto sostén se perdió (PS + MG) |
| **Interproximal** | Entre diente y diente (sitios distal y mesial) |
| **Vestibular · palatino · lingual** | Cara de afuera · de adentro arriba · de adentro abajo |
| **Distal · mesial** | El costado hacia el fondo · hacia el medio de la boca |
| **Furca** | Donde se separan las raíces de una muela |
| **Movilidad** | Cuánto se mueve el diente |
| **Implante** | Raíz artificial de titanio |
| **Mucositis** | Encía inflamada alrededor de un implante, sin pérdida de hueso |
| **Periimplantitis** | Pérdida de hueso alrededor de un implante |
| **Póntico** | Diente falso del medio de un puente |
| **Sextante** | Cada una de las seis partes en que se divide la boca para el cribado |
| **PSR/BPE** | Cribado rápido: un código por sextante |
| **Estadio** | Qué tan grave es la periodontitis (I a IV) |
| **Grado** | Qué tan rápido avanza (A, B, C) |
| **Riesgo** | Qué tan probable es que vuelva; define cada cuánto controlar |
| **Reinstrumentación** | Limpieza profunda debajo de la encía |
| **Mantenimiento** | Los controles periódicos de un paciente ya tratado |
| **HbA1c** | Análisis de sangre que muestra qué tan controlada está la diabetes |
| **AAP/EFP** | Sociedades de periodoncia de Estados Unidos y Europa, autoras de la clasificación de 2017 |
| **FDI** | El sistema internacional de numeración de los dientes |

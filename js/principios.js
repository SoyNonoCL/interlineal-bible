// Principios de la app (texto para los usuarios). Guía completa para el desarrollo: docs/PRINCIPIOS.md
const L = (u, t) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
export const PRINCIPIOS_HTML = `
<p class="lead">Esta app se hace con tres principios que guían sus glosas, notas y explicaciones.</p>

<h3>1. Un solo Dios verdadero</h3>
<p>La app no es trinitaria. El Padre, cuyo nombre es Jehová, es «el único Dios verdadero» (<a href="#r-JHN-17-3">Juan 17:3</a>; <a href="#r-1CO-8-6">1 Corintios 8:6</a>; <a href="#r-DEU-6-4">Deuteronomio 6:4</a>). Jesucristo es el Hijo de Dios, distinto del Padre y sujeto a él (<a href="#r-JHN-14-28">Juan 14:28</a>; <a href="#r-1CO-11-3">1 Corintios 11:3</a>; <a href="#r-1CO-15-28">15:28</a>).</p>
<p>Por eso las notas propias no dan por sentada la doctrina de la Trinidad, que se formuló en los concilios de Nicea (325) y Constantinopla (381). Los añadidos tardíos que la apoyaban, como <a href="#r-1JN-5-7">1 Juan 5:7-8</a>, se marcan como espurios. En los pasajes debatidos, la app muestra la gramática y los argumentos de cada postura con sus fuentes.</p>

<h3>2. El nombre de Dios, siempre</h3>
<p>El nombre divino (<bdi lang="he">יהוה</bdi>: YHVH, Jehová, Yahweh, Yavé…) aparece casi 7.000 veces en las Escrituras Hebreas, y la app lo respeta siempre. En las Escrituras Griegas, cuando un escritor cita un pasaje que contiene el nombre, partimos de que él lo usó. Igual se sigue viendo la palabra que traen los manuscritos griegos (κύριος, «Señor»).</p>
<p><b>En qué nos apoyamos</b></p>
<ul>
<li><b>Septuaginta judía del siglo I.</b> Las copias griegas de la época de Jesús no ponían «Señor», sino el nombre en letras hebreas:
  <ul>
  <li>${L('https://en.wikipedia.org/wiki/Papyrus_Fouad_266', 'Papiro Fouad 266')} (Deuteronomio, siglo I a. e. c.), con יהוה más de 30 veces.</li>
  <li>El ${L('https://en.wikipedia.org/wiki/Greek_Minor_Prophets_Scroll_from_Nahal_Hever', 'rollo de los Profetas Menores de Naḥal Ḥever')} (siglo I a. e. c.) y el ${L('https://en.wikipedia.org/wiki/Papyrus_Oxyrhynchus_3522', 'Papiro Oxirrinco 3522')} (Job, siglo I e. c.), en letras paleohebreas.</li>
  <li>${L('https://en.wikipedia.org/wiki/4Q120', '4Q120')} (Levítico, Qumrán), que lo transcribe ΙΑΩ.</li>
  </ul></li>
<li><b>Traducción de Áquila (siglo II).</b> Sus fragmentos de la Genizá de El Cairo escriben el nombre en letras hebreas antiguas (${L('https://www.jewishencyclopedia.com/articles/1674-aquila', 'Jewish Encyclopedia')}).</li>
<li><b>Orígenes y Jerónimo.</b> Orígenes (siglo III) escribió: «En las copias más exactas, este Nombre está escrito en caracteres hebreos». Jerónimo (c. 391): «Hallamos el nombre del Señor, el tetragrámaton, escrito todavía hoy con las letras antiguas en ciertos libros griegos» (${L('https://bible-researcher.com/jerome.html', 'Prologus Galeatus')}).</li>
<li><b>Escritos rabínicos.</b> La Tosefta y el Talmud (Shabbat 116a) discuten qué hacer con los <i>gilyonim</i> y los libros de los herejes «que contienen los nombres divinos». Muchos estudiosos entienden <i>gilyonim</i> como «evangelios», aunque es discutido (${L('https://en.wikipedia.org/wiki/Gilyonim', 'Gilyonim')}).</li>
<li><b>El propio Nuevo Testamento.</b> «Aleluya», que significa «alaben a Jah» (<a href="#r-REV-19-1">Apocalipsis 19:1-6</a>). Jesús dice: «He manifestado tu nombre» (<a href="#r-JHN-17-6">Juan 17:6, 26</a>) y «Santificado sea tu nombre» (<a href="#r-MAT-6-9">Mateo 6:9</a>).</li>
<li><b>Estudios.</b> George Howard, «The Tetragram and the New Testament», <i>Journal of Biblical Literature</i> 96 (1977), pp. 63-83, y su artículo en <i>The Anchor Bible Dictionary</i> (1992).</li>
</ul>
<p><b>Con honestidad:</b> ningún manuscrito griego conservado del Nuevo Testamento contiene el nombre. Los más antiguos usan las abreviaturas ΚΣ y ΘΣ, y la propuesta de Howard es minoritaria (${L('https://en.wikipedia.org/wiki/Names_and_titles_of_God_in_the_New_Testament', 'resumen de la discusión')}). Por eso, en el Nuevo Testamento, la restitución del nombre se presenta como una decisión editorial fundamentada y siempre se puede ver la palabra griega original.</p>

<h3>3. Independencia</h3>
<p>Esta app no tiene relación con los Testigos de Jehová ni con la Watch Tower Bible and Tract Society, y no está patrocinada ni revisada por ellos. Algunas ideas coinciden con sus publicaciones (por ejemplo, el ${L('https://www.jw.org/es/biblioteca/biblia/biblia-estudio/apendice-a/nombre-de-dios-escrituras-griegas-cristianas/', 'apéndice A5 de la Traducción del Nuevo Mundo')}); cuando las usamos, las citamos y preferimos respaldarlas con fuentes independientes.</p>
<p>La app no descarga contenido de jw.org. Lo que tú importes o pegues queda solo en tu dispositivo. Los textos incluidos vienen de fuentes abiertas: STEPBible, UBS y la Reina-Valera 1909.</p>`;

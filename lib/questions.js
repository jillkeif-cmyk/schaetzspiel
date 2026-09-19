// Fester Fragenpool. E = Schätzfrage, M = Auswahlfrage (erste Option ist richtig, wird beim Ausspielen gemischt).
// range = absolute Abweichung, ab der es 0 Punkte gibt (Standard: 50 % der Antwort).
const pool = [];
let n = 0;
const E = (q, a, unit, cat, range) => pool.push({ id: 'p' + (++n), t: 'est', q, a, unit, cat, range });
const M = (q, o, cat) => pool.push({ id: 'p' + (++n), t: 'mc', q, o, cat });
const yearRange = (y) => (y >= 1800 ? 50 : y >= 1400 ? 100 : 200);
const Y = (q, a, cat = 'Geschichte') => E(q, a, 'Jahr', cat, yearRange(a));

// Bauwerke & Höhen
E('Wie hoch ist der Eiffelturm inklusive Antenne?', 330, 'm', 'Bauwerke');
E('Wie viele Stufen führen bis zur Spitze des Eiffelturms?', 1665, 'Stufen', 'Bauwerke');
E('Wie hoch ist der Kölner Dom?', 157, 'm', 'Bauwerke');
E('Wie hoch ist der Burj Khalifa in Dubai?', 828, 'm', 'Bauwerke');
E('Wie hoch ist der Berliner Fernsehturm?', 368, 'm', 'Bauwerke');
E('Wie hoch ist der Turm des Ulmer Münsters, der höchste Kirchturm der Welt?', 161.5, 'm', 'Bauwerke');
E('Wie hoch ist die Freiheitsstatue inklusive Sockel?', 93, 'm', 'Bauwerke');
E('Wie hoch ist die Cheops-Pyramide heute?', 139, 'm', 'Bauwerke');
E('Wie lang ist die Golden Gate Bridge insgesamt?', 2737, 'm', 'Bauwerke');
E('Wie lang ist der Gotthard-Basistunnel?', 57, 'km', 'Bauwerke');
E('Wie lang ist der Eurotunnel unter dem Ärmelkanal?', 50, 'km', 'Bauwerke');
E('Wie lang ist die Chinesische Mauer mit allen Abschnitten laut offizieller Vermessung?', 21196, 'km', 'Bauwerke');
E('Wie lang war die Titanic?', 269, 'm', 'Bauwerke');
E('Wie groß ist die Spannweite eines Airbus A380?', 79.8, 'm', 'Technik');

// Geografie
E('Wie hoch ist der Mount Everest?', 8849, 'm', 'Geografie');
E('Wie hoch ist die Zugspitze?', 2962, 'm', 'Geografie');
E('Wie hoch ist der Kilimandscharo?', 5895, 'm', 'Geografie');
E('Wie hoch ist das Matterhorn?', 4478, 'm', 'Geografie');
E('Wie hoch ist der Großglockner?', 3798, 'm', 'Geografie');
E('Wie hoch ist der Brocken im Harz?', 1141, 'm', 'Geografie');
E('Wie hoch ist der Feldberg im Schwarzwald?', 1493, 'm', 'Geografie');
E('Wie lang ist der Rhein?', 1233, 'km', 'Geografie');
E('Wie lang ist die Donau?', 2857, 'km', 'Geografie');
E('Wie lang ist der Nil?', 6650, 'km', 'Geografie');
E('Wie groß ist die Fläche des Bodensees?', 536, 'km²', 'Geografie');
E('Wie tief ist der Bodensee an seiner tiefsten Stelle?', 251, 'm', 'Geografie');
E('Wie tief ist der Baikalsee an seiner tiefsten Stelle?', 1642, 'm', 'Geografie');
E('Wie groß ist die Fläche Deutschlands, in Tausend km²?', 358, 'Tsd. km²', 'Geografie');
E('Wie groß ist die Fläche Russlands?', 17.1, 'Mio. km²', 'Geografie');
E('Wie groß ist die Sahara ungefähr?', 9.2, 'Mio. km²', 'Geografie');
E('Wie viele Staaten sind Mitglied der Vereinten Nationen?', 193, 'Staaten', 'Geografie');
E('Wie viele Mitgliedstaaten hat die EU?', 27, 'Staaten', 'Geografie');
E('Wie viele Länder gibt es in Afrika?', 54, 'Länder', 'Geografie');
E('Wie viele Zeitzonen hat Russland?', 11, 'Zeitzonen', 'Geografie');
E('Wie viel Prozent der Erdoberfläche sind von Wasser bedeckt?', 71, '%', 'Geografie');
E('Wie lang ist das deutsche Autobahnnetz ungefähr?', 13200, 'km', 'Geografie');
E('Welche Temperatur wurde als höchste jemals auf der Erde gemessen (Death Valley)?', 56.7, '°C', 'Geografie');

// Weltall & Naturwissenschaft
E('Wie schnell ist das Licht?', 299792, 'km/s', 'Wissenschaft');
E('Wie schnell ist der Schall in Luft bei 20 °C?', 343, 'm/s', 'Wissenschaft');
E('Wie viele Sekunden braucht das Licht von der Sonne zur Erde?', 499, 's', 'Weltall');
E('Wie weit ist der Mond im Mittel von der Erde entfernt?', 384400, 'km', 'Weltall');
E('Wie weit ist die Sonne im Mittel von der Erde entfernt?', 150, 'Mio. km', 'Weltall');
E('Wie groß ist der Durchmesser der Erde am Äquator?', 12756, 'km', 'Weltall');
E('Wie groß ist der Erdumfang am Äquator?', 40075, 'km', 'Weltall');
E('Wie groß ist der Durchmesser des Mondes?', 3474, 'km', 'Weltall');
E('Wie groß ist der Durchmesser der Sonne?', 1.39, 'Mio. km', 'Weltall');
E('Wie alt ist das Universum?', 13.8, 'Mrd. Jahre', 'Weltall');
E('Wie alt ist die Erde?', 4.5, 'Mrd. Jahre', 'Weltall');
E('Wie schnell fliegt die ISS um die Erde?', 27600, 'km/h', 'Weltall');
E('In welcher Höhe fliegt die ISS ungefähr?', 400, 'km', 'Weltall');
E('Wie heiß ist die Oberfläche der Sonne ungefähr?', 5500, '°C', 'Weltall');
E('Bei welcher Temperatur schmilzt Eisen?', 1538, '°C', 'Wissenschaft');
E('Bei welcher Temperatur schmilzt Gold?', 1064, '°C', 'Wissenschaft');
E('Welche Dichte hat Gold?', 19.3, 'g/cm³', 'Wissenschaft');
E('Wie viel wiegt ein Standard-Goldbarren (400 Unzen)?', 12.4, 'kg', 'Wissenschaft');
E('Wie viele Elemente hat das Periodensystem?', 118, 'Elemente', 'Wissenschaft');
E('Welche Ordnungszahl hat Gold?', 79, '', 'Wissenschaft');
E('Wie viel Prozent der Luft sind Sauerstoff?', 21, '%', 'Wissenschaft');
E('Wie viel Prozent der Luft sind Stickstoff?', 78, '%', 'Wissenschaft');
E('Wie viel ist 2 hoch 20?', 1048576, '', 'Mathe');
E('Wie viele Sekunden hat ein Tag?', 86400, 's', 'Mathe');
E('Wie viele Minuten hat eine Woche?', 10080, 'min', 'Mathe');
E('Wie viele Stunden hat ein Jahr mit 365 Tagen?', 8760, 'h', 'Mathe');

// Mensch & Tier
E('Wie viele Knochen hat ein erwachsener Mensch?', 206, 'Knochen', 'Mensch');
E('Wie viele Chromosomen hat eine menschliche Körperzelle?', 46, 'Chromosomen', 'Mensch');
E('Wie viele Wochen dauert eine Schwangerschaft rechnerisch?', 40, 'Wochen', 'Mensch');
E('Wie viele Monate trägt eine Afrikanische Elefantenkuh ihr Kalb aus?', 22, 'Monate', 'Tiere');

// Sport
E('Wie lang ist ein Marathon?', 42195, 'm', 'Sport');
E('Wie breit ist ein Fußballtor?', 7.32, 'm', 'Sport');
E('Wie hoch ist ein Fußballtor?', 2.44, 'm', 'Sport');
E('Wie hoch hängt ein Basketballkorb?', 3.05, 'm', 'Sport');
E('Wie lang ist ein Tennisplatz?', 23.77, 'm', 'Sport');
E('Wie hoch ist ein Tischtennisnetz?', 15.25, 'cm', 'Sport');
E('Wie lautet der 100-Meter-Weltrekord von Usain Bolt?', 9.58, 's', 'Sport');
E('Wie weit sprang Mike Powell bei seinem Weitsprung-Weltrekord?', 8.95, 'm', 'Sport');
E('Wie hoch sprang Javier Sotomayor bei seinem Hochsprung-Weltrekord?', 2.45, 'm', 'Sport');
E('Wie viele Länderspieltore schoss Miroslav Klose für Deutschland?', 71, 'Tore', 'Sport');
E('Wie viele Bundesligatore schoss Gerd Müller?', 365, 'Tore', 'Sport');
E('Wie viele Tore schoss Robert Lewandowski in seiner Rekordsaison 2020/21 in der Bundesliga?', 41, 'Tore', 'Sport');
E('Wie viele Zuschauer passen bei Bundesligaspielen in den Signal Iduna Park?', 81365, 'Plätze', 'Sport');
E('Wie viele Zuschauer passen bei Bundesligaspielen in die Allianz Arena?', 75024, 'Plätze', 'Sport');
E('Wie lang ist die Nürburgring-Nordschleife?', 20.8, 'km', 'Sport');
E('Wie hoch ist das höchstmögliche Break beim Snooker?', 147, 'Punkte', 'Sport');
E('Wie viele Punkte sind beim Darts mit drei Pfeilen maximal möglich?', 180, 'Punkte', 'Sport');
E('Wie viele Spieler stehen beim Rugby Union pro Team auf dem Feld?', 15, 'Spieler', 'Sport');
E('Wie schnell fuhr der TGV bei seinem Weltrekord 2007?', 574.8, 'km/h', 'Technik');

// Spiele & Kultur
E('Wie viele Tasten hat ein Klavier?', 88, 'Tasten', 'Kultur');
E('Wie viele Felder hat ein Schachbrett?', 64, 'Felder', 'Spiele');
E('Wie viele Felder hat ein Sudoku?', 81, 'Felder', 'Spiele');
E('Wie viele Felder hat das Monopoly-Spielbrett?', 40, 'Felder', 'Spiele');
E('Wie viele Karten hat ein Skatblatt?', 32, 'Karten', 'Spiele');
E('Wie viele Augen hat ein Würfel insgesamt?', 21, 'Augen', 'Spiele');
E('Wie viele Steine hat ein Standard-Dominospiel (Doppel-6)?', 28, 'Steine', 'Spiele');
E('Wie viele Sterne hat die Europaflagge?', 12, 'Sterne', 'Kultur');
E('Wie viele Streifen hat die Flagge der USA?', 13, 'Streifen', 'Kultur');
E('Wie viele Oscars gewann „Der Herr der Ringe: Die Rückkehr des Königs“?', 11, 'Oscars', 'Kultur');
E('Wie alt wurde Wolfgang Amadeus Mozart?', 35, 'Jahre', 'Kultur');

// Jahreszahlen
Y('In welchem Jahr fiel die Berliner Mauer?', 1989);
Y('In welchem Jahr landeten die ersten Menschen auf dem Mond?', 1969);
Y('In welchem Jahr sank die Titanic?', 1912);
Y('In welchem Jahr erreichte Kolumbus Amerika?', 1492);
Y('In welchem Jahr begann die Französische Revolution?', 1789);
Y('In welchem Jahr wurde die Bundesrepublik Deutschland gegründet?', 1949);
Y('In welchem Jahr wurde das Euro-Bargeld eingeführt?', 2002);
Y('In welchem Jahr wurde die D-Mark eingeführt?', 1948);
Y('In welchem Jahr war die deutsche Wiedervereinigung?', 1990);
Y('In welchem Jahr wurde das Deutsche Kaiserreich gegründet?', 1871);
Y('In welchem Jahr veröffentlichte Luther seine 95 Thesen?', 1517);
Y('In welchem Jahr endete der Dreißigjährige Krieg?', 1648);
Y('In welchem Jahr wurde Karl der Große zum Kaiser gekrönt?', 800);
Y('In welchem Jahr endete das Weströmische Reich?', 476);
Y('In welchem Jahr wurde das bayerische Reinheitsgebot erlassen?', 1516);
Y('In welchem Jahr fand das erste Oktoberfest statt?', 1810);
Y('In welchem Jahr war die Reaktorkatastrophe von Tschernobyl?', 1986);
Y('In welchem Jahr wurde der Mount Everest erstmals bestiegen?', 1953);
Y('In welchem Jahr gelang den Brüdern Wright der erste Motorflug?', 1903);
Y('In welchem Jahr veröffentlichte Einstein die spezielle Relativitätstheorie?', 1905);
Y('In welchem Jahr erhielt Alexander Graham Bell das Patent auf das Telefon?', 1876);
Y('In welchem Jahr meldete Carl Benz seinen Motorwagen zum Patent an?', 1886, 'Auto');
Y('In welchem Jahr entstand die Daimler-Benz AG durch Fusion?', 1926, 'Auto');
Y('In welchem Jahr wurde das Mercedes-Benz-Werk Sindelfingen gegründet?', 1915, 'Auto');
Y('In welchem Jahr schlug Tim Berners-Lee das World Wide Web vor?', 1989, 'Technik');
Y('In welchem Jahr kam das erste iPhone auf den Markt?', 2007, 'Technik');
Y('In welchem Jahr wurde Google gegründet?', 1998, 'Technik');
Y('In welchem Jahr wurde Apple gegründet?', 1976, 'Technik');
Y('In welchem Jahr wurde Microsoft gegründet?', 1975, 'Technik');
Y('In welchem Jahr wurde Amazon gegründet?', 1994, 'Technik');
Y('In welchem Jahr ging YouTube online?', 2005, 'Technik');
Y('In welchem Jahr startete die Fußball-Bundesliga?', 1963, 'Sport');
Y('In welchem Jahr fand die erste Tour de France statt?', 1903, 'Sport');
Y('In welchem Jahr fanden die ersten Olympischen Spiele der Neuzeit statt?', 1896, 'Sport');

// Auswahlfragen
M('Wie heißt die Hauptstadt von Australien?', ['Canberra', 'Sydney', 'Melbourne', 'Perth'], 'Geografie');
M('Wie heißt die Hauptstadt von Kanada?', ['Ottawa', 'Toronto', 'Vancouver', 'Montreal'], 'Geografie');
M('Wie heißt die Hauptstadt der Türkei?', ['Ankara', 'Istanbul', 'Izmir', 'Antalya'], 'Geografie');
M('Wie heißt die Hauptstadt von Brasilien?', ['Brasília', 'Rio de Janeiro', 'São Paulo', 'Salvador'], 'Geografie');
M('Durch welche Hauptstadt fließt die Donau?', ['Budapest', 'Prag', 'Warschau', 'Rom'], 'Geografie');
M('Welches Land hat die größte Fläche?', ['Russland', 'Kanada', 'China', 'USA'], 'Geografie');
M('Welcher ist der größte Ozean?', ['Pazifik', 'Atlantik', 'Indischer Ozean', 'Arktischer Ozean'], 'Geografie');
M('Welche ist die größte Wüste der Erde, Eiswüsten eingeschlossen?', ['Antarktis', 'Sahara', 'Gobi', 'Arabische Wüste'], 'Geografie');
M('Welcher Kontinent hat die meisten Länder?', ['Afrika', 'Asien', 'Europa', 'Südamerika'], 'Geografie');
M('Welches Land hat mit seinen Überseegebieten die meisten Zeitzonen?', ['Frankreich', 'Russland', 'USA', 'China'], 'Geografie');
M('Wie heißt der höchste Wasserfall der Erde?', ['Salto Ángel', 'Niagarafälle', 'Victoriafälle', 'Iguazú-Fälle'], 'Geografie');
M('In welcher Stadt steht die Sagrada Família?', ['Barcelona', 'Madrid', 'Lissabon', 'Sevilla'], 'Geografie');
M('Welcher ist der größte Planet unseres Sonnensystems?', ['Jupiter', 'Saturn', 'Neptun', 'Uranus'], 'Weltall');
M('Welcher Planet ist der Sonne am nächsten?', ['Merkur', 'Venus', 'Mars', 'Erde'], 'Weltall');
M('Welches chemische Symbol hat Eisen?', ['Fe', 'Ei', 'Ir', 'Es'], 'Wissenschaft');
M('Welches chemische Symbol hat Gold?', ['Au', 'Go', 'Ag', 'Gd'], 'Wissenschaft');
M('Welches chemische Symbol hat Natrium?', ['Na', 'Nt', 'N', 'Ni'], 'Wissenschaft');
M('Welches Gas ist der Hauptbestandteil der Luft?', ['Stickstoff', 'Sauerstoff', 'Kohlendioxid', 'Argon'], 'Wissenschaft');
M('Welches ist das härteste natürliche Material?', ['Diamant', 'Granit', 'Quarz', 'Titan'], 'Wissenschaft');
M('In welcher Einheit misst man den elektrischen Widerstand?', ['Ohm', 'Volt', 'Ampere', 'Watt'], 'Technik');
M('Was misst man in Hertz?', ['Frequenz', 'Spannung', 'Leistung', 'Helligkeit'], 'Technik');
M('Welches Organ produziert Insulin?', ['Bauchspeicheldrüse', 'Leber', 'Niere', 'Milz'], 'Mensch');
M('Welcher ist der längste Knochen des Menschen?', ['Oberschenkelknochen', 'Schienbein', 'Oberarmknochen', 'Wadenbein'], 'Mensch');
M('Welche Blutgruppe gilt als Universalspender für rote Blutkörperchen?', ['0 negativ', 'AB positiv', 'A negativ', 'B positiv'], 'Mensch');
M('Wie viele Herzen hat ein Oktopus?', ['3', '1', '2', '4'], 'Tiere');
M('Welches ist das schnellste Landtier?', ['Gepard', 'Löwe', 'Antilope', 'Windhund'], 'Tiere');
M('Welches ist das größte Säugetier?', ['Blauwal', 'Afrikanischer Elefant', 'Pottwal', 'Giraffe'], 'Tiere');
M('Wer malte die Mona Lisa?', ['Leonardo da Vinci', 'Michelangelo', 'Raffael', 'Botticelli'], 'Kultur');
M('Wer schrieb „Faust“?', ['Goethe', 'Schiller', 'Lessing', 'Heine'], 'Kultur');
M('Wer komponierte „Die Zauberflöte“?', ['Mozart', 'Beethoven', 'Haydn', 'Wagner'], 'Kultur');
M('Was ist die Hauptzutat von Guacamole?', ['Avocado', 'Erbsen', 'Gurke', 'Spinat'], 'Kultur');
M('Welche Währung hat Japan?', ['Yen', 'Won', 'Yuan', 'Baht'], 'Geografie');
M('Wer wurde 2018 Fußball-Weltmeister?', ['Frankreich', 'Kroatien', 'Deutschland', 'Brasilien'], 'Sport');
M('Wer wurde 2022 Fußball-Weltmeister?', ['Argentinien', 'Frankreich', 'Kroatien', 'Marokko'], 'Sport');
M('Wie viele Spieler pro Team stehen beim Volleyball auf dem Feld?', ['6', '5', '7', '8'], 'Sport');
M('Wer meldete 1886 das erste Automobil zum Patent an?', ['Carl Benz', 'Gottlieb Daimler', 'Henry Ford', 'Rudolf Diesel'], 'Auto');
M('Welcher Hersteller wirbt mit „Das Beste oder nichts“?', ['Mercedes-Benz', 'BMW', 'Audi', 'Porsche'], 'Auto');
M('In welcher Stadt hat Porsche seinen Hauptsitz?', ['Stuttgart', 'München', 'Wolfsburg', 'Ingolstadt'], 'Auto');
M('Welche Sprache führen Webbrowser nativ aus?', ['JavaScript', 'Python', 'Java', 'C#'], 'Technik');

module.exports = { pool, yearRange };

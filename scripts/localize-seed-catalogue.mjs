import fs from 'node:fs/promises';
const { seedProducts: products } = JSON.parse(await fs.readFile('output/multilingual-audit-20261028/content-inventory.json','utf8'));
const names = [
 ['Monaco Café-Racer-Lederjacke in Schwarz','Chaqueta café racer Monaco de cuero negro','Veste café racer Monaco en cuir noir','Giacca café racer Monaco in pelle nera'],
 ['G-1 Fliegerjacke aus braunem Leder mit Lammfellkragen','Chaqueta de aviador G-1 de cuero marrón con cuello de borrego','Blouson aviateur G-1 en cuir marron à col en peau lainée','Giacca da aviatore G-1 in pelle marrone con collo in montone'],
 ['Heritage Leder-Fliegerjacke für Herren','Chaqueta de aviador Heritage de cuero para hombre','Blouson aviateur Heritage en cuir pour homme','Giacca da aviatore Heritage in pelle da uomo'],
 ['Herren-Collegejacke aus Wolle mit Lederärmeln','Chaqueta universitaria de lana con mangas de cuero para hombre','Veste universitaire en laine à manches en cuir pour homme','Giacca universitaria in lana con maniche in pelle da uomo'],
 ['Schwarze gesteppte Leder-Bikerjacke für Herren','Chaqueta motera de cuero negro acolchado para hombre','Veste de style motard en cuir noir matelassé pour homme','Giacca biker in pelle nera trapuntata da uomo'],
 ['Schwarze minimalistische Lammlederjacke für Herren','Chaqueta minimalista de piel de cordero negra para hombre','Veste minimaliste en cuir d’agneau noir pour homme','Giacca minimalista in pelle di agnello nera da uomo'],
 ['Schwarze Leder-Truckerjacke für Herren','Chaqueta camionera de cuero negro para hombre','Veste camionneur en cuir noir pour homme','Giacca trucker in pelle nera da uomo'],
 ['Klassische G-1 Leder-Fliegerjacke','Chaqueta clásica de aviador G-1 de cuero','Blouson aviateur classique G-1 en cuir','Giacca classica da aviatore G-1 in pelle'],
 ['Zweifarbige Café-Racer-Lederjacke für Herren','Chaqueta café racer de cuero bicolor para hombre','Veste café racer en cuir bicolore pour homme','Giacca café racer in pelle bicolore da uomo'],
 ['Café-Racer-Jacke aus Leder und Textil für Herren','Chaqueta café racer de cuero y tejido para hombre','Veste café racer en cuir et textile pour homme','Giacca café racer in pelle e tessuto da uomo'],
 ['Braune Café-Racer-Lederjacke im Antiklook für Herren','Chaqueta café racer de cuero marrón envejecido para hombre','Veste café racer en cuir marron vieilli pour homme','Giacca café racer in pelle marrone effetto vissuto da uomo'],
 ['Gesteppte Racerjacke aus Leder und Textil für Herren','Chaqueta deportiva acolchada de cuero y tejido para hombre','Veste sportive matelassée en cuir et textile pour homme','Giacca sportiva trapuntata in pelle e tessuto da uomo'],
 ['Weiße Lederjacke mit Motorsport-Aufnähern für Herren','Chaqueta de cuero blanco con parches de competición para hombre','Veste en cuir blanc à écussons de sport automobile pour homme','Giacca in pelle bianca con applicazioni da corsa da uomo'],
 ['Einteilige Motorrad-Lederkombi für Herren','Mono de moto de cuero de una pieza para hombre','Combinaison moto en cuir une pièce pour homme','Tuta da moto in pelle intera da uomo'],
 ['Cognacfarbene Leder-Reisetasche für Wochenendausflüge','Bolsa de viaje de cuero coñac para fin de semana','Sac de voyage de week-end en cuir cognac','Borsone da viaggio per il fine settimana in pelle cognac'],
 ['Schwarzer Rucksack aus genarbtem Leder','Mochila de cuero granulado negro','Sac à dos en cuir grainé noir','Zaino in pelle nera martellata'],
 ['Schwarze magnetische Motorrad-Tanktasche','Bolsa magnética negra para depósito de moto','Sacoche de réservoir moto magnétique noire','Borsa da serbatoio moto magnetica nera'],
 ['Olivgrüne Motorrad-Satteltasche aus gewachstem Canvas','Alforja de moto verde oliva de lona encerada','Sacoche de selle moto vert olive en toile cirée','Borsa laterale moto verde oliva in tela cerata'],
 ['Wasserdichte Adventure-Motorrad-Satteltaschen','Alforjas impermeables de moto para aventura','Sacoches de selle moto étanches pour l’aventure','Borse laterali moto impermeabili per l’avventura'],
 ['Schwarze Motorrad-Satteltasche aus gewachstem Canvas','Alforja de moto negra de lona encerada','Sacoche de selle moto noire en toile cirée','Borsa laterale moto nera in tela cerata'],
 ['Schwarze Leder-Motorradhandschuhe mit Carbon-Knöchelschale','Guantes de moto de cuero negro con nudillos de carbono','Gants moto en cuir noir avec coque de phalanges en carbone','Guanti moto in pelle nera con protezione nocche in carbonio'],
 ['Weiße Leder-Motorradhandschuhe mit Carbon-Knöchelschale','Guantes de moto de cuero blanco con nudillos de carbono','Gants moto en cuir blanc avec coque de phalanges en carbone','Guanti moto in pelle bianca con protezione nocche in carbonio'],
];
const materials = {
 '1.2mm Full-Grain Italian Calfskin':['1,2 mm italienisches Vollnarben-Kalbsleder','Piel italiana de ternera de plena flor de 1,2 mm','Cuir de veau italien pleine fleur de 1,2 mm','Pelle di vitello italiana pieno fiore da 1,2 mm'],
 '1.3mm Hand-Burnished Italian Calfskin':['1,3 mm von Hand poliertes italienisches Kalbsleder','Piel italiana de ternera bruñida a mano de 1,3 mm','Cuir de veau italien patiné à la main de 1,3 mm','Pelle di vitello italiana brunita a mano da 1,3 mm'],
 'Wool Body / Cowhide Leather Sleeves':['Wollkörper mit Ärmeln aus Rindsleder','Cuerpo de lana y mangas de piel de vacuno','Corps en laine et manches en cuir de vache','Corpo in lana e maniche in pelle bovina'],
 'Full-Grain Leather':['Vollnarbenleder','Cuero de plena flor','Cuir pleine fleur','Pelle pieno fiore'],
 'Soft Italian Lambskin':['Weiches italienisches Lammleder','Piel italiana de cordero suave','Cuir d’agneau italien souple','Morbida pelle di agnello italiana'],
 'Full-Grain Italian Calfskin':['Italienisches Vollnarben-Kalbsleder','Piel italiana de ternera de plena flor','Cuir de veau italien pleine fleur','Pelle di vitello italiana pieno fiore'],
 'Top-Grain Calfskin':['Kalbsleder mit Narbenoberfläche','Piel de ternera de flor','Cuir de veau fleur','Pelle di vitello fiore'],
 'Premium Hybrid Calfskin':['Kalbsleder-Hybrid','Piel de ternera híbrida','Cuir de veau hybride','Pelle di vitello ibrida'],
 'Leather & Technical Textile':['Leder und technisches Textil','Cuero y tejido técnico','Cuir et textile technique','Pelle e tessuto tecnico'],
 'Full-Grain Distressed Calfskin':['Vollnarben-Kalbsleder im Antiklook','Piel de ternera de plena flor envejecida','Cuir de veau pleine fleur à effet vieilli','Pelle di vitello pieno fiore effetto vissuto'],
 'Leather & Textile':['Leder und Textil','Cuero y tejido','Cuir et textile','Pelle e tessuto'],
 'Cowhide & Technical Stretch Panels':['Rindsleder mit technischen Stretcheinsätzen','Piel de vacuno con paneles técnicos elásticos','Cuir de vache et panneaux techniques extensibles','Pelle bovina con pannelli tecnici elasticizzati'],
 'Vegetable-tanned cowhide':['Pflanzlich gegerbtes Rindsleder','Piel de vacuno de curtido vegetal','Cuir de vache tanné végétal','Pelle bovina a concia vegetale'],
 'Pebbled French calfskin':['Genarbtes französisches Kalbsleder','Piel francesa de ternera granulada','Cuir de veau français grainé','Pelle di vitello francese martellata'],
 'Weather-resistant technical nylon':['Wetterbeständiges technisches Nylon','Nailon técnico resistente a la intemperie','Nylon technique résistant aux intempéries','Nylon tecnico resistente alle intemperie'],
 'Waxed canvas and leather':['Gewachstes Canvas und Leder','Lona encerada y cuero','Toile cirée et cuir','Tela cerata e pelle'],
 'Waxed Canvas & Leather':['Gewachstes Canvas und Leder','Lona encerada y cuero','Toile cirée et cuir','Tela cerata e pelle'],
 'Premium goatskin + carbon fiber':['Ziegenleder und Carbonfaser','Piel de cabra y fibra de carbono','Cuir de chèvre et fibre de carbone','Pelle di capra e fibra di carbonio'],
};
const details = [
 ['100 % Vollnarben-Kalbsleder','100 % piel de ternera de plena flor','100 % cuir de veau pleine fleur','100% pelle di vitello pieno fiore'],
 ['Abnehmbarer echter Lammfellkragen','Cuello desmontable de borrego auténtico','Col amovible en véritable peau lainée','Collo staccabile in vero montone'],
 ['1,3 mm fassgefärbtes Kalbsleder','Piel de ternera teñida en bombo de 1,3 mm','Cuir de veau teint en foulon de 1,3 mm','Pelle di vitello tinta in botte da 1,3 mm'],
 ['Melton-Wolle','Lana Melton','Laine Melton','Lana Melton'],
 ['Gestepptes Futter aus Seidenmischung','Forro acolchado de mezcla de seda','Doublure matelassée en mélange de soie','Fodera trapuntata in misto seta'],
 ['Weiches Viskosefutter','Forro suave de viscosa','Doublure souple en viscose','Morbida fodera in viscosa'],
 ['Knöpfe aus Messing im Antiklook','Botones de latón envejecido','Boutons en laiton vieilli','Bottoni in ottone anticato'],
 ['Abnehmbarer echter Lammfellkragen','Cuello desmontable de borrego auténtico','Col amovible en véritable peau lainée','Collo staccabile in vero montone'],
 ['Mehrteilige Hybridkonstruktion','Construcción híbrida de varios paneles','Construction hybride à plusieurs empiècements','Costruzione ibrida a pannelli'],
 ['Gesteppte Schultern','Hombros acolchados','Épaules matelassées','Spalle trapuntate'],
 ['Verstärkte, gesteppte Schultern','Hombros reforzados y acolchados','Épaules renforcées et matelassées','Spalle rinforzate e trapuntate'],
 ['Rautensteppung an den Schultern','Hombros acolchados en rombos','Épaules matelassées en losanges','Spalle trapuntate a rombi'],
 ['Motorsport-inspirierte Aufnäher','Parches inspirados en el automovilismo','Écussons inspirés du sport automobile','Applicazioni ispirate agli sport motoristici'],
 ['Verstärkte Lederfelder und vorgeformte einteilige Passform','Paneles de cuero reforzados y corte precurvado de una pieza','Panneaux en cuir renforcés et coupe préformée une pièce','Pannelli in pelle rinforzati e taglio intero precurvato'],
 ['48 Liter Fassungsvermögen','Capacidad de 48 litros','Capacité de 48 litres','Capacità di 48 litri'],
 ['18 Liter Fassungsvermögen','Capacidad de 18 litros','Capacité de 18 litres','Capacità di 18 litri'],
 ['Magnet- oder Riemenbefestigung','Fijación magnética o con correas','Fixation magnétique ou par sangles','Fissaggio magnetico o con cinghie'],
 ['Universelle Riemenbefestigung','Fijación universal con correas','Fixation universelle par sangles','Fissaggio universale con cinghie'],
 ['Universelle Riemenbefestigung','Fijación universal con correas','Fixation universelle par sangles','Fissaggio universale con cinghie'],
 ['Universelle Riemenbefestigung','Fijación universal con correas','Fixation universelle par sangles','Fissaggio universale con cinghie'],
 ['0,6 mm Ziegenleder und Knöchelschale aus Carbonfaser','Piel de cabra de 0,6 mm y carcasa de nudillos de fibra de carbono','Cuir de chèvre de 0,6 mm et coque de phalanges en fibre de carbone','Pelle di capra da 0,6 mm e guscio delle nocche in fibra di carbonio'],
 ['0,6 mm Ziegenleder und Knöchelschale aus Carbonfaser','Piel de cabra de 0,6 mm y carcasa de nudillos de fibra de carbono','Cuir de chèvre de 0,6 mm et coque de phalanges en fibre de carbone','Pelle di capra da 0,6 mm e guscio delle nocche in fibra di carbonio'],
];
const labels = {
 Shell:['Außenmaterial','Material exterior','Matière extérieure','Materiale esterno'],Collar:['Kragen','Cuello','Col','Collo'],Outer:['Außenmaterial','Material exterior','Matière extérieure','Materiale esterno'],Body:['Hauptmaterial','Cuerpo','Corps','Corpo'],Lining:['Futter','Forro','Doublure','Fodera'],Hardware:['Beschläge','Herrajes','Finitions métalliques','Parti metalliche'],Construction:['Aufbau','Construcción','Construction','Costruzione'],Detailing:['Details','Detalles','Détails','Dettagli'],Shoulders:['Schultern','Hombros','Épaules','Spalle'],Theme:['Stil','Estilo','Style','Stile'],Fit:['Passform','Corte','Coupe','Vestibilità'],Material:['Material','Material','Matière','Materiale'],Capacity:['Fassungsvermögen','Capacidad','Capacité','Capacità'],Mounting:['Befestigung','Fijación','Fixation','Fissaggio'],Protection:['Schutzdetails','Protección','Protection','Protezione'],
};
const extraColors = {'Distressed Brown':['Antikbraun','Marrón envejecido','Marron vieilli','Marrone effetto vissuto'],'Dark Brown':['Dunkelbraun','Marrón oscuro','Marron foncé','Marrone scuro'],'Dark Cordovan':['Dunkles Cordovan','Cordobán oscuro','Cordovan foncé','Cordovan scuro'],'Espresso':['Espresso','Espresso','Espresso','Espresso'],'Vintage Espresso':['Espresso im Antiklook','Espresso envejecido','Espresso vieilli','Espresso effetto vissuto'],'Noir':['Schwarz','Negro','Noir','Nero'],'Midnight Blue':['Mitternachtsblau','Azul medianoche','Bleu nuit','Blu notte'],'Beige':['Beige','Beige','Beige','Beige'],'Green':['Grün','Verde','Vert','Verde'],'Olive Green':['Olivgrün','Verde oliva','Vert olive','Verde oliva']};
if(products.length!==names.length)throw Error('Legacy catalogue changed; review translations before regenerating');
for(const [index,locale]of ['de','es','fr','it'].entries()){
 const file=`src/i18n/locales/${locale}.json`,dict=JSON.parse(await fs.readFile(file,'utf8'));
 dict.colorNames = {...dict.colorNames,...Object.fromEntries(Object.entries(extraColors).map(([key,value])=>[key,value[index]]))};
 for(const [n,p]of products.entries()){
  const name=names[n][index],material=materials[p.material]?.[index],detail=details[n][index];
  if(!material)throw Error(`Missing material: ${p.material}`);
  const size=p.sizes.map(size=>size==='One Size'?['Einheitsgröße','Talla única','Taille unique','Taglia unica'][index]:size).join(', ');
  const description=[`${name}. Material: ${material}. ${detail}. Größen: ${size}. Prüfen Sie die Produktfotos und Maßangaben vor der Bestellung.`,`${name}. Material: ${material}. ${detail}. Tallas: ${size}. Consulta las fotos y medidas antes de hacer el pedido.`,`${name}. Matière : ${material}. ${detail}. Tailles : ${size}. Consultez les photos et les mesures avant de commander.`,`${name}. Materiale: ${material}. ${detail}. Taglie: ${size}. Consulta foto e misure prima di ordinare.`][index];
  const origin=p.origin==='Made in Italy'?['Hergestellt in Italien','Hecho en Italia','Fabriqué en Italie','Prodotto in Italia'][index]:p.origin==='Designed in Italy'?['Entworfen in Italien','Diseñado en Italia','Conçu en Italie','Progettato in Italia'][index]:p.origin==='Italy'?['Italien','Italia','Italie','Italia'][index]:p.origin?.includes('USA')?['Entworfen in den USA','Diseñado en EE. UU.','Conçu aux États-Unis','Progettato negli USA'][index]:p.origin;
  dict.products[p.slug]={name,tagline:detail,material,origin,description,specs:Object.fromEntries(p.specs.map(spec=>{if(!labels[spec.label])throw Error(`Missing label: ${spec.label}`);return [spec.label,{label:labels[spec.label][index],value:spec.label==='Material'?material:detail}]}))};
 }
 await fs.writeFile(file,JSON.stringify(dict,null,2)+'\n');
}
console.log(JSON.stringify({legacyProducts:products.length,locales:4,databaseWrites:0}));

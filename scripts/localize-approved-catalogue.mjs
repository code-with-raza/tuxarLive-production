import fs from 'node:fs/promises';
const products = (await Promise.all(['approved-catalogue', 'approved-womens-catalogue'].map(async name => JSON.parse(await fs.readFile(`src/data/products/${name}.json`, 'utf8')).products))).flat();
const colors = ['Burnt Orange','Cobalt Blue','Chocolate','Burgundy','Cognac','Orange','Yellow','Brown','Black','White','Ivory','Cream','Camel','Slate','Grey','Gray','Navy','Blue','Pink','Tan','Red'];
function family(product) {
  let name = product.name.replace(/^(?:Men's|Women's) /, '');
  const color = new RegExp(`^(?:${colors.join('|')})(?:\\s*(?:&|/)\\s*|\\s+|$)`, 'i');
  while (color.test(name)) name = name.replace(color, '');
  return name.replace(/\b(?:Leather|Suede|Jacket|Coat|Top)\b/g, '').replace(/\s+/g, ' ').trim();
}
if (process.argv.includes('--inspect')) {
  console.log(JSON.stringify({ families: [...new Set(products.map(family))], colors: [...new Set(products.flatMap(p => p.colors.map(c => c.name)))] }));
  process.exit(0);
}
const locales = ['de', 'es', 'fr', 'it'];
const descriptors = {
  'Colour-Block Biker': ['Colorblock im Biker-Stil','bloques de color, estilo motero','empiècements contrastés, style motard','inserti a contrasto, stile biker'],
  'Quilted-Sleeve Zip-Up Biker': ['gesteppte Ärmel und Reißverschluss, Biker-Stil','mangas acolchadas y cremallera, estilo motero','manches matelassées et zip, style motard','maniche trapuntate e zip, stile biker'],
  'Striped-Sleeve Cafe Racer': ['Ärmelstreifen im Café-Racer-Stil','rayas en las mangas, estilo café racer','bandes sur les manches, style café racer','righe sulle maniche, stile café racer'],
  'Croc-Effect Zip-Up': ['Krokoprägung und Reißverschluss','efecto cocodrilo y cremallera','effet crocodile et fermeture zippée','effetto coccodrillo e zip'],
  'Stand-Collar Puffer': ['Stehkragen und gesteppte Form','cuello alto y diseño acolchado','col montant et coupe matelassée','collo alto e struttura trapuntata'],
  'Front-Pocket Motorcycle-Style': ['Fronttaschen im Motorrad-Stil','bolsillos delanteros, estilo motorista','poches devant, style moto','tasche anteriori, stile motociclista'],
  'Twin-Stripe': ['zwei Streifen','dos franjas','deux bandes','due righe'],
  'Panelled': ['Einsatzdesign','diseño de paneles','construction à empiècements','design a pannelli'],
  'Quilted-Patch': ['gesteppte Einsätze','apliques acolchados','empiècements matelassés','inserti trapuntati'],
  'Four-Pocket Cafe Racer': ['vier Taschen im Café-Racer-Stil','cuatro bolsillos, estilo café racer','quatre poches, style café racer','quattro tasche, stile café racer'],
  'Double-Stripe Motorcycle': ['Doppelstreifen im Motorrad-Stil','doble franja, estilo motorista','doubles bandes, style moto','doppie righe, stile motociclista'],
  'Yoke-Collar Puffer': ['Kontrastpasse, Kragen und Steppdesign','canesú y cuello, diseño acolchado','empiècement aux épaules, col et matelassage','sprone, collo e lavorazione trapuntata'],
  'Chevron Puffer': ['Chevron-Steppung','acolchado en espiga','matelassage à chevrons','trapuntatura a spina di pesce'],
  'Diamond Quilt Puffer': ['Rautensteppung','acolchado de rombos','matelassage en losanges','trapuntatura a rombi'],
  'Diamond-Quilt Puffer': ['Rautensteppung','acolchado de rombos','matelassage en losanges','trapuntatura a rombi'],
  'Heritage Quilt Puffer': ['klassische Steppung','acolchado de estilo clásico','matelassage de style classique','trapuntatura di ispirazione classica'],
  'Diamond-Panel Puffer': ['rautenförmige Steppfelder','paneles acolchados en rombo','panneaux matelassés en losanges','pannelli trapuntati a rombi'],
  'Quilted Puffer': ['Steppdesign','diseño acolchado','coupe matelassée','struttura trapuntata'],
  'V-Panel Varsity': ['V-förmige Einsätze im College-Stil','paneles en V, estilo universitario','empiècements en V, style universitaire','inserti a V, stile universitario'],
  'Rib-Trim Zip': ['Rippbündchen und Reißverschluss','ribetes de canalé y cremallera','bords côtelés et zip','bordi a coste e zip'],
  'Ribbed-Hem': ['gerippter Saum','bajo de canalé','ourlet côtelé','fondo a coste'],
  'College-Trim': ['Abschlüsse im College-Stil','ribetes de estilo universitario','finitions de style universitaire','finiture di stile universitario'],
  'Zip-Front': ['Frontreißverschluss','cremallera delantera','zip devant','zip frontale'],
  'Stripe-Trim': ['gestreifte Abschlüsse','ribetes a rayas','finitions rayées','finiture a righe'],
  'Rib-Trim': ['Rippbündchen','ribetes de canalé','finitions côtelées','finiture a coste'],
  'Panel': ['Kontrasteinsätze','paneles a contraste','empiècements contrastés','inserti a contrasto'],
  'Tri-Colour Panel': ['dreifarbige Einsätze','paneles tricolores','empiècements tricolores','inserti tricolori'],
  'Contrast-Collar': ['Kontrastkragen','cuello a contraste','col contrasté','collo a contrasto'],
  'Graphic-Panel': ['grafische Einsätze','paneles gráficos','empiècements graphiques','inserti grafici'],
  'Tri-Panel Zip': ['drei Einsätze und Reißverschluss','tres paneles y cremallera','trois empiècements et zip','tre pannelli e zip'],
  'Cross-Back Zip': ['Kreuzdesign am Rücken und Reißverschluss','diseño cruzado en la espalda y cremallera','motif croisé au dos et zip','disegno incrociato sul retro e zip'],
  'Cross-Back': ['Kreuzdesign am Rücken','diseño cruzado en la espalda','motif croisé au dos','disegno incrociato sul retro'],
  'Cream-Collar Zip': ['cremefarbener Kragen und Reißverschluss','cuello crema y cremallera','col crème et zip','collo color crema e zip'],
  'Cream-Collar Bomber': ['cremefarbener Kragen im Bomber-Stil','cuello crema, estilo bomber','col crème, style bomber','collo color crema, stile bomber'],
  'Contrast-Collar Zip': ['Kontrastkragen und Reißverschluss','cuello a contraste y cremallera','col contrasté et zip','collo a contrasto e zip'],
  'Cape-Shoulder Belted': ['Cape-Schultern und Gürtel','hombros tipo capa y cinturón','épaules façon cape et ceinture','spalle a mantella e cintura'],
  'Pointed-Hem Belted': ['spitz zulaufender Saum und Gürtel','bajo en punta y cinturón','ourlet pointu et ceinture','fondo a punta e cintura'],
  'Layered-Shoulder Belted': ['mehrlagige Schulterpartie und Gürtel','hombros superpuestos y cinturón','épaules superposées et ceinture','spalle sovrapposte e cintura'],
  'Curved-Hem Belted': ['gerundeter Saum und Gürtel','bajo curvo y cinturón','ourlet arrondi et ceinture','fondo arrotondato e cintura'],
  'Panelled Cropped Zip': ['kurzer Schnitt, Einsätze und Reißverschluss','corte corto, paneles y cremallera','coupe courte, empiècements et zip','taglio corto, pannelli e zip'],
  'Shirt-Collar Cropped': ['kurzer Schnitt mit Hemdkragen','corte corto y cuello camisero','coupe courte et col chemise','taglio corto e collo a camicia'],
  'Contour-Seam Cropped': ['kurzer Schnitt mit Formnähten','corte corto con costuras entalladas','coupe courte et coutures de mise en forme','taglio corto con cuciture sagomate'],
  'Short-Cut Zip': ['kurzer Schnitt mit Reißverschluss','corte corto con cremallera','coupe courte avec zip','taglio corto con zip'],
  'Fur-Collar Slim': ['schmaler Schnitt mit Fellkragen','corte entallado y cuello con pelo','coupe ajustée et col à garniture de fourrure','taglio aderente e collo con bordo in pelliccia'],
  'Cream-Trim Zip-Pocket': ['cremefarbene Abschlüsse und Reißverschlusstaschen','ribetes crema y bolsillos con cremallera','finitions crème et poches zippées','finiture color crema e tasche con zip'],
  'Fur-Trim Hooded Belted': ['Kapuze, Fellbesatz und Gürtel','capucha, ribetes con pelo y cinturón','capuche, garniture de fourrure et ceinture','cappuccio, bordi in pelliccia e cintura'],
  'Contrast Fur-Sleeve': ['Ärmel mit kontrastierendem Fellbesatz','mangas con pelo a contraste','manches à garniture de fourrure contrastée','maniche con pelliccia a contrasto'],
  'Cream-Lapel': ['cremefarbene Revers','solapas color crema','revers crème','rever color crema'],
  'Cream-Trim': ['cremefarbene Abschlüsse','ribetes color crema','finitions crème','finiture color crema'],
  'Fur-Collar Panelled': ['Einsätze und Fellkragen','paneles y cuello con pelo','empiècements et col à garniture de fourrure','pannelli e collo con pelliccia'],
  'Double-Breasted Fur-Lapel': ['zweireihiger Schnitt und Fellrevers','cierre cruzado y solapas con pelo','coupe croisée et revers à garniture de fourrure','taglio doppiopetto e rever con pelliccia'],
  'Black-Trim Panel-Back': ['schwarze Abschlüsse und Rückeneinsätze','ribetes negros y paneles traseros','finitions noires et empiècements au dos','finiture nere e pannelli sul retro'],
  'Tab-Collar': ['Kragen mit Lasche','cuello con trabilla','col à patte','collo con linguetta'],
  'Gathered-Waist Peplum': ['geraffte Taille und Schößchen','cintura fruncida y volante','taille froncée et basque','vita arricciata e baschina'],
  'Zip-Front Bomber': ['Frontreißverschluss im Bomber-Stil','cremallera delantera, estilo bomber','zip devant, style bomber','zip frontale, stile bomber'],
  'Contour-Panel Zip': ['geformte Einsätze und Reißverschluss','paneles entallados y cremallera','empiècements ajustés et zip','pannelli sagomati e zip'],
  'Drawstring-Waist Hooded': ['Kapuze und Kordelzug an der Taille','capucha y cordón en la cintura','capuche et cordon à la taille','cappuccio e coulisse in vita'],
  'Quilt-Panel Biker': ['Steppfelder im Biker-Stil','paneles acolchados, estilo motero','empiècements matelassés, style motard','inserti trapuntati, stile biker'],
  'Gothic Hooded Tail': ['Kapuze und verlängerter Rückensaum im Gothic-Stil','capucha y bajo trasero alargado, estilo gótico','capuche et pans allongés, style gothique','cappuccio e fondo posteriore allungato, stile gotico'],
  'Hooded Belted Frock': ['Kapuze, Gürtel und ausgestellter Schnitt','capucha, cinturón y corte acampanado','capuche, ceinture et coupe évasée','cappuccio, cintura e taglio svasato'],
  'Contrast-Panel Motorcycle-Style': ['Kontrasteinsätze im Motorrad-Stil','paneles a contraste, estilo motorista','empiècements contrastés, style moto','inserti a contrasto, stile motociclista'],
  'Twin-Stripe Motorcycle-Style': ['Doppelstreifen im Motorrad-Stil','dos franjas, estilo motorista','deux bandes, style moto','due righe, stile motociclista'],
  'Quilt-Shoulder': ['gesteppte Schultern','hombros acolchados','épaules matelassées','spalle trapuntate'],
  'Contour-Stripe Motorcycle-Style': ['geformte Streifen im Motorrad-Stil','franjas entalladas, estilo motorista','bandes dessinant la silhouette, style moto','righe sagomate, stile motociclista'],
  'Waist-Seam Zip': ['Taillennaht und Reißverschluss','costura en la cintura y cremallera','couture à la taille et zip','cucitura in vita e zip'],
  'Round-Neck': ['runder Ausschnitt','cuello redondo','encolure ronde','scollo rotondo'],
  'Spread-Collar': ['breiter Kragen','cuello abierto','col ouvert','collo aperto'],
  'Collared Zipper': ['Kragen und Reißverschluss','cuello y cremallera','col et fermeture zippée','collo e chiusura con zip'],
  'Longline Slim': ['lange, schmale Form','corte largo y entallado','coupe longue et ajustée','taglio lungo e aderente'],
  'Cat-Ear Hood': ['Kapuze mit Katzenohren','capucha con orejas de gato','capuche à oreilles de chat','cappuccio con orecchie da gatto'],
};
const colorNames = {
  Black:['Schwarz','Negro','Noir','Nero'], White:['Weiß','Blanco','Blanc','Bianco'], Red:['Rot','Rojo','Rouge','Rosso'], Brown:['Braun','Marrón','Marron','Marrone'], Tan:['Hellbraun','Cuero tostado','Fauve','Cuoio'], Burgundy:['Bordeaux','Burdeos','Bordeaux','Bordeaux'], Grey:['Grau','Gris','Gris','Grigio'], Gray:['Grau','Gris','Gris','Grigio'], Navy:['Marineblau','Azul marino','Bleu marine','Blu navy'], Blue:['Blau','Azul','Bleu','Blu'], Yellow:['Gelb','Amarillo','Jaune','Giallo'], Orange:['Orange','Naranja','Orange','Arancione'], Pink:['Rosa','Rosa','Rose','Rosa'], Camel:['Camel','Camel','Camel','Cammello'], Ivory:['Elfenbein','Marfil','Ivoire','Avorio'], Cream:['Creme','Crema','Crème','Crema'], Cognac:['Cognac','Coñac','Cognac','Cognac'], Chocolate:['Schokoladenbraun','Chocolate','Chocolat','Cioccolato'], Slate:['Schiefergrau','Gris pizarra','Gris ardoise','Grigio ardesia'], 'Burnt Orange':['Rostorange','Naranja quemado','Orange brûlé','Arancio bruciato'], 'Cobalt Blue':['Kobaltblau','Azul cobalto','Bleu cobalt','Blu cobalto'],
};
const materialNames = {
  'Genuine leather':['Echtes Leder','Cuero auténtico','Cuir véritable','Vera pelle'],
  'Genuine suede leather':['Echtes Wildleder','Ante auténtico','Daim véritable','Vero camoscio'],
  'Leather':['Leder','Cuero','Cuir','Pelle'],
  'Leather; fur trim composition unconfirmed':['Leder; Zusammensetzung des Fellbesatzes noch nicht bestätigt','Cuero; composición del ribete con pelo sin confirmar','Cuir ; composition de la garniture de fourrure non confirmée','Pelle; composizione del bordo in pelliccia non confermata'],
  'Leather; rib trim composition unconfirmed':['Leder; Zusammensetzung der Rippbündchen noch nicht bestätigt','Cuero; composición de los ribetes de canalé sin confirmar','Cuir ; composition des bords côtelés non confirmée','Pelle; composizione dei bordi a coste non confermata'],
  'Leather; contrast panel composition unconfirmed':['Leder; Zusammensetzung der Kontrasteinsätze noch nicht bestätigt','Cuero; composición de los paneles a contraste sin confirmar','Cuir ; composition des empiècements contrastés non confirmée','Pelle; composizione degli inserti a contrasto non confermata'],
  'Leather with contrast panels; textile composition unconfirmed':['Leder mit Kontrasteinsätzen; Textilzusammensetzung noch nicht bestätigt','Cuero con paneles a contraste; composición textil sin confirmar','Cuir à empiècements contrastés ; composition textile non confirmée','Pelle con inserti a contrasto; composizione tessile non confermata'],
  'Suede leather; hide type unconfirmed':['Wildleder; Lederart noch nicht bestätigt','Ante; tipo de piel sin confirmar','Daim ; type de peau non confirmé','Camoscio; tipo di pelle non confermato'],
  'Leather; panel composition unconfirmed':['Leder; Zusammensetzung der Einsätze noch nicht bestätigt','Cuero; composición de los paneles sin confirmar','Cuir ; composition des empiècements non confirmée','Pelle; composizione dei pannelli non confermata'],
  'Leather; composition awaiting supplier confirmation':['Leder; Zusammensetzung muss vom Lieferanten noch bestätigt werden','Cuero; composición pendiente de confirmación del proveedor','Cuir ; composition en attente de confirmation du fournisseur','Pelle; composizione in attesa di conferma del fornitore'],
  'Leather; hood lining and composition awaiting supplier confirmation':['Leder; Kapuzenfutter und Zusammensetzung müssen noch bestätigt werden','Cuero; forro de la capucha y composición pendientes de confirmación','Cuir ; doublure de capuche et composition en attente de confirmation','Pelle; fodera del cappuccio e composizione in attesa di conferma'],
};
Object.assign(colorNames, {
  'Black Cross': ['Schwarzes Kreuz','Cruz negra','Croix noire','Croce nera'],
  'Ivory Cross': ['Elfenbeinfarbenes Kreuz','Cruz marfil','Croix ivoire','Croce avorio'],
  'Cream Collar': ['Cremefarbener Kragen','Cuello crema','Col crème','Collo color crema'],
});
const safety = ['Modebekleidung im Motorrad-Stil. Schutzausrüstung, Aufprallschutz und CE/UKCA-Zertifizierung sind nicht bestätigt. Nicht als Motorradschutzkleidung verwenden.', 'Prenda de moda de inspiración motorista. El equipo protector, la protección contra impactos y la certificación CE/UKCA no están verificados. No utilizar como ropa de protección para moto.', 'Vêtement de mode inspiré de la moto. Les protections, la résistance aux chocs et la certification CE/UKCA ne sont pas vérifiées. Ne pas utiliser comme équipement de protection à moto.', 'Capo di moda ispirato al motociclismo. Dotazioni protettive, protezione dagli impatti e certificazione CE/UKCA non sono verificate. Non utilizzare come abbigliamento protettivo da moto.'];
const slugify = value => value.toLowerCase().replaceAll('ß','ss').replaceAll('œ','oe').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
for (const [index, locale] of locales.entries()) {
  const file = `src/i18n/locales/${locale}.json`;
  const dictionary = JSON.parse(await fs.readFile(file, 'utf8'));
  dictionary.products ??= {};
  dictionary.colorNames = Object.fromEntries(Object.entries(colorNames).map(([key,value])=>[key,value[index]]));
  dictionary.optionNames = { 'One Size':['Einheitsgröße','Talla única','Taille unique','Taglia unica'][index] };
  const slugs = new Set();
  for (const product of products) {
    const features = descriptors[family(product)]?.[index];
    const material = materialNames[product.material]?.[index];
    if (!features || !material) throw Error(`Missing reviewed translation: ${product.slug}`);
    const color = product.colors.map(c => c.name.split(/\s*\/\s*|\s*&\s*/).map(c => { if (!colorNames[c]) throw Error(`Unknown colour ${c}`); return colorNames[c][index]; }).join(' / ')).join(', ');
    const women = product.slug.startsWith('womens-');
    const coat = /\bCoat\b/.test(product.name), top = /\bTop\b/.test(product.name), suede = /suede/i.test(product.material);
    const type = suede ? ['Wildlederjacke','Chaqueta de ante','Veste en daim','Giacca in camoscio'][index] : coat ? ['Ledermantel','Abrigo de cuero','Manteau en cuir','Cappotto in pelle'][index] : top ? ['Oberteil aus Leder','Top de cuero','Haut en cuir','Top in pelle'][index] : ['Lederjacke','Chaqueta de cuero','Veste en cuir','Giacca in pelle'][index];
    const audience = women ? ['für Damen','para mujer','pour femme','da donna'][index] : ['für Herren','para hombre','pour homme','da uomo'][index];
    const name = `${type} ${audience} – ${color} – ${features}`;
    const sizes = product.sizes.join(', ');
    const sizing = [`Größen: ${sizes}. Vergleichen Sie Ihre Maße vor der Bestellung mit der abgebildeten Größentabelle.`, `Tallas: ${sizes}. Compara tus medidas con la tabla de tallas de la galería antes de hacer el pedido.`, `Tailles : ${sizes}. Comparez vos mesures au guide des tailles de la galerie avant de commander.`, `Taglie: ${sizes}. Confronta le tue misure con la tabella taglie nella galleria prima di ordinare.`][index];
    const description = [`${type} ${audience} in ${color}. Design: ${features}. Material: ${material}. ${sizing}`, `${type} ${audience} en ${color}. Diseño: ${features}. Material: ${material}. ${sizing}`, `${type} ${audience}, coloris ${color}. Détails : ${features}. Matière : ${material}. ${sizing}`, `${type} ${audience} in ${color}. Design: ${features}. Materiale: ${material}. ${sizing}`][index];
    const warning = product.specs.some(s => s.label === 'Safety') ? safety[index] : '';
    const slug = slugify(name);
    if (slugs.has(slug)) throw Error(`Duplicate localized slug: ${locale}/${slug}`);
    slugs.add(slug);
    dictionary.products[product.slug] = {
      slug, name, tagline: `${features} · ${color}`, material,
      description: `${description}${warning ? ` ${warning}` : ''}`,
      specs: Object.fromEntries(product.specs.map(spec => {
        const label = spec.label;
        const translatedLabel = label === 'Material' ? ['Material','Material','Matière','Materiale'][index] : label === 'Colour' ? ['Farbe','Color','Couleur','Colore'][index] : label === 'Sizes' || label === 'Sizing' ? ['Größen','Tallas','Tailles','Taglie'][index] : label === 'Safety' ? ['Sicherheit','Seguridad','Sécurité','Sicurezza'][index] : ['Design','Diseño','Détails','Dettagli'][index];
        const value = label === 'Material' ? material : label === 'Colour' ? color : label === 'Sizes' ? sizes : label === 'Sizing' ? sizing : label === 'Safety' ? safety[index] : features;
        return [label, { label: translatedLabel, value }];
      })),
    };
  }
  await fs.writeFile(file, JSON.stringify(dictionary, null, 2) + '\n');
}
console.log(JSON.stringify({ products: products.length, locales, inventoryChanges: 0, databaseWrites: 0 }));

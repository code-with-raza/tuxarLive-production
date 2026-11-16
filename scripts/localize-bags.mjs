import fs from 'node:fs/promises';
const { products } = JSON.parse(await fs.readFile('src/data/products/approved-bags-catalogue.json', 'utf8'));
const translations = {
de: [
 ['Schlichter brauner Rucksack mit Reißverschluss','Brauner Rucksack mit abgerundeter Form, Trageschlaufe und vorderer Reißverschlusstasche.'],
 ['Braune Reisetasche mit Schnallentasche','Rechteckige braune Reisetasche mit Tragegriffen, Schulterriemen, vorderer Schnallentasche und zwei senkrechten Reißverschlusstaschen.'],
 ['Schwarzer Rucksack mit Logo-Aufnäher','Schwarzer Rucksack mit abgerundeter Form, vorderer Reißverschlusstasche und sichtbarem OVERTOP-Logo-Aufnäher.'],
 ['Brauner Rucksack mit Kordelzug und Schnallen','Brauner Rucksack mit Schnallenklappe, Kordelzug und vorderer Tasche mit zwei Schnallen.'],
 ['Brauner Rucksack mit Kontrastbesatz','Brauner Rucksack mit abgerundeter Form, Kontrastkanten, vorderer Reißverschlusstasche und kleinem rundem Emblem.'],
 ['Dunkelbraune zylindrische Reisetasche','Dunkelbraune zylindrische Reisetasche mit Antikoptik, Tragegriffen, Schulterriemen und äußerer Reißverschlusstasche.'],
 ['Formstabiler hellbrauner Rucksack mit Klappe','Hellbrauner Rucksack mit Tragegriff, breiter Klappe, vorderem Steckfach und Lasche mit Metallring.'],
 ['Zweifarbiger Rucksack in Schwarz und Braun','Rucksack in Schwarz und Braun mit Klappe, zwei Schnallenriemen und Seitentaschen.'],
 ['Braun-weiß gefleckte Reisetasche','Braun-weiß gefleckte Reisetasche mit hellbraunem Besatz, Tragegriffen, Schulterriemen und seitlicher Reißverschlusstasche.'],
 ['Hellbrauner Rucksack in Antikoptik mit zwei Reißverschlusstaschen','Hellbrauner Rucksack in Antikoptik mit oberer Reißverschlusstasche und größerem unteren Reißverschlussfach.'],
 ['Schwarzer Rucksack mit Mittelnaht','Schwarzer Rucksack mit Mittelnaht, vorderem Reißverschlussfach, Seitentaschen und Tragegriff.'],
],
fr: [
 ['Sac à dos brun épuré zippé','Sac à dos brun arrondi avec anse supérieure et poche avant zippée.'],
 ['Sac de voyage brun à poche à boucles','Sac de voyage brun rectangulaire avec poignées, bandoulière, poche avant à boucles et deux poches zippées verticales.'],
 ['Sac à dos noir à écusson logo','Sac à dos noir arrondi avec poche avant zippée et écusson OVERTOP visible.'],
 ['Sac à dos brun à cordon et boucles','Sac à dos brun avec rabat à boucle, fermeture à cordon et poche avant à deux boucles.'],
 ['Sac à dos brun à finitions contrastées','Sac à dos brun arrondi avec bordures contrastées, poche avant zippée et petit emblème rond.'],
 ['Sac de voyage cylindrique brun foncé','Sac de voyage cylindrique brun foncé à aspect patiné, avec poignées, bandoulière et poche extérieure zippée.'],
 ['Sac à dos camel structuré à rabat','Sac à dos camel structuré avec poignée, large rabat, poche avant ouverte et patte à anneau métallique.'],
 ['Sac à dos bicolore noir et brun','Sac à dos noir et brun avec rabat, deux sangles à boucles et poches latérales.'],
 ['Sac de voyage tacheté brun et blanc','Sac de voyage tacheté brun et blanc avec finitions camel, poignées, bandoulière et poche zippée sur le côté.'],
 ['Sac à dos camel patiné à deux poches zippées','Sac à dos camel à aspect patiné, avec poche zippée supérieure et grand compartiment zippé inférieur.'],
 ['Sac à dos noir à couture centrale','Sac à dos noir avec couture centrale, compartiment avant zippé, poches latérales et poignée supérieure.'],
],
it: [
 ['Zaino marrone essenziale con zip','Zaino marrone arrotondato con passante superiore e tasca anteriore con zip.'],
 ['Borsa da viaggio marrone con tasca a fibbie','Borsa da viaggio marrone rettangolare con manici, tracolla, tasca anteriore a fibbie e due tasche verticali con zip.'],
 ['Zaino nero con etichetta logo','Zaino nero arrotondato con tasca anteriore con zip ed etichetta OVERTOP visibile.'],
 ['Zaino marrone con coulisse e fibbie','Zaino marrone con patta a fibbia, chiusura a coulisse e tasca anteriore con due fibbie.'],
 ['Zaino marrone con bordi a contrasto','Zaino marrone arrotondato con bordi a contrasto, tasca anteriore con zip e piccolo emblema circolare.'],
 ['Borsone cilindrico marrone scuro','Borsone cilindrico marrone scuro dall’aspetto vissuto, con manici, tracolla e tasca esterna con zip.'],
 ['Zaino color cuoio strutturato con patta','Zaino color cuoio strutturato con manico, ampia patta, tasca anteriore aperta e linguetta con anello metallico.'],
 ['Zaino bicolore nero e marrone','Zaino nero e marrone con patta, due cinghie con fibbie e tasche laterali.'],
 ['Borsone maculato marrone e bianco','Borsone maculato marrone e bianco con finiture color cuoio, manici, tracolla e tasca laterale con zip.'],
 ['Zaino color cuoio effetto vissuto con due tasche con zip','Zaino color cuoio dall’aspetto vissuto, con tasca superiore con zip e ampio scomparto inferiore con zip.'],
 ['Zaino nero con cucitura centrale','Zaino nero con cucitura centrale, scomparto anteriore con zip, tasche laterali e manico superiore.'],
],
es: [
 ['Mochila marrón sencilla con cremallera','Mochila marrón redondeada con asa superior y bolsillo delantero con cremallera.'],
 ['Bolsa de viaje marrón con bolsillo de hebillas','Bolsa de viaje marrón rectangular con asas, correa de hombro, bolsillo delantero con hebillas y dos bolsillos verticales con cremallera.'],
 ['Mochila negra con parche de logotipo','Mochila negra redondeada con bolsillo delantero con cremallera y parche OVERTOP visible.'],
 ['Mochila marrón con cordón y hebillas','Mochila marrón con solapa de hebilla, cierre de cordón y bolsillo delantero con dos hebillas.'],
 ['Mochila marrón con ribetes a contraste','Mochila marrón redondeada con ribetes a contraste, bolsillo delantero con cremallera y pequeño emblema circular.'],
 ['Bolsa de viaje cilíndrica marrón oscuro','Bolsa de viaje cilíndrica marrón oscuro de aspecto envejecido, con asas, correa de hombro y bolsillo exterior con cremallera.'],
 ['Mochila tostada estructurada con solapa','Mochila tostada estructurada con asa, solapa ancha, bolsillo delantero abierto y lengüeta con anilla metálica.'],
 ['Mochila bicolor negra y marrón','Mochila negra y marrón con solapa, dos correas con hebillas y bolsillos laterales.'],
 ['Bolsa de viaje moteada marrón y blanca','Bolsa de viaje moteada marrón y blanca con ribetes tostados, asas, correa de hombro y bolsillo lateral con cremallera.'],
 ['Mochila tostada envejecida con dos bolsillos con cremallera','Mochila tostada de aspecto envejecido, con bolsillo superior con cremallera y compartimento inferior grande con cremallera.'],
 ['Mochila negra con costura central','Mochila negra con costura central, compartimento delantero con cremallera, bolsillos laterales y asa superior.'],
],
};
const text = {
 en: ['Bag collection','Awaiting supplier confirmation','Colour','Measurements and capacity','See the supplied photographs for the visible design. Material composition, measurements and capacity are awaiting supplier confirmation.','Bags','Explore backpacks, rucksacks and travel bags with individual product photographs.'],
 de: ['Taschenkollektion','Bestätigung des Lieferanten ausstehend','Farbe','Maße und Fassungsvermögen','Die bereitgestellten Fotos zeigen das sichtbare Design. Materialzusammensetzung, Maße und Fassungsvermögen müssen noch vom Lieferanten bestätigt werden.','Taschen','Entdecken Sie Rucksäcke und Reisetaschen mit individuellen Produktfotos.'],
 fr: ['Collection de sacs','En attente de confirmation du fournisseur','Couleur','Dimensions et capacité','Consultez les photographies fournies pour les détails visibles. La composition, les dimensions et la capacité restent à confirmer par le fournisseur.','Sacs','Découvrez des sacs à dos et de voyage avec leurs photographies individuelles.'],
 it: ['Collezione borse','In attesa di conferma del fornitore','Colore','Dimensioni e capacità','Consulta le fotografie fornite per i dettagli visibili. Composizione, misure e capacità sono in attesa di conferma del fornitore.','Borse','Scopri zaini e borse da viaggio con le fotografie di ogni prodotto.'],
 es: ['Colección de bolsos','Pendiente de confirmación del proveedor','Color','Dimensiones y capacidad','Consulta las fotografías facilitadas para los detalles visibles. La composición, las medidas y la capacidad están pendientes de confirmación del proveedor.','Bolsos','Descubre mochilas y bolsas de viaje con las fotografías de cada producto.'],
};
const slug = name => name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
for (const locale of ['en','de','fr','it','es']) {
 const file = `src/i18n/locales/${locale}.json`;
 const dictionary = JSON.parse(await fs.readFile(file,'utf8'));
 dictionary.products ??= {};
 dictionary.collections ??= {};
 const [tagline,pending,colorLabel,dimensionsLabel,note,collectionTitle,collectionDescription] = text[locale];
 for (const [i,p] of products.entries()) {
  const [name,detail] = locale === 'en' ? [p.name,p.seoDescription] : translations[locale][i];
  const colour = p.colors[0].name.split(' / ').map(c=>dictionary.colorNames?.[c] ?? c).join(' / ');
  dictionary.products[p.slug] = { slug: locale === 'en' ? p.slug : slug(name), name, tagline: `${colour} · ${tagline}`, description: `${detail} ${note}`, material:pending,
   specs: { Colour:{label:colorLabel,value:colour}, 'Measurements and capacity':{label:dimensionsLabel,value:pending} } };
 }
 dictionary.collections['women-leather-bags'] = { ...dictionary.collections['women-leather-bags'],title:collectionTitle,description:collectionDescription,metaIntro:collectionDescription,seoContent:collectionDescription };
 await fs.writeFile(file,JSON.stringify(dictionary,null,2)+'\n');
}
console.log('Localised 11 approved bags in all five languages.');

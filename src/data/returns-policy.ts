import type { Locale } from "@/i18n/i18n";

export const BUSINESS_ADDRESS = ["Tuxar", "Via Pollenzo 58/D", "10141 Torino TO", "Italy"] as const;
export const RETURNS_EMAIL = "tuxar.co@gmail.com";
export const ADDRESS_LABELS: Record<Locale, string> = {
  en: "Return and dispatch address", de: "Rücksende- und Versandadresse", es: "Dirección de devoluciones y expedición", fr: "Adresse de retour et d’expédition", it: "Indirizzo per resi e spedizioni",
};
type Policy = {
  title: string; description: string; start: string; eligibility: string;
  tracked: string; fees: string; refund: string; custom: string; faulty: string;
  rights: string; headings: readonly string[];
};
export const RETURN_POLICIES: Record<Locale, Policy> = {
  "en": {
    "title": "Returns policy",
    "description": "Request a return within 15 days. Customers pay change-of-mind return postage; Tuxar covers faulty, damaged or incorrect items. No restocking fee.",
    "start": "This policy applies to customers in the UK, Germany, France, Italy and Spain. To start a return, email tuxar.co@gmail.com with your order number. Return requests are accepted within 15 days of delivery.",
    "eligibility": "You may inspect or try on items as you would in a shop. For a non-faulty return under our commercial policy, items must not have been worn beyond trying on, used, damaged or altered, and must be returned with their original tags and packaging. These conditions do not remove your statutory cancellation rights; see below.",
    "tracked": "Returns are sent by mail after Tuxar provides return instructions. Contact us before posting your return. The return address is shown below.",
    "fees": "For non-faulty or change-of-mind returns, the customer pays the return-postage costs. Tuxar covers return costs for faulty, damaged or incorrectly supplied items. There is no restocking fee.",
    "refund": "Approved refunds are issued to the original payment method within 10 calendar days after the returned item is received and inspected. Inspection will not delay a refund beyond any earlier deadline required by law, including where proof of return has been provided. Standard outbound delivery costs are refunded where required by law.",
    "custom": "Made-to-measure or customised products are excluded from change-of-mind returns only where legally applicable and genuinely made or personalised for that customer. This does not exclude statutory remedies for faulty, damaged or incorrectly supplied items.",
    "faulty": "If an item is faulty, damaged or incorrectly supplied, contact tuxar.co@gmail.com with your order number and, where possible, photographs of the issue. Tuxar covers the return costs and will provide instructions and arrange the appropriate remedy. The 15-day commercial return window does not limit your statutory rights for these items.",
    "rights": "Your statutory rights under applicable UK or EU consumer law remain unaffected. Where the statutory right to cancel applies, you may exercise it by any clear statement; our email process and return instructions are not conditions for a valid cancellation. You have at least 14 days after delivery to notify cancellation and a further 14 days after notifying us to send the goods back. Missing original tags or packaging does not automatically remove this right. Any deduction for diminished value is limited to what the law permits for handling beyond what is necessary to inspect or try on an item as in a shop.",
    "headings": [
      "Start a return",
      "Item condition and trying on",
      "Return by mail",
      "Return costs and fees",
      "Refunds",
      "Made-to-measure and customised products",
      "Faulty, damaged or incorrect items",
      "Your statutory rights"
    ]
  },
  "de": {
    "title": "Rückgaberichtlinie",
    "description": "Rückgabe innerhalb von 15 Tagen anfragen. Rückporto bei Nichtgefallen zahlt der Kunde; bei Mängeln, Schäden oder Falschlieferung Tuxar. Keine Wiedereinlagerungsgebühr.",
    "start": "Diese Richtlinie gilt für Kunden im Vereinigten Königreich, in Deutschland, Frankreich, Italien und Spanien. Um eine Rückgabe einzuleiten, senden Sie eine E-Mail mit Ihrer Bestellnummer an tuxar.co@gmail.com. Rückgabeanfragen werden innerhalb von 15 Tagen nach der Lieferung akzeptiert.",
    "eligibility": "Sie dürfen Artikel wie in einem Geschäft prüfen oder anprobieren. Bei einer mangelfreien Rückgabe im Rahmen unserer freiwilligen Rückgaberegelung dürfen Artikel nicht über die Anprobe hinaus getragen, benutzt, beschädigt oder verändert worden sein und müssen mit Originaletiketten und Originalverpackung zurückgesandt werden. Diese Bedingungen schränken Ihr gesetzliches Widerrufsrecht nicht ein; siehe unten.",
    "tracked": "Rücksendungen erfolgen per Post, nachdem Tuxar Ihnen die Rücksendeanweisungen mitgeteilt hat. Kontaktieren Sie uns vor dem Versand. Die Rücksendeadresse finden Sie unten.",
    "fees": "Bei mangelfreien Rückgaben oder Rückgaben wegen Nichtgefallens trägt der Kunde die Rücksendekosten. Bei fehlerhaften, beschädigten oder falsch gelieferten Artikeln übernimmt Tuxar die Rücksendekosten. Es fällt keine Wiedereinlagerungsgebühr an.",
    "refund": "Genehmigte Erstattungen erfolgen über die ursprünglich verwendete Zahlungsmethode innerhalb von 10 Kalendertagen, nachdem der zurückgesandte Artikel eingegangen und geprüft worden ist. Die Prüfung verzögert keine Erstattung über eine gesetzlich vorgeschriebene frühere Frist hinaus, auch wenn ein Rücksendenachweis vorgelegt wurde. Die Kosten der ursprünglichen Standardlieferung werden erstattet, soweit gesetzlich vorgeschrieben.",
    "custom": "Maßgefertigte oder personalisierte Produkte sind nur dann von Rückgaben wegen Nichtgefallens ausgeschlossen, wenn dies gesetzlich zulässig ist und sie tatsächlich speziell für den jeweiligen Kunden angefertigt oder personalisiert wurden. Gesetzliche Ansprüche bei fehlerhaften, beschädigten oder falsch gelieferten Artikeln bleiben bestehen.",
    "faulty": "Bei fehlerhaften, beschädigten oder falsch gelieferten Artikeln kontaktieren Sie tuxar.co@gmail.com mit Ihrer Bestellnummer und, wenn möglich, Fotos des Problems. Tuxar übernimmt die Rücksendekosten, stellt Rücksendeanweisungen bereit und veranlasst eine geeignete Abhilfe. Die freiwillige Rückgabefrist von 15 Tagen schränkt Ihre gesetzlichen Rechte bei diesen Artikeln nicht ein.",
    "rights": "Ihre gesetzlichen Rechte nach dem jeweils geltenden britischen oder EU-Verbraucherrecht bleiben unberührt. Soweit das gesetzliche Widerrufsrecht gilt, können Sie es durch jede eindeutige Erklärung ausüben; unser E-Mail-Verfahren und unsere Rücksendeanweisungen sind keine Voraussetzung für einen wirksamen Widerruf. Sie haben mindestens 14 Tage nach der Lieferung Zeit, den Widerruf mitzuteilen, und weitere 14 Tage nach dieser Mitteilung, um die Waren zurückzusenden. Fehlende Originaletiketten oder Originalverpackungen beseitigen dieses Recht nicht automatisch. Ein Abzug wegen Wertverlusts ist nur im gesetzlich zulässigen Umfang möglich, wenn der Umgang mit dem Artikel über die Prüfung oder Anprobe wie in einem Geschäft hinausgeht.",
    "headings": [
      "Rückgabe einleiten",
      "Artikelzustand und Anprobe",
      "Rücksendung per Post",
      "Rücksendekosten und Gebühren",
      "Erstattungen",
      "Maßgefertigte und personalisierte Produkte",
      "Fehlerhafte, beschädigte oder falsch gelieferte Artikel",
      "Ihre gesetzlichen Rechte"
    ]
  },
  "fr": {
    "title": "Politique de retour",
    "description": "Demandez un retour sous 15 jours. Frais de retour à votre charge en cas de changement d’avis, à la charge de Tuxar en cas de défaut, dommage ou erreur. Aucun frais de remise en stock.",
    "start": "Cette politique s’applique aux clients au Royaume-Uni, en Allemagne, en France, en Italie et en Espagne. Pour demander un retour, envoyez un e-mail à tuxar.co@gmail.com en indiquant votre numéro de commande. Les demandes de retour sont acceptées dans les 15 jours suivant la livraison.",
    "eligibility": "Vous pouvez examiner ou essayer les articles comme vous le feriez en magasin. Pour un retour sans défaut au titre de notre politique commerciale, les articles ne doivent pas avoir été portés au-delà de l’essayage, utilisés, endommagés ou modifiés et doivent être renvoyés avec leurs étiquettes et leur emballage d’origine. Ces conditions ne suppriment pas votre droit légal de rétractation ; voir ci-dessous.",
    "tracked": "Les retours sont envoyés par voie postale après réception des instructions de Tuxar. Contactez-nous avant de renvoyer votre article. L’adresse de retour figure ci-dessous.",
    "fees": "Pour les retours d’articles sans défaut ou en cas de changement d’avis, les frais de retour sont à la charge du client. Tuxar prend en charge les frais de retour des articles défectueux, endommagés ou livrés par erreur. Aucun frais de remise en stock n’est appliqué.",
    "refund": "Les remboursements approuvés sont effectués sur le moyen de paiement d’origine dans les 10 jours calendaires après réception et inspection de l’article retourné. L’inspection ne reporte pas le remboursement au-delà d’un délai légal plus court, y compris lorsqu’une preuve de renvoi a été fournie. Les frais de livraison standard initiaux sont remboursés lorsque la loi l’exige.",
    "custom": "Les produits sur mesure ou personnalisés sont exclus des retours pour changement d’avis uniquement lorsque la loi le permet et qu’ils ont réellement été confectionnés ou personnalisés pour le client concerné. Les recours légaux pour les articles défectueux, endommagés ou livrés par erreur restent applicables.",
    "faulty": "Si un article est défectueux, endommagé ou livré par erreur, contactez tuxar.co@gmail.com avec votre numéro de commande et, si possible, des photographies du problème. Tuxar prend en charge les frais de retour, fournit les instructions et organise la solution appropriée. Le délai commercial de 15 jours ne limite pas vos droits légaux pour ces articles.",
    "rights": "Vos droits légaux en vertu du droit de la consommation applicable au Royaume-Uni ou dans l’Union européenne restent inchangés. Lorsque le droit légal de rétractation s’applique, vous pouvez l’exercer par toute déclaration claire ; notre procédure par e-mail et nos instructions de retour ne sont pas des conditions de validité de la rétractation. Vous disposez d’au moins 14 jours après la livraison pour nous notifier votre rétractation, puis de 14 jours supplémentaires après cette notification pour renvoyer les biens. L’absence d’étiquettes ou d’emballage d’origine ne supprime pas automatiquement ce droit. Toute retenue pour dépréciation est limitée à ce que la loi autorise pour des manipulations allant au-delà de l’examen ou de l’essayage comme en magasin.",
    "headings": [
      "Demander un retour",
      "État des articles et essayage",
      "Retour par voie postale",
      "Frais de retour",
      "Remboursements",
      "Produits sur mesure et personnalisés",
      "Articles défectueux, endommagés ou livrés par erreur",
      "Vos droits légaux"
    ]
  },
  "it": {
    "title": "Politica di reso",
    "description": "Richiedi un reso entro 15 giorni. Spese a carico del cliente per ripensamento; a carico di Tuxar per difetti, danni o articoli errati. Nessun costo di riassortimento.",
    "start": "Questa politica si applica ai clienti nel Regno Unito, in Germania, Francia, Italia e Spagna. Per avviare un reso, scrivi a tuxar.co@gmail.com indicando il numero d’ordine. Le richieste di reso sono accettate entro 15 giorni dalla consegna.",
    "eligibility": "Puoi esaminare o provare gli articoli come faresti in un negozio. Per un reso di articoli non difettosi ai sensi della nostra politica commerciale, gli articoli non devono essere stati indossati oltre la prova, usati, danneggiati o modificati e devono essere restituiti con cartellini e confezione originali. Queste condizioni non escludono il diritto legale di recesso; vedi sotto.",
    "tracked": "I resi vengono inviati per posta dopo che Tuxar ha fornito le istruzioni di reso. Contattaci prima di spedire l’articolo. L’indirizzo per il reso è indicato qui sotto.",
    "fees": "Per i resi di articoli non difettosi o per ripensamento, le spese di spedizione del reso sono a carico del cliente. Tuxar copre le spese di reso per articoli difettosi, danneggiati o forniti erroneamente. Non viene applicato alcun costo di riassortimento.",
    "refund": "I rimborsi approvati vengono emessi sul metodo di pagamento originale entro 10 giorni di calendario dopo la ricezione e l’ispezione dell’articolo restituito. L’ispezione non ritarda il rimborso oltre eventuali termini precedenti previsti dalla legge, anche quando viene fornita una prova di spedizione del reso. Le spese della consegna standard iniziale vengono rimborsate ove previsto dalla legge.",
    "custom": "I prodotti su misura o personalizzati sono esclusi dai resi per ripensamento solo ove legalmente applicabile e se effettivamente realizzati o personalizzati per quel cliente. Restano validi i rimedi previsti dalla legge per articoli difettosi, danneggiati o forniti erroneamente.",
    "faulty": "Se un articolo è difettoso, danneggiato o fornito erroneamente, contatta tuxar.co@gmail.com con il numero d’ordine e, se possibile, fotografie del problema. Tuxar copre le spese di reso, fornisce le istruzioni e predispone il rimedio appropriato. Il termine commerciale di 15 giorni non limita i tuoi diritti legali per questi articoli.",
    "rights": "I tuoi diritti previsti dalla normativa applicabile del Regno Unito o dell’Unione europea a tutela dei consumatori restano invariati. Quando si applica il diritto legale di recesso, puoi esercitarlo mediante qualsiasi dichiarazione chiara; la nostra procedura via e-mail e le istruzioni di reso non sono condizioni per un recesso valido. Hai almeno 14 giorni dalla consegna per comunicarci il recesso e altri 14 giorni dalla comunicazione per rispedire i beni. L’assenza dei cartellini o della confezione originali non esclude automaticamente questo diritto. Eventuali detrazioni per diminuzione del valore sono limitate a quanto consentito dalla legge per manipolazioni che vanno oltre l’esame o la prova come in negozio.",
    "headings": [
      "Avviare un reso",
      "Condizioni degli articoli e prova",
      "Reso per posta",
      "Spese di reso",
      "Rimborsi",
      "Prodotti su misura e personalizzati",
      "Articoli difettosi, danneggiati o errati",
      "I tuoi diritti legali"
    ]
  },
  "es": {
    "title": "Política de devoluciones",
    "description": "Solicita una devolución en 15 días. El cliente paga el envío por cambio de opinión; Tuxar lo cubre por defectos, daños o artículos incorrectos. Sin gastos de reposición.",
    "start": "Esta política se aplica a clientes del Reino Unido, Alemania, Francia, Italia y España. Para iniciar una devolución, escribe a tuxar.co@gmail.com e indica tu número de pedido. Se aceptan solicitudes de devolución en un plazo de 15 días desde la entrega.",
    "eligibility": "Puedes examinar o probarte los artículos como lo harías en una tienda. Para una devolución de artículos sin defectos conforme a nuestra política comercial, los artículos no deben haberse llevado más allá de la prueba, usado, dañado ni modificado, y deben devolverse con sus etiquetas y embalaje originales. Estas condiciones no eliminan tu derecho legal de desistimiento; consulta más abajo.",
    "tracked": "Las devoluciones se envían por correo después de que Tuxar facilite las instrucciones. Contacta con nosotros antes de enviar el artículo. La dirección de devolución figura a continuación.",
    "fees": "En las devoluciones de artículos sin defectos o por cambio de opinión, el cliente paga los gastos de envío de la devolución. Tuxar cubre los gastos de devolución de artículos defectuosos, dañados o suministrados incorrectamente. No se cobran gastos de reposición.",
    "refund": "Los reembolsos aprobados se realizan al método de pago original dentro de los 10 días naturales posteriores a la recepción e inspección del artículo devuelto. La inspección no retrasa el reembolso más allá de cualquier plazo anterior exigido por la ley, incluso cuando se haya aportado un comprobante del envío de la devolución. Los gastos de entrega estándar inicial se reembolsan cuando lo exige la ley.",
    "custom": "Los productos hechos a medida o personalizados solo quedan excluidos de las devoluciones por cambio de opinión cuando sea legalmente aplicable y se hayan fabricado o personalizado realmente para ese cliente. Se mantienen los derechos legales relativos a artículos defectuosos, dañados o suministrados incorrectamente.",
    "faulty": "Si un artículo es defectuoso, está dañado o se ha suministrado incorrectamente, contacta con tuxar.co@gmail.com indicando tu número de pedido y, si es posible, adjuntando fotografías del problema. Tuxar cubre los gastos de devolución, facilita las instrucciones y organiza la solución adecuada. El plazo comercial de 15 días no limita tus derechos legales para estos artículos.",
    "rights": "Tus derechos legales conforme a la normativa de consumo aplicable del Reino Unido o de la Unión Europea no se ven afectados. Cuando se aplique el derecho legal de desistimiento, puedes ejercerlo mediante cualquier declaración clara; nuestro procedimiento por correo electrónico y las instrucciones de devolución no son condiciones para un desistimiento válido. Dispones de al menos 14 días desde la entrega para notificarnos el desistimiento y de otros 14 días desde esa notificación para devolver los bienes. La falta de etiquetas o embalaje originales no elimina automáticamente este derecho. Cualquier deducción por pérdida de valor se limita a lo permitido por la ley por manipulaciones que vayan más allá del examen o la prueba como en una tienda.",
    "headings": [
      "Iniciar una devolución",
      "Estado de los artículos y prueba",
      "Devolución por correo",
      "Gastos de devolución",
      "Reembolsos",
      "Productos hechos a medida y personalizados",
      "Artículos defectuosos, dañados o incorrectos",
      "Tus derechos legales"
    ]
  }
};
export function returnPolicySummary(locale: Locale) {
  const p = RETURN_POLICIES[locale];
  return `${p.start} ${p.eligibility} ${p.tracked} ${BUSINESS_ADDRESS.join(", ")}. ${p.fees} ${p.refund} ${p.custom} ${p.faulty} ${p.rights}`;
}


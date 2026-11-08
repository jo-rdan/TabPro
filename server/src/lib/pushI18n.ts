// Notifications in each phone's language (the RW · EN · FR switch on that
// phone, saved with its push subscription). Messages are written in English;
// these patterns turn the ones waiters, managers, kitchen, cashiers and guests
// get into Kinyarwanda or French. Anything not matched goes out in English.
// The Kinyarwanda is a draft for Jordan to check.

export type PushLang = 'en' | 'rw' | 'fr';
type Rule = [RegExp, string];

const RW: Rule[] = [
  // Titles
  [/^💸 (.+) sent you a (.+) RWF tip$/, '💸 $1 bakwoherereje ishimwe rya $2 RWF'],
  [/^👀 Keep an eye on (.+)$/, '👀 Kurikirana $1'],
  [/^⏱ (.+) · (.+) · arrived yet\?$/, '⏱ $1 · $2 · yageze?'],
  [/^⚠️ (.+): MoMo didn't arrive$/, '⚠️ $1: MoMo ntiyageze'],
  [/^⚠️ (.+) now has 2 open bills$/, '⚠️ $1 ubu ifite fagitire 2 zifunguye'],
  [/^🪑 (.+): new guests seated$/, '🪑 $1: abakiriya bashya bicaye'],
  [/^👋 (.+) needs you$/, '👋 $1 irakwita'],
  [/^💳 (.+) is ready to pay$/, '💳 $1 bashaka kwishyura'],
  [/^📱 (.+) is paying by MoMo$/, '📱 $1 barishyura na MoMo'],
  [/^💰 (.+) says they paid by MoMo$/, '💰 $1 bavuga ko bishyuye na MoMo'],
  [/^New order — (.+)$/, 'Ibyatumijwe bishya — $1'],
  [/^🍽️ (.+): food is ready$/, '🍽️ $1: ibiryo byateguwe'],
  [/^⚠️ (.+): (.+) not available$/, '⚠️ $1: $2 ntibihari'],
  [/^⏰ (.+): order waiting (\d+) min$/, '⏰ $1: ibyatumijwe bimaze iminota $2 bitegereje'],
  [/^👨‍🍳 Your order is being prepared$/, '👨‍🍳 Ibyo watumije biri gutegurwa'],
  [/^🍽️ Your order has been served$/, '🍽️ Ibyo watumije byazanywe'],
  [/^Your food is ready 🍽️$/, 'Ibiryo byawe byateguwe 🍽️'],
  [/^Sorry, (.+) isn't available tonight$/, 'Mutubabarire, $1 ntibihari iri joro'],
  // Bodies
  [/^Straight to your MoMo\. Check it, and thank them!$/, 'Aje kuri MoMo yawe ako kanya. Reba, ubashimire!'],
  [/^They're paying (.+) RWF by MoMo, but it hasn't arrived yet\. Don't let them leave before it's confirmed\.$/, 'Barishyura $1 RWF na MoMo, ariko ntarageza. Ntubareke bagenda itaremezwa.'],
  [/^Reminder (\d) of 3\. Check your MoMo\.$/, 'Kwibutsa $1 kuri 3. Reba MoMo yawe.'],
  [/^(.+) RWF never reached the MoMo Pay\. Go to the table\.$/, '$1 RWF ntiyageze kuri MoMo Pay. Jya ku meza.'],
  [/^(.+) RWF, asked 3 times(.*)\. Open Skuzi to call the guest\.$/, '$1 RWF, twabajije inshuro 3$2. Fungura Skuzi uhamagare umukiriya.'],
  [/^A new phone started its own bill\. The other bill \((.+) RWF\) is still open: collect it or close it\.$/, 'Telefoni nshya yafunguye fagitire yayo. Indi fagitire ($1 RWF) iracyafunguye: yishyuze cyangwa uyifunge.'],
  [/^Go say hello\. They can order from their phone\.$/, 'Jya kubasuhuza. Bashobora gutumiza kuri telefoni zabo.'],
  [/^A guest would love a hand 👋$/, 'Umukiriya akeneye ubufasha 👋'],
  [/^Head over — the customer wants to settle up$/, 'Jyayo, umukiriya arashaka kwishyura'],
  [/^(.+) RWF should reach your MoMo Pay soon\. Check it, then tap Received\.$/, '$1 RWF iragera kuri MoMo Pay vuba. Reba, hanyuma ukande Yageze.'],
  [/^(.+) RWF to your MoMo Pay\. Check your MoMo, then tap Received\.$/, '$1 RWF kuri MoMo Pay yawe. Reba MoMo yawe, hanyuma ukande Yageze.'],
  [/^(.+)\. Pick it up at the kitchen\.$/, '$1. Bifate mu gikoni.'],
  [/^The kitchen took it off the bill\. Maybe suggest something else\.$/, 'Igikoni cyabikuye kuri fagitire. Wenda ubasabe ikindi.'],
  [/^Nobody has started it yet\. Mark it "preparing" once it is\.$/, 'Ntawe uratangira kubitegura. Kanda "Tangira gutegura" bitangiye.'],
  [/^(.+): it's on its way soon\.$/, '$1: biraza vuba.'],
  [/^Enjoy! Need anything else\? Order from your phone\.$/, 'Muryoherwe! Hari ikindi mukeneye? Mutumize kuri telefoni yanyu.'],
  [/^Your waiter is bringing it to you\.$/, 'Umuseriveri wawe ari kukizanira.'],
  [/^It's off your bill\. Your waiter can suggest something else\.$/, 'Byavanywe kuri fagitire yawe. Umuseriveri wawe arashobora kugusaba ikindi.'],
];

const FR: Rule[] = [
  [/^💸 (.+) sent you a (.+) RWF tip$/, '💸 $1 vous a envoyé un pourboire de $2 RWF'],
  [/^👀 Keep an eye on (.+)$/, '👀 Surveillez $1'],
  [/^⏱ (.+) · (.+) · arrived yet\?$/, '⏱ $1 · $2 · reçu ?'],
  [/^⚠️ (.+): MoMo didn't arrive$/, '⚠️ $1 : MoMo pas reçu'],
  [/^⚠️ (.+) now has 2 open bills$/, '⚠️ $1 a maintenant 2 additions ouvertes'],
  [/^🪑 (.+): new guests seated$/, '🪑 $1 : nouveaux clients installés'],
  [/^👋 (.+) needs you$/, '👋 $1 vous appelle'],
  [/^💳 (.+) is ready to pay$/, '💳 $1 veut payer'],
  [/^📱 (.+) is paying by MoMo$/, '📱 $1 paie par MoMo'],
  [/^💰 (.+) says they paid by MoMo$/, '💰 $1 dit avoir payé par MoMo'],
  [/^New order — (.+)$/, 'Nouvelle commande — $1'],
  [/^🍽️ (.+): food is ready$/, '🍽️ $1 : les plats sont prêts'],
  [/^⚠️ (.+): (.+) not available$/, '⚠️ $1 : $2 indisponible'],
  [/^⏰ (.+): order waiting (\d+) min$/, '⏰ $1 : commande en attente depuis $2 min'],
  [/^👨‍🍳 Your order is being prepared$/, '👨‍🍳 Votre commande est en préparation'],
  [/^🍽️ Your order has been served$/, '🍽️ Votre commande est servie'],
  [/^Your food is ready 🍽️$/, 'Vos plats sont prêts 🍽️'],
  [/^Sorry, (.+) isn't available tonight$/, "Désolé, $1 n'est pas disponible ce soir"],
  [/^Straight to your MoMo\. Check it, and thank them!$/, 'Directement sur votre MoMo. Vérifiez, et remerciez-les !'],
  [/^They're paying (.+) RWF by MoMo, but it hasn't arrived yet\. Don't let them leave before it's confirmed\.$/, "Ils paient $1 RWF par MoMo, mais ce n'est pas encore arrivé. Ne les laissez pas partir avant la confirmation."],
  [/^Reminder (\d) of 3\. Check your MoMo\.$/, 'Rappel $1 sur 3. Vérifiez votre MoMo.'],
  [/^(.+) RWF never reached the MoMo Pay\. Go to the table\.$/, "$1 RWF ne sont jamais arrivés sur le MoMo Pay. Allez à la table."],
  [/^(.+) RWF, asked 3 times(.*)\. Open Skuzi to call the guest\.$/, '$1 RWF, demandé 3 fois$2. Ouvrez Skuzi pour appeler le client.'],
  [/^A new phone started its own bill\. The other bill \((.+) RWF\) is still open: collect it or close it\.$/, "Un nouveau téléphone a ouvert sa propre addition. L'autre ($1 RWF) est toujours ouverte : encaissez-la ou fermez-la."],
  [/^Go say hello\. They can order from their phone\.$/, 'Allez les saluer. Ils peuvent commander depuis leur téléphone.'],
  [/^A guest would love a hand 👋$/, "Un client a besoin d'aide 👋"],
  [/^Head over — the customer wants to settle up$/, 'Allez-y, le client veut payer'],
  [/^(.+) RWF should reach your MoMo Pay soon\. Check it, then tap Received\.$/, '$1 RWF vont arriver sur votre MoMo Pay. Vérifiez, puis touchez Reçu.'],
  [/^(.+) RWF to your MoMo Pay\. Check your MoMo, then tap Received\.$/, '$1 RWF sur votre MoMo Pay. Vérifiez votre MoMo, puis touchez Reçu.'],
  [/^(.+)\. Pick it up at the kitchen\.$/, '$1. À récupérer en cuisine.'],
  [/^The kitchen took it off the bill\. Maybe suggest something else\.$/, "La cuisine l'a retiré de l'addition. Proposez autre chose."],
  [/^Nobody has started it yet\. Mark it "preparing" once it is\.$/, "Personne ne l'a encore commencée. Touchez « Commencer » dès que c'est le cas."],
  [/^(.+): it's on its way soon\.$/, '$1 : ça arrive bientôt.'],
  [/^Enjoy! Need anything else\? Order from your phone\.$/, "Bon appétit ! Autre chose ? Commandez depuis votre téléphone."],
  [/^Your waiter is bringing it to you\.$/, 'Votre serveur vous les apporte.'],
  [/^It's off your bill\. Your waiter can suggest something else\.$/, "C'est retiré de votre addition. Votre serveur peut vous proposer autre chose."],
];

const RULES: Record<Exclude<PushLang, 'en'>, Rule[]> = { rw: RW, fr: FR };
// "… (Grace's table)": added when a manager covers a waiter without a phone.
const COVERING = /^(.*) \((.+)'s table\)$/s;
const COVERING_OUT: Record<Exclude<PushLang, 'en'>, string> = { rw: ' (ameza ya $NAME)', fr: ' (table de $NAME)' };

export function pushLang(v: string | null | undefined): PushLang {
  return v === 'rw' || v === 'fr' ? v : 'en';
}

export function translatePush(text: string, lang: PushLang): string {
  if (lang === 'en' || !text) return text;
  const cover = COVERING.exec(text);
  if (cover) return translatePush(cover[1], lang) + COVERING_OUT[lang].replace('$NAME', cover[2]);
  for (const [re, out] of RULES[lang]) {
    if (re.test(text)) return text.replace(re, out);
  }
  return text;
}

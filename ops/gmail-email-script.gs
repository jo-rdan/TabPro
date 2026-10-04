// TabPro → your Gmail. Paste this into script.google.com (see ops notes).
// Sends demo-request emails to the Google account that owns this script.
const SECRET = 'PASTE_THE_SECRET_HERE';

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  if (data.secret !== SECRET) return ContentService.createTextOutput('forbidden');
  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: data.subject,
    body: data.text,
    htmlBody: data.html,
    name: 'TabPro',
  });
  return ContentService.createTextOutput('ok');
}

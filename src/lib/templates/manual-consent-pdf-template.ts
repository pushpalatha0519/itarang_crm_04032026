type ManualConsentPdfTemplateInput = {
  customerName: string;
  date: string;
  organisationName: string;
  logoDataUrl?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildManualConsentPdfHtml({
  customerName,
  date,
  organisationName,
  logoDataUrl,
}: ManualConsentPdfTemplateInput) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Consent Form For Data Processing</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: "Times New Roman", Times, serif;
        margin: 0;
        color: #111111;
        background: #ffffff;
        font-size: 16px;
        line-height: 1.35;
      }
      .container {
        width: 820px;
        margin: 0 auto;
        padding: 48px 56px;
      }
      .center {
        text-align: center;
      }
      .logo-wrap {
        text-align: center;
        margin-bottom: 14px;
      }
      .logo {
        max-width: 420px;
        width: 100%;
        height: auto;
        object-fit: contain;
      }
      .title {
        margin: 6px 0 24px;
        font-size: 36px;
        font-weight: 700;
        letter-spacing: 0.3px;
      }
      p {
        margin: 0 0 16px;
      }
      .line {
        margin: 0 0 24px;
      }
      .section {
        margin-top: 34px;
      }
      h2 {
        font-size: 38px;
        font-weight: 700;
        margin: 0 0 16px;
      }
      ul, ol {
        margin: 0 0 16px 34px;
      }
      li {
        margin-bottom: 6px;
      }
      hr {
        border: 0;
        border-top: 1px solid #d9d9d9;
        margin: 26px 0;
      }
      .bold {
        font-weight: 700;
      }
      .sig-line {
        display: block;
        width: 320px;
        border-bottom: 1px solid #555;
        height: 1.3em;
      }
      .page-break {
        page-break-before: always;
      }
    </style>
  </head>
  <body>
    <main class="container">
      <div class="logo-wrap">
        ${logoDataUrl
      ? `<img class="logo" src="${logoDataUrl}" alt="iTarang Logo" />`
      : `<p class="center">iTarang</p>`}
      </div>
      <p class="center title">CONSENT FORM FOR DATA PROCESSING</p>

      <p><span class="bold">Date:</span> ${escapeHtml(date)}</p>
      <p><span class="bold">Subject:</span> Consent for Processing of Personal Data</p>
      <p>Dear ${escapeHtml(customerName)},</p>
      <p>
        This consent form is issued to inform you of the purposes for which your personal data will be
        processed and to obtain your explicit consent for the same, in compliance with the Digital
        Personal Data Protection Act, 2023 ("DPDPA") and the Digital Personal Data Protection Rules, 2023
        ("DPDP Rules").
      </p>
      <hr />

      <section class="section">
        <h2>1. INFORMATION WE WILL COLLECT</h2>
        <p>We may collect and process the following categories of personal data:</p>
        <ul>
          <li><span class="bold">Basic Information:</span> Name, Contact Information, Address, Date of Birth.</li>
          <li><span class="bold">Sensitive Personal Data (if applicable):</span> Financial Details, Health Information, Biometric Data, etc.</li>
        </ul>
      </section>

      <section class="section">
        <h2>2. PURPOSE OF PROCESSING</h2>
        <p>Your personal data will be processed for the following purposes:</p>
        <ol>
          <li><span class="bold">Service Provision:</span> To provide the services or products you have requested.</li>
          <li><span class="bold">Legal Compliance:</span> To comply with applicable laws and regulatory requirements.</li>
          <li><span class="bold">Marketing Communications:</span> To send you marketing materials, but only with your explicit consent.</li>
          <li><span class="bold">Data Analytics:</span> For improving our services, products, and user experience.</li>
        </ol>
      </section>

      <section class="section">
        <h2>3. LEGAL BASIS FOR PROCESSING</h2>
        <p>
          The legal basis for processing your personal data is your explicit consent as provided under
          Section 7 of the DPDPA and other applicable provisions of the DPDP Rules.
        </p>
      </section>
    </main>

    <main class="container page-break">
      <section class="section">
        <h2>4. RIGHTS AVAILABLE TO YOU</h2>
        <p>Under the DPDPA, you have the following rights:</p>
        <ul>
          <li><span class="bold">Right to Access:</span> Obtain access to your data.</li>
          <li><span class="bold">Right to Rectification:</span> Request corrections to any inaccuracies in your data.</li>
          <li><span class="bold">Right to Erasure:</span> Request deletion of your personal data.</li>
          <li><span class="bold">Right to Restriction:</span> Restrict or object to certain types of data processing.</li>
          <li><span class="bold">Right to Data Portability:</span> Request transfer of your personal data to another entity.</li>
          <li><span class="bold">Right to Withdraw Consent:</span> Withdraw your consent at any time, without affecting the lawfulness of processing based on consent before its withdrawal.</li>
          <li><span class="bold">Right to Nominate:</span> Can nominate someone to exercise their rights on their behalf if they are unable to do so.</li>
        </ul>

        <p>To exercise these rights, you may contact us at:</p>
        <ul>
          <li><span class="bold">Email:</span> support@itarang.in</li>
          <li><span class="bold">Phone:</span> +91-XXXXXXXXXX</li>
          <li><span class="bold">Address:</span> ${escapeHtml(organisationName)}</li>
        </ul>
      </section>

      <hr />

      <section class="section">
        <h2>5. CONSENT DECLARATION</h2>
        <p>
          By signing below, you confirm that you have read and understood the terms of this consent form
          and voluntarily agree to the processing of your personal data as described herein.
        </p>
        <p>
          I hereby give my explicit consent to ${escapeHtml(organisationName)} for the processing of my
          personal data for the purposes mentioned above.
        </p>
        <p class="line">Signature: <span class="sig-line"></span></p>
        <p class="line">Name: <span class="sig-line">${escapeHtml(customerName)}</span></p>
        <p class="line">Date: <span class="sig-line">${escapeHtml(date)}</span></p>
      </section>

      <section class="section">
        <h2>6. CONTACT INFORMATION</h2>
        <p>
          If you have any questions or concerns regarding this consent form or our data processing
          practices, please contact our Data Protection Officer (DPO):
        </p>
        <ul>
          <li><span class="bold">Name:</span> DPO, ${escapeHtml(organisationName)}</li>
          <li><span class="bold">Email:</span> dpo@itarang.in</li>
          <li><span class="bold">Phone:</span> +91-XXXXXXXXXX</li>
        </ul>
      </section>
    </main>
  </body>
</html>`;
}

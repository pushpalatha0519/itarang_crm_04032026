const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("=== Enter Decentro Credentials ===");

rl.question("DECENTRO_CLIENT_ID: ", (clientId) => {
  rl.question("DECENTRO_CLIENT_SECRET: ", (clientSecret) => {
    rl.question("DECENTRO_MODULE_SECRET_KYC: ", (moduleSecretKYC) => {
      rl.question("DECENTRO_MODULE_SECRET_BANKING: ", (moduleSecretBanking) => {
        rl.question("DECENTRO_BASE_URL (default https://in.staging.decentro.tech): ", (baseUrl) => {

          const DECENTRO_BASE_URL = baseUrl || "https://in.staging.decentro.tech";

          console.log("\n✅ Credentials captured successfully!\n");
          console.log("KYC Module Secret:", moduleSecretKYC);
          console.log("Banking Module Secret:", moduleSecretBanking);
          console.log("Base URL:", DECENTRO_BASE_URL);

          // Create .env entries
          const envEntries = [
            `DECENTRO_CLIENT_ID=${clientId}`,
            `DECENTRO_CLIENT_SECRET=${clientSecret}`,
            `DECENTRO_MODULE_SECRET_KYC=${moduleSecretKYC}`,
            `DECENTRO_MODULE_SECRET_BANKING=${moduleSecretBanking}`,
            `DECENTRO_BASE_URL=${DECENTRO_BASE_URL}`
          ].join('\n');

          console.log("\n📝 Add these to your .env.local file:");
          console.log("=====================================");
          console.log(envEntries);
          console.log("=====================================");

          rl.close();
        });
      });
    });
  });
});
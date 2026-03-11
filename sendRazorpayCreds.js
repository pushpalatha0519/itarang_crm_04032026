const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("=== Razorpay Credentials Sender ===");

// Step 1: Ask agent for their name or identifier
rl.question("Enter Agent Name: ", (agentName) => {

  // Step 2: Ask for Key ID
  rl.question("Enter Razorpay Key ID: ", (key_id) => {

    // Step 3: Ask for Key Secret
    rl.question("Enter Razorpay Key Secret: ", (key_secret) => {

      // Step 4: Display / Send the credentials
      console.log("\n✅ Razorpay Credentials ready to share with the agent!\n");
      console.log(`Agent: ${agentName}`);
      console.log(`Key ID: ${key_id}`);
      console.log(`Key Secret: ${key_secret}`);
      console.log("\n⚠️ Make sure the agent keeps these credentials secure!");

      rl.close();
    });

  });

});
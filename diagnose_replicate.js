const Replicate = require("replicate");
const fs = require("fs");
const path = require("path");

// Clean parsing
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach(line => {
    let [key, value] = line.split("=");
    if (key && value) {
      // Strip comments and quotes
      value = value.split("#")[0].trim().replace(/['"]/g, "");
      process.env[key.trim()] = value;
    }
  });
}

console.log("Using token:", process.env.REPLICATE_API_TOKEN ? (process.env.REPLICATE_API_TOKEN.substring(0, 5) + "...") : "MISSING");

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function testVision(model) {
  console.log(`Testing model: ${model}`);
  try {
    const output = await replicate.run(
      model,
      {
        input: {
          image: "https://replicate.delivery/pbxt/IJpwf9icYvO2zDM3XbT7U0X0jS1vL7jZ0Y9H1Z2jYv0/view.jpg",
          prompt: "Return a JSON object with { \"test\": \"ok\" }",
        }
      }
    );
    console.log(`Success with ${model}`);
    return true;
  } catch (err) {
    console.error(`Failed ${model}:`, err.message);
    return false;
  }
}

async function main() {
  const models = [
    "lucataco/moondream2:a91fbc52504222014022c4d9bc26362d2a4501a6b0c2a2123ef15ed62580a80e",
    "yorickvp/llava-v1.6-mistral-7b:0603dec596000036133f1c86f0ec7aef1533ebe1582c3c6ca6c934d7fa319807"
  ];

  for (const model of models) {
    await testVision(model);
  }
}

main();

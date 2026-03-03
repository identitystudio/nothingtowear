const Replicate = require("replicate");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach(line => {
    let [key, value] = line.split("=");
    if (key && value) {
      value = value.trim().replace(/['"]/g, "");
      process.env[key.trim()] = value;
    }
  });
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function test(model) {
  console.log(`Testing: ${model}`);
  try {
    const output = await replicate.run(model, {
       input: {
         image: "https://replicate.delivery/pbxt/IJpwf9icYvO2zDM3XbT7U0X0jS1vL7jZ0Y9H1Z2jYv0/view.jpg",
         prompt: "What is this?"
       }
    });
    console.log("SUCCESS!");
    return true;
  } catch (err) {
    console.error("FAIL:", err.message);
    return false;
  }
}

async function main() {
  // Try LLaVA v1.6 (Official Replicate Hub version)
  await test("yorickvp/llava-v1.6-mistral-7b:0603dec596000036133f1c86f0ec7aef1533ebe1582c3c6ca6c934d7fa319807");
}

main();

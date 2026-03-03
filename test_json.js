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

async function test(model, prompt) {
  console.log(`\nTesting: ${model}`);
  try {
    const output = await replicate.run(model, {
       input: {
         image: "https://replicate.delivery/pbxt/IJpwf9icYvO2zDM3XbT7U0X0jS1vL7jZ0Y9H1Z2jYv0/view.jpg",
         prompt: prompt
       }
    });
    const res = Array.isArray(output) ? output.join("") : output;
    console.log("RESPONSE:", res);
    return res;
  } catch (err) {
    console.error("FAIL:", err.message);
    return null;
  }
}

async function main() {
  const jsonPrompt = "Analyze this clothing and return ONLY a JSON object with keys: type, color, style, description. No other text.";
  
  // Try different models for JSON obedience
  await test("lucataco/moondream2:72ccb656353c348c1385df54b237eeb7bfa874bf11486cf0b9473e691b662d31", jsonPrompt);
  
  // Try LLaVA 1.5 (more likely to be public/permitted)
  await test("yorickvp/llava-13b:b5f6212d032508382d61ff5c6e51ea369a770af273520f00ade9aa84da748f94", jsonPrompt);
}

main();

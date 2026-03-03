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

async function main() {
  const models = ["lucataco/moondream2", "yorickvp/llava-v1.6-mistral-7b"];
  
  for (const modelName of models) {
    console.log(`\n--- Testing ${modelName} ---`);
    try {
      const [owner, name] = modelName.split("/");
      const model = await replicate.models.get(owner, name);
      const latestVersion = model.latest_version.id;
      console.log(`Latest version: ${latestVersion}`);
      
      console.log("Running trial...");
      const output = await replicate.run(`${modelName}:${latestVersion}`, {
        input: {
          image: "https://replicate.delivery/pbxt/IJpwf9icYvO2zDM3XbT7U0X0jS1vL7jZ0Y9H1Z2jYv0/view.jpg",
          prompt: "What is this?"
        }
      });
      console.log("SUCCESS!");
      console.log("Output:", JSON.stringify(output).substring(0, 100));
    } catch (err) {
      console.error("FAILED:", err.message);
    }
  }
}

main();

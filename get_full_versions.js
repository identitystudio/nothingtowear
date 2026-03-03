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
  const results = {};
  
  for (const m of models) {
     try {
       const [owner, name] = m.split("/");
       const model = await replicate.models.get(owner, name);
       results[m] = model.latest_version.id;
     } catch (e) {
       results[m] = "ERROR: " + e.message;
     }
  }
  
  fs.writeFileSync("versions_full.json", JSON.stringify(results, null, 2));
  console.log("Full versions written to versions_full.json");
}

main();

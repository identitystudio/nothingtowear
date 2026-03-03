const Replicate = require("replicate");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach(line => {
    let [key, value] = line.split("=");
    if (key && value) {
      value = value.split("#")[0].trim().replace(/['"]/g, "");
      process.env[key.trim()] = value;
    }
  });
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function findVersion(modelName) {
  console.log(`Finding version for: ${modelName}`);
  try {
    const model = await replicate.models.get(modelName.split("/")[0], modelName.split("/")[1]);
    console.log(`Latest version for ${modelName}:`, model.latest_version.id);
    return model.latest_version.id;
  } catch (err) {
    console.error(`Error finding version for ${modelName}:`, err.message);
    return null;
  }
}

async function main() {
  const models = [
    "lucataco/moondream2",
    "yorickvp/llava-v1.6-mistral-7b"
  ];

  for (const model of models) {
    const version = await findVersion(model);
    if (version) {
      console.log(`Suggested call: replicate.run("${model}:${version}", ...);`);
    }
  }
}

main();

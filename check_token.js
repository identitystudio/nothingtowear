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
  console.log("Using token:", process.env.REPLICATE_API_TOKEN.substring(0, 5) + "...");
  
  try {
    console.log("Listing models...");
    const predictions = await replicate.predictions.list();
    console.log("Successfully listed predictions. Count:", predictions.results.length);
    
    // If we can list predictions, the token is valid.
    // Now try a guaranteed featured model.
    console.log("Testing replicate/vicuna-13b (Text only test)...");
    const output = await replicate.run("replicate/vicuna-13b:6282926a458ae0ffc38466642d99723ecdbf476295ea5f6e80b674828164f9f3", {
      input: { prompt: "Say hello" }
    });
    console.log("Vicuna Output:", output);
    
  } catch (err) {
    console.error("FAIL:", err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", JSON.stringify(err.response.data));
    }
  }
}

main();

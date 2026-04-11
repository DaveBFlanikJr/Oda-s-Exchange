const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Scraper environment looks valid.");

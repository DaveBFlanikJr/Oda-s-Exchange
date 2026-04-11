const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
  console.error("This project is locked to pnpm. Please run commands with pnpm only.");
  process.exit(1);
}

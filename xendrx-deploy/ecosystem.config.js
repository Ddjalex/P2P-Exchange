// PM2 process manager configuration
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 save            (persist across reboots)
//   pm2 startup         (auto-start on server boot)
//   pm2 logs xendrx-api (view logs)
//   pm2 restart xendrx-api

module.exports = {
  apps: [
    {
      name: "xendrx-api",
      script: "./api/dist/index.mjs",
      cwd: __dirname,

      // Load environment variables from .env
      env_file: ".env",

      // Keep alive — restart on crash
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",

      // Logging
      out_file: "./logs/api-out.log",
      error_file: "./logs/api-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};

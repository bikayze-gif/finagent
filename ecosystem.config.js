module.exports = {
  apps: [
    {
      name: "finagent-api",
      script: "server/dist/index.js",
      cwd: "/var/www/finagent",
      env: {
        NODE_ENV: "production",
        PORT: 5010,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "256M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};

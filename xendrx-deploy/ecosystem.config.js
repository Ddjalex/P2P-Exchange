module.exports = {
  apps: [{
    name: 'xendrx-api',
    script: './backend/index.mjs',
    cwd: '/var/www/xendrx',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    error_file: '/var/log/xendrx/error.log',
    out_file: '/var/log/xendrx/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};

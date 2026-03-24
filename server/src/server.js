const { getEnv } = require('./config/env');
const { createApplication } = require('./app');

async function start() {
  const { server } = await createApplication();
  const port = Number(getEnv('PORT', process.env.PORT || 3001));

  server.listen(port, '0.0.0.0', () => {
    console.log(`IND Blades API listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start IND Blades API:', error);
  process.exit(1);
});

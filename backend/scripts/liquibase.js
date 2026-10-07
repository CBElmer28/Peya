const { spawn } = require('node:child_process');
const path = require('node:path');

const liquibasePackagePath = require.resolve('liquibase/package.json');
const liquibaseDirectory = path.dirname(liquibasePackagePath);
const liquibaseHome = path.join(liquibaseDirectory, 'dist', 'liquibase');
const javaExecutable = process.env.JAVA_HOME
  ? path.join(process.env.JAVA_HOME.replace(/^"(.*)"$/, '$1'), 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
  : 'java';

const liquibase = spawn(javaExecutable, [
  '-jar',
  path.join(liquibaseHome, 'internal', 'lib', 'liquibase-core.jar'),
  ...process.argv.slice(2),
], {
  env: {
    ...process.env,
    LIQUIBASE_HOME: liquibaseHome,
  },
  stdio: 'inherit',
});

liquibase.on('error', (error) => {
  console.error(`Failed to start Liquibase: ${error.message}`);
  process.exitCode = 1;
});

liquibase.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

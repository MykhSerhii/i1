const esbuild = require('esbuild');
const path = require('path');

const watch = process.argv.includes('--watch');

const srcDir = path.join(__dirname, '..', 'src');

const appConfig = {
  entryPoints: [path.join(srcDir, 'app.js')],
  outfile: path.join(srcDir, 'bundle.js'),
  bundle: true,
  sourcemap: true,
  target: 'chrome120',
  format: 'iife',
  platform: 'browser',
  define: {
    'process.env.NODE_ENV': '"production"'
  }
};

const workerConfig = {
  entryPoints: [path.join(srcDir, 'worker.js')],
  outfile: path.join(srcDir, 'worker-bundle.js'),
  bundle: true,
  sourcemap: true,
  target: 'chrome120',
  format: 'iife',
  platform: 'browser',
  define: {
    'process.env.NODE_ENV': '"production"'
  }
};

async function build() {
  if (watch) {
    const appCtx = await esbuild.context(appConfig);
    const workerCtx = await esbuild.context(workerConfig);
    await appCtx.watch();
    await workerCtx.watch();
    console.log('Watching for changes...');
  } else {
    await Promise.all([
      esbuild.build(appConfig),
      esbuild.build(workerConfig)
    ]);
    console.log('Build complete.');
  }
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
